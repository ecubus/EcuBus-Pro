import { TimeGraphUnitController } from '../time-graph-unit-controller'
import {
  TimeGraphComponent,
  TimeGraphStyledRect,
  TimeGraphInteractionHandler
} from '../components/time-graph-component'
import { TimeGraphStateController } from '../time-graph-state-controller'
import { TimeGraphRectangle } from '../components/time-graph-rectangle'
import { TimeGraphLayer } from './time-graph-layer'
import { TimelineChart } from '../time-graph-model'
import { BIMath } from '../bigint-utils'

export class TimeGraphNavigator extends TimeGraphLayer {
  protected navigatorHandle: TimeGraphNavigatorHandle
  protected navigatorBackground: TimeGraphNavigatorBackground
  protected selectionRange?: TimeGraphRectangle
  private _updateHandler: {
    (): void
    (viewRange: TimelineChart.TimeGraphRange): void
    (selectionRange: TimelineChart.TimeGraphRange): void
    (viewRange: TimelineChart.TimeGraphRange): void
    (selectionRange: TimelineChart.TimeGraphRange): void
  }
  private _contextMenuHandler: { (e: MouseEvent): void; (event: Event): void }

  afterAddToContainer() {
    this._updateHandler = (): void => this.update()
    this.unitController.onAbsoluteRangeChanged(this._updateHandler)
    this.unitController.onViewRangeChanged(this._updateHandler)
    this.navigatorBackground = new TimeGraphNavigatorBackground(
      this.unitController,
      this.stateController
    )
    this.addChild(this.navigatorBackground)
    this.navigatorHandle = new TimeGraphNavigatorHandle(this.unitController, this.stateController)
    this.addChild(this.navigatorHandle)
    this.unitController.onSelectionRangeChange(this._updateHandler)
    this._contextMenuHandler = (e: MouseEvent): void => {
      e.preventDefault()
    }
    this.onCanvasEvent('contextmenu', this._contextMenuHandler)
    this.update()
  }

  update() {
    this.navigatorHandle.clear()
    this.navigatorHandle.render()

    if (this.unitController.selectionRange) {
      const selectionOpts: TimeGraphStyledRect = {
        color: 0xb7b799,
        height: this.stateController.canvasDisplayHeight,
        opacity: 0.5,
        position: {
          x:
            Number(this.unitController.selectionRange.start) *
            this.stateController.absoluteResolution,
          y: 0
        },
        width:
          Number(
            this.unitController.selectionRange.end - this.unitController.selectionRange.start
          ) * this.stateController.absoluteResolution
      }
      if (!this.selectionRange) {
        this.selectionRange = new TimeGraphRectangle(selectionOpts)
        this.addChild(this.selectionRange)
      } else {
        this.selectionRange.update(selectionOpts)
      }
    } else {
      if (this.selectionRange) {
        this.selectionRange.clear()
      }
    }
  }

  destroy(): void {
    if (this.unitController) {
      this.unitController.removeAbsoluteRangeChangedHandler(this._updateHandler)
      this.unitController.removeViewRangeChangedHandler(this._updateHandler)
      this.unitController.removeSelectionRangeChangedHandler(this._updateHandler)
    }
    if (this._contextMenuHandler) {
      this.removeOnCanvasEvent('contextmenu', this._contextMenuHandler)
    }
    super.destroy()
  }
}

export class TimeGraphNavigatorHandle extends TimeGraphComponent<null> {
  protected mouseIsDown: boolean
  protected mouseStartX: number
  protected oldViewStart: bigint
  private _moveEndHandler: () => void

