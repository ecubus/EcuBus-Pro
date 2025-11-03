import { TimeGraphRectangle } from '../components/time-graph-rectangle'
import { TimelineChart } from '../time-graph-model'
import { TimeGraphChartProviders } from './time-graph-chart'
import { TimeGraphViewportLayer } from './time-graph-viewport-layer'

export class TimeGraphRangeEventsLayer extends TimeGraphViewportLayer {
  protected rangeEvents: Map<TimelineChart.TimeGraphAnnotation, TimeGraphRectangle>
  protected providers: TimeGraphChartProviders

  private _worldRangeUpdateHandler: {
    (): void
    (worldRange: TimelineChart.TimeGraphRange): void
    (worldRange: TimelineChart.TimeGraphRange): void
  }

  constructor(id: string, providers: TimeGraphChartProviders) {
    super(id)
    this.providers = providers
  }

  protected afterAddToContainer() {
    this._worldRangeUpdateHandler = (): void => this.update()
    this.stateController.onWorldRender(this._worldRangeUpdateHandler)
  }

  protected addRangeEvent(rangeEvent: TimelineChart.TimeGraphAnnotation) {
    const start = this.getWorldPixel(rangeEvent.range.start)
    const end = this.getWorldPixel(rangeEvent.range.end)
    const width = end - start
    const elementStyle = this.providers.rowAnnotationStyleProvider
      ? this.providers.rowAnnotationStyleProvider(rangeEvent)
      : undefined
    const rangeEventComponent = new TimeGraphRectangle({
      color: elementStyle ? elementStyle.color : 0x000000,
      opacity: elementStyle ? elementStyle.opacity : 1.0,
      position: {
        x: start,
        y: 0
      },
      height: this.stateController.canvasDisplayHeight,
      width
    })
    this.rangeEvents.set(rangeEvent, rangeEventComponent)
    this.addChild(rangeEventComponent)
  }

  addRangeEvents(rangeEvents: TimelineChart.TimeGraphAnnotation[]): void {
    if (!this.stateController) {
      throw 'Add the TimeGraphRangeEventsLayer to a container before adding range events.'
    }
    if (this.rangeEvents) {
      this.removeChildren()
    }
    this.rangeEvents = new Map()
    rangeEvents.forEach((range) => {
      this.addRangeEvent(range)
    })
  }

  update(): void {
    if (this.rangeEvents) {
      for (const range of this.rangeEvents.keys()) {
        this.updateRangeEvent(range)
      }
    }
  }

  protected updateRangeEvent(rangeEvent: TimelineChart.TimeGraphAnnotation) {
    const rangeEventComponent = this.rangeEvents.get(rangeEvent)
    const start = this.getWorldPixel(rangeEvent.range.start)
    const end = this.getWorldPixel(rangeEvent.range.end)
    const width = end - start
    if (rangeEventComponent) {
      rangeEventComponent.update({
        position: {
          x: start,
          y: 0
        },
        height: this.stateController.canvasDisplayHeight,
        width
      })
    }
  }

  destroy(): void {
    if (this.unitController) {
      this.stateController.removeWorldRenderHandler(this._worldRangeUpdateHandler)
    }
    super.destroy()
  }
}
