import { TimeGraphRectangle } from '../components/time-graph-rectangle'
import { TimelineChart } from '../time-graph-model'
import { TimeGraphViewportLayer } from './time-graph-viewport-layer'

export class TimeGraphChartSelectionRange extends TimeGraphViewportLayer {
  protected selectionRange?: TimeGraphRectangle
  protected color: number = 0x0000ff
  private _updateHandler!: {
    (): void
    (selectionRange: TimelineChart.TimeGraphRange): void
    (selectionRange: TimelineChart.TimeGraphRange): void
  }

  constructor(id: string, style?: { color?: number }) {
    super(id)
    this.isScalable = false
    if (style && style.color) {
      this.color = style.color
    }
  }

  protected updateScaleAndPosition() {
    if (this.unitController.selectionRange && this.selectionRange) {
      const firstCursorPosition = this.getWorldPixel(this.unitController.selectionRange.start)
      const width = this.getPixel(
        this.unitController.selectionRange.end - this.unitController.selectionRange.start
      )
      this.selectionRange.update({
        position: {
          x: firstCursorPosition,
          y: 0
        },
        height: this.stateController.canvasDisplayHeight,
        width
      })
    }
  }

  protected afterAddToContainer() {
    this._updateHandler = (): void => this.update()
    this.stateController.onWorldRender(this._updateHandler)
    this.unitController.onSelectionRangeChange(this._updateHandler)
    this.stateController.onScaleFactorChange(this._updateHandler)
    this.update()
  }

  protected removeSelectionRange() {
    this.removeChildren()
    delete this.selectionRange
  }

  update() {
    if (this.unitController.selectionRange) {
      /**
       * When user selects a range on the timeline chart, the selection position must correspond to the cursor of the user,
       * and not the timeline chart itself since scaling might be applied.
       */
      const firstCursorPosition = this.getWorldPixel(this.unitController.selectionRange.start)
      const secondCursorPosition = this.getWorldPixel(this.unitController.selectionRange.end)
      if (secondCursorPosition !== firstCursorPosition) {
        if (!this.selectionRange) {
          this.selectionRange = new TimeGraphRectangle({
            color: this.color,
            opacity: 0.2,
            position: {
              x: firstCursorPosition,
              y: 0
            },
            height: this.stateController.canvasDisplayHeight,
            width: secondCursorPosition - firstCursorPosition
          })
          this.addChild(this.selectionRange)
        } else {
          this.selectionRange.update({
            position: {
              x: firstCursorPosition,
              y: 0
            },
            height: this.stateController.canvasDisplayHeight,
            width: secondCursorPosition - firstCursorPosition
          })
        }
      } else {
        this.removeSelectionRange()
      }
    } else {
      this.removeSelectionRange()
    }
  }

  destroy(): void {
    if (this.unitController) {
      this.stateController.removeWorldRenderHandler(this._updateHandler)
      this.unitController.removeSelectionRangeChangedHandler(this._updateHandler)
    }
    super.destroy()
  }
}
