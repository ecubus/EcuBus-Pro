import {
  TimeGraphComponent,
  TimeGraphStyledRect,
  TimeGraphElementPosition
} from './time-graph-component'
import { TimeGraphRow } from './time-graph-row'
import { TimelineChart } from '../time-graph-model'
import { FontController } from '../time-graph-font-controller'
import * as PIXI from 'pixi.js-legacy'

export interface TimeGraphStateStyle {
  color?: number
  opacity?: number
  height?: number
  borderWidth?: number
  borderColor?: number
  scale?: number
}

/**
 * Using BitMapText.getLocalBounds() to measure the full label width is expensive, because
 * we need to create a BitMapText object to use it. This means that we need to create a BitMapText
 * for every state, even if we don't use it. When we remove the states, these objects need to
 * be removed as well. In the case where we have a lot states, this cause multiple garbage collection
 * and hogs the performance of the timeline chart.
 *
 * An alternative to measure the width of the label is to use PIXI.TextMetrics.measureText().
 * However, this method applies only for Text objects, and not BitMapText; therefore there is a
 * slight difference between the values returned by the two methods. PIXI.TextMetrics returns a
 * slightly smaller value. Currently, PIXI does not support measureText() for BitMapText.
 *
 * Through some trials, it looks like the ratio between the text width returned by the two methods is
 * consistent. Hence, we can use PIXI.TextMetrics.measureText() to get a good estimation of the text width,
 * then multiply with the SCALING_FACTOR to determine the actual width of the label when rendered
 * with BitMapText.
 *
 * SCALING_FACTOR = BitMapText.getLocalBounds() / PIXI.TextMetrics.measureText()
 */
const SCALING_FACTOR = 1.04

export class TimeGraphStateComponent extends TimeGraphComponent<TimelineChart.TimeGraphState> {
  static fontController: FontController = new FontController()

  protected _options: TimeGraphStyledRect
  private textLabelObject: PIXI.BitmapText | undefined

  constructor(
    id: string,
    model: TimelineChart.TimeGraphState,
    xStart: number,
    xEnd: number,
    protected _row: TimeGraphRow,
    protected _style: TimeGraphStateStyle = { color: 0xfffa66, height: 14 },
    protected displayWidth: number,
    protected scaleFactor: number,
    displayObject?: PIXI.Graphics
  ) {
    super(id, displayObject, model)
    const height = _row.height === 0 ? 0 : Math.min(_style.height || 14, _row.height - 1)
    const position = {
      x: xStart,
      y: this._row.position.y + (this.row.height - height) / 2
    }
    // min width of a state should never be less than 1 (for visibility)
    const width = Math.max(1, xEnd - xStart)
    this._options = {
      color: _style.color,
      opacity: _style.opacity,
      height,
      position,
      width,
      displayWidth,
      borderRadius: 2,
      borderWidth: _style.borderWidth || 0,
      borderColor: _style.borderColor || 0x000000
    }
  }

  /**
   * Conveniently generate the labels of states and apply proper scaling when zooming
   */
  renderLabel() {
    if (!this.model.label) {
      return
    }
    const { fontName, fontStyle } =
      TimeGraphStateComponent.fontController.getFont(
        this._options.color ? this._options.color : 0,
        this._options.height - 2
      ) || TimeGraphStateComponent.fontController.getDefaultFont()
    const position = {
      x:
        this._options.position.x + this._options.width < 0
          ? this._options.position.x
          : Math.max(0, this._options.position.x),
      y: this._options.position.y
    }
    const displayWidth = this._options.displayWidth ? this._options.displayWidth : 0
    const labelText = this.model.label
    const textPadding = 0.5
    if (displayWidth < 3) {
      this.removeLabel()
      return
    }

    if (fontStyle) {
      const metrics = PIXI.TextMetrics.measureText(this.model.label, fontStyle)
      // Round the text width up just to be sure that it will fit in the state
      const textWidth = Math.ceil((metrics.width * SCALING_FACTOR) / this.scaleFactor)

      let textObjX = position.x + textPadding
      const textObjY = position.y + textPadding
      let displayLabel = ''

      if (displayWidth > textWidth) {
        textObjX = position.x + (displayWidth - textWidth) / 2
        displayLabel = labelText
      } else {
        const textScaler = displayWidth / textWidth
        const index = Math.min(Math.floor(textScaler * labelText.length), labelText.length - 1)
        const partialLabel = labelText.substr(0, Math.max(index - 1, 0))
        if (partialLabel.length > 0) {
          displayLabel = partialLabel.concat('…')
        }
      }

      if (displayLabel === '') {
        this.removeLabel()
        return
      }

      if (!this.textLabelObject) {
        this.textLabelObject = new PIXI.BitmapText(displayLabel, { fontName: fontName })
        this.displayObject.addChild(this.textLabelObject)
      } else {
        this.textLabelObject.text = displayLabel
      }

      this.textLabelObject.alpha = this._options.opacity ?? 1
      this.textLabelObject.x = textObjX
      this.textLabelObject.y = textObjY
      this.textLabelObject.scale.x = 1 / this.scaleFactor
    }
  }

  /**
   * Scale only state labels that actually have text displayed.
   *
   * @param scaleFactor
   */
  scaleLabel(scaleFactor: number) {
    this.scaleFactor = scaleFactor
    if (this.textLabelObject && this.textLabelObject.scale) {
      this.renderLabel()
    }
  }

  private removeLabel() {
    if (this.textLabelObject) {
      this.textLabelObject.destroy()
      this.textLabelObject = undefined
    }
  }

  get height(): number {
    return this._options.height
  }

  get width(): number {
    return this._options.width
  }

  get position(): TimeGraphElementPosition {
    return this._options.position
  }

  get row(): TimeGraphRow {
    return this._row
  }

  get style() {
    return this._style
  }

  set style(style: TimeGraphStateStyle) {
    if (style.color !== undefined) {
      this._options.color = style.color
    }
    if (style.opacity !== undefined) {
      this._options.opacity = style.opacity
    }
    if (style.height !== undefined) {
      this._options.height = style.height
    }
    if (style.borderColor !== undefined) {
      this._options.borderColor = style.borderColor
    }
    if (style.borderWidth !== undefined) {
      this._options.borderWidth = style.borderWidth
    }
    this.update()
  }

  update(opts?: TimeGraphStyledRect) {
    if (opts) {
      this._options.position = opts.position
      this._options.width = opts.width
      this._options.displayWidth = opts.displayWidth
    }
    super.update()
  }

  render() {
    this.rect(this._options)
    this.renderLabel()
  }

  clear() {
    super.clear()
  }
}
