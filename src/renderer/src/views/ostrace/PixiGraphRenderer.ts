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

    this.container.addChild(this.blocksContainer)
    this.container.addChild(this.timelineContainer)
    this.app.stage.addChild(this.container)

    // Create tooltip
    this.createTooltip()

    // Setup interactions
    this.setupInteractions()

    // Initial render
    this.updateViewport()
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

    const delta = -event.deltaY / 1000
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
    const zoomFactor = 1 + delta * 0.1
    const oldScaleX = this.viewport.scaleX
    const newScaleX = Math.max(0.1, Math.min(10, oldScaleX * zoomFactor))

    // Zoom around mouse position
    const mouseWorldX = this.screenToWorldX(mouseX)
    this.viewport.scaleX = newScaleX
    const newMouseWorldX = this.screenToWorldX(mouseX)
    this.viewport.offsetX += (mouseWorldX - newMouseWorldX) * this.getPixelsPerSecond()

    this.updateViewport()
  }

  private handlePan(deltaX: number) {
    this.viewport.offsetX += deltaX
    this.updateViewport()
  }

  private handleMouseDown(event: MouseEvent) {
    if (event.altKey) {
      this.isDragging = true
      this.lastPointerPosition = { x: event.clientX, y: event.clientY }
      this.app.canvas.style.cursor = 'grabbing'
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.isDragging && event.altKey) {
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

  private screenToWorldX(screenX: number): number {
    return (screenX - this.viewport.offsetX) / this.getPixelsPerSecond() + this.viewport.minX
  }

  private screenToWorldY(screenY: number): number {
    return (this.config.height - screenY) / this.config.buttonHeight
  }

  private worldToScreenX(worldX: number): number {
    return (worldX - this.viewport.minX) * this.getPixelsPerSecond() + this.viewport.offsetX
  }

  private worldToScreenY(worldY: number): number {
    return this.config.height - worldY * this.config.buttonHeight
  }

  private getPixelsPerSecond(): number {
    return (
      ((this.config.width - this.config.leftWidth - 1) /
        (this.viewport.maxX - this.viewport.minX)) *
      this.viewport.scaleX
    )
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
        return this.config.totalButtons - yPos - 1
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
  }

  public updateViewport(minX?: number, maxX?: number) {
    if (minX !== undefined) this.viewport.minX = minX
    if (maxX !== undefined) this.viewport.maxX = maxX
    this.renderBlocks()
  }

  public setBlocks(blocks: VisibleBlock[]) {
    this.visibleBlocks = blocks
    this.renderBlocks()
  }

  public updateTimeline(currentTime: number, visible: boolean = true) {
    if (this.timeline) {
      this.timelineContainer.removeChild(this.timeline)
    }

    if (!visible) return

    this.timeline = new PIXI.Graphics()
    const x = this.worldToScreenX(currentTime)

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

    const startX = this.worldToScreenX(start)
    const endX = this.worldToScreenX(end)
    let width = endX - startX
    if (width < 4) {
      width = 4
    }

    const screenY = this.worldToScreenY(finalYPos)

    // Create block graphic
    const blockGraphic = new PIXI.Graphics()
    blockGraphic.rect(startX, screenY - height, width, height).fill(this.colorToHex(color))

    // Add text if it fits
    if (text && width > 20) {
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
      textGraphic.y = screenY - height / 2

      // Only add text if it fits within the block
      if (textGraphic.width <= width - 4) {
        blockGraphic.addChild(textGraphic)
      }
    }

    this.blocksContainer.addChild(blockGraphic)
    this.blockGraphics.push(blockGraphic)
  }

  public destroy() {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip)
    }

    this.blockGraphics.forEach((graphic) => graphic.destroy())
    this.app.destroy(true, { children: true, texture: true })
  }
}
