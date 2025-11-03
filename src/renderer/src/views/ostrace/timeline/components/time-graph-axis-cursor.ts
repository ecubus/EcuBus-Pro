import {
  TimeGraphComponent,
  TimeGraphElementPosition,
  TimeGraphComponentOptions
} from './time-graph-component'

export interface TimeGraphAxisCursorOptions extends TimeGraphComponentOptions {
  position: TimeGraphElementPosition
  color: number
}

export class TimeGraphAxisCursor extends TimeGraphComponent<null> {
  constructor(protected _options: TimeGraphAxisCursorOptions) {
    super('cursor')
  }

  render(): void {
    const { position, color } = this._options
    this._displayObject.beginFill(color)
    this._displayObject.moveTo(position.x, position.y)
    this._displayObject.lineTo(position.x - 5, position.y - 5)
    this._displayObject.lineTo(position.x + 5, position.y - 5)
    this._displayObject.lineTo(position.x, position.y)
    this._displayObject.endFill()
  }
}
