import * as PIXI from 'pixi.js'
import { VisibleBlock, TaskType, parseInfo } from 'nodeCan/osEvent'

export interface GraphConfig {
  width: number
  height: number
  leftWidth: number
  totalButtons: number
  buttonHeight: number
  coreConfigs: Array<{
    id: number
    name: string
    buttons: Array<{ name: string; color: string; id: number; type: number }>
  }>
}

export interface ViewportState {
  minX: number
  maxX: number
  scaleX: number
  offsetX: number
}

export class PixiGraphRenderer {
  private app: PIXI.Application
  private container!: PIXI.Container
  private blocksContainer!: PIXI.Container
  private timelineContainer!: PIXI.Container
  private xAxisContainer!: PIXI.Container
  private tooltip!: HTMLDivElement
  private config: GraphConfig
  private viewport: ViewportState
  private visibleBlocks: VisibleBlock[] = []
  private blockGraphics: PIXI.Graphics[] = []
  private timeline: PIXI.Graphics | null = null
  private isDragging = false
  private lastPointerPosition = { x: 0, y: 0 }
  private coreStatus: Record<
    number,
    {
      activeDataIndex: number
      lasttype: TaskType
      status: number
      cnt: number
      cntTimer?: number
      yPos: number
      color: string
    }
  > = {}

  private constructor(config: GraphConfig) {
    this.config = config
    this.viewport = {
      minX: 7,
      maxX: 8.4,
      scaleX: 1,
      offsetX: 0
    }

    // Initialize PIXI Application
    this.app = new PIXI.Application()
  }

  static async create(canvas: HTMLCanvasElement, config: GraphConfig): Promise<PixiGraphRenderer> {
    const renderer = new PixiGraphRenderer(config)
    await renderer.initializeApp(canvas)
    return renderer
  }

