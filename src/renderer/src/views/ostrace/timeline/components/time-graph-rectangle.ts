import { TimeGraphComponent, TimeGraphStyledRect } from './time-graph-component'

export class TimeGraphRectangle extends TimeGraphComponent<null> {
  protected _options: TimeGraphStyledRect

  constructor(protected opts: TimeGraphStyledRect) {
    super('rect')
    this._options = opts
  }

  update(opts?: TimeGraphStyledRect): void {
    if (opts) {
      this._options.width = opts.width
      this._options.height = opts.height
      this._options.position = opts.position
      if (opts.color) {
        this._options.color = opts.color
      }
    }
    super.update()
  }

  render(): void {
    this.rect(this._options)
  }
}
