import { TimelineChart } from './time-graph-model'
import { TimeGraphRenderController } from './time-graph-render-controller'

export class TimeGraphUnitController {
  protected absoluteRangeChangedHandlers: ((absoluteRange: bigint) => void)[]
  protected _absoluteRange: bigint

  protected viewRangeChangedHandlers: ((
    oldRange: TimelineChart.TimeGraphRange,
    newRange: TimelineChart.TimeGraphRange
  ) => void)[]
  protected _viewRange: TimelineChart.TimeGraphRange

  /**
   * This determines the world size.
   * worldRenderFactor = 1 renders one extra viewRange to the left and right,
   *      so there are three viewRanges rendered.
   */
  private _worldRenderFactor = 1

  protected selectionRangeChangedHandlers: ((newRange?: TimelineChart.TimeGraphRange) => void)[]
  protected _selectionRange?: TimelineChart.TimeGraphRange

  protected _offset: bigint = BigInt(0)

  protected _renderer: TimeGraphRenderController
  /**
   *  Create a string from the given number, which is shown in TimeAxis.
   *  Or return undefined to not show any text for that number.
   */
  numberTranslator?: (theNumber: bigint) => string | undefined
  scaleSteps?: number[]

  constructor(absoluteRange: bigint, viewRange?: TimelineChart.TimeGraphRange) {
    this._absoluteRange = absoluteRange
    this._viewRange = viewRange || { start: BigInt(0), end: absoluteRange }

    this.absoluteRangeChangedHandlers = []
    this.viewRangeChangedHandlers = []
    this.selectionRangeChangedHandlers = []

    this._renderer = new TimeGraphRenderController()
  }

  protected handleAbsoluteRangeChange() {
    this.absoluteRangeChangedHandlers.forEach((handler) => handler(this._absoluteRange))
  }

  protected handleViewRangeChange(oldRange: TimelineChart.TimeGraphRange) {
    this.viewRangeChangedHandlers.forEach((handler) => handler(oldRange, this._viewRange))
  }

  protected handleSelectionRangeChange() {
    this.selectionRangeChangedHandlers.forEach((handler) => handler(this._selectionRange))
  }

  onAbsoluteRangeChanged(handler: (absoluteRange: bigint) => void) {
    this.absoluteRangeChangedHandlers.push(handler)
  }

  onViewRangeChanged(
    handler: (
      oldRange: TimelineChart.TimeGraphRange,
      viewRange: TimelineChart.TimeGraphRange
    ) => void
  ) {
    this.viewRangeChangedHandlers.push(handler)
  }

  removeAbsoluteRangeChangedHandler(handler: (absoluteRange: bigint) => void) {
    const index = this.absoluteRangeChangedHandlers.indexOf(handler)
    if (index > -1) {
      this.absoluteRangeChangedHandlers.splice(index, 1)
    }
  }

  removeViewRangeChangedHandler(
    handler: (
      oldRange: TimelineChart.TimeGraphRange,
      viewRange: TimelineChart.TimeGraphRange
    ) => void
  ) {
    const index = this.viewRangeChangedHandlers.indexOf(handler)
    if (index > -1) {
      this.viewRangeChangedHandlers.splice(index, 1)
    }
  }

  onSelectionRangeChange(handler: (selectionRange: TimelineChart.TimeGraphRange) => void) {
    this.selectionRangeChangedHandlers.push(handler)
  }

  removeSelectionRangeChangedHandler(
    handler: (selectionRange: TimelineChart.TimeGraphRange) => void
  ) {
    const index = this.selectionRangeChangedHandlers.indexOf(handler)
    if (index > -1) {
      this.selectionRangeChangedHandlers.splice(index, 1)
    }
  }

  get absoluteRange(): bigint {
    return this._absoluteRange
  }

  set absoluteRange(absoluteRange: bigint) {
    if (this._absoluteRange !== absoluteRange) {
      this._absoluteRange = absoluteRange
      this.handleAbsoluteRangeChange()
    }
  }

  get viewRange(): TimelineChart.TimeGraphRange {
    return this._viewRange
  }

  set viewRange(newRange: TimelineChart.TimeGraphRange) {
    // Making a deep copy
    const oldRange = {
      start: this._viewRange.start,
      end: this._viewRange.end
    }

    if (newRange.end > newRange.start) {
      this._viewRange = { start: newRange.start, end: newRange.end }
    }
    if (newRange.start < 0) {
      this._viewRange.start = BigInt(0)
    }
    // if (this._viewRange.end > this.absoluteRange) {
    //   this._viewRange.end = this.absoluteRange
    // }
    this.handleViewRangeChange(oldRange)
  }

  get selectionRange(): TimelineChart.TimeGraphRange | undefined {
    return this._selectionRange
  }

  set selectionRange(value: TimelineChart.TimeGraphRange | undefined) {
    this._selectionRange = value
    this.handleSelectionRangeChange()
  }

  get viewRangeLength(): bigint {
    return this._viewRange.end - this._viewRange.start
  }

  get offset(): bigint {
    return this._offset
  }

  set offset(offset: bigint) {
    this._offset = offset
  }

  get worldRenderFactor(): number {
    return this._worldRenderFactor
  }

  set worldRenderFactor(n: number) {
    this._worldRenderFactor = n
  }
}
