import * as PIXI from 'pixi.js-legacy'
import {
  TimeGraphAnnotationComponent,
  TimeGraphAnnotationStyle
} from '../components/time-graph-annotation'
import { TimeGraphComponent } from '../components/time-graph-component'
import { TimeGraphRectangle } from '../components/time-graph-rectangle'
import { TimeGraphRow, TimeGraphRowStyle } from '../components/time-graph-row'
import { TimeGraphStateComponent, TimeGraphStateStyle } from '../components/time-graph-state'
import { TimelineChart } from '../time-graph-model'
import { TimeGraphRowController } from '../time-graph-row-controller'
import { TimeGraphChartLayer } from './time-graph-chart-layer'
import { BIMath } from '../bigint-utils'
import { debounce, cloneDeep, DebouncedFunc, isEqual } from 'lodash'

export interface TimeGraphMouseInteractions {
  click?: (el: TimeGraphComponent<any>, ev: PIXI.InteractionEvent, clickCount: number) => void
  mouseover?: (el: TimeGraphComponent<any>, ev: PIXI.InteractionEvent) => void
  mouseout?: (el: TimeGraphComponent<any>, ev: PIXI.InteractionEvent) => void
  mousedown?: (el: TimeGraphComponent<any>, ev: PIXI.InteractionEvent) => void
  mouseup?: (el: TimeGraphComponent<any>, ev: PIXI.InteractionEvent) => void
}

export interface TimeGraphChartProviders {
  rowProvider: () => { rowIds: number[] }
  dataProvider: (
    range: TimelineChart.TimeGraphRange,
    resolution: number,
    fetchArrows: boolean,
    rowIds?: number[],
    additionalProperties?: { [key: string]: any }
  ) =>
    | Promise<{
        rows: TimelineChart.TimeGraphRowModel[]
        range: TimelineChart.TimeGraphRange
        resolution: number
      }>
    | {
        rows: TimelineChart.TimeGraphRowModel[]
        range: TimelineChart.TimeGraphRange
        resolution: number
      }
    | undefined
  stateStyleProvider?: (el: TimelineChart.TimeGraphState) => TimeGraphStateStyle | undefined
  rowAnnotationStyleProvider?: (
    el: TimelineChart.TimeGraphAnnotation
  ) => TimeGraphAnnotationStyle | undefined
  rowStyleProvider?: (row?: TimelineChart.TimeGraphRowModel) => TimeGraphRowStyle | undefined
}

export const keyBoardNavs: Record<string, Array<string>> = {
  zoomin: ['w', 'i'],
  zoomout: ['s', 'k'],
  panleft: ['a', 'j'],
  panright: ['d', 'l']
}

export type TimeGraphRowStyleHook = (
  row: TimelineChart.TimeGraphRowModel
) => TimeGraphRowStyle | undefined

const VISIBLE_ROW_BUFFER = 3 // number of buffer rows above and below visible range
const FINE_RESOLUTION_FACTOR = 1 // fine resolution factor or default to disable coarse update
const EXCLUDED = 4 // EXCLUDED filter expression property key

export class TimeGraphChart extends TimeGraphChartLayer {
  protected rowIds: number[] = [] // complete ordered list of rowIds
  protected rowComponents: Map<number, TimeGraphRow> = new Map() // map of rowId to row component
  protected mouseInteractions: TimeGraphMouseInteractions = {}
  protected selectedStateModel: TimelineChart.TimeGraphState | undefined
  protected selectedStateChangedHandler: ((
    el: TimelineChart.TimeGraphState | undefined
  ) => void)[] = []
  protected ongoingRequest:
    | {
        worldRange: TimelineChart.TimeGraphRange
        resolution: number
        rowIds: number[]
        additionalParams: {
          [key: string]: any
        }
        fullSearch?: boolean
      }
    | undefined

  protected isNavigating: boolean

  protected mousePanning: boolean = false
  protected mouseZooming: boolean = false
  protected mouseButtons: number = 0
  protected mouseDownButton: number = 0
  protected mouseStartX: number = 0
  protected mouseEndX: number = 0
  protected mousePanningStart: bigint = BigInt(0)
  protected mouseZoomingStart: bigint = BigInt(0)
  protected zoomingSelection?: TimeGraphRectangle

  private _stageMouseDownHandler: Function = () => {}
  private _stageMouseMoveHandler: Function = () => {}
  private _stageMouseUpHandler: Function = () => {}

  private _viewRangeChangedHandler: () => void = () => {}
  private _zoomRangeChangedHandler: (zoomFactor: number) => void = () => {}
  private _scaleFactorChangedHandler: (scaleFactor: number) => void = () => {}
  private _mouseMoveHandler: EventListener = () => {}
  private _mouseDownHandler: EventListener = () => {}
  private _keyDownHandler: EventListener = () => {}
  private _keyUpHandler: EventListener = () => {}
  private _mouseWheelHandler: EventListener = () => {}
  private _contextMenuHandler: EventListener = () => {}
  private _filterExpressionsMap: { [key: number]: string[] } | undefined = undefined
  private _allRowIds: number[] = [] // full ordered list of row ids including excluded rows
  private _excludedRows: Map<number, TimelineChart.TimeGraphRange> = new Map() // known excluded rows after filtering

  private _debouncedMaybeFetchNewData = debounce(() => this.maybeFetchNewData(false), 400)
  private _debouncedMaybeFetchNewDataFine = debounce(() => this.maybeFetchNewData(false, true), 400)
  private _debouncedMaybeFetchNewDataFineFullSearch = debounce(
    () => this.maybeFetchNewData(false, true, true),
    400
  )

  private _fetchingRows = false
  private _pendingFetch:
    | { update: boolean | undefined; fine: boolean | undefined; fullSearch: boolean | undefined }
    | undefined = undefined

  // Keep track of the most recently clicked point.
  // If clicked again during _multiClickTime duration (milliseconds) record multi-click
  private _recentlyClickedGlobal: PIXI.Point | null = null
  private _multiClickTime: number = 500
  private _mouseClicks = 0
  private _multiClickTimer: DebouncedFunc<() => void> = debounce(() => {}, 0)

