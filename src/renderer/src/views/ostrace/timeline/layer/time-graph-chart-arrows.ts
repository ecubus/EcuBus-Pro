import { TimeGraphArrowComponent, TimeGraphArrowCoordinates } from '../components/time-graph-arrow'
import { TimeGraphElementPosition } from '../components/time-graph-component'
import { TimelineChart } from '../time-graph-model'
import { TimeGraphRowController } from '../time-graph-row-controller'
import { TimeGraphChartLayer } from './time-graph-chart-layer'

export class TimeGraphChartArrows extends TimeGraphChartLayer {
  protected arrows: Map<TimelineChart.TimeGraphArrow, TimeGraphArrowComponent>
  protected rowIds: number[] = []
  private _updateHandler: {
    (): void
    (worldRange: TimelineChart.TimeGraphRange): void
    (worldRange: TimelineChart.TimeGraphRange): void
  }

  constructor(
    id: string,
    protected rowController: TimeGraphRowController
  ) {
    super(id, rowController)
    this.isScalable = false
  }

  protected afterAddToContainer() {
    this._updateHandler = (): void => this.update()
    this.stateController.onWorldRender(this._updateHandler)
    this.stateController.onScaleFactorChange(this._updateHandler)

    this.rowController.onVerticalOffsetChangedHandler((verticalOffset) => {
      this.layer.position.y = -verticalOffset
    })
  }

  protected getCoordinates(
    arrow: TimelineChart.TimeGraphArrow
  ): TimeGraphArrowCoordinates | undefined {
    const sourceIndex = this.rowIds.indexOf(arrow.sourceId)
    const destinationIndex = this.rowIds.indexOf(arrow.destinationId)
    if (sourceIndex === -1 || destinationIndex === -1) {
      return undefined
    }
    const start: TimeGraphElementPosition = {
      x: this.getWorldPixel(arrow.range.start),
      y: sourceIndex * this.rowController.rowHeight + this.rowController.rowHeight / 2
    }
    const end: TimeGraphElementPosition = {
      x: this.getWorldPixel(arrow.range.end),
      y: destinationIndex * this.rowController.rowHeight + this.rowController.rowHeight / 2
    }
    return { start, end }
  }

  protected addArrow(arrow: TimelineChart.TimeGraphArrow) {
    const coords = this.getCoordinates(arrow)
    if (!coords) {
      return
    }
    const arrowComponent = new TimeGraphArrowComponent('arrow', arrow, coords)
    this.arrows.set(arrow, arrowComponent)
    this.addChild(arrowComponent)
  }

  addArrows(arrows: TimelineChart.TimeGraphArrow[], rowIds: number[]): void {
    this.rowIds = rowIds
    if (!this.stateController) {
      throw 'Add this TimeGraphChartArrows to a container before adding arrows.'
    }
    if (this.arrows) {
      this.removeChildren()
    }
    this.arrows = new Map()
    arrows.forEach((arrow) => {
      this.addArrow(arrow)
    })
  }

  update(): void {
    if (this.arrows) {
      for (const arrow of this.arrows.keys()) {
        this.updateArrow(arrow)
      }
    }
  }

  protected updateArrow(arrow: TimelineChart.TimeGraphArrow) {
    const arrowComponent = this.arrows.get(arrow)
    if (arrowComponent) {
      const coords = this.getCoordinates(arrow)
      if (!coords) {
        this.removeChild(arrowComponent)
        this.arrows.delete(arrow)
      } else {
        arrowComponent.update(coords)
      }
    }
  }

  destroy(): void {
    if (this.unitController) {
      this.stateController.removeWorldRenderHandler(this._updateHandler)
    }
    super.destroy()
  }
}
