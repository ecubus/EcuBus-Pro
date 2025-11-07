import { TimelineChart } from './time-graph-model'
import { TimeGraphUnitController } from './time-graph-unit-controller'
import { BIMath } from './bigint-utils'

export class TimeGraphStateController {
  oldPositionOffset: {
    x: number
    y: number
  }

  snapped: boolean

  protected ratio: number

  private _unscaledCanvasWidth: number
  protected _canvasDisplayWidth: number
  protected _canvasDisplayHeight: number

  private _scaleFactor: number

  protected _zoomFactor!: number
  protected _initialZoomFactor: number
  protected _positionOffset: {
    x: number
    y: number
  }

  protected _worldRange: TimelineChart.TimeGraphRange = { start: BigInt(0), end: BigInt(0) }
  protected _worldZoomFactor = 1

  private _worldRenderedHandlers: ((worldRange: TimelineChart.TimeGraphRange) => void)[] = []
  protected zoomChangedHandlers: ((zoomFactor: number) => void)[] = []
  protected canvasWidthChangedHandlers: ((baseWidth: number) => void)[] = []
  protected positionChangedHandlers: (() => void)[] = []
  protected scaleFactorChangedHandlers: ((newScaleFactor: number) => void)[] = []

  constructor(
    protected canvas: HTMLCanvasElement,
    protected unitController: TimeGraphUnitController
  ) {
    this.ratio = window.devicePixelRatio
    this._canvasDisplayWidth = this.canvas.width / this.ratio
    this._canvasDisplayHeight = this.canvas.height / this.ratio
    this._initialZoomFactor = this.zoomFactor
    this._positionOffset = { x: 0, y: 0 }
    this.oldPositionOffset = { x: 0, y: 0 }
    this.snapped = false

    this._unscaledCanvasWidth = this._canvasDisplayWidth
    this._scaleFactor = 1
    this.worldRange = this.computeWorldRangeFromViewRange()
    this.unitController.onViewRangeChanged(this.updateZoomFactor)
    this.unitController.onViewRangeChanged(this.updateScaleFactor)
  }

  protected handleZoomChange(zoomFactor: number) {
    this.zoomChangedHandlers.forEach((handler) => handler(zoomFactor))
  }
  protected handlePositionChange() {
    this.positionChangedHandlers.forEach((handler) => handler())
  }
  protected handleScaleFactorChange() {
    this.scaleFactorChangedHandlers.forEach((handler) => handler(this._scaleFactor))
  }

  onZoomChanged(handler: (zoomFactor: number) => void) {
    this.zoomChangedHandlers.push(handler)
  }
  onPositionChanged(handler: () => void) {
    this.positionChangedHandlers.push(handler)
  }
  onScaleFactorChange(handler: (newWidth: number) => void) {
    this.scaleFactorChangedHandlers.push(handler)
  }

  removeOnZoomChanged(handler: (zoomFactor: number) => void) {
    const index = this.zoomChangedHandlers.indexOf(handler)
    if (index > -1) {
      this.zoomChangedHandlers.splice(index, 1)
    }
  }

  removeOnScaleFactorChanged(handler: (zoomFactor: number) => void) {
    const index = this.scaleFactorChangedHandlers.indexOf(handler)
    if (index > -1) {
      this.scaleFactorChangedHandlers.splice(index, 1)
    }
  }

  /**
        It is not the width of the canvas display buffer but of the canvas element in browser. Can be different depending on the display pixel ratio.
    */
  get canvasDisplayWidth() {
    return this._canvasDisplayWidth
  }

  updateDisplayWidth() {
    this._canvasDisplayWidth = this.canvas.width / this.ratio

    // Adjust the scale factor if the display canvas width changes
    this.scaleFactor = this._canvasDisplayWidth / this._unscaledCanvasWidth
  }

  /**
        It is not the heigth of the canvas display buffer but of the canvas element in browser. Can be different depending on the display pixel ratio.
    */
  get canvasDisplayHeight() {
    return this._canvasDisplayHeight
  }