  constructor(
    id: string,
    protected providers: TimeGraphChartProviders,
    protected rowController: TimeGraphRowController,
    private _coarseResolutionFactor = FINE_RESOLUTION_FACTOR
  ) {
    super(id, rowController)
    this.isNavigating = false
  }

  adjustZoom(zoomPosition: number | undefined, hasZoomedIn: boolean) {
    if (this.unitController.viewRangeLength <= 0) {
      return
    }
    if (zoomPosition === undefined) {
      const start = this.getWorldPixel(
        this.unitController.selectionRange ? this.unitController.selectionRange.start : BigInt(0)
      )
      const end = this.getWorldPixel(
        this.unitController.selectionRange
          ? this.unitController.selectionRange.end
          : this.stateController.worldRangeLength
      )
      zoomPosition = (start + end) / 2
    }
    const zoomTime = zoomPosition / this.stateController.zoomFactor
    const zoomMagnitude = hasZoomedIn ? 0.8 : 1.25
    const newViewRangeLength = BIMath.clamp(
      Number(this.unitController.viewRangeLength) * zoomMagnitude,
      BigInt(2),
      this.unitController.absoluteRange
    )
    const center = this.unitController.viewRange.start + BIMath.round(zoomTime)
    const start = BIMath.clamp(
      Number(center) -
        (zoomTime * Number(newViewRangeLength)) / Number(this.unitController.viewRangeLength),
      BigInt(0),
      this.unitController.absoluteRange - newViewRangeLength
    )
    const end = start + newViewRangeLength
    if (start !== end) {
      this.unitController.viewRange = {
        start,
        end
      }
    }
  }

  protected afterAddToContainer() {
    this.stage.cursor = 'default'
    let mousePositionX = 1
    const horizontalDelta = 3
    let triggerKeyEvent = false

    const moveHorizontally = (magnitude: number) => {
      if (magnitude === 0) {
        return
      }
      // move by at least one nanosecond
      const absOffset = BIMath.max(1, Math.abs(magnitude / this.stateController.zoomFactor))
      const timeOffset = magnitude > 0 ? absOffset : -absOffset
      const start = BIMath.clamp(
        this.unitController.viewRange.start + timeOffset,
        BigInt(0),
        this.unitController.absoluteRange - this.unitController.viewRangeLength
      )
      const end = start + this.unitController.viewRangeLength
      this.unitController.viewRange = {
        start,
        end
      }
    }

    const panHorizontally = (magnitude: number) => {
      const timeOffset = BIMath.round(magnitude / this.stateController.zoomFactor)
      const start = BIMath.clamp(
        this.mousePanningStart - timeOffset,
        BigInt(0),
        this.unitController.absoluteRange - this.unitController.viewRangeLength
      )
      const end = start + this.unitController.viewRangeLength
      this.unitController.viewRange = {
        start,
        end
      }
    }

    const moveVertically = (magnitude: number) => {
      const totalHeight =
        this.rowController.totalHeight - this.rowController.rowHeight * this._excludedRows.size
      if (totalHeight <= this.stateController.canvasDisplayHeight) {
        return
      }
      let verticalOffset = Math.max(0, this.rowController.verticalOffset + magnitude)
      if (totalHeight - verticalOffset <= this.stateController.canvasDisplayHeight) {
        verticalOffset = totalHeight - this.stateController.canvasDisplayHeight
      }
      this.rowController.verticalOffset = verticalOffset
    }

    this._mouseMoveHandler = (event: Event) => {
      const ev = event as MouseEvent
      mousePositionX = ev.offsetX
    }

    this._keyDownHandler = (event: Event) => {
      const keyEvent = event as KeyboardEvent
      const keyPressed = keyEvent.key
      if (triggerKeyEvent) {
        if (
          keyPressed === 'Control' &&
          this.mouseButtons === 0 &&
          !keyEvent.shiftKey &&
          !keyEvent.altKey
        ) {
          this.stage.cursor = 'grabbing'
        } else if (
          this.stage.cursor === 'grabbing' &&
          !this.mousePanning &&
          (keyPressed === 'Shift' || keyPressed === 'Alt')
        ) {
          this.stage.cursor = 'default'
        }
        if (keyBoardNavs['zoomin'].indexOf(keyPressed) >= 0) {
          this.adjustZoom(mousePositionX, true)
        } else if (keyBoardNavs['zoomout'].indexOf(keyPressed) >= 0) {
          this.adjustZoom(mousePositionX, false)
        } else if (keyBoardNavs['panleft'].indexOf(keyPressed) >= 0) {
          moveHorizontally(-horizontalDelta)
        } else if (keyBoardNavs['panright'].indexOf(keyPressed) >= 0) {
          moveHorizontally(horizontalDelta)
        } else if (keyPressed === 'ArrowUp') {
          this.navigateUp()
        } else if (keyPressed === 'ArrowDown') {
          this.navigateDown()
        }
        keyEvent.preventDefault()
      }
      if (keyPressed === 'Escape' && this.mouseZooming) {
        this.mouseZooming = false
        this.stage.cursor = 'default'
        this.updateZoomingSelection()
      }
    }
    this._keyUpHandler = (event: Event) => {
      const keyEvent = event as KeyboardEvent
      const keyPressed = keyEvent.key
      if (triggerKeyEvent) {
        if (this.stage.cursor === 'grabbing' && !this.mousePanning && keyPressed === 'Control') {
          this.stage.cursor = 'default'
        }
      }
    }

    this.stage.addListener('mouseover', (event: MouseEvent) => {
      triggerKeyEvent = true
    })

    this.stage.addListener('mouseout', (event: MouseEvent) => {
      triggerKeyEvent = false
      if (this.stage.cursor === 'grabbing' && !this.mousePanning) {
        this.stage.cursor = 'default'
      }
    })

    this._stageMouseDownHandler = (event: PIXI.InteractionEvent) => {
      this.mouseButtons = event.data.buttons
      // if only middle button or only Ctrl+left button is pressed
      if (
        (event.data.button !== 1 || event.data.buttons !== 4) &&
        (event.data.button !== 0 ||
          event.data.buttons !== 1 ||
          !event.data.originalEvent.ctrlKey ||
          event.data.originalEvent.shiftKey ||
          event.data.originalEvent.altKey ||
          this.stage.cursor !== 'grabbing')
      ) {
        return
      }
      this.mousePanning = true
      this.mouseDownButton = event.data.button
      this.mouseStartX = event.data.global.x
      this.mousePanningStart = this.unitController.viewRange.start
      this.stage.cursor = 'grabbing'
    }
    this.stage.on('mousedown', this._stageMouseDownHandler)

    this._stageMouseMoveHandler = (event: PIXI.InteractionEvent) => {
      this.mouseButtons = event.data.buttons
      if (this.mousePanning) {
        if (
          (this.mouseDownButton == 1 && (this.mouseButtons & 4) === 0) ||
          (this.mouseDownButton == 0 && (this.mouseButtons & 1) === 0)
        ) {
          // handle missed button mouseup event
          this.mousePanning = false
          const orig = event.data.originalEvent
          if (!orig.ctrlKey || orig.shiftKey || orig.altKey) {
            this.stage.cursor = 'default'
          }
          return
        }
        const horizontalDelta = event.data.global.x - this.mouseStartX
        panHorizontally(horizontalDelta)
      }
      if (this.mouseZooming) {
        this.mouseEndX = event.data.global.x
        this.updateZoomingSelection()
      }
    }
    this.stage.on('mousemove', this._stageMouseMoveHandler)

    this._stageMouseUpHandler = (event: PIXI.InteractionEvent) => {
      this.mouseButtons = event.data.buttons
      if (event.data.button === this.mouseDownButton && this.mousePanning) {
        this.mousePanning = false
        const orig = event.data.originalEvent
        if (!orig.ctrlKey || orig.shiftKey || orig.altKey) {
          this.stage.cursor = 'default'
        }
      }
    }
    this.stage.on('mouseup', this._stageMouseUpHandler)
    this.stage.on('mouseupoutside', this._stageMouseUpHandler)

    this._mouseWheelHandler = (event: Event) => {
      const ev = event as WheelEvent
      if (ev.ctrlKey) {
        const hasZoomedIn = ev.deltaY < 0
        this.adjustZoom((ev as any).offsetX ?? 0, hasZoomedIn)
      } else if (ev.shiftKey) {
        moveHorizontally(ev.deltaY)
      } else {
        if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
          moveVertically(ev.deltaY)
        } else {
          moveHorizontally(ev.deltaX)
        }
      }
      ev.preventDefault()
    }
    this._contextMenuHandler = (event: Event) => {
      event.preventDefault()
    }

