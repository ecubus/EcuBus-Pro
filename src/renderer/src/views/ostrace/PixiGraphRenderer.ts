import * as PIXI from 'pixi.js'
import { VisibleBlock, TaskType, parseInfo } from 'nodeCan/osEvent'

export interface GraphConfig {
  width: number
  height: number
  leftWidth: number
  totalButtons: number
  buttonHeight: number
  maxTimeSpan: number
  coreConfigs: Array<{
    id: number
    name: string
    buttons: Array<{ name: string; color: string; id: number; type: number }>
  }>
}

export interface ViewportState {
  minTs: number // Data start time
  maxTs: number // Data end time
  minX: number // Current viewport start time
  maxX: number // Current viewport end time
}

export class PixiGraphRenderer {
  private app: PIXI.Application
  private container!: PIXI.Container
  private blocksContainer!: PIXI.Container
  private timelineContainer!: PIXI.Container
  private xAxisContainer!: PIXI.Container
  private tooltip!: HTMLDivElement
  private config: GraphConfig
  public viewport: ViewportState
  private allBlocks: VisibleBlock[] = [] // Store all blocks
  private visibleBlocks: VisibleBlock[] = [] // Only blocks within current viewport
  private blockGraphics: PIXI.Graphics[] = []
  private blockGraphicsMap: Map<number, PIXI.Graphics> = new Map() // Map block index to graphics
  private timeline: PIXI.Graphics | null = null
  private visibleWindowStart: number = 0 // Start index of visible window
  private visibleWindowEnd: number = 0 // End index of visible window
  private isDragging = false
  private timer: number | null = null
  private tooltipTimer: number | null = null
  private lastPointerPosition = { x: 0, y: 0 }
  private record: Record<string, { pos: number; color: string; name: string }> = {}
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
  private onScaleChange?: (scale: number) => void
  private onPanPercentageChange?: (percentage: number) => void

