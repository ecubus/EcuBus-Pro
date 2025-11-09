import { throttle, debounce } from 'lodash'
import * as PIXI from 'pixi.js-legacy'

const START_RENDER_STRING = 'startPixiRender'
const STOP_RENDER_STRING = 'stopPixiRender'

const throttledStart = throttle(
  () => {
    window.dispatchEvent(new Event(START_RENDER_STRING))
  },
  450,
  { leading: true }
)

const debouncedStop = debounce(() => {
  window.dispatchEvent(new Event(STOP_RENDER_STRING))
}, 1000)

interface RenderEvents {
  startRender: () => void
  stopRender: () => void
}

export const RenderEvents: RenderEvents = {
  /**
   * Fires an event that will start the PIXI.Ticker.
   * This will start rendering.
   * Event handler located in time-graph-render-controller.ts
   */
  startRender: () => {
    throttledStart()
  },
  /**
   * Fires an event that will stop the PIXI.Ticker.
   * This will stop rendering.
   * Event handler located in time-graph-render-controller.ts
   */
  stopRender: () => {
    debouncedStop()
  }
}
export class TimeGraphRenderController {
  constructor() {
    this.initializeRenderEvents()
  }

  private initializeRenderEvents = () => {
    const { startRender, stopRender } = this

    window.addEventListener(START_RENDER_STRING, startRender)
    window.addEventListener(STOP_RENDER_STRING, stopRender)

    window.addEventListener('beforeunload', () => {
      window.removeEventListener(START_RENDER_STRING, startRender)
      window.removeEventListener(STOP_RENDER_STRING, stopRender)
    })
  }

  public startRender = () => {
    PIXI.Ticker.shared.start()
    debouncedStop()
  }

  public stopRender = () => {
    PIXI.Ticker.shared.stop()
  }
}