  updateDisplayHeight() {
    this._canvasDisplayHeight = this.canvas.height / this.ratio
  }

  get initialZoomFactor(): number {
    return this._initialZoomFactor
  }

  updateZoomFactor = () => {
    let newZoom = this.canvasDisplayWidth / Number(this.unitController.viewRangeLength)
    if (this._zoomFactor !== newZoom) {
      this.handleZoomChange((this._zoomFactor = newZoom))
    }
  }

  // Adjust the scale factor if the view range changes
  updateScaleFactor = (
    oldViewRange: TimelineChart.TimeGraphRange,
    newViewRange: TimelineChart.TimeGraphRange
  ) => {
    const oldViewRangeLength = oldViewRange.end - oldViewRange.start
    const newViewRangeLength = newViewRange.end - newViewRange.start

    const newScaleFactor =
      (Number(oldViewRangeLength) / Number(newViewRangeLength)) * this._scaleFactor
    this.scaleFactor = newScaleFactor
  }

  resetScale() {
    this._unscaledCanvasWidth = this._canvasDisplayWidth
    this.scaleFactor = 1
  }

  get scaleFactor(): number {
    return this._scaleFactor
  }

  set scaleFactor(newScaleFactor: number) {
    this._scaleFactor = newScaleFactor
    this.handleScaleFactorChange()
  }

  get zoomFactor(): number {
    this.updateZoomFactor()
    return this._zoomFactor
  }

  get absoluteResolution(): number {
    return this.canvasDisplayWidth / Number(this.unitController.absoluteRange)
  }

  get positionOffset(): {
    x: number
    y: number
  } {
    return this._positionOffset
  }
  set positionOffset(value: { x: number; y: number }) {
    this._positionOffset = value
    this.handlePositionChange()
  }

  computeWorldRangeFromViewRange() {
    const deltaV = this.unitController.viewRange.end - this.unitController.viewRange.start
    let start =
      this.unitController.viewRange.start -
      BIMath.multiply(deltaV, this.unitController.worldRenderFactor)
    let end =
      this.unitController.viewRange.end +
      BIMath.multiply(deltaV, this.unitController.worldRenderFactor)
    if (start < 0) {
      start = BigInt(0)
    }
    if (end > this.unitController.absoluteRange) {
      end = this.unitController.absoluteRange
    }
    return { start, end }
  }

  get worldRange(): TimelineChart.TimeGraphRange {
    return this._worldRange
  }

  set worldRange(newRange: TimelineChart.TimeGraphRange) {
    if (newRange.end > newRange.start) {
      this._worldRange = { start: newRange.start, end: newRange.end }
    }
    if (newRange.start < 0) {
      this._worldRange.start = BigInt(0)
    }
    if (this._worldRange.end > this.unitController.absoluteRange) {
      this._worldRange.end = this.unitController.absoluteRange
    }
  }

  get worldZoomFactor(): number {
    return this._worldZoomFactor
  }

  set worldZoomFactor(worldZoomFactor: number) {
    this._worldZoomFactor = worldZoomFactor
  }

  get worldRangeLength(): bigint {
    return this._worldRange.end - this._worldRange.start
  }

  onWorldRender = (handler: (worldRange: TimelineChart.TimeGraphRange) => void) => {
    this._worldRenderedHandlers.push(handler)
  }

  handleOnWorldRender = () => {
    this._worldRenderedHandlers.forEach((handler) => handler(this.worldRange))
  }

  removeWorldRenderHandler = (handler: (worldRange: TimelineChart.TimeGraphRange) => void) => {
    const index = this._worldRenderedHandlers.indexOf(handler)
    if (index > -1) {
      this._worldRenderedHandlers.splice(index, 1)
    }
  }

  removeHandlers() {
    this.unitController.removeViewRangeChangedHandler(this.updateZoomFactor)
    this.unitController.removeViewRangeChangedHandler(this.updateScaleFactor)
  }
}