  private constructor(config: GraphConfig) {
    this.config = config
    this.viewport = {
      minTs: 0,
      maxTs: 0,
      minX: 0,
      maxX: 0
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
      preference: 'webgpu',
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

    // Get the world X position at mouse
    const mouseWorldX = this.screenToWorldX(mouseX)

    // Calculate new range
    const currentRange = this.viewport.maxX - this.viewport.minX
    let newRange = currentRange / zoomFactor

    // Limit the range to MAX_TIME_SPAN
    if (newRange > this.config.maxTimeSpan) {
      newRange = this.config.maxTimeSpan
    }

    // Zoom around mouse position
    const mouseRatio = (mouseWorldX - this.viewport.minX) / currentRange
    let newMinX = mouseWorldX - newRange * mouseRatio
    let newMaxX = mouseWorldX + newRange * (1 - mouseRatio)

    // Clamp to data bounds
    newMinX = Math.max(this.viewport.minTs, newMinX)
    newMaxX = Math.min(this.viewport.maxTs, newMaxX)

    // Ensure the range doesn't exceed MAX_TIME_SPAN
    if (newMaxX - newMinX > this.config.maxTimeSpan) {
      const center = (newMinX + newMaxX) / 2
      newMinX = center - this.config.maxTimeSpan / 2
      newMaxX = center + this.config.maxTimeSpan / 2

      // Re-clamp to data bounds
      if (newMinX < this.viewport.minTs) {
        newMinX = this.viewport.minTs
        newMaxX = newMinX + this.config.maxTimeSpan
      } else if (newMaxX > this.viewport.maxTs) {
        newMaxX = this.viewport.maxTs
        newMinX = newMaxX - this.config.maxTimeSpan
      }
    }

    this.viewport.minX = newMinX
    this.viewport.maxX = newMaxX

    // Update visible blocks and re-render
    this.updateVisibleBlocks()
    this.applyViewportTransform()
    this.renderXAxis()
    if (this.onScaleChange) {
      this.onScaleChange(newMaxX - newMinX)
    }
    this.notifyPanPercentageChange()
  }

  private handlePan(deltaX: number) {
    // Convert screen pixels to world units
    const canvasWidth = this.config.width - this.config.leftWidth - 1
    const viewportRange = this.viewport.maxX - this.viewport.minX
    const worldDelta = (-deltaX * viewportRange) / canvasWidth

    // Update viewport range
    let newMinX = this.viewport.minX + worldDelta
    let newMaxX = this.viewport.maxX + worldDelta

    // Clamp to data bounds
    if (newMinX < this.viewport.minTs) {
      newMinX = this.viewport.minTs
      newMaxX = this.viewport.minTs + viewportRange
    } else if (newMaxX > this.viewport.maxTs) {
      newMaxX = this.viewport.maxTs
      newMinX = this.viewport.maxTs - viewportRange
    }

    // Ensure the range doesn't exceed MAX_TIME_SPAN
    if (newMaxX - newMinX > this.config.maxTimeSpan) {
      newMaxX = newMinX + this.config.maxTimeSpan
    }

    this.viewport.minX = newMinX
    this.viewport.maxX = newMaxX

    // Update visible blocks and re-render
    this.updateVisibleBlocks()
    this.applyViewportTransform()
    this.renderXAxis()
    this.notifyPanPercentageChange()
  }

  private handleMouseDown(event: MouseEvent) {
    this.isDragging = true
    this.lastPointerPosition = { x: event.clientX, y: event.clientY }
    this.app.canvas.style.cursor = 'grabbing'
    // Clear tooltip timer when dragging starts
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer)
      this.tooltipTimer = null
    }
    this.hideTooltip()
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
    // Clear tooltip timer when mouse leaves
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer)
      this.tooltipTimer = null
    }
    this.hideTooltip()
  }

  private handleTooltip(event: MouseEvent) {
    // Clear existing tooltip timer
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer)
      this.tooltipTimer = null
    }

    const rect = this.app.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const worldX = this.screenToWorldX(x)
    const worldY = this.screenToWorldY(y)

    const hoveredBlock = this.findBlockAt(worldX, worldY)

    if (hoveredBlock) {
      // Set a timer to show tooltip after 500ms
      this.tooltipTimer = window.setTimeout(() => {
        this.showTooltip(event.clientX, event.clientY, hoveredBlock)
        this.tooltipTimer = null
      }, 200)
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
        if (yPos !== null && worldY - yPos.pos < 1 && worldY - yPos.pos > 0) {
          return block
        }
      }
    }
    return null
  }

  private showTooltip(clientX: number, clientY: number, block: VisibleBlock) {
    const end = block.end || this.viewport.maxX
    const coreName = `Core-${block.coreId}`

    const task = this.getBlockYPosition(block)

    if (task) {
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
  }

  private hideTooltip() {
    this.tooltip.style.display = 'none'
  }

  // Coordinate conversion based on data bounds (minTs to maxTs)
  private getDataPixelsPerSecond(): number {
    return (
      (this.config.width - this.config.leftWidth - 1) / (this.viewport.maxTs - this.viewport.minTs)
    )
  }

  private worldToDataScreenX(worldX: number): number {
    return (worldX - this.viewport.minTs) * this.getDataPixelsPerSecond()
  }

  private worldToDataScreenY(worldY: number): number {
    return worldY * this.config.buttonHeight
  }

  // Coordinate conversion for current viewport (minX to maxX)
  private getViewportPixelsPerSecond(): number {
    return (
      (this.config.width - this.config.leftWidth - 1) / (this.viewport.maxX - this.viewport.minX)
    )
  }

  private screenToWorldX(screenX: number): number {
    return (
      (screenX / (this.config.width - this.config.leftWidth - 1)) *
        (this.viewport.maxX - this.viewport.minX) +
      this.viewport.minX
    )
  }

  private screenToWorldY(screenY: number): number {
    return screenY / this.config.buttonHeight
  }

  private worldToScreenX(worldX: number): number {
    return (worldX - this.viewport.minX) * this.getViewportPixelsPerSecond()
  }

  private worldToScreenY(worldY: number): number {
    return worldY * this.config.buttonHeight
  }

  private getBlockYPosition(block: VisibleBlock) {
    const key = `${block.coreId}-${block.id}-${block.type}`
    if (this.record[key]) {
      return this.record[key]
    } else {
      let yPos = 0

      for (const core of this.config.coreConfigs) {
        if (core.id !== block.coreId) {
          yPos += core.buttons.length
          continue
        }

        const buttonIndex = core.buttons.findIndex(
          (b) => b.id === block.id && b.type === block.type
        )
        if (buttonIndex !== -1) {
          yPos += buttonIndex

          this.record[key] = {
            pos: yPos,
            color: core.buttons[buttonIndex].color,
            name: core.buttons[buttonIndex].name
          }
          return this.record[key]
        }
      }
      return null
    }
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
    //hide tooltip
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer)
      this.tooltipTimer = null
    }
    this.hideTooltip()

    const action = () => {
      this.timer = requestAnimationFrame(() => {
        const preservedMinX = this.viewport.minX
        const preservedMaxX = this.viewport.maxX
        Object.assign(this.config, config)

        this.app.renderer.resize(this.config.width - this.config.leftWidth - 1, this.config.height)
        this.renderBlocks()
        // Restore the preserved viewport state
        this.viewport.minX = preservedMinX
        this.viewport.maxX = preservedMaxX

        // Apply the viewport transform with preserved zoom/pan state
        this.applyViewportTransform()
        this.renderXAxis()
        this.timer = null

        this.app.renderer.render(this.app.stage)
      })
    }
    if (this.timer) {
      cancelAnimationFrame(this.timer)
      action()
    } else {
      action()
    }
  }

  public updateViewport(minX?: number, maxX?: number) {
    if (minX !== undefined) {
      this.viewport.minX = Math.max(this.viewport.minTs, minX)
    }
    if (maxX !== undefined) {
      this.viewport.maxX = Math.min(this.viewport.maxTs, maxX)
    }

    // Ensure the range doesn't exceed MAX_TIME_SPAN
    if (this.viewport.maxX - this.viewport.minX > this.config.maxTimeSpan) {
      this.viewport.maxX = this.viewport.minX + this.config.maxTimeSpan
    }

    // Clamp again after adjusting maxX
    this.viewport.minX = Math.max(this.viewport.minTs, this.viewport.minX)
    this.viewport.maxX = Math.min(this.viewport.maxTs, this.viewport.maxX)

    // Update visible blocks and transform
    this.updateVisibleBlocks()
    this.renderXAxis()
    this.notifyPanPercentageChange()
  }

  private applyViewportTransform() {
    // Calculate scale and position based on viewport range
    // Blocks are rendered in data coordinates (minTs to maxTs)
    // Transform them to viewport coordinates (minX to maxX)

    const dataRange = this.viewport.maxTs - this.viewport.minTs
    const viewportRange = this.viewport.maxX - this.viewport.minX
    const scale = dataRange / viewportRange

    const canvasWidth = this.config.width - this.config.leftWidth - 1
    const dataPixelsPerSecond = canvasWidth / dataRange
    const offsetX = -(this.viewport.minX - this.viewport.minTs) * dataPixelsPerSecond * scale

    this.blocksContainer.scale.x = scale
    this.blocksContainer.position.x = offsetX

    // Apply inverse scale to all text children and control visibility based on scaled width
    this.blockGraphics.forEach((graphic) => {
      graphic.children.forEach((child) => {
        if (child instanceof PIXI.Text && child.label === 'duration-text') {
          // Apply inverse scale to keep text size constant
          child.scale.x = 1 / scale

          // Calculate the actual displayed width after scaling
          const baseWidth = (child as any).baseWidth || 0
          const displayedWidth = baseWidth * scale

          // Show text only if the displayed width is large enough
          child.visible = displayedWidth > 20
        }
      })
    })

    // Update timeline position as well
    if (this.timeline) {
      this.timelineContainer.scale.x = scale
      this.timelineContainer.position.x = offsetX
    }
  }
  public setBlocks(blocks: VisibleBlock[]) {
    this.allBlocks = blocks

    // Reset window boundaries
    this.visibleWindowStart = 0
    this.visibleWindowEnd = 0

    // Initialize viewport based on first 50 seconds of data
    if (blocks.length > 0) {
      this.viewport.minTs = blocks[0].start

      // Find the maxTs from all blocks
      let maxTs = blocks[0].start
      for (const block of blocks) {
        if (block.end && block.end > maxTs) {
          maxTs = block.end
        }
      }
      this.viewport.maxTs = maxTs

      // Set initial viewport to first 50 seconds or less if data is shorter
      this.viewport.minX = this.viewport.minTs
      this.viewport.maxX = Math.min(
        this.viewport.minTs + this.config.maxTimeSpan,
        this.viewport.maxTs
      )
    }

    // Update visible blocks for the initial viewport
    this.updateVisibleBlocks()
    this.renderXAxis()
    this.app.renderer.render(this.app.stage)
  }

  public updateTimeline(currentTime: number, visible: boolean = true) {
    if (this.timeline) {
      this.timelineContainer.removeChild(this.timeline)
    }

    if (!visible) return

    this.timeline = new PIXI.Graphics()
    // Use data coordinates, container transform will handle zoom/pan
    const x = this.worldToDataScreenX(currentTime)

    this.timeline.moveTo(x, 0).lineTo(x, this.config.height).stroke({ color: 0x0000ff, width: 1 })

    this.timelineContainer.addChild(this.timeline)
  }

  private updateVisibleBlocks() {
    // Add buffer to rendered range to avoid pop-in effects
    const buffer = (this.viewport.maxX - this.viewport.minX) * 0.1
    const minVisible = this.viewport.minX - buffer
    const maxVisible = this.viewport.maxX + buffer

    // Calculate current rendered range
    const currentRenderedMin =
      this.visibleWindowStart < this.allBlocks.length
        ? (this.allBlocks[this.visibleWindowStart]?.start ?? this.viewport.minTs)
        : this.viewport.minTs
    const currentRenderedMax =
      this.visibleWindowEnd > 0 && this.visibleWindowEnd <= this.allBlocks.length
        ? (this.allBlocks[this.visibleWindowEnd - 1]?.start ?? this.viewport.maxTs)
        : this.viewport.maxTs
    const renderedRange = currentRenderedMax - currentRenderedMin

    // Only update rendered blocks if range exceeds maxTimeSpan (need to cull) or if new blocks need to be added
    const needsCulling = renderedRange > this.config.maxTimeSpan * 1.5 // 50% margin before culling

    let newWindowStart = this.visibleWindowStart
    let newWindowEnd = this.visibleWindowEnd

    if (needsCulling) {
      // Need to remove far-away blocks to save memory
      const lookbackTime = minVisible - this.config.maxTimeSpan

      // Find new window start
      newWindowStart = this.visibleWindowStart
      while (newWindowStart > 0) {
        const block = this.allBlocks[newWindowStart - 1]
        if (block.start < lookbackTime) {
          break
        }
        newWindowStart--
      }

      while (newWindowStart < this.allBlocks.length) {
        const block = this.allBlocks[newWindowStart]
        const blockEnd = block.end || this.viewport.maxTs
        if (blockEnd >= minVisible) {
          break
        }
        newWindowStart++
      }

      // Find new window end
      newWindowEnd = this.visibleWindowEnd
      while (newWindowEnd < this.allBlocks.length) {
        const block = this.allBlocks[newWindowEnd]
        if (block.start > maxVisible) {
          break
        }
        newWindowEnd++
      }

      while (newWindowEnd > newWindowStart && newWindowEnd > 0) {
        const block = this.allBlocks[newWindowEnd - 1]
        if (block.start <= maxVisible) {
          break
        }
        newWindowEnd--
      }

      newWindowStart = Math.max(0, Math.min(newWindowStart, this.allBlocks.length))
      newWindowEnd = Math.max(0, Math.min(newWindowEnd, this.allBlocks.length))

      // Remove blocks that are now outside the window
      for (let i = this.visibleWindowStart; i < newWindowStart; i++) {
        const graphic = this.blockGraphicsMap.get(i)
        if (graphic) {
          this.blocksContainer.removeChild(graphic)
          graphic.destroy()
          this.blockGraphicsMap.delete(i)
        }
      }

      for (let i = newWindowEnd; i < this.visibleWindowEnd; i++) {
        const graphic = this.blockGraphicsMap.get(i)
        if (graphic) {
          this.blocksContainer.removeChild(graphic)
          graphic.destroy()
          this.blockGraphicsMap.delete(i)
        }
      }
    } else {
      // No culling needed, just expand window if necessary
      // Expand left
      while (newWindowStart > 0) {
        const block = this.allBlocks[newWindowStart - 1]
        const blockEnd = block.end || this.viewport.maxTs
        if (blockEnd < minVisible) {
          break
        }
        newWindowStart--
      }

      // Expand right
      while (newWindowEnd < this.allBlocks.length) {
        const block = this.allBlocks[newWindowEnd]
        if (block.start > maxVisible) {
          break
        }
        newWindowEnd++
      }
    }

    // Rebuild core status for rendering context
    this.coreStatus = {}

    // Add new blocks that came into view
    for (let i = newWindowStart; i < Math.min(this.visibleWindowStart, newWindowEnd); i++) {
      if (!this.blockGraphicsMap.has(i)) {
        const block = this.allBlocks[i]
        const blockEnd = block.end || this.viewport.maxTs
        if (block.start <= maxVisible && blockEnd >= minVisible) {
          this.renderBlock(block, i)
        }
      }
    }

    for (let i = Math.max(newWindowStart, this.visibleWindowEnd); i < newWindowEnd; i++) {
      if (!this.blockGraphicsMap.has(i)) {
        const block = this.allBlocks[i]
        const blockEnd = block.end || this.viewport.maxTs
        if (block.start <= maxVisible && blockEnd >= minVisible) {
          this.renderBlock(block, i)
        }
      }
    }

    // Update visible window indices
    this.visibleWindowStart = newWindowStart
    this.visibleWindowEnd = newWindowEnd

    // Update visible blocks array for tooltip and other uses
    this.visibleBlocks = this.allBlocks.slice(newWindowStart, newWindowEnd)

    // Apply current viewport transform after updating
    this.applyViewportTransform()
  }

  private renderBlocks() {
    // Clear existing blocks
    this.blockGraphics.forEach((graphic) => {
      this.blocksContainer.removeChild(graphic)
      graphic.destroy()
    })
    this.blockGraphics = []
    this.blockGraphicsMap.clear()
    this.coreStatus = {}

    // Render visible blocks only
    for (let i = 0; i < this.allBlocks.length; i++) {
      const block = this.allBlocks[i]
      const blockEnd = block.end || this.viewport.maxX

      // Only render blocks within visible viewport
      if (block.start <= this.viewport.maxX && blockEnd >= this.viewport.minX) {
        this.renderBlock(block, i)
      }
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

    let height = this.config.buttonHeight
    let finalYPos = yPos.pos
    let text = ''
    let color = yPos.color

    const start = block.start
    const end = block.end || this.viewport.maxTs + 0.01
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

    // Use data screen coordinates (based on full data range minTs to maxTs)
    // The container transform will handle zoom and pan
    const startX = this.worldToDataScreenX(start)
    const endX = this.worldToDataScreenX(end)
    const width = endX - startX

    const screenY = this.worldToDataScreenY(finalYPos)

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
    this.blockGraphicsMap.set(dataIndex, blockGraphic)
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

  public setOnScaleChange(callback: (scale: number) => void) {
    this.onScaleChange = callback
  }

  public setOnPanPercentageChange(callback: (percentage: number) => void) {
    this.onPanPercentageChange = callback
  }

  private notifyPanPercentageChange() {
    if (this.onPanPercentageChange) {
      const totalRange = this.viewport.maxTs - this.viewport.minTs
      if (totalRange > 0) {
        const currentPosition = this.viewport.minX - this.viewport.minTs
        const percentage = (currentPosition / totalRange) * 100
        this.onPanPercentageChange(Math.max(0, Math.min(100, percentage)))
      }
    }
  }

  public destroy() {
    // Clear tooltip timer
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer)
      this.tooltipTimer = null
    }

    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip)
    }

    this.blockGraphics.forEach((graphic) => graphic.destroy())
    this.app.destroy(true, { children: true, texture: true })
  }
}