  constructor(
    protected unitController: TimeGraphUnitController,
    protected stateController: TimeGraphStateController
  ) {
    super('navigator_handle')
    const moveStart: TimeGraphInteractionHandler = (event) => {
      this.mouseStartX = event.data.global.x
      this.oldViewStart = this.unitController.viewRange.start
      this.mouseIsDown = true
      this.stateController.snapped = false
      document.addEventListener('snap-x-end', this._moveEndHandler)
    }
    this._moveEndHandler = () => {
      this.mouseIsDown = false
      document.removeEventListener('snap-x-end', this._moveEndHandler)
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
          const delta = event.data.global.x - this.mouseStartX
          const start = BIMath.clamp(
            Number(this.oldViewStart) + delta / this.stateController.absoluteResolution,
            BigInt(0),
            this.unitController.absoluteRange - this.unitController.viewRangeLength
          )
          const end = start + this.unitController.viewRangeLength
          this.unitController.viewRange = {
            start,
            end
          }
        }
      },
      this._displayObject
    )
    this.addEvent('mouseup', this._moveEndHandler, this._displayObject)
    this.addEvent('mouseupoutside', this._moveEndHandler, this._displayObject)
  }

  render(): void {
    const MIN_NAVIGATOR_WIDTH = 20
    const xPos =
      Number(this.unitController.viewRange.start) * this.stateController.absoluteResolution
    const effectiveAbsoluteRange =
      Number(this.unitController.absoluteRange) * this.stateController.absoluteResolution
    // Avoid the navigator rendered outside of the range at high zoom levels when its width is capped to MIN_NAVIGATOR_WIDTH
    const position = { x: Math.min(effectiveAbsoluteRange - MIN_NAVIGATOR_WIDTH, xPos), y: 0 }
    const width = Math.max(
      MIN_NAVIGATOR_WIDTH,
      Number(this.unitController.viewRangeLength) * this.stateController.absoluteResolution
    )
    this.rect({
      height: 20,
      position,
      width,
      color: 0x777769
    })
  }
}

export class TimeGraphNavigatorBackground extends TimeGraphComponent<null> {
  protected snapEvent: CustomEvent
  protected snapEventString: string

  constructor(
    protected unitController: TimeGraphUnitController,
    protected stateController: TimeGraphStateController
  ) {
    super('navigator_background')
    this.addEvent(
      'mousedown',
      (event) => {
        // Get x position of click (in pixels).
        let x = event.data.getLocalPosition(this._displayObject).x
        // Convert x to units of BigInt Time.
        let center = BIMath.round(
          (x / this.stateController.canvasDisplayWidth) * Number(this.unitController.absoluteRange)
        )
        // We have the center of the new scrollbar position, but need the start of new position.
        // Start = middle - (scrollbarWidth / 2)
        let halfViewWidth = this.unitController.viewRangeLength / BigInt(2)
        let start = center - halfViewWidth
        // Get the maximum and minimum values that start can be.
        // Min = 0 (Handle is farthest left)
        // Max = [The Last Number] - [Length of handle] (Handle is farthest right)
        let max = this.unitController.absoluteRange - this.unitController.viewRangeLength
        let min = BigInt(0)
        // Clamp
        start = BIMath.clamp(start, min, max)
        this.unitController.viewRange = {
          start,
          end: start + this.unitController.viewRangeLength
        }
        // Set snapped state
        this.toggleSnappedState(true)
      },
      this._displayObject
    )
    // Custom event lets handler know 'mouseup' triggers.
    this.snapEvent = new CustomEvent((this.snapEventString = 'snap-x-end'))
    const endSnap = () => {
      this.toggleSnappedState(false)
      document.dispatchEvent(this.snapEvent)
    }
    this.addEvent('mouseup', endSnap, this._displayObject)
    this.addEvent('mouseupoutside', endSnap, this._displayObject)
    this.addEvent(
      'rightdown',
      (event) => {
        // Get x position of click (in pixels).
        let x = event.data.getLocalPosition(this._displayObject).x
        // Convert x to units of BigInt time.
        let clickPoint = BIMath.round(
          (x / this.stateController.canvasDisplayWidth) * Number(this.unitController.absoluteRange)
        )
        // Are we clicking to the left or the right of the current scrollbar position?
        const { start, end } = this.unitController.viewRange
        let newStart = BigInt(0)
        if (clickPoint < start) {
          // If left, move left one page.
          newStart = start - this.unitController.viewRangeLength
        } else if (clickPoint > end) {
          // If right, move right one page.
          newStart = start + this.unitController.viewRangeLength
        }
        // Clamp our new value
        let startMin = BigInt(0)
        let startMax = this.unitController.absoluteRange - this.unitController.viewRangeLength
        newStart = BIMath.clamp(newStart, startMin, startMax)
        // Set new value
        this.unitController.viewRange = {
          start: newStart,
          end: newStart + this.unitController.viewRangeLength
        }
      },
      this._displayObject
    )

    this.update()
  }

  protected toggleSnappedState = (bool: boolean) => {
    this.stateController.snapped = bool
  }

  render(): void {
    this.rect({
      height: 20,
      position: {
        x: 0,
        y: 0
      },
      width: this.stateController.canvasDisplayWidth,
      opacity: 0
    })
  }
}
