import { TimeGraphAxisScale, TimeGraphAxisStyle } from './time-graph-axis-scale'
import { TimeGraphUnitController } from '../time-graph-unit-controller'
import { TimeGraphStateController } from '../time-graph-state-controller'
import { TimeGraphAxisLayerOptions } from '../layer/time-graph-axis'

export interface TimeGraphGridStyle extends TimeGraphAxisStyle {
  lineColor?: number
}

export class TimeGraphGrid extends TimeGraphAxisScale {
  constructor(
    id: string,
    protected _options: TimeGraphGridStyle,
    protected rowHeight: number,
    protected unitController: TimeGraphUnitController,
    protected stateController: TimeGraphStateController
  ) {
    super(id, _options, unitController, stateController)
  }

  protected addEvents() {}

  update(opts?: TimeGraphAxisLayerOptions): void {
    if (opts && opts.lineColor) {
      this._options.lineColor = opts.lineColor
    }
    super.update(this._options)
  }

  render(): void {
    this.renderVerticalLines(false, this._options.lineColor || 0xdddddd, () => ({
      lineHeight: this.stateController.canvasDisplayHeight
    }))
  }
}