  private async initializeApp(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      width: this.config.width - this.config.leftWidth - 1,
      height: this.config.height,
      backgroundColor: 0xffffff,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })

    // Create containers after initialization
    this.container = new PIXI.Container()
    this.blocksContainer = new PIXI.Container()
    this.timelineContainer = new PIXI.Container()
    this.xAxisContainer = new PIXI.Container()

    this.container.addChild(this.blocksContainer)
    this.container.addChild(this.timelineContainer)
    this.container.addChild(this.xAxisContainer)
    this.app.stage.addChild(this.container)

    // Create tooltip
    this.createTooltip()

    // Setup interactions
    this.setupInteractions()

    // Initial render
    this.updateViewport()
    this.renderXAxis()
  }

  private createTooltip() {
    this.tooltip = document.createElement('div')
    this.tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.4;
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 300px;
      white-space: pre-line;
    `
    document.body.appendChild(this.tooltip)
  }

  private setupInteractions() {
    const canvas = this.app.canvas as HTMLCanvasElement

    // Mouse wheel for zoom and pan
    canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false })

    // Mouse events for dragging
    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this))

    // Enable interactivity
    this.app.stage.eventMode = 'static'
    this.blocksContainer.eventMode = 'static'
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault()

    const delta = -event.deltaY / 2000
    const isCtrlPressed = event.ctrlKey
    const isAltPressed = event.altKey

    if (isCtrlPressed) {
      // Zoom
      this.handleZoom(delta, event.offsetX)
    } else if (isAltPressed) {
      // Pan
      this.handlePan(delta * 100)
    }
  }

  private handleZoom(delta: number, mouseX: number) {
    const zoomFactor = 1 + delta * 0.5
    const oldScaleX = this.viewport.scaleX
    const newScaleX = Math.max(0.1, oldScaleX * zoomFactor)

    // Zoom around mouse position
    const mouseWorldX = this.screenToWorldX(mouseX)
    this.viewport.scaleX = newScaleX
    const newMouseWorldX = this.screenToWorldX(mouseX)
    this.viewport.offsetX -= (mouseWorldX - newMouseWorldX) * this.getPixelsPerSecond()

    // Only update container transform, don't re-render blocks
    this.applyViewportTransform()
    this.renderXAxis()
  }

  private handlePan(deltaX: number) {
    this.viewport.offsetX += deltaX

    // Only update container transform, don't re-render blocks
    this.applyViewportTransform()
    this.renderXAxis()
  }

  private handleMouseDown(event: MouseEvent) {
    this.isDragging = true
    this.lastPointerPosition = { x: event.clientX, y: event.clientY }
    this.app.canvas.style.cursor = 'grabbing'
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      const deltaX = event.clientX - this.lastPointerPosition.x
      this.handlePan(deltaX)
      this.lastPointerPosition = { x: event.clientX, y: event.clientY }
    } else {
      // Handle tooltip
      this.handleTooltip(event)
    }
  }

  private handleMouseUp() {
    this.isDragging = false
    this.app.canvas.style.cursor = 'default'
  }

  private handleTooltip(event: MouseEvent) {
    const rect = this.app.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const worldX = this.screenToWorldX(x)
    const worldY = this.screenToWorldY(y)

    const hoveredBlock = this.findBlockAt(worldX, worldY)

    if (hoveredBlock) {
      this.showTooltip(event.clientX, event.clientY, hoveredBlock)
    } else {
      this.hideTooltip()
    }
  }

  private findBlockAt(worldX: number, worldY: number): VisibleBlock | null {
    for (const block of this.visibleBlocks) {
      if (block.type === TaskType.SERVICE || block.type === TaskType.HOOK) {
        continue
      }

      const blockEnd = block.end || this.viewport.maxX
      if (worldX >= block.start && worldX <= blockEnd) {
        const yPos = this.getBlockYPosition(block)
        if (yPos !== null && Math.abs(worldY - yPos) < this.config.buttonHeight / 2) {
          return block
        }
      }
    }
    return null
  }

  private showTooltip(clientX: number, clientY: number, block: VisibleBlock) {
    return
    const end = block.end || this.viewport.maxX
    const coreName = `Core-${block.coreId}`

    let task
    for (const core of this.config.coreConfigs) {
      if (core.id === block.coreId) {
        task = core.buttons.find((b) => b.id === block.id && b.type === block.type)
        break
      }
    }

    const content = `
      <strong>${task?.name || 'Unknown'}</strong>
      ${parseInfo(block.type, block.status as number, '\n')}
      Core: ${coreName}
      Start: ${(block.start * 1000000).toFixed(1)}us
      Duration: ${((end - block.start) * 1000000).toFixed(1)}us
      End: ${(end * 1000000).toFixed(1)}us
    `.trim()

    this.tooltip.innerHTML = content.replace(/\n/g, '<br>')
    this.tooltip.style.display = 'block'
    this.tooltip.style.left = clientX + 10 + 'px'
    this.tooltip.style.top = clientY - 10 + 'px'
  }

  private hideTooltip() {
    this.tooltip.style.display = 'none'
  }

  // Base coordinate conversion (without viewport transform)
  private getBasePixelsPerSecond(): number {
    return (
      (this.config.width - this.config.leftWidth - 1) / (this.viewport.maxX - this.viewport.minX)
    )
  }

  private worldToBaseScreenX(worldX: number): number {
    return (worldX - this.viewport.minX) * this.getBasePixelsPerSecond()
  }

  private worldToBaseScreenY(worldY: number): number {
    return worldY * this.config.buttonHeight
  }

  // Full coordinate conversion (with viewport transform)
  private getPixelsPerSecond(): number {
    return this.getBasePixelsPerSecond() * this.viewport.scaleX
  }

  private screenToWorldX(screenX: number): number {
    return (screenX - this.viewport.offsetX) / this.getPixelsPerSecond() + this.viewport.minX
  }

  private screenToWorldY(screenY: number): number {
    return screenY / this.config.buttonHeight
  }

  private worldToScreenX(worldX: number): number {
    return (worldX - this.viewport.minX) * this.getPixelsPerSecond() + this.viewport.offsetX
  }

  private worldToScreenY(worldY: number): number {
    return worldY * this.config.buttonHeight
  }

  private getBlockYPosition(block: VisibleBlock): number | null {
    let yPos = 0

    for (const core of this.config.coreConfigs) {
      if (core.id !== block.coreId) {
        yPos += core.buttons.length
        continue
      }

      const buttonIndex = core.buttons.findIndex((b) => b.id === block.id && b.type === block.type)
      if (buttonIndex !== -1) {
        yPos += buttonIndex
        return yPos
      }
    }
    return null
  }

  private getBlockColor(block: VisibleBlock): string {
    for (const core of this.config.coreConfigs) {
      if (core.id === block.coreId) {
        const button = core.buttons.find((b) => b.id === block.id && b.type === block.type)
        if (button) {
          return button.color
        }
      }
    }
    return '#95a5a6'
  }

  private darkColor(color: string, level: number): string {
    const rgb = color.match(/\d+/g)!.map(Number)
    const factor = 1 - 0.2 * level
    const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, v * factor)))
    return `rgb(${r}, ${g}, ${b})`
  }

  private colorToHex(color: string): number {
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16)
    }
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g)
      if (matches && matches.length >= 3) {
        const [r, g, b] = matches.map(Number)
        return (r << 16) | (g << 8) | b
      }
    }
    return 0x95a5a6
  }

  public updateConfig(config: Partial<GraphConfig>) {
    Object.assign(this.config, config)
    this.app.renderer.resize(this.config.width - this.config.leftWidth - 1, this.config.height)
    this.renderBlocks()
    this.renderXAxis()
  }

  public updateViewport(minX?: number, maxX?: number) {
    const needsRerender = minX !== undefined || maxX !== undefined
    if (minX !== undefined) this.viewport.minX = minX
    if (maxX !== undefined) this.viewport.maxX = maxX

    if (needsRerender) {
      // Only re-render blocks when data range changes
      this.renderBlocks()
    } else {
      // Just update transform for zoom/pan
      this.applyViewportTransform()
    }
    this.renderXAxis()
  }

  private applyViewportTransform() {
    // Apply container transform using PIXI's built-in transformation
    // This is much faster than re-rendering all blocks
    this.blocksContainer.scale.x = this.viewport.scaleX
    this.blocksContainer.position.x = this.viewport.offsetX

    // Apply inverse scale to all text children and control visibility based on scaled width
    this.blockGraphics.forEach((graphic) => {
      graphic.children.forEach((child) => {
        if (child instanceof PIXI.Text && child.label === 'duration-text') {
          // Apply inverse scale to keep text size constant
          child.scale.x = 1 / this.viewport.scaleX

          // Calculate the actual displayed width after scaling
          const baseWidth = (child as any).baseWidth || 0
          const displayedWidth = baseWidth * this.viewport.scaleX

          // Show text only if the displayed width is large enough
          child.visible = displayedWidth > 20
        }
      })
    })

    // Update timeline position as well
    if (this.timeline) {
      this.timelineContainer.scale.x = this.viewport.scaleX
      this.timelineContainer.position.x = this.viewport.offsetX
    }
  }
  public setBlocks(blocks: VisibleBlock[]) {
    this.visibleBlocks = blocks
    this.renderBlocks()
    this.renderXAxis()
  }

  public updateTimeline(currentTime: number, visible: boolean = true) {
    if (this.timeline) {
      this.timelineContainer.removeChild(this.timeline)
    }

    if (!visible) return

    this.timeline = new PIXI.Graphics()
    // Use base coordinates, container transform will handle zoom/pan
    const x = this.worldToBaseScreenX(currentTime)

    this.timeline.moveTo(x, 0).lineTo(x, this.config.height).stroke({ color: 0x0000ff, width: 1 })

    this.timelineContainer.addChild(this.timeline)
  }

  private renderBlocks() {
    // Clear existing blocks
    this.blockGraphics.forEach((graphic) => {
      this.blocksContainer.removeChild(graphic)
      graphic.destroy()
    })
    this.blockGraphics = []
    this.coreStatus = {}

    // Render visible blocks
    for (let i = 0; i < this.visibleBlocks.length; i++) {
      const block = this.visibleBlocks[i]
      this.renderBlock(block, i)
    }

    // Apply current viewport transform after rendering
    this.applyViewportTransform()
  }

  private renderBlock(block: VisibleBlock, dataIndex: number) {
    if (block.type === TaskType.SERVICE || block.type === TaskType.HOOK) {
      return
    }

    const yPos = this.getBlockYPosition(block)
    if (yPos === null) return

    let color = this.getBlockColor(block)
    let height = this.config.buttonHeight
    let finalYPos = yPos
    let text = ''

    const start = block.start
    const end = block.end || this.viewport.maxX
    const diff = end - start

    // Calculate text based on duration
    if (block.type === TaskType.TASK || block.type === TaskType.ISR) {
      if (diff > 1) {
        text = `${diff.toFixed(1)}s`
      } else if (diff > 0.001) {
        text = `${(diff * 1000).toFixed(1)}ms`
      } else {
        text = `${(diff * 1000000).toFixed(1)}us`
      }
    }

    // Handle core status and stacking
    if (block.type === TaskType.TASK || block.type === TaskType.ISR) {
      this.coreStatus[block.coreId] = {
        status: block.status,
        lasttype: block.type,
        activeDataIndex: dataIndex,
        cnt: 0,
        yPos: finalYPos,
        color: color
      }

      if (block.type === TaskType.TASK && block.status !== 1) {
        height = height * 0.1
        text = ''
        finalYPos += 0.45
      }
    } else {
      if (this.coreStatus[block.coreId] === undefined) {
        return
      }

      this.coreStatus[block.coreId].cnt++

      if (
        this.coreStatus[block.coreId].cntTimer !== undefined &&
        start >= this.coreStatus[block.coreId].cntTimer!
      ) {
        this.coreStatus[block.coreId].cnt--
      }
      this.coreStatus[block.coreId].cntTimer = end

      finalYPos = this.coreStatus[block.coreId].yPos + (this.coreStatus[block.coreId].cnt - 1) * 0.2
      color = this.coreStatus[block.coreId].color
      color = this.darkColor(color, this.coreStatus[block.coreId].cnt)
      height = height * 0.2
    }

    // Use base screen coordinates (without viewport transform)
    // The container transform will handle zoom and pan
    const startX = this.worldToBaseScreenX(start)
    const endX = this.worldToBaseScreenX(end)
    let width = endX - startX
    if (width < 1) {
      width = 1
    }

    const screenY = this.worldToBaseScreenY(finalYPos)

    // Create block graphic
    const blockGraphic = new PIXI.Graphics()
    blockGraphic.rect(startX, screenY, width, height).fill(this.colorToHex(color))

    // Always add text if available (visibility will be controlled by viewport transform)
    if (text) {
      const textGraphic = new PIXI.Text({
        text,
        style: {
          fontSize: 8,
          fill: 0x000000,
          fontWeight: 'bold',
          align: 'center'
        }
      })

      textGraphic.anchor.set(0.5)
      textGraphic.x = startX + width / 2
      textGraphic.y = screenY + height / 2

      // Store the base width for later visibility calculation
      textGraphic.label = 'duration-text'
      ;(textGraphic as any).baseWidth = width

      blockGraphic.addChild(textGraphic)
    }

    this.blocksContainer.addChild(blockGraphic)
    this.blockGraphics.push(blockGraphic)
  }

  private calculateTickInterval(): { interval: number; unit: string } {
    // Calculate the actual visible time range based on current zoom and pan
    const canvasWidth = this.config.width - this.config.leftWidth - 1
    const visibleMinX = this.screenToWorldX(0)
    const visibleMaxX = this.screenToWorldX(canvasWidth)
    const timeRange = visibleMaxX - visibleMinX

    // Always target exactly 10 ticks
    const targetTicks = 10
    const rawInterval = timeRange / targetTicks

    // Define nice intervals in different units
    const intervals = [
      { value: 0.000001, unit: 'μs', multiplier: 1000000 }, // 1 microsecond
      { value: 0.000002, unit: 'μs', multiplier: 1000000 }, // 2 microseconds
      { value: 0.000005, unit: 'μs', multiplier: 1000000 }, // 5 microseconds
      { value: 0.00001, unit: 'μs', multiplier: 1000000 }, // 10 microseconds
      { value: 0.00002, unit: 'μs', multiplier: 1000000 }, // 20 microseconds
      { value: 0.00005, unit: 'μs', multiplier: 1000000 }, // 50 microseconds
      { value: 0.0001, unit: 'μs', multiplier: 1000000 }, // 100 microseconds
      { value: 0.0002, unit: 'μs', multiplier: 1000000 }, // 200 microseconds
      { value: 0.0005, unit: 'μs', multiplier: 1000000 }, // 500 microseconds
      { value: 0.001, unit: 'ms', multiplier: 1000 }, // 1 millisecond
      { value: 0.002, unit: 'ms', multiplier: 1000 }, // 2 milliseconds
      { value: 0.005, unit: 'ms', multiplier: 1000 }, // 5 milliseconds
      { value: 0.01, unit: 'ms', multiplier: 1000 }, // 10 milliseconds
      { value: 0.02, unit: 'ms', multiplier: 1000 }, // 20 milliseconds
      { value: 0.05, unit: 'ms', multiplier: 1000 }, // 50 milliseconds
      { value: 0.1, unit: 'ms', multiplier: 1000 }, // 100 milliseconds
      { value: 0.2, unit: 'ms', multiplier: 1000 }, // 200 milliseconds
      { value: 0.5, unit: 'ms', multiplier: 1000 }, // 500 milliseconds
      { value: 1, unit: 's', multiplier: 1 }, // 1 second
      { value: 2, unit: 's', multiplier: 1 }, // 2 seconds
      { value: 5, unit: 's', multiplier: 1 }, // 5 seconds
      { value: 10, unit: 's', multiplier: 1 }, // 10 seconds
      { value: 30, unit: 's', multiplier: 1 }, // 30 seconds
      { value: 60, unit: 's', multiplier: 1 } // 1 minute
    ]

    // Find the best interval
    let bestInterval = intervals[0]
    for (const interval of intervals) {
      if (interval.value >= rawInterval) {
        bestInterval = interval
        break
      }
      bestInterval = interval
    }

    return { interval: bestInterval.value, unit: bestInterval.unit }
  }

  private renderXAxis() {
    // Clear existing x-axis
    this.xAxisContainer.removeChildren()

    const { interval, unit } = this.calculateTickInterval()
    const axisHeight = 44 // Height of the x-axis area
    const tickHeight = 6
    const axisY = this.config.height - axisHeight

    // Draw main axis line

    // Calculate the actual visible time range based on current zoom and pan
    const canvasWidth = this.config.width - this.config.leftWidth - 1
    const visibleMinX = this.screenToWorldX(0)
    const visibleMaxX = this.screenToWorldX(canvasWidth)

    // Calculate tick positions
    const startTime = Math.floor(visibleMinX / interval) * interval
    const endTime = visibleMaxX

    for (let time = startTime; time <= endTime; time += interval) {
      if (time < visibleMinX) continue

      const screenX = this.worldToScreenX(time)
      if (screenX < 0 || screenX > this.config.width - this.config.leftWidth - 1) continue

      // Draw tick mark
      const tick = new PIXI.Graphics()
      tick.moveTo(screenX, axisY).lineTo(screenX, axisY + tickHeight)
      tick.stroke({ color: 0x333333, width: 1 })
      this.xAxisContainer.addChild(tick)

      // Draw label
      const labelValue = this.formatTimeLabel(time, unit)
      const label = new PIXI.Text({
        text: labelValue,
        style: {
          fontSize: 10,
          fill: 0x333333,
          fontFamily: 'Arial',
          align: 'center'
        }
      })

      label.anchor.set(0.5, 0)
      label.x = screenX
      label.y = axisY + tickHeight + 2

      this.xAxisContainer.addChild(label)
    }
  }

  private formatTimeLabel(time: number, unit: string): string {
    switch (unit) {
      case 'μs':
        return `${(time * 1000000).toFixed(0)}μs`
      case 'ms':
        return `${(time * 1000).toFixed(0)}ms`
      case 's':
        if (time >= 60) {
          const minutes = Math.floor(time / 60)
          const seconds = time % 60
          return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds.toFixed(0)}s`
        }
        return `${time.toFixed(0)}s`
      default:
        return time.toFixed(3)
    }
  }

  public destroy() {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip)
    }

    this.blockGraphics.forEach((graphic) => graphic.destroy())
    this.app.destroy(true, { children: true, texture: true })
  }
}
