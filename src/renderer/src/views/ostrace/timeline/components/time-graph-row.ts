import {
  TimeGraphComponent,
  TimeGraphElementPosition,
  TimeGraphParentComponent,
  TimeGraphStyledRect
} from './time-graph-component'
import { TimelineChart } from '../time-graph-model'
import { TimeGraphStateComponent } from './time-graph-state'
import { TimeGraphAnnotationComponent } from './time-graph-annotation'

export interface TimeGraphRowStyle {
  backgroundColor?: number
  backgroundOpacity?: number
  lineThickness?: number
  lineColor?: number
  lineOpacity?: number
}

export class TimeGraphRow
  extends TimeGraphComponent<TimelineChart.TimeGraphRowModel>
  implements TimeGraphParentComponent
{
  protected _providedModel:
    | {
        range: TimelineChart.TimeGraphRange
        resolution: number
        filterExpressionsMap?: { [key: number]: string[] }
      }
    | undefined
  protected _rowStateComponents: Map<string, TimeGraphStateComponent> = new Map()
  protected _rowAnnotationComponents: Map<string, TimeGraphAnnotationComponent> = new Map()

  constructor(
    id: string,
    protected _options: TimeGraphStyledRect,
    protected _rowIndex: number,
    model?: TimelineChart.TimeGraphRowModel,
    protected _style: TimeGraphRowStyle = {
      lineOpacity: 0.5,
      lineThickness: 1,
      backgroundOpacity: 0
    }
  ) {
    super(id, undefined, model)
  }

  get rowIndex(): number {
    return this._rowIndex
  }

  render() {
    this.rect({
      color: this._style.backgroundColor,
      opacity: this._style.backgroundOpacity,
      height: this._options.height,
      width: this._options.width,
      position: this._options.position
    })
    this.hline({
      color: this._style.lineColor || 0xeeeeee,
      opacity: this._style.lineOpacity || 0.5,
      thickness: this._style.lineThickness || 1,
      width: this._options.width,
      position: {
        x: this._options.position.x,
        y: this._options.position.y + this._options.height / 2
      }
    })
  }

  get position(): TimeGraphElementPosition {
    return this._options.position
  }

  get height(): number {
    return this._options.height
  }

  addChild(child: TimeGraphComponent<any>): void {
    this._displayObject.addChild(child.displayObject)
    child.update()
  }

  removeChild(child: TimeGraphComponent<any>): void {
    this._displayObject.removeChild(child.displayObject)
    child.destroy()
  }

  addState(stateComponent: TimeGraphStateComponent) {
    this._rowStateComponents.set(stateComponent.id, stateComponent)
    this.addChild(stateComponent)
  }

  removeState(stateComponent: TimeGraphStateComponent) {
    this._rowStateComponents.delete(stateComponent.id)
    this.removeChild(stateComponent)
  }

  getStateById(id: string) {
    return this._rowStateComponents.get(id)
  }

  addAnnotation(annotationComponent: TimeGraphAnnotationComponent) {
    this._rowAnnotationComponents.set(annotationComponent.id, annotationComponent)
    this.addChild(annotationComponent)
  }

  removeAnnotation(annotationComponent: TimeGraphAnnotationComponent) {
    this._rowAnnotationComponents.delete(annotationComponent.id)
    this.removeChild(annotationComponent)
  }

  getAnnotationById(id: string) {
    return this._rowAnnotationComponents.get(id)
  }

  get style() {
    return this._style
  }

  set style(style: TimeGraphRowStyle) {
    if (style.backgroundColor !== undefined) {
      this._options.color = style.backgroundColor
      this._style.backgroundColor = style.backgroundColor
    }
    if (style.backgroundOpacity !== undefined) {
      this._style.backgroundOpacity = style.backgroundOpacity
    }
    if (style.lineColor) {
      this._style.lineColor = style.lineColor
    }
    if (style.lineOpacity) {
      this._style.lineOpacity = style.lineOpacity
    }
    if (style.lineThickness) {
      this._style.lineThickness = style.lineThickness
    }
    this.update()
  }

  get providedModel() {
    return this._providedModel
  }

  set providedModel(
    providedModel:
      | {
          range: TimelineChart.TimeGraphRange
          resolution: number
          filterExpressionsMap?: { [key: number]: string[] }
        }
      | undefined
  ) {
    this._providedModel = providedModel
  }
}
