import { TimeGraphComponent, TimeGraphElementPosition } from './time-graph-component'

export interface TimeGraphCursorOptions {
  height: number
  position: TimeGraphElementPosition
  color: number
  thickness?: number
}

export class TimeGraphCursor extends TimeGraphComponent<null> {
  constructor(opts: TimeGraphCursorOptions) {
    super('cursor')
    this._options = opts
  }
  render(): void {
    const { color, height, position, thickness } = this._options as TimeGraphCursorOptions
    this.vline({
      thickness,
      color,
      height,
      position
    })
  }
}