    this._mouseDownHandler = (event: Event) => {
      const e = event as MouseEvent
      this.mouseButtons = e.buttons
      // if only right button is pressed
      if (e.button === 2 && e.buttons === 2 && this.stage.cursor === 'default') {
        this.mouseZooming = true
        this.mouseDownButton = e.button
        this.mouseStartX = e.offsetX
        this.mouseEndX = e.offsetX
        this.mouseZoomingStart =
          this.unitController.viewRange.start +
          BIMath.round(this.mouseStartX / this.stateController.zoomFactor)
        this.stage.cursor = 'col-resize'
        // this is the only way to detect mouseup outside of right button
        document.addEventListener('mouseup', mouseUpListener)
        this.updateZoomingSelection()
      }
    }
    const mouseUpListener = (event: MouseEvent) => {
      const e = event as MouseEvent
      this.mouseButtons = e.buttons
      if (e.button === this.mouseDownButton && this.mouseZooming) {
        this.mouseZooming = false
        const start = this.mouseZoomingStart
        const end =
          this.unitController.viewRange.start +
          BIMath.round(this.mouseEndX / this.stateController.zoomFactor)
        if (BIMath.abs(end - start) > 1 && this.unitController.viewRangeLength > 1) {
          let newViewStart = BIMath.clamp(start, this.unitController.viewRange.start, end)
          let newViewEnd = BIMath.clamp(end, start, this.unitController.viewRange.end)
          this.unitController.viewRange = {
            start: newViewStart,
            end: newViewEnd
          }
        }
        this.stage.cursor = 'default'
        document.removeEventListener('mouseup', mouseUpListener)
        this.updateZoomingSelection()
      }
    }
    this.onCanvasEvent('mousemove', this._mouseMoveHandler)
    this.onCanvasEvent('keydown', this._keyDownHandler)
    this.onCanvasEvent('keyup', this._keyUpHandler)
    this.onCanvasEvent('mousedown', this._mouseDownHandler)
    this.onCanvasEvent('mousewheel', this._mouseWheelHandler)
    this.onCanvasEvent('wheel', this._mouseWheelHandler)
    this.onCanvasEvent('contextmenu', this._contextMenuHandler)

    this.rowController.onVerticalOffsetChangedHandler((verticalOffset) => {
      this.layer.position.y = -verticalOffset
      this._debouncedMaybeFetchNewData()
    })

    this._viewRangeChangedHandler = () => {
      this.updateZoomingSelection()
      this.ensureRowLinesFitViewWidth()
    }
    this.unitController.onViewRangeChanged(this._viewRangeChangedHandler)
    this.unitController.onViewRangeChanged(this._debouncedMaybeFetchNewData)

    this._scaleFactorChangedHandler = () => {
      this.scaleComponents()
    }

    this.stateController.onScaleFactorChange(this._scaleFactorChangedHandler)

    /**
     * We need to explicitly re-render every zoom change because of edge case:
     *   WorldRange = Absolute Range && ViewRange < WorldRange
     * When we are at above state, and reset view to home, nothing happens.
     *   We already rendered the world and don't rerender (WorldRange doesn't change)
     *   this.maybeFetchNewData is called and we don't fetch or trigger viewport.handleOnWorldRange.
     *   This is because don't re-render the world since it's we already have the entire trace rendered.
     *   We don't currently have any logic for scaling the world down.
     * UpdatingScaleAndPosition also scales everything down nicely when zooming out :)
     * Side effect - stage.width is always reset to renderer.width when this is called.
     */
    this._zoomRangeChangedHandler = (zoomFactor) => {
      this.ensureRowLinesFitViewWidth()
      this.stateController.handleOnWorldRender()
    }
    this.stateController.onZoomChanged(this._zoomRangeChangedHandler)

