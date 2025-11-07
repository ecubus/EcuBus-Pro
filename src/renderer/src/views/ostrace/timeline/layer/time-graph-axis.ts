import { TimeGraphAxisScale, TimeGraphAxisStyle } from '../components/time-graph-axis-scale'
import { TimeGraphLayer, TimeGraphLayerOptions } from './time-graph-layer'
import * as _ from 'lodash'
import { TimelineChart } from '../time-graph-model'
import { BIMath } from '../bigint-utils'

export interface TimeGraphAxisLayerOptions extends TimeGraphLayerOptions {
  lineColor?: number
}

export class TimeGraphAxis extends TimeGraphLayer {
  protected scaleComponent!: TimeGraphAxisScale
  protected controlKeyDown!: boolean
  private _updateHandler!: {
    (): void
    (selectionRange: TimelineChart.TimeGraphRange): void
    (viewRange: TimelineChart.TimeGraphRange): void
    (viewRange: TimelineChart.TimeGraphRange): void
    (selectionRange: TimelineChart.TimeGraphRange): void
  }
  private _mouseWheelHandler!: _.DebouncedFunc<(ev: WheelEvent) => boolean>
  private _keyUpHandler!: { (event: KeyboardEvent): void; (this: Document, ev: KeyboardEvent): any }
  private _keyDownHandler!: {
    (event: KeyboardEvent): void
    (this: Document, ev: KeyboardEvent): any
  }

  constructor(
    id: string,
    protected style?: { color?: number; lineColor?: number; verticalAlign?: string }
  ) {
    super(id)
  }

  protected getOptions(): TimeGraphAxisStyle {
    let color
    let lineColor
    let verticalAlign: string | undefined = 'top' // Default position is top, same as CSS verticalAlign is 'baseline'

    if (this.style) {
      color = this.style.color
      lineColor = this.style.lineColor
      verticalAlign = this.style.verticalAlign
    }

    return {
      height: this.stateController.canvasDisplayHeight,
      width: this.stateController.canvasDisplayWidth,
      position: {
        x: 0,
        y: 0
      },
      color,
      lineColor,
      verticalAlign
    }
  }

  protected afterAddToContainer() {
    this.controlKeyDown = false
    this._keyDownHandler = (event: KeyboardEvent) => {
      this.controlKeyDown = event.ctrlKey
    }
    document.addEventListener('keydown', this._keyDownHandler)
    this._keyUpHandler = (event: KeyboardEvent) => {
      this.controlKeyDown = event.ctrlKey
    }
    document.addEventListener('keyup', this._keyUpHandler)
    this._mouseWheelHandler = _.throttle((ev: WheelEvent) => {
      if (this.controlKeyDown) {
        // ZOOM AROUND MOUSE POINTER
        const zoomPosition = BIMath.round(ev.offsetX / this.stateController.zoomFactor)
        const zoomIn = ev.deltaY < 0
        const newViewRangeLength = BIMath.clamp(
          Number(this.unitController.viewRangeLength) * (zoomIn ? 0.8 : 1.25),
          BigInt(1),
          this.unitController.absoluteRange
        )
        const center = this.unitController.viewRange.start + zoomPosition
        const start = BIMath.clamp(
          Number(center) -
            (Number(zoomPosition) * Number(newViewRangeLength)) /
              Number(this.unitController.viewRangeLength),
          BigInt(0),
          this.unitController.absoluteRange - newViewRangeLength
        )
        const end = start + newViewRangeLength
        this.unitController.viewRange = {
          start,
          end
        }
      } else {
        // PANNING
        const shiftStep = ev.deltaY
        const oldViewRange = this.unitController.viewRange
        let start = oldViewRange.start + BIMath.round(shiftStep / this.stateController.zoomFactor)
        if (start < 0) {
          start = BigInt(0)
        }
        let end = start + this.unitController.viewRangeLength
        if (end > this.unitController.absoluteRange) {
          start = this.unitController.absoluteRange - this.unitController.viewRangeLength
          end = this.unitController.absoluteRange
        }
        this.unitController.viewRange = { start, end }
      }
      ev.preventDefault()
      return false
    })
    this.onCanvasEvent('mousewheel', this._mouseWheelHandler as any)
    this.onCanvasEvent('wheel', this._mouseWheelHandler as any)
    this.scaleComponent = new TimeGraphAxisScale(
      this.id + '_scale',
      this.getOptions(),
      this.unitController,
      this.stateController
    )
    this.addChild(this.scaleComponent)

    this._updateHandler = (): void => this.update()
    this.unitController.onSelectionRangeChange(this._updateHandler)
    this.unitController.onViewRangeChanged(this._updateHandler)
  }

  update(opts?: TimeGraphAxisLayerOptions) {
    if (opts && this.style) {
      this.style.lineColor = opts.lineColor
    }
    this.scaleComponent.update(this.getOptions())
  }

  destroy(): void {
    if (this.unitController) {
      this.unitController.removeViewRangeChangedHandler(this._updateHandler)
      this.unitController.removeSelectionRangeChangedHandler(this._updateHandler)
    }
    if (this._mouseWheelHandler) {
      this.removeOnCanvasEvent('mousewheel', this._mouseWheelHandler as any)
      this.removeOnCanvasEvent('wheel', this._mouseWheelHandler as any)
    }
    if (this._keyDownHandler) {
      document.removeEventListener('keydown', this._keyDownHandler)
    }
    if (this._keyUpHandler) {
      document.removeEventListener('keyup', this._keyUpHandler)
    }
    super.destroy()
  }
}
