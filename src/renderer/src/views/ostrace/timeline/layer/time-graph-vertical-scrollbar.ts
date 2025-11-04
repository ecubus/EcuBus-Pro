import {
  TimeGraphComponent,
  TimeGraphInteractionHandler,
  TimeGraphElementPosition
} from '../components/time-graph-component'
import { TimeGraphStateController } from '../time-graph-state-controller'
import { TimeGraphRectangle } from '../components/time-graph-rectangle'
import { TimeGraphChartLayer } from './time-graph-chart-layer'
import { TimeGraphRowController } from '../time-graph-row-controller'

export class TimeGraphVerticalScrollbar extends TimeGraphChartLayer {
  protected navigatorHandle!: TimeGraphVerticalScrollbarHandle
  protected navigatorBackground!: TimeGraphVerticalScrollbarBackground
  protected selectionRange?: TimeGraphRectangle
  private _contextMenuHandler!: { (e: MouseEvent): void; (event: Event): void }
  private _verticalOffsetChangedHandler!: () => void
  private _totalHeightChangedHandler!: () => void

  protected factor!: number

  constructor(
    id: string,
    protected rowController: TimeGraphRowController
  ) {
    super(id, rowController)
  }

  protected afterAddToContainer() {
    this.updateFactor()
    this.navigatorHandle = new TimeGraphVerticalScrollbarHandle(
      this.rowController,
      this.stateController,
      this.factor
    )
    this.navigatorBackground = new TimeGraphVerticalScrollbarBackground(
      this.rowController,
      this.stateController,
      this.factor
    )
    this.addChild(this.navigatorBackground)
    this.addChild(this.navigatorHandle)
    this._contextMenuHandler = (e: MouseEvent | Event): void => {
      e.preventDefault()
    }
    this.onCanvasEvent('contextmenu', this._contextMenuHandler)
    this._verticalOffsetChangedHandler = () => {
      this.update()
    }
    this._totalHeightChangedHandler = () => {
      this.updateFactor()
      this.navigatorHandle.updateFactor(this.factor)
      this.navigatorBackground.updateFactor(this.factor)
      this.update()
    }
    this.rowController.onVerticalOffsetChangedHandler(this._verticalOffsetChangedHandler)
    this.rowController.onTotalHeightChangedHandler(this._totalHeightChangedHandler)
  }

  protected updateFactor() {
    if (this.rowController.totalHeight) {
      this.factor = this.stateController.canvasDisplayHeight / this.rowController.totalHeight
    } else {
      this.factor = 0
    }
  }

  update() {
    this.navigatorHandle.clear()
    this.navigatorHandle.render()
    this.navigatorBackground.clear()
    this.navigatorBackground.render()
  }

  destroy() {
    if (this.rowController) {
      this.rowController.removeTotalHeightChangedHandler(this._totalHeightChangedHandler)
      this.rowController.removeVerticalOffsetChangedHandler(this._verticalOffsetChangedHandler)
    }
    if (this._contextMenuHandler) {
      this.removeOnCanvasEvent('contextmenu', this._contextMenuHandler)
    }
    super.destroy()
  }
}

export class TimeGraphVerticalScrollbarHandle extends TimeGraphComponent<null> {
  protected mouseIsDown!: boolean
  protected mouseStartY!: number
  protected oldVerticalOffset!: number

  protected height!: number
  protected position!: TimeGraphElementPosition
  private _moveEndHandler

  constructor(
    protected rowController: TimeGraphRowController,
    protected stateController: TimeGraphStateController,
    protected factor: number
  ) {
    super('vscroll_handle')
    const moveStart: TimeGraphInteractionHandler = (event) => {
      this.mouseStartY = event.data.global.y
      this.oldVerticalOffset = this.rowController.verticalOffset
      this.mouseIsDown = true
      this.stateController.snapped = false
      document.addEventListener('snap-y-end', this._moveEndHandler)
    }
    this._moveEndHandler = () => {
      this.mouseIsDown = false
      document.removeEventListener('snap-y-end', this._moveEndHandler)
    }
    this.addEvent(
      'mouseover',
      (event) => {
        if (this.stateController.snapped) {
          moveStart(event)
        }
      },
      this._displayObject
    )
    this.addEvent('mousedown', moveStart, this._displayObject)
    this.addEvent(
      'mousemove',
      (event) => {
        if (this.mouseIsDown) {
          const delta = (event.data.global.y - this.mouseStartY) / this.factor
          const verticalOffset = this.oldVerticalOffset + delta
          this.rowController.verticalOffset = Math.max(
            0,
            Math.min(
              this.rowController.totalHeight - this.stateController.canvasDisplayHeight,
              verticalOffset
            )
          )
        }
      },
      this._displayObject
    )
    this.addEvent('mouseup', this._moveEndHandler, this._displayObject)
    this.addEvent('mouseupoutside', this._moveEndHandler, this._displayObject)
  }

