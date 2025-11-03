import * as PIXI from 'pixi.js-legacy'

import { TimeGraphComponent, TimeGraphParentComponent } from '../components/time-graph-component'
import { TimeGraphUnitController } from '../time-graph-unit-controller'
import { TimeGraphStateController } from '../time-graph-state-controller'

export type TimeGraphLayerOptions = {}

export abstract class TimeGraphLayer {
  private canvas: HTMLCanvasElement
  protected stateController: TimeGraphStateController
  protected unitController: TimeGraphUnitController
  protected children: TimeGraphComponent<any>[]
  protected stage: PIXI.Container
  protected layer: PIXI.Container
  private childContainer: PIXI.Container | undefined

  constructor(protected id: string) {
    this.children = []
    this.layer = new PIXI.Container()
  }

  protected addChild(child: TimeGraphComponent<any>, parent?: TimeGraphParentComponent) {
    if (!this.canvas) {
      throw 'Layers must be added to a container before components can be added.'
    }
    child.update()
    if (parent) {
      parent.addChild(child)
    } else {
      if (!this.childContainer) {
        this.childContainer = new PIXI.Container()
        this.layer.addChild(this.childContainer)
      }
      this.childContainer.addChild(child.displayObject)
      this.children.push(child)
    }
  }

  /**
    This method is called by the container this layer is added to.
    */
  initializeLayer(
    canvas: HTMLCanvasElement,
    stage: PIXI.Container,
    stateController: TimeGraphStateController,
    unitController: TimeGraphUnitController
  ) {
    this.canvas = canvas
    this.stateController = stateController
    this.unitController = unitController
    this.stage = stage
    stage.addChild(this.layer)
    this.afterAddToContainer()
  }

  protected onCanvasEvent(type: string, handler: (event: Event) => void) {
    this.canvas.addEventListener(type, handler)
  }

  protected removeOnCanvasEvent(type: string, handler: (event: Event) => void) {
    this.canvas.removeEventListener(type, handler)
  }

  protected removeChildren() {
    this.childContainer?.destroy({ children: true })
    this.childContainer = undefined
    this.children = []
  }

  protected removeChild(child: TimeGraphComponent<any>) {
    this.childContainer?.removeChild(child.displayObject)
    child.destroy()
    const idx = this.children.findIndex((c) => c === child)
    idx && this.children.splice(idx, 1)
  }

  protected getPixel(time: bigint) {
    const div = 0x100000000
    const hi = Number(time / BigInt(div))
    const lo = Number(time % BigInt(div))
    return Math.floor(
      hi * this.stateController.zoomFactor * div + lo * this.stateController.zoomFactor
    )
  }

  protected afterAddToContainer() {}

  destroy() {
    this.layer.destroy({ children: true })
    this.childContainer = undefined
    this.children = []
  }

  abstract update(opts?: TimeGraphLayerOptions): void
}