    if (this.unitController.viewRangeLength && this.stateController.canvasDisplayWidth) {
      this.maybeFetchNewData()
    }
  }

  updateChart(filterExpressionsMap?: { [key: number]: string[] }) {
    if (!isEqual(filterExpressionsMap?.[EXCLUDED], this._filterExpressionsMap?.[EXCLUDED])) {
      this._excludedRows.clear()
    }
    this._filterExpressionsMap = filterExpressionsMap
    if (this.unitController && this.stateController) {
      this.maybeFetchNewData(true)
    }
  }

  update() {
    this.ensureRowLinesFitViewWidth()
    this._debouncedMaybeFetchNewData()
  }

  updateZoomingSelection() {
    if (!this.mouseZooming && this.zoomingSelection) {
      this.removeChild(this.zoomingSelection)
      delete this.zoomingSelection
    } else if (this.mouseZooming) {
      // The zooming selection should not be scaled. It should use the actual mouse coordinates.
      const x = this.getWorldPixel(this.mouseZoomingStart) / this.stateController.scaleFactor
      const options = {
        color: 0xbbbbbb,
        opacity: 0.2,
        position: {
          x,
          y: 0
        },
        height: Math.max(this.stateController.canvasDisplayHeight, this.rowController.totalHeight),
        width: (this.mouseEndX - this.mouseStartX) / this.stateController.scaleFactor
      }

      if (!this.zoomingSelection) {
        // Add the rectangle if we don't have one
        this.zoomingSelection = new TimeGraphRectangle(options)
        this.addChild(this.zoomingSelection)
      } else {
        // Update the rectangle if we do
        this.zoomingSelection.update(options)
      }
    }
  }

  protected removeChildren(): void {
    this.rowComponents.clear()
    super.removeChildren()
  }

  destroy() {
    this.stateController.removeOnZoomChanged(this._zoomRangeChangedHandler)
    this.stateController.removeOnScaleFactorChanged(this._scaleFactorChangedHandler)
    this.unitController.removeViewRangeChangedHandler(this._debouncedMaybeFetchNewData)
    this.unitController.removeViewRangeChangedHandler(this._viewRangeChangedHandler)
    if (this._viewRangeChangedHandler) {
      this.unitController.removeViewRangeChangedHandler(this._viewRangeChangedHandler)
    }
    if (this._mouseMoveHandler) {
      this.removeOnCanvasEvent('mousemove', this._mouseMoveHandler)
    }
    if (this._mouseDownHandler) {
      this.removeOnCanvasEvent('mousedown', this._mouseDownHandler)
    }
    if (this._keyDownHandler) {
      this.removeOnCanvasEvent('keydown', this._keyDownHandler)
    }
    if (this._keyUpHandler) {
      this.removeOnCanvasEvent('keyup', this._keyUpHandler)
    }
    if (this._mouseWheelHandler) {
      this.removeOnCanvasEvent('mousewheel', this._mouseWheelHandler)
      this.removeOnCanvasEvent('wheel', this._mouseWheelHandler)
    }
    if (this._contextMenuHandler) {
      this.removeOnCanvasEvent('contextmenu', this._contextMenuHandler)
    }
    if (this.stage) {
      this.stage.off('mousedown', this._stageMouseDownHandler)
      this.stage.off('mousemove', this._stageMouseMoveHandler)
      this.stage.off('mouseup', this._stageMouseUpHandler)
      this.stage.off('mouseupoutside', this._stageMouseUpHandler)
    }
    this.rowComponents.clear()
    super.destroy()
  }

  protected async maybeFetchNewData(update?: boolean, fine?: boolean, fullSearch?: boolean) {
    if (this._fetchingRows) {
      this._pendingFetch = {
        update: this._pendingFetch?.update || update,
        fine: this._pendingFetch?.fine || fine,
        fullSearch: this._pendingFetch?.fullSearch || fullSearch
      }
      return
    }
    if (!fine && this._filterExpressionsMap?.[EXCLUDED]) {
      // skip the coarse update when EXCLUDED filter is applied
      fine = true
    }
    this._allRowIds = this.providers.rowProvider().rowIds
    this.rowIds = this._allRowIds.filter((rowId) => !this._excludedRows.has(rowId))
    const visibleRowIds = this.getVisibleRowIds(VISIBLE_ROW_BUFFER)
    // update position of existing rows and remove deleted rows
    const movedRows: TimeGraphRow[] = []
    this.rowComponents.forEach((rowComponent, rowId) => {
      const index = this.rowIds.indexOf(rowId)
      if (index == -1) {
        this.rowComponents.delete(rowId)
        this.removeChild(rowComponent)
      } else {
        const y = this.rowController.rowHeight * index
        if (!visibleRowIds.includes(rowId)) {
          this.rowComponents.delete(rowId)
          this.removeChild(rowComponent)
        } else if (rowComponent.position.y !== y) {
          movedRows.push(rowComponent)
        }
        rowComponent.position.y = y
      }
    })
    // update selected row
    if (this.rowController.selectedRow) {
      this.rowController.selectedRowIndex = this.rowIds.indexOf(this.rowController.selectedRow.id)
      if (this.rowController.selectedRowIndex === -1) {
        this.rowController.selectedRow = undefined
      }
    }
    // create placeholder rows
    this.rowIds.forEach((rowId) => {
      if (!this.rowComponents.get(rowId)) {
        this.addRow(rowId)
      }
    })
    const { viewRange } = this.unitController
    const worldRange = this.stateController.computeWorldRangeFromViewRange()
    const resolutionFactor = fine ? FINE_RESOLUTION_FACTOR : this._coarseResolutionFactor
    const resolution =
      (resolutionFactor * Number(this.unitController.viewRangeLength)) /
      this.stateController.canvasDisplayWidth
    // Compute the visible rowIds to fetch. Fetch all visible rows if update flag is set,
    // otherwise fetch visible rows with no component, no model or obsolete model.
    const rowIds = visibleRowIds.filter((rowId) => {
      const rowComponent = this.rowComponents.get(rowId)
      return (
        update ||
        !rowComponent ||
        !rowComponent.providedModel ||
        viewRange.start < rowComponent.providedModel.range.start || // This logic can be updated for pre-rendering before we reach the end.
        viewRange.end > rowComponent.providedModel.range.end || // This logic can be updated for pre-rendering before we reach the end.
        !isEqual(worldRange, rowComponent.providedModel.range) ||
        resolution < rowComponent.providedModel.resolution ||
        !isEqual(rowComponent.providedModel.filterExpressionsMap, this._filterExpressionsMap)
      )
    })
    // rebuild rows that have changed position but that won't be fetched
    movedRows.forEach((rowComponent) => {
      if (
        rowComponent.model &&
        !rowIds.includes(rowComponent.model.id) &&
        rowComponent.providedModel
      ) {
        const rowData = {
          rows: [rowComponent.model],
          range: rowComponent.providedModel?.range,
          resolution: rowComponent.providedModel?.resolution
        }
        this.addOrUpdateRows(rowData)
      }
    })
    if (fullSearch && this._filterExpressionsMap?.[EXCLUDED]) {
      this._excludedRows.forEach((range, rowId) => {
        // add excluded rows to request to determine if they should reappear
        if (!isEqual(worldRange, range)) {
          rowIds.push(rowId)
        }
      })
      // reorder rows
      rowIds.sort((a, b) => this._allRowIds.indexOf(a) - this._allRowIds.indexOf(b))
    }
    if (rowIds.length > 0) {
      const additionalParams: { [key: string]: any } = {}
      if (this._filterExpressionsMap) {
        additionalParams['filter_query_parameters'] = {
          filter_expressions_map: this._filterExpressionsMap,
          strategy: fullSearch ? 'DEEP' : 'SAMPLED'
        }
      }

      if (fullSearch) {
        for (let i = 0; i < rowIds.length; i++) {
          let interrupted = false
          try {
            const request = {
              worldRange,
              resolution,
              rowIds: [rowIds[i]],
              additionalParams,
              fullSearch
            }
            this._fetchingRows = true
            await this.fetchRows(request, i === rowIds.length - 1, fine)
          } catch (error) {
            return
          } finally {
            this._fetchingRows = false
            if (this._pendingFetch !== undefined) {
              const pendingFetch = this._pendingFetch
              this._pendingFetch = undefined
              this.maybeFetchNewData(
                pendingFetch.update,
                pendingFetch.fine,
                pendingFetch.fullSearch
              )
              interrupted = true
            }
          }
          if (interrupted) {
            return
          }
        }
        // When row-by-row fetch is completed (not interrupted by new request), update model with filter
        for (let i = 0; i < rowIds.length; i++) {
          const rowComponent = this.rowComponents.get(rowIds[i])
          if (rowComponent && rowComponent.providedModel) {
            rowComponent.providedModel.filterExpressionsMap = this._filterExpressionsMap
          }
        }
        if (this._filterExpressionsMap?.[EXCLUDED]) {
          // restart full search to check if newly visible rows need to be filled after filtering
          this._debouncedMaybeFetchNewDataFineFullSearch()
        }
      } else {
        try {
          const request = { worldRange, resolution, rowIds, additionalParams, fullSearch }
          this._fetchingRows = true
          await this.fetchRows(request, !fullSearch, fine)
        } catch (error) {
          return
        } finally {
          this._fetchingRows = false
          if (this._pendingFetch !== undefined) {
            const pendingUpdate = this._pendingFetch
            this._pendingFetch = undefined
            this.maybeFetchNewData(
              pendingUpdate.update,
              pendingUpdate.fine,
              pendingUpdate.fullSearch
            )
          }
        }
      }
    } else {
      if (movedRows.length > 0) {
        // no rows to update but may need to fetch arrows
        const request = { worldRange, resolution, rowIds: [], additionalParams: {}, fullSearch }
        await this.fetchRows(request, true, fine)
      }
      if (!fine && this._coarseResolutionFactor !== FINE_RESOLUTION_FACTOR) {
        // no row to update for coarse resolution, try fine resolution
        this.maybeFetchNewData(update, true)
      }
    }
  }

  private async fetchRows(
    request: {
      worldRange: TimelineChart.TimeGraphRange
      resolution: number
      rowIds: number[]
      additionalParams: {
        [key: string]: any
      }
      fullSearch?: boolean
    },
    fetchArrows: boolean,
    fine?: boolean
  ) {
    if (isEqual(request, this.ongoingRequest)) {
      // request ignored because equal to ongoing request
      return
    }
    this._debouncedMaybeFetchNewDataFine.cancel()
    this._debouncedMaybeFetchNewDataFineFullSearch.cancel()
    try {
      this.ongoingRequest = request
      const rowData = await this.providers.dataProvider(
        request.worldRange,
        request.resolution,
        fetchArrows,
        request.rowIds,
        request.additionalParams
      )
      if (!isEqual(request, this.ongoingRequest)) {
        // response discarded because not equal to ongoing request
        return Promise.reject(new Error('Ongoing request updated'))
      }
      if (rowData) {
        if (!request.fullSearch) {
          this.stateController.worldRange = request.worldRange
          this.stateController.worldZoomFactor = this.stateController.zoomFactor
          this.stateController.resetScale()
        } else if (!isEqual(request.worldRange, this.stateController.worldRange)) {
          // response discarded because world range updated
          return Promise.reject(new Error('Request for outdated world range'))
        }
        this.updateExcludedRows(request.rowIds, request.worldRange, rowData.rows)
        this.addOrUpdateRows(rowData)
        if (this.isNavigating) {
          this.selectStateInNavigation()
        }
        if (this.mouseZooming) {
          if (this.zoomingSelection) {
            this.removeChild(this.zoomingSelection)
          }

          delete this.zoomingSelection
          this.updateZoomingSelection()
        }
      }
    } finally {
      if (isEqual(request, this.ongoingRequest)) {
        this.ongoingRequest = undefined
      }
      this.isNavigating = false
      if (!fine && this._coarseResolutionFactor !== FINE_RESOLUTION_FACTOR) {
        this._debouncedMaybeFetchNewDataFine()
      }
      if (
        this._filterExpressionsMap &&
        !request.fullSearch &&
        (fine || this._coarseResolutionFactor === FINE_RESOLUTION_FACTOR)
      ) {
        // fine resolution done for sampled search, time for deep search in fine res
        this._debouncedMaybeFetchNewDataFineFullSearch()
      }
    }
    // After we build the new world from new data, execute render handlers.
    // Only execute after first, coarse render.  Don't need to repeat after second, fine render.
    this.stateController.handleOnWorldRender()
  }

  protected handleSelectedStateChange() {
    this.selectedStateChangedHandler.forEach((handler) => handler(this.selectedStateModel))
  }

  protected updateExcludedRows(
    requestedRowIds: number[],
    worldRange: TimelineChart.TimeGraphRange,
    rows: TimelineChart.TimeGraphRowModel[]
  ) {
    let update = false
    requestedRowIds.forEach((rowId) => {
      if (!rows.find((row) => row.id === rowId)) {
        // an excluded row is removed
        update = true
        this._excludedRows.set(rowId, worldRange)
        const rowComponent = this.rowComponents.get(rowId)
        if (rowComponent) {
          this.rowComponents.delete(rowId)
          this.removeChild(rowComponent)
        }
      } else if (this._excludedRows.delete(rowId)) {
        // a previously excluded row reappears
        update = true
      }
    })
    if (update) {
      // reposition all rows
      this.rowIds = this._allRowIds.filter((rowId) => !this._excludedRows.has(rowId))
      this.rowComponents.forEach((rowComponent, rowId) => {
        const index = this.rowIds.indexOf(rowId)
        if (index != -1) {
          rowComponent.position.y = this.rowController.rowHeight * index
        }
      })
    }
  }

  protected addOrUpdateRows(rowData: {
    rows: TimelineChart.TimeGraphRowModel[]
    range: TimelineChart.TimeGraphRange
    resolution: number
  }) {
    if (!this.stateController) {
      throw 'Add this TimeGraphChart to a container before adding rows.'
    }
    const providedModel = { range: rowData.range, resolution: rowData.resolution }
    rowData.rows.forEach((row) => {
      const rowComponent = this.rowComponents.get(row.id)
      if (rowComponent) {
        this.removeChild(rowComponent)
      }
      this.addRow(row.id, row, providedModel)
    })
  }

  protected addRow(
    rowId: number,
    row?: TimelineChart.TimeGraphRowModel,
    providedModel?: {
      range: TimelineChart.TimeGraphRange
      resolution: number
      filterExpressionsMap?: { [key: number]: string[] }
    }
  ) {
    const id = 'row_' + rowId
    const rowIndex = this.rowIds.indexOf(rowId)
    const rowStyle = this.providers.rowStyleProvider
      ? this.providers.rowStyleProvider(row)
      : undefined
    const rowComponent = new TimeGraphRow(
      id,
      {
        position: {
          x: 0,
          y: this.rowController.rowHeight * rowIndex
        },
        width: this.rowWidth,
        height: this.rowController.rowHeight
      },
      rowIndex,
      row,
      rowStyle
    )
    rowComponent.displayObject.interactive = true
    rowComponent.displayObject.on(
      'click',
      ((e: PIXI.InteractionEvent) => {
        this.selectRow(row)
      }).bind(this)
    )
    this.addChild(rowComponent)
    this.rowComponents.set(rowId, rowComponent)
    if (this.rowController.selectedRowIndex == rowIndex) {
      this.selectRow(row)
    }
    if (row && providedModel) {
      this.updateRow(rowComponent, row, providedModel)
    }
  }

  protected updateRow(
    rowComponent: TimeGraphRow,
    row: TimelineChart.TimeGraphRowModel,
    providedModel: {
      range: TimelineChart.TimeGraphRange
      resolution: number
      filterExpressionsMap?: { [key: number]: string[] }
    }
  ) {
    let lastX: number | undefined
    let lastTime: bigint | undefined
    let lastBlank = false
    row.states.forEach((stateModel: TimelineChart.TimeGraphState) => {
      const x = this.getWorldPixel(stateModel.range.start)
      if (stateModel.data?.style) {
        const el = this.createNewState(stateModel, rowComponent)
        if (el) {
          this.addElementInteractions(el)
          rowComponent.addState(el)
        }
      }
      if (row.gapStyle) {
        this.updateGap(stateModel, rowComponent, row.gapStyle, x, lastX, lastTime, lastBlank)
      }
      lastX = Math.max(x + 1, this.getWorldPixel(stateModel.range.end))
      lastTime = stateModel.range.end
      lastBlank = stateModel.data?.style === undefined
    })
    if (
      this.rowController.selectedRow &&
      this.unitController.selectionRange &&
      this.rowController.selectedRow.id === row.id
    ) {
      const state = row.states.find((state) => {
        return (
          this.unitController.selectionRange &&
          state.range.start <= this.unitController.selectionRange.start &&
          state.range.end > this.unitController.selectionRange.start
        )
      })
      this.selectState(state)
    }
    row.annotations.forEach((annotation: TimelineChart.TimeGraphAnnotation) => {
      const el = this.createNewAnnotation(annotation, rowComponent)
      if (el) {
        this.addElementInteractions(el)
        rowComponent.addAnnotation(el)
      }
    })
    rowComponent.providedModel = providedModel
  }

  protected updateGap(
    state: TimelineChart.TimeGraphState,
    rowComponent: TimeGraphRow,
    gapStyle: any,
    x: number,
    lastX?: number,
    lastTime?: bigint,
    lastBlank?: boolean
  ) {
    /* add gap if there is visible space between states or if there is a time gap between two blank states */
    const isFilteredOut = state.data?.tags >= EXCLUDED
    if (
      lastX &&
      lastTime &&
      (x > lastX || (lastBlank && !state.data?.style && state.range.start > lastTime)) &&
      !isFilteredOut
    ) {
      const stateModel = {
        id: rowComponent.id + '-gap',
        range: {
          start: lastTime,
          end: state.range.start
        },
        data: {
          style: gapStyle
        }
      }
      const gap = this.createNewState(stateModel, rowComponent)
      if (gap) {
        rowComponent.addChild(gap)
        this.addElementInteractions(gap)
      }
    }
  }

  protected createNewAnnotation(
    annotation: TimelineChart.TimeGraphAnnotation,
    rowComponent: TimeGraphRow
  ) {
    const start = this.getWorldPixel(annotation.range.start)
    const elementStyle = this.providers.rowAnnotationStyleProvider
      ? this.providers.rowAnnotationStyleProvider(annotation)
      : undefined
    const el = new TimeGraphAnnotationComponent(
      annotation.id,
      annotation,
      { position: { x: start, y: rowComponent.position.y + rowComponent.height * 0.5 } },
      elementStyle,
      rowComponent,
      this.stateController.scaleFactor
    )
    return el
  }

  protected createNewState(
    stateModel: TimelineChart.TimeGraphState,
    rowComponent: TimeGraphRow
  ): TimeGraphStateComponent | undefined {
    const xStart = this.getWorldPixel(stateModel.range.start, true)
    const xEnd = this.getWorldPixel(stateModel.range.end, true)
    const displayWidth = xEnd - xStart
    const elementStyle = this.providers.stateStyleProvider
      ? this.providers.stateStyleProvider(stateModel)
      : undefined
    const el = new TimeGraphStateComponent(
      stateModel.id,
      stateModel,
      xStart,
      xEnd,
      rowComponent,
      elementStyle,
      displayWidth,
      this.stateController.scaleFactor
    )
    return el
  }

  protected addElementInteractions(el: TimeGraphComponent<any>) {
    el.displayObject.interactive = true

    this._multiClickTimer = debounce(() => {
      this._mouseClicks = 0
      this._recentlyClickedGlobal = null
    }, this._multiClickTime)

    el.displayObject.on(
      'click',
      ((e: PIXI.InteractionEvent) => {
        if (el instanceof TimeGraphStateComponent && !this.mousePanning && !this.mouseZooming) {
          this.selectState(el.model)
        }

        // Mouse clicks count keeps increasing without limit as long as we keep clicking on the same coordinate.
        if (this._recentlyClickedGlobal && this._recentlyClickedGlobal.equals(e.data.global)) {
          this._mouseClicks++
        } else {
          // Only clear the timer and reset the click count if the global position is NOT
          // the same one as click 1.
          this._multiClickTimer.cancel()
          this._mouseClicks = 1

          // Store the global position on first click
          this._recentlyClickedGlobal = cloneDeep(e.data.global)
        }

        // We can use a debouncer to reset the count when no click occurs for a certain period.
        this._multiClickTimer()

        // Click callback includes count parameter to record subsequent clicks on the same point
        if (this.mouseInteractions && this.mouseInteractions.click) {
          this.mouseInteractions.click(el, e, this._mouseClicks)
        }
      }).bind(this)
    )
    el.displayObject.on(
      'mouseover',
      ((e: PIXI.InteractionEvent) => {
        if (this.mouseInteractions && this.mouseInteractions.mouseover) {
          this.mouseInteractions.mouseover(el, e)
        }
      }).bind(this)
    )
    el.displayObject.on(
      'mouseout',
      ((e: PIXI.InteractionEvent) => {
        if (this.mouseInteractions && this.mouseInteractions.mouseout) {
          this.mouseInteractions.mouseout(el, e)
        }
      }).bind(this)
    )
    el.displayObject.on(
      'mousedown',
      ((e: PIXI.InteractionEvent) => {
        if (this.mouseInteractions && this.mouseInteractions.mousedown) {
          this.mouseInteractions.mousedown(el, e)
        }
      }).bind(this)
    )
    el.displayObject.on(
      'mouseup',
      ((e: PIXI.InteractionEvent) => {
        if (this.mouseInteractions && this.mouseInteractions.mouseup) {
          this.mouseInteractions.mouseup(el, e)
        }
      }).bind(this)
    )
  }

  protected updateStateStyle(model: TimelineChart.TimeGraphState) {
    const style = this.providers.stateStyleProvider && this.providers.stateStyleProvider(model)
    const component = this.getStateById(model.id)
    component && style && (component.style = style)
  }

  protected updateRowStyle(model: TimelineChart.TimeGraphRowModel) {
    const style = this.providers.rowStyleProvider && this.providers.rowStyleProvider(model)
    const component = this.rowComponents.get(model.id)
    component && style && (component.style = style)
  }

  registerMouseInteractions(interactions: TimeGraphMouseInteractions) {
    this.mouseInteractions = interactions
  }

  onSelectedStateChanged(handler: (el: TimelineChart.TimeGraphState | undefined) => void) {
    this.selectedStateChangedHandler.push(handler)
  }

  getRowModel(index: number): TimelineChart.TimeGraphRowModel | undefined {
    if (index >= this.rowIds.length) {
      return undefined
    }
    return this.rowComponents.get(this.rowIds[index])?.model
  }

  getStateById(id: string): TimeGraphStateComponent | undefined {
    let state = undefined
    for (const rowComponent of this.rowComponents.values()) {
      state = rowComponent.getStateById(id)
      if (state) {
        break
      }
    }
    return state
  }

  selectRow(row: TimelineChart.TimeGraphRowModel | undefined) {
    if (this.rowController.selectedRow) {
      delete this.rowController.selectedRow.selected
      this.updateRowStyle(this.rowController.selectedRow)
    }
    this.rowController.selectedRow = row
    if (row) {
      this.rowController.selectedRowIndex = this.rowIds.indexOf(row.id)
      row.selected = true
      this.updateRowStyle(row)
    }
  }

  getSelectedState(): TimelineChart.TimeGraphState | undefined {
    return this.selectedStateModel
  }

  selectState(model: TimelineChart.TimeGraphState | undefined) {
    if (this.selectedStateModel === model) {
      return
    }
    if (this.selectedStateModel) {
      delete this.selectedStateModel.selected
      this.updateStateStyle(this.selectedStateModel)
    }
    if (model) {
      const state = this.getStateById(model.id)
      if (state) {
        const row = state.row
        if (row) {
          state.model.selected = true
          this.updateStateStyle(state.model)
          this.selectRow(row.model)
        }
      }
    }
    this.selectedStateModel = model
    this.handleSelectedStateChange()
  }

  setNavigationFlag(flag: boolean) {
    this.isNavigating = flag
  }

  selectAndReveal(rowIndex: number) {
    if (rowIndex >= 0 && rowIndex < this.rowIds.length) {
      this.rowController.selectedRowIndex = rowIndex
      this.navigate(rowIndex, true)
    }
  }

  protected selectStateInNavigation() {
    const row = this.rowController.selectedRow
    if (row && this.unitController.selectionRange) {
      const cursorPosition = this.unitController.selectionRange.end
      const state = row.states.find(
        (stateModel: TimelineChart.TimeGraphState) =>
          stateModel.range.start === cursorPosition || stateModel.range.end === cursorPosition
      )
      this.selectState(state)
    }
    this.setNavigationFlag(false)
  }

  protected navigateDown() {
    if (this.rowIds.length > 0) {
      this.rowController.selectedRowIndex = Math.min(
        this.rowController.selectedRowIndex + 1,
        this.rowIds.length - 1
      )
      this.navigate(this.rowController.selectedRowIndex)
    }
  }

  protected navigateUp() {
    if (this.rowIds.length > 0) {
      this.rowController.selectedRowIndex = Math.max(this.rowController.selectedRowIndex - 1, 0)
      this.navigate(this.rowController.selectedRowIndex)
    }
  }

  protected navigate(rowIndex: number, center?: boolean) {
    this.ensureVisible(rowIndex, center)
    const selectedRowId = this.rowIds[rowIndex]
    const selectedRowComponent = this.rowComponents.get(selectedRowId)
    if (!selectedRowComponent) {
      this.selectRow(undefined)
      this.selectState(undefined)
      return
    }
    const selectedRow = selectedRowComponent.model
    this.selectRow(selectedRow)
    const state = selectedRow?.states.find((state) => {
      return (
        this.unitController.selectionRange &&
        state.range.start <= this.unitController.selectionRange.start &&
        state.range.end > this.unitController.selectionRange.start
      )
    })
    this.selectState(state)
  }

  private getVisibleRowIds(buffer: number): number[] {
    const visibleRowIds: number[] = []
    const rowHeight = this.rowController.rowHeight
    // return all rows that intersect the visible height range with a number of buffer rows
    const minY = this.rowController.verticalOffset - buffer * rowHeight
    const maxY =
      this.rowController.verticalOffset +
      this.stateController.canvasDisplayHeight +
      buffer * rowHeight
    this.rowIds.forEach((rowId, index) => {
      const y = rowHeight * index
      if (y + rowHeight >= minY && y <= maxY) {
        visibleRowIds.push(rowId)
      }
    })
    return visibleRowIds
  }

  protected ensureVisible(rowIndex: number, center?: boolean) {
    if (rowIndex === -1) {
      return
    }
    if (rowIndex * this.rowController.rowHeight < this.rowController.verticalOffset) {
      center
        ? this.centerRow(rowIndex)
        : (this.rowController.verticalOffset = rowIndex * this.rowController.rowHeight)
    } else if (
      (rowIndex + 1) * this.rowController.rowHeight >
      this.rowController.verticalOffset + this.stateController.canvasDisplayHeight
    ) {
      center
        ? this.centerRow(rowIndex)
        : (this.rowController.verticalOffset =
            (rowIndex + 1) * this.rowController.rowHeight -
            this.stateController.canvasDisplayHeight)
    }
  }

  protected centerRow(rowIndex: number) {
    if (rowIndex === -1) {
      return
    }

    const { rowHeight } = this.rowController
    const { canvasDisplayHeight } = this.stateController

    const numberOfVisibleRows = Math.floor(canvasDisplayHeight / rowHeight)
    const halfVizRows = Math.floor(numberOfVisibleRows / 2)
    const numberOfRows = this.rowComponents.size

    if (rowIndex < halfVizRows) {
      // Index too low to center.
      this.rowController.verticalOffset = 0
    } else if (rowIndex > numberOfRows - halfVizRows - 1) {
      // Index too high to center.
      this.rowController.verticalOffset = (numberOfRows - numberOfVisibleRows) * rowHeight
    } else {
      // Can be centered.
      const numberOfHiddenRows = rowIndex - halfVizRows
      this.rowController.verticalOffset = numberOfHiddenRows * rowHeight
    }
  }

  /**
   * Ensures that we always see the row lines.
   * This is a hacky solution that triggers every view range change.
   */
  protected ensureRowLinesFitViewWidth = () => {
    const newRowWidth = this.stateController.canvasDisplayWidth / this.stateController.scaleFactor
    this.rowComponents.forEach((rowComponent) => {
      rowComponent.update({
        height: this.rowController.rowHeight,
        position: {
          x: -this.stateController.positionOffset.x,
          y: rowComponent.position.y
        },
        width: newRowWidth
      })
    })
  }

  protected scaleComponents() {
    this.rowComponents.forEach((rowComponent) => {
      const row = rowComponent.model
      row?.states.forEach((state: TimelineChart.TimeGraphState) => {
        const el = rowComponent.getStateById(state.id)
        if (el) {
          el.scaleLabel(this.stateController.scaleFactor)
        }
      })
      row?.annotations.forEach((annotation: TimelineChart.TimeGraphAnnotation) => {
        const el = rowComponent.getAnnotationById(annotation.id)
        if (el) {
          el.scaleAnnotation(this.stateController.scaleFactor)
        }
      })
    })
  }

  get rowWidth(): number {
    return Number(this.stateController.worldRangeLength) * this.stateController.zoomFactor
  }
}
