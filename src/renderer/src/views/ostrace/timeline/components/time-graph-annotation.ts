import * as PIXI from 'pixi.js-legacy'
import { TimelineChart } from '../time-graph-model'
import {
  TimeGraphComponent,
  TimeGraphElementPosition,
  TimeGraphComponentOptions
} from './time-graph-component'
import { TimeGraphRow } from './time-graph-row'

export interface TimeGraphAnnotationComponentOptions extends TimeGraphComponentOptions {
  position: TimeGraphElementPosition
}

export interface TimeGraphAnnotationStyle extends TimeGraphComponentOptions {
  symbol?: string
  size?: number
  color?: number
  opacity?: number
  verticalAlign?: string
}

/*
 * This is only implementing a subset of the tick elements so far
 */
export class TimeGraphAnnotationComponent extends TimeGraphComponent<TimelineChart.TimeGraphAnnotation> {
  // TODO: make a map of the display objects
  // e.g. cross-14-black-middle etc...
  // and then use this._displayObject.addChild(cross-14-black-middle) in the draw.
  // if performance is an issue

  protected _size: number

  constructor(
    id: string,
    model: TimelineChart.TimeGraphAnnotation,
    protected _options: TimeGraphAnnotationComponentOptions,
    protected _style: TimeGraphAnnotationStyle = {
      color: 0,
      size: 7,
      symbol: 'cross',
      verticalAlign: 'middle'
    },
    protected _row: TimeGraphRow,
    protected scaleFactor: number,
    displayObject?: PIXI.Graphics
  ) {
    super(id, displayObject, model)
    this._size = _style.size || 7
    // called to ensure consistency. Only the X component is used from options.
    this.update(_options)
  }

  update(opts?: TimeGraphAnnotationComponentOptions): void {
    if (opts) {
      this._options.position.x = opts.position.x
      this.updateYPosition()
    }
    super.update()
  }

  get row(): TimeGraphRow {
    return this._row
  }

  private updateYPosition() {
    const align = this._style.verticalAlign
    const size = this._style.size
    if (!!size) {
      const offset =
        align == 'top' ? size : align == 'bottom' ? this._row.height - size : this._row.height / 2
      this._options.position.y = this._row.position.y + offset
    }
  }

  render(): void {
    const { symbol } = this._style as TimeGraphAnnotationStyle
    const size = this._size
    const x = this._options.position.x * this.scaleFactor
    const y = this._options.position.y

    if (symbol === undefined || symbol == 'none') {
      return
    }
    if (symbol == 'circle') {
      this.drawCircle(x, y, size)
    } else if (symbol == 'cross') {
      this.drawCross(x, y, size)
    } else if (symbol == 'plus') {
      this.drawPlus(x, y, size)
    } else if (symbol == 'diamond') {
      this.drawDiamond(x, y, size)
    } else if (symbol == 'triangle') {
      this.drawTriangle(x, y, size)
    } else if (symbol == 'inverted-triangle') {
      this.drawInvertedTriangle(x, y, size)
    } else {
      this.drawPlus(x, y, size)
    }
    this._displayObject.scale.x = 1 / this.scaleFactor
  }

  /**
   * Scale only annotations labels that actually have object displayed.
   *
   * @param scaleFactor
   */
  scaleAnnotation(scaleFactor: number) {
    this.scaleFactor = scaleFactor
    if (this._displayObject && this._displayObject.scale) {
      this.render()
    }
  }

  private drawCircle(x: number, y: number, radius: number): void {
    this._displayObject.clear()
    this._displayObject.beginFill(this._style.color, this.getPIXIOpacity(this._style.opacity))
    this._displayObject.lineStyle(0)
    this._displayObject.drawCircle(x, y, radius)
    this._displayObject.endFill()
    //this._displayObject.cacheAsBitmap = true;
  }

  // thickness = 20
  private drawCross(x: number, y: number, size: number): void {
    this._displayObject.clear()
    this._displayObject.beginFill(this._style.color, this.getPIXIOpacity(this._style.opacity))
    this._displayObject.lineStyle(0)
    // Root of two thickness
    const thickness = 0.14 * size

    this._displayObject.drawPolygon([
      x - size,
      y - size + thickness,
      x - thickness,
      y,
      x - size,
      y + size - thickness,
      x - size + thickness,
      y + size,
      x,
      y + thickness,
      x + size - thickness,
      y + size,
      x + size,
      y + size - thickness,
      x + thickness,
      y,
      x + size,
      y - size + thickness,
      x + size - thickness,
      y - size,
      x,
      y - thickness,
      x - size + thickness,
      y - size,
      x - size,
      y - size + thickness
    ])
    this._displayObject.endFill()
    //this._displayObject.cacheAsBitmap = true;
  }

  // thickness = 20%
  private drawPlus(x: number, y: number, size: number): void {
    this._displayObject.clear()
    this._displayObject.beginFill(this._style.color, this.getPIXIOpacity(this._style.opacity))
    this._displayObject.lineStyle(0)
    // half thickness
    const thickness = 0.1 * size
    this._displayObject.drawPolygon([
      x - thickness,
      y - size,
      x - thickness,
      y - thickness,
      x - size,
      y - thickness,
      x - size,
      y + thickness,
      x - thickness,
      y + thickness,
      x - thickness,
      y + size,
      x + thickness,
      y + size,
      x + thickness,
      y + thickness,
      x + size,
      y + thickness,
      x + size,
      y - thickness,
      x + thickness,
      y - thickness,
      x + thickness,
      y - size,
      x - thickness,
      y - size
    ])
    this._displayObject.endFill()
    //this._displayObject.cacheAsBitmap = true;
  }

  private drawDiamond(x: number, y: number, size: number): void {
    this._displayObject.clear()
    this._displayObject.beginFill(this._style.color, this.getPIXIOpacity(this._style.opacity))
    this._displayObject.lineStyle(0)
    this._displayObject.drawPolygon([
      x - size,
      y,
      x,
      y - size,
      x + size,
      y,
      x,
      y + size,
      x - size,
      y
    ])
    this._displayObject.endFill()
    //this._displayObject.cacheAsBitmap = true;
  }

  private drawTriangle(x: number, y: number, size: number): void {
    this._displayObject.clear()
    this._displayObject.beginFill(this._style.color, this.getPIXIOpacity(this._style.opacity))
    this._displayObject.lineStyle(0)
    this._displayObject.drawPolygon([x - size, y + size, x, y - size, x + size, y + size])
    this._displayObject.endFill()
    //this._displayObject.cacheAsBitmap = true;
  }

  private drawInvertedTriangle(x: number, y: number, size: number): void {
    this._displayObject.clear()
    this._displayObject.beginFill(this._style.color, this.getPIXIOpacity(this._style.opacity))
    this._displayObject.lineStyle(0)
    this._displayObject.drawPolygon([x + size, y - size, x, y + size, x - size, y - size])
    this._displayObject.endFill()
    //this._displayObject.cacheAsBitmap = true;
  }
}
