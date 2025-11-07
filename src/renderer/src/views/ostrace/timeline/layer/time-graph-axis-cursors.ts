import { TimeGraphAxisCursor } from '../components/time-graph-axis-cursor'
import { TimelineChart } from '../time-graph-model'
import { TimeGraphLayer } from './time-graph-layer'

export class TimeGraphAxisCursors extends TimeGraphLayer {
  protected firstCursor?: TimeGraphAxisCursor
  protected secondCursor?: TimeGraphAxisCursor
  protected color: number = 0x0000ff
  private _updateHandler!: {
    (): void
    (viewRange: TimelineChart.TimeGraphRange): void
    (selectionRange: TimelineChart.TimeGraphRange): void
    (viewRange: TimelineChart.TimeGraphRange): void
    (selectionRange: TimelineChart.TimeGraphRange): void
  }

  constructor(id: string, style?: { color?: number }) {
    super(id)

    if (style && style.color) {
      this.color = style.color
    }
  }

  afterAddToContainer() {
    this._updateHandler = (): void => this.update()
    this.unitController.onViewRangeChanged(this._updateHandler)
    this.unitController.onSelectionRangeChange(this._updateHandler)
    this.update()
  }

  update(): void {
    if (this.unitController.selectionRange) {
      const firstCursorPosition = this.getPixel(
        this.unitController.selectionRange.start - this.unitController.viewRange.start
      )
      const secondCursorPosition = this.getPixel(
        this.unitController.selectionRange.end - this.unitController.viewRange.start
      )
      const firstOpts = {
        color: this.color,
        position: {
          x: firstCursorPosition,
          y: this.stateController.canvasDisplayHeight
        }
      }
      if (!this.firstCursor) {
        this.firstCursor = new TimeGraphAxisCursor(firstOpts)
        this.addChild(this.firstCursor)
      } else {
        this.firstCursor.update(firstOpts)
      }
      if (secondCursorPosition !== firstCursorPosition) {
        const secondOpts = {
          color: this.color,
          position: {
            x: secondCursorPosition,
            y: this.stateController.canvasDisplayHeight
          }
        }
        if (!this.secondCursor) {
          this.secondCursor = new TimeGraphAxisCursor(secondOpts)
          this.addChild(this.secondCursor)
        } else {
          this.secondCursor.update(secondOpts)
        }
      } else if (this.secondCursor) {
        this.secondCursor.clear()
      }
    } else {
      this.removeChildren()
      delete this.firstCursor
      delete this.secondCursor
    }
  }

  destroy(): void {
    if (this.unitController) {
      this.unitController.removeViewRangeChangedHandler(this._updateHandler)
      this.unitController.removeSelectionRangeChangedHandler(this._updateHandler)
    }
    super.destroy()
  }
}