  updateFactor(factor: number) {
    this.factor = factor
  }

  render(): void {
    this.position = { x: 0, y: this.rowController.verticalOffset * this.factor }
    this.height = this.stateController.canvasDisplayHeight * this.factor
    this.rect({
      height: this.height,
      position: this.position,
      width: 10,
      color: 0x777769
    })
  }
}

export class TimeGraphVerticalScrollbarBackground extends TimeGraphComponent<null> {
  protected snapEvent: CustomEvent
  protected snapEventString: string

  constructor(
    protected rowController: TimeGraphRowController,
    protected stateController: TimeGraphStateController,
    protected factor: number
  ) {
    super('vscroll_background')
    this.addEvent(
      'mousedown',
      (event) => {
        // Get y position of click (in pixels).
        let y = event.data.getLocalPosition(this._displayObject).y
        // Convert to units used by rowController.
        let center = (y / this.stateController.canvasDisplayHeight) * this.rowController.totalHeight
        // We have the center of the new scrollbar position, but need the starting pixel.
        // start = middle - (scrollbarHeight / 2)
        let scrollBarHeight = this.rowController.totalHeight * this.factor
        let newOffset = center - scrollBarHeight / 2
        // Clamp our new verticalOffset value
        let vOffsetMin = 0
        let vOffsetMax = this.rowController.totalHeight - this.stateController.canvasDisplayHeight
        newOffset = Math.max(vOffsetMin, Math.min(vOffsetMax, newOffset))
        this.rowController.verticalOffset = newOffset
        // Set snapped state
        this.toggleSnappedState(true)
      },
      this._displayObject
    )
    // Emit custom event to let vertical handler know when 'mousedown' is released.
    this.snapEvent = new CustomEvent((this.snapEventString = 'snap-y-end'))
    const endSnap = () => {
      this.toggleSnappedState(false)
      document.dispatchEvent(this.snapEvent)
    }
    this.addEvent('mouseup', endSnap, this._displayObject)
    this.addEvent('mouseupoutside', endSnap, this._displayObject)
    this.addEvent(
      'rightdown',
      (event) => {
        // Get y position of click (in raw pixels).
        let y = event.data.getLocalPosition(this._displayObject).y
        // Convert y to correct units used by rowController.
        let clickPoint =
          (y / this.stateController.canvasDisplayHeight) * this.rowController.totalHeight
        // Are we clicking above or below the current scrollbar position?
        const { verticalOffset, totalHeight } = this.rowController
        const scrollBarHeight = totalHeight * this.factor
        let newOffset = verticalOffset
        const start = verticalOffset
        const end = verticalOffset + scrollBarHeight
        if (clickPoint < start) {
          // If above, move up one page.
          newOffset = newOffset - scrollBarHeight
        } else if (clickPoint > end) {
          // If below, move down one page.
          newOffset = newOffset + scrollBarHeight
        }
        // Clamp our new values
        const vOffsetMin = 0
        const vOffsetMax = totalHeight - scrollBarHeight
        newOffset = Math.max(vOffsetMin, Math.min(vOffsetMax, newOffset))
        //  Assign new value
        this.rowController.verticalOffset = newOffset
      },
      this._displayObject
    )
  }

  updateFactor(factor: number) {
    this.factor = factor
  }

  protected toggleSnappedState = (bool: boolean) => {
    this.stateController.snapped = bool
  }

  render(): void {
    this.rect({
      height: this.stateController.canvasDisplayHeight,
      position: { x: 0, y: 0 },
      width: 10,
      opacity: 0
    })
  }
}
