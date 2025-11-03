import { TimeGraphRowController } from '../time-graph-row-controller'
import { TimeGraphViewportLayer } from './time-graph-viewport-layer'

export abstract class TimeGraphChartLayer extends TimeGraphViewportLayer {
  constructor(
    id: string,
    protected rowController: TimeGraphRowController
  ) {
    super(id)
  }
}
