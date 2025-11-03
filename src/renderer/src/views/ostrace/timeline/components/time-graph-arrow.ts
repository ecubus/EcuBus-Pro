import * as PIXI from 'pixi.js-legacy'

import { TimelineChart } from '../time-graph-model'
import {
  TimeGraphComponent,
  TimeGraphElementPosition,
  TimeGraphComponentOptions
} from './time-graph-component'

export interface TimeGraphArrowCoordinates extends TimeGraphComponentOptions {
  start: TimeGraphElementPosition
  end: TimeGraphElementPosition
}

export class TimeGraphArrowComponent extends TimeGraphComponent<TimelineChart.TimeGraphArrow> {
  protected head: PIXI.Graphics

  constructor(
    id: string,
    model: TimelineChart.TimeGraphArrow,
    protected _options: TimeGraphArrowCoordinates
  ) {
    super(id, undefined, model)

    this.head = new PIXI.Graphics()
    this._displayObject.addChild(this.head)
  }

  render(): void {
    const { start, end } = this._options as TimeGraphArrowCoordinates
    this._displayObject.lineStyle(1, 0x000000)
    this._displayObject.moveTo(start.x, start.y)
    this._displayObject.lineTo(end.x, end.y)

    // const edge = Math.sqrt((8*8)+(2*2));
    // const cos_a = Math.cos(Math.atan2(end.y - start.y, end.x - start.x) + Math.atan2(2, 8));
    // const cos_b = Math.cos(Math.atan2(end.y - start.y, end.x - start.x) - Math.atan2(2, 8));
    // const xa = edge * cos_a;
    // const ya = Math.sqrt((edge*edge) - (xa*xa));
    // const xb = edge * cos_b;
    // const yb = Math.sqrt((edge*edge) - (xb*xb));

    // this._displayObject.beginFill(0x000000);
    // this._displayObject.drawPolygon([
    //     end.x, end.y,
    //     end.x - xa, end.y - ya,
    //     end.x - xb, end.y + yb,
    //     end.x, end.y
    // ]);
    // this._displayObject.endFill();

    this.head.clear()
    this.head.beginFill(0x000000)
    this.head.drawPolygon([end.x, end.y, end.x - 7, end.y - 3, end.x - 7, end.y + 3, end.x, end.y])
    this.head.endFill()
    this.head.position.x = end.x
    this.head.position.y = end.y
    this.head.pivot = new PIXI.Point(end.x, end.y)
    this.head.rotation = Math.atan2(end.y - start.y, end.x - start.x)
  }
}
