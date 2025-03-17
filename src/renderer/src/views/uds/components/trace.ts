import konva from 'konva'
import { VxeGridPropTypes } from 'vxe-table'
export interface LogData {
  dir?: 'Tx' | 'Rx' | '--'
  data: string
  ts: string
  id?: string
  dlc?: number
  len?: number
  device: string
  channel: string
  msgType: string
  method: string
  name?: string
  seqIndex?: number
}
export type CTableColumns = VxeGridPropTypes.Columns<LogData>

export class CTable {
  private headerGroup: konva.Group
  private bodyGroup: konva.Group // 新增数据区域组
  private headerHeight: number = 30
  private rowHeight: number = 30 // 行高
  private cellPadding: number = 10
  private headerBgColor: string = '#f8f8f9'
  private rowBgColor: string = '#ffffff'
  private rowAltBgColor: string = '#f9f9f9' // 交替行背景色
  private borderColor: string = '#e8eaec'
  private textColor: string = '#515a6e'
  private fontSize: number = 12
  private fontFamily: string = 'Arial'
  private columns: CTableColumns
  private width: number = 0
  private resizeHandles: konva.Rect[] = []
  private containerWidth: number = 0
  private hScrollbarGroup: konva.Group // 水平滚动条组
  private vScrollbarGroup: konva.Group // 垂直滚动条组
  private scrollbarHeight: number = 6 // 滚动条高度/宽度
  private vScrollbarThumbHeight: number = 60 // 垂直滚动条滑块固定高度
  private scrollbarBgColor: string = '#f1f1f1'
  private scrollbarThumbColor: string = '#c1c1c1'
  private hScrollbarThumb: konva.Rect | null = null // 水平滚动条滑块
  private hScrollbarBg: konva.Rect | null = null // 水平滚动条背景
  private vScrollbarThumb: konva.Rect | null = null // 垂直滚动条滑块
  private vScrollbarBg: konva.Rect | null = null // 垂直滚动条背景
  private hScrollPosition: number = 0 // 水平滚动位置
  private vScrollPosition: number = 0 // 垂直滚动位置
  private scrolling: boolean = false
  private containerHeight: number = 0
  private stage: konva.Stage
  private data: any[] = [] // 存储表格数据
  private maxCacheRows: number = 10000 // 最大缓存行数
  private visibleRowsCount: number = 0 // 可见行数
  private startRowIndex: number = 0 // 当前可见的起始行索引
  private totalHeight: number = 0 // 所有数据行的总高度

  constructor(private layer: konva.Layer) {
    this.columns = [
      {
        field: 'type',
        title: '',
        width: 36,
        resizable: false,
        editRender: {},
        slots: { default: 'default_type' }
      },
      { field: 'ts', title: 'Time', width: 100 },
      { field: 'name', title: 'Name', width: 200 },
      { field: 'data', title: 'Data', minWidth: 300 },
      { field: 'dir', title: 'Dir', width: 50 },
      // { field: 'seqIndex', title: 'Num', width: 50 },

      { field: 'id', title: 'ID', width: 100 },

      { field: 'dlc', title: 'DLC', width: 100 },
      { field: 'len', title: 'Len', width: 100 },
      { field: 'msgType', title: 'Type', width: 100 },
      { field: 'channel', title: 'Channel', width: 100 },
      { field: 'device', title: 'Device', width: 200 }
    ]
    this.headerGroup = new konva.Group()
    this.bodyGroup = new konva.Group()
    this.hScrollbarGroup = new konva.Group()
    this.vScrollbarGroup = new konva.Group()
    this.layer.add(this.headerGroup)
    this.layer.add(this.bodyGroup)
    this.layer.add(this.hScrollbarGroup)
    this.layer.add(this.vScrollbarGroup)
    this.stage = this.layer.getStage()

    // 获取容器宽度和高度
    if (this.stage) {
      this.containerWidth = this.stage.width()
      this.containerHeight = this.stage.height()
      this.visibleRowsCount = Math.floor(
        (this.containerHeight - this.headerHeight - this.scrollbarHeight) / this.rowHeight
      )
    }

    this.initHeader()
    this.initBody()
    this.initHScrollbar()
    this.initVScrollbar()
  }

  private calculateTotalWidth(): number {
    // 计算所有列宽的总和
    const columnsWidth = this.columns.reduce((total, column) => {
      return total + (typeof column.width === 'number' ? column.width : 100)
    }, 0)

    // 如果列宽总和小于stage宽度，则返回stage宽度减去滚动条宽度
    if (this.stage && columnsWidth < this.stage.width() - this.scrollbarHeight) {
      return this.stage.width() - this.scrollbarHeight
    }

    // 否则返回列宽总和
    return columnsWidth
  }

  private addResizeHandlers(handle: konva.Rect, columnIndex: number) {
    handle.on('mousedown touchstart', (e) => {
      const startX = this.stage.getPointerPosition()?.x || 0
      const initialWidth =
        typeof this.columns[columnIndex].width === 'number'
          ? (this.columns[columnIndex].width as number)
          : 100

      // 添加鼠标移动事件
      const mouseMoveHandler = (moveEvent: any) => {
        const currentX = this.stage.getPointerPosition()?.x || 0
        const newWidth = Math.max(30, initialWidth + (currentX - startX))

        // 更新列宽
        this.columns[columnIndex].width = newWidth

        // 重新绘制表头
        this.headerGroup.destroyChildren()
        this.resizeHandles = []
        this.initHeader()

        // 重新绘制数据区域
        this.initBody()

        // 重新初始化滚动条
        this.initHScrollbar()
        this.initVScrollbar()
      }

      // 添加鼠标释放事件
      const mouseUpHandler = () => {
        this.stage.off('mousemove touchmove', mouseMoveHandler)
        this.stage.off('mouseup touchend', mouseUpHandler)
      }

      this.stage.on('mousemove touchmove', mouseMoveHandler)
      this.stage.on('mouseup touchend', mouseUpHandler)
    })

    // 鼠标悬停效果
    handle.on('mouseover', () => {
      //cursor: col-resize
      this.stage.container().style.cursor = 'col-resize'
      this.layer.draw()
    })

    handle.on('mouseout', () => {
      this.stage.container().style.cursor = 'default'
      this.layer.draw()
    })
  }

  // 添加鼠标滚轮事件处理
  private setupWheelEvents() {
    // 移除之前的事件监听器，避免重复添加
    this.stage.off('wheel.tableScroll')

    // 添加新的事件监听器
    this.stage.on('wheel.tableScroll', (e) => {
      e.evt.preventDefault()

      // 检查是否按下Shift键 - Shift+滚轮用于水平滚动
      if (e.evt.shiftKey && this.hScrollbarThumb) {
        const delta = e.evt.deltaY || e.evt.deltaX
        const maxScroll = this.width - (this.containerWidth - this.scrollbarHeight)

        // 更新水平滚动位置
        this.hScrollPosition = Math.max(0, Math.min(maxScroll, this.hScrollPosition + delta))

        // 更新表头和数据区域位置
        this.headerGroup.x(-this.hScrollPosition)
        this.bodyGroup.x(-this.hScrollPosition)

        // 更新水平滑块位置
        if (this.hScrollbarThumb) {
          const thumbWidth = this.hScrollbarThumb.width()
          const scrollRatio = this.hScrollPosition / maxScroll
          const newThumbX = scrollRatio * (this.containerWidth - this.scrollbarHeight - thumbWidth)
          this.hScrollbarThumb.x(newThumbX)
        }
      }
      // 默认垂直滚动
      else if (this.vScrollbarThumb) {
        const delta = e.evt.deltaY
        const visibleHeight = this.containerHeight - this.headerHeight - this.scrollbarHeight
        const maxScroll = this.totalHeight - visibleHeight

        if (maxScroll <= 0) return

        // 更新垂直滚动位置
        this.vScrollPosition = Math.max(0, Math.min(maxScroll, this.vScrollPosition + delta))

        // 计算当前应该显示的起始行索引
        this.startRowIndex = Math.floor(this.vScrollPosition / this.rowHeight)

        // 更新垂直滑块位置
        if (this.vScrollbarThumb) {
          const scrollableHeight = visibleHeight - this.vScrollbarThumbHeight
          const scrollRatio = this.vScrollPosition / maxScroll
          const newThumbY = this.headerHeight + scrollRatio * scrollableHeight
          this.vScrollbarThumb.y(newThumbY)
        }

        // 重新绘制数据区域
        this.initBody()
      }

      this.layer.draw()
    })
  }

  // 初始化表头
  public initHeader() {
    // 计算列宽总和
    const columnsWidth = this.columns.reduce((total, column) => {
      return total + (typeof column.width === 'number' ? column.width : 100)
    }, 0)

    // 如果列宽总和小于stage宽度，增加data列的宽度
    let dataColumnExtraWidth = 0
    if (this.stage && columnsWidth < this.stage.width() - this.scrollbarHeight) {
      // 查找data列的索引
      const dataColumnIndex = this.columns.findIndex((col) => col.field === 'data')
      if (dataColumnIndex !== -1) {
        dataColumnExtraWidth = this.stage.width() - this.scrollbarHeight - columnsWidth
        // 更新data列的宽度
        const currentWidth =
          typeof this.columns[dataColumnIndex].width === 'number'
            ? (this.columns[dataColumnIndex].width as number)
            : 100
        this.columns[dataColumnIndex].width = currentWidth + dataColumnExtraWidth
      }
    }

    // 计算总宽度
    this.width = this.calculateTotalWidth()

    // 绘制表头背景
    const headerBg = new konva.Rect({
      x: 0,
      y: 0,
      width: this.width,
      height: this.headerHeight,
      fill: this.headerBgColor,
      stroke: this.borderColor,
      strokeWidth: 1
    })
    this.headerGroup.add(headerBg)

    // 绘制每个列标题
    let currentX = 0
    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i]
      const width = typeof column.width === 'number' ? column.width : 100

      // 列分隔线
      if (i > 0) {
        const line = new konva.Line({
          points: [currentX, 0, currentX, this.headerHeight],
          stroke: this.borderColor,
          strokeWidth: 1
        })
        this.headerGroup.add(line)
      }

      // 获取列的对齐方式，默认为居中
      const align = column.align || 'center'

      // 列标题文本
      const text = new konva.Text({
        text: (column.title as string) || '',
        fontSize: this.fontSize,
        fontStyle: 'bold',
        fontFamily: this.fontFamily,
        fill: this.textColor
      })

      // 根据对齐方式设置文本位置
      let textX = 0
      switch (align) {
        case 'left':
          textX = currentX + this.cellPadding
          break
        case 'right':
          textX = currentX + width - text.width() - this.cellPadding
          break
        case 'center':
        default:
          textX = currentX + (width - text.width()) / 2
          break
      }

      text.x(textX)
      text.y((this.headerHeight - this.fontSize) / 2)

      this.headerGroup.add(text)

      // 检查列是否可调整大小
      const isResizable = column.resizable !== false // 默认为true，除非明确设置为false

      // 只有当列可调整大小时才添加调整列宽的控制柄
      if (isResizable) {
        // 添加调整列宽的控制柄
        const resizeHandle = new konva.Rect({
          x: currentX + width - 3,
          y: 0,
          width: 6,
          height: this.headerHeight,
          fill: 'transparent'
        })

        // 添加拖动调整列宽的功能
        this.addResizeHandlers(resizeHandle, i)

        this.headerGroup.add(resizeHandle)
        this.resizeHandles.push(resizeHandle)
      }

      currentX += width
    }

    // 应用滚动位置
    this.headerGroup.x(-this.hScrollPosition)

    this.layer.draw()
  }

  // 初始化数据区域
  public initBody() {
    // 设置数据区域位置
    this.bodyGroup.y(this.headerHeight)
    this.bodyGroup.x(-this.hScrollPosition) // 应用水平滚动位置

    // 清除现有内容
    this.bodyGroup.destroyChildren()

    // 计算总高度
    this.totalHeight = this.data.length * this.rowHeight

    // 计算可见行范围
    const endRowIndex = Math.min(this.startRowIndex + this.visibleRowsCount + 1, this.data.length)

    // 计算实际要绘制的行数（确保填满可视区域）
    const rowsToDraw = Math.max(this.visibleRowsCount + 1, endRowIndex - this.startRowIndex)

    // 绘制可见行
    for (let i = 0; i < rowsToDraw; i++) {
      const rowIndex = this.startRowIndex + i
      const rowY = i * this.rowHeight
      const rowData = rowIndex < this.data.length ? this.data[rowIndex] : null

      // 创建行背景 (交替行颜色)
      const rowBg = new konva.Rect({
        x: 0,
        y: rowY,
        width: this.width,
        height: this.rowHeight,
        fill: rowIndex % 2 === 0 ? this.rowBgColor : this.rowAltBgColor,
        stroke: this.borderColor,
        strokeWidth: 1
      })

      this.bodyGroup.add(rowBg)

      // 绘制单元格
      let currentX = 0
      for (let colIndex = 0; colIndex < this.columns.length; colIndex++) {
        const column = this.columns[colIndex]
        const width = typeof column.width === 'number' ? column.width : 100

        // 列分隔线
        if (colIndex > 0) {
          const line = new konva.Line({
            points: [currentX, rowY, currentX, rowY + this.rowHeight],
            stroke: this.borderColor,
            strokeWidth: 1
          })
          this.bodyGroup.add(line)
        }

        // 只有当有数据时才绘制单元格内容
        if (rowData) {
          const field = column.field as string

          // 获取单元格数据
          const cellValue = rowData && rowData[field] !== undefined ? String(rowData[field]) : ''

          // 获取列的对齐方式，默认为居中
          const align = column.align || 'center'

          // 创建单元格文本
          const cellText = new konva.Text({
            text: cellValue,
            fontSize: this.fontSize,
            fontFamily: this.fontFamily,
            fill: this.textColor,
            y: rowY + (this.rowHeight - this.fontSize) / 2
          })

          // 根据对齐方式设置文本位置
          let textX = 0
          switch (align) {
            case 'left':
              textX = currentX + this.cellPadding
              break
            case 'right':
              textX = currentX + width - cellText.width() - this.cellPadding
              break
            case 'center':
            default:
              textX = currentX + (width - cellText.width()) / 2
              break
          }

          cellText.x(textX)
          this.bodyGroup.add(cellText)
        }

        currentX += width
      }
    }

    this.layer.draw()
  }

  // 初始化水平滚动条
  public initHScrollbar() {
    this.containerWidth = this.stage.width()
    this.containerHeight = this.stage.height()

    // 只有当表格宽度超过容器宽度时才显示水平滚动条
    if (this.width <= this.containerWidth - this.scrollbarHeight) {
      this.hScrollbarGroup.visible(false)
      return
    }

    this.hScrollbarGroup.visible(true)
    this.hScrollbarGroup.destroyChildren()

    // 水平滚动条背景 - 放在底部
    this.hScrollbarBg = new konva.Rect({
      x: 0,
      y: this.containerHeight - this.scrollbarHeight,
      width: this.containerWidth - this.scrollbarHeight, // 留出垂直滚动条的空间
      height: this.scrollbarHeight,
      fill: this.scrollbarBgColor,
      cornerRadius: 3 // 减小圆角
    })

    // 计算滑块宽度和位置
    const thumbRatio = (this.containerWidth - this.scrollbarHeight) / this.width
    const thumbWidth = Math.max(30, (this.containerWidth - this.scrollbarHeight) * thumbRatio)
    const thumbX =
      (this.hScrollPosition / this.width) * (this.containerWidth - this.scrollbarHeight)

    // 水平滚动条滑块 - 放在底部
    this.hScrollbarThumb = new konva.Rect({
      x: thumbX,
      y: this.containerHeight - this.scrollbarHeight,
      width: thumbWidth,
      height: this.scrollbarHeight,
      fill: this.scrollbarThumbColor,
      cornerRadius: 3, // 减小圆角
      draggable: true,
      dragBoundFunc: (pos) => {
        // 限制滑块在滚动条范围内
        return {
          x: Math.max(0, Math.min(this.containerWidth - this.scrollbarHeight - thumbWidth, pos.x)),
          y: this.containerHeight - this.scrollbarHeight
        }
      }
    })

    // 添加滑块拖动事件
    this.hScrollbarThumb.on('dragmove', () => {
      if (!this.hScrollbarThumb) return
      const maxScroll = this.width - (this.containerWidth - this.scrollbarHeight)
      const scrollRatio =
        this.hScrollbarThumb.x() / (this.containerWidth - this.scrollbarHeight - thumbWidth)
      this.hScrollPosition = Math.max(0, Math.min(maxScroll, maxScroll * scrollRatio))
      this.headerGroup.x(-this.hScrollPosition)
      this.bodyGroup.x(-this.hScrollPosition)
      this.layer.draw()
    })

    // 添加滚动条点击事件（点击滚动条背景时移动滑块到该位置）
    if (this.hScrollbarBg) {
      this.hScrollbarBg.on('click', (e) => {
        if (!this.hScrollbarThumb) return

        const pointerPos = this.stage.getPointerPosition()
        if (!pointerPos) return

        const clickX = pointerPos.x - this.hScrollbarGroup.x()
        const thumbWidth = this.hScrollbarThumb.width()
        const newThumbX = Math.max(
          0,
          Math.min(this.containerWidth - this.scrollbarHeight - thumbWidth, clickX - thumbWidth / 2)
        )

        this.hScrollbarThumb.x(newThumbX)

        const maxScroll = this.width - (this.containerWidth - this.scrollbarHeight)
        const scrollRatio = newThumbX / (this.containerWidth - this.scrollbarHeight - thumbWidth)
        this.hScrollPosition = Math.max(0, Math.min(maxScroll, maxScroll * scrollRatio))
        this.headerGroup.x(-this.hScrollPosition)
        this.bodyGroup.x(-this.hScrollPosition)

        this.layer.draw()
      })
    }

    this.hScrollbarGroup.add(this.hScrollbarBg)
    this.hScrollbarGroup.add(this.hScrollbarThumb)

    this.layer.draw()
  }

  // 初始化垂直滚动条
  public initVScrollbar() {
    // 只有当数据总高度超过可视区域高度时才显示垂直滚动条
    const visibleHeight = this.containerHeight - this.headerHeight - this.scrollbarHeight

    if (this.totalHeight <= visibleHeight) {
      this.vScrollbarGroup.visible(false)
      return
    }

    this.vScrollbarGroup.visible(true)
    this.vScrollbarGroup.destroyChildren()

    // 垂直滚动条背景 - 放在右侧
    this.vScrollbarBg = new konva.Rect({
      x: this.containerWidth - this.scrollbarHeight,
      y: this.headerHeight,
      width: this.scrollbarHeight,
      height: visibleHeight,
      fill: this.scrollbarBgColor,
      cornerRadius: 3 // 减小圆角
    })

    // 使用固定的滑块高度
    const thumbHeight = this.vScrollbarThumbHeight
    const thumbY =
      this.headerHeight + (this.vScrollPosition / this.totalHeight) * (visibleHeight - thumbHeight)

    // 垂直滚动条滑块 - 放在右侧
    this.vScrollbarThumb = new konva.Rect({
      x: this.containerWidth - this.scrollbarHeight,
      y: thumbY,
      width: this.scrollbarHeight,
      height: thumbHeight,
      fill: this.scrollbarThumbColor,
      cornerRadius: 3, // 减小圆角
      draggable: true,
      dragBoundFunc: (pos) => {
        // 限制滑块在滚动条范围内
        return {
          x: this.containerWidth - this.scrollbarHeight,
          y: Math.max(
            this.headerHeight,
            Math.min(this.containerHeight - this.scrollbarHeight - thumbHeight, pos.y)
          )
        }
      }
    })

    // 添加滑块拖动事件
    this.vScrollbarThumb.on('dragmove', () => {
      if (!this.vScrollbarThumb) return

      const maxScroll = this.totalHeight - visibleHeight
      const scrollableHeight = visibleHeight - thumbHeight
      const scrollRatio = (this.vScrollbarThumb.y() - this.headerHeight) / scrollableHeight

      this.vScrollPosition = Math.max(0, Math.min(maxScroll, maxScroll * scrollRatio))

      // 计算当前应该显示的起始行索引
      this.startRowIndex = Math.floor(this.vScrollPosition / this.rowHeight)

      // 重新绘制数据区域
      this.initBody()
    })

    // 添加滚动条点击事件（点击滚动条背景时移动滑块到该位置）
    if (this.vScrollbarBg) {
      this.vScrollbarBg.on('click', (e) => {
        if (!this.vScrollbarThumb) return

        const pointerPos = this.stage.getPointerPosition()
        if (!pointerPos) return

        const clickY = pointerPos.y
        const newThumbY = Math.max(
          this.headerHeight,
          Math.min(
            this.containerHeight - this.scrollbarHeight - thumbHeight,
            clickY - thumbHeight / 2
          )
        )

        this.vScrollbarThumb.y(newThumbY)

        const maxScroll = this.totalHeight - visibleHeight
        const scrollableHeight = visibleHeight - thumbHeight
        const scrollRatio = (newThumbY - this.headerHeight) / scrollableHeight

        this.vScrollPosition = Math.max(0, Math.min(maxScroll, maxScroll * scrollRatio))

        // 计算当前应该显示的起始行索引
        this.startRowIndex = Math.floor(this.vScrollPosition / this.rowHeight)

        // 重新绘制数据区域
        this.initBody()
      })
    }

    this.vScrollbarGroup.add(this.vScrollbarBg)
    this.vScrollbarGroup.add(this.vScrollbarThumb)

    this.layer.draw()
  }

  // 更新表格大小
  resize(width: number, height: number) {
    this.stage.width(width)
    this.stage.height(height)
    this.containerWidth = width
    this.containerHeight = height
    this.visibleRowsCount = Math.floor(
      (this.containerHeight - this.headerHeight - this.scrollbarHeight) / this.rowHeight
    )

    this.initBody()
    this.initHScrollbar()
    this.initVScrollbar()
    this.setupWheelEvents()
    this.layer.draw()
  }

  // 更新列配置
  updateColumns(columns: CTableColumns) {
    this.columns = columns
    this.headerGroup.destroyChildren()
    this.resizeHandles = []
    this.initHeader()
    this.initBody()
    this.initHScrollbar()
    this.initVScrollbar()
  }

  // 添加多行数据
  addRows(rows: any[]) {
    // 添加到数据数组
    this.data = this.data.concat(rows)

    // 如果超过最大缓存行数，移除最早的数据
    if (this.data.length > this.maxCacheRows) {
      const excessRows = this.data.length - this.maxCacheRows
      this.data.splice(0, excessRows)

      // 如果当前滚动位置已经超出范围，调整滚动位置
      if (this.startRowIndex > 0) {
        this.startRowIndex = Math.max(0, this.startRowIndex - excessRows)
      }
    }

    // 更新总高度
    this.totalHeight = this.data.length * this.rowHeight

    // 自动滚动到底部显示最新数据
    this.scrollToBottom()

    // 重新绘制数据区域
    this.initBody()

    // 更新垂直滚动条
    this.initVScrollbar()
  }

  // 滚动到底部显示最新数据
  scrollToBottom() {
    const visibleHeight = this.containerHeight - this.headerHeight - this.scrollbarHeight

    // 如果数据总高度大于可视区域高度，则滚动到底部
    if (this.totalHeight > visibleHeight) {
      // 计算应该显示的起始行索引，使最后一页数据可见
      this.startRowIndex = Math.max(0, this.data.length - this.visibleRowsCount)

      // 更新垂直滚动位置
      this.vScrollPosition = this.startRowIndex * this.rowHeight

      // 更新垂直滑块位置
      if (this.vScrollbarThumb) {
        const maxScroll = this.totalHeight - visibleHeight
        if (maxScroll > 0) {
          const scrollableHeight = visibleHeight - this.vScrollbarThumbHeight
          const scrollRatio = this.vScrollPosition / maxScroll
          const newThumbY = this.headerHeight + scrollRatio * scrollableHeight
          this.vScrollbarThumb.y(newThumbY)
        }
      }
    }
  }

  // 清空数据
  clearData() {
    this.data = []
    this.startRowIndex = 0
    this.vScrollPosition = 0
    this.totalHeight = 0
    this.initBody()
    this.initVScrollbar()
  }

  // 获取当前数据
  getData() {
    return this.data
  }

  // 设置垂直滚动位置
  setVerticalScroll(rowIndex: number) {
    if (rowIndex < 0 || rowIndex >= this.data.length) return

    this.startRowIndex = rowIndex
    this.vScrollPosition = rowIndex * this.rowHeight

    // 更新垂直滑块位置
    if (this.vScrollbarThumb) {
      const visibleHeight = this.containerHeight - this.headerHeight - this.scrollbarHeight
      const maxScroll = this.totalHeight - visibleHeight

      if (maxScroll > 0) {
        const thumbHeight = this.vScrollbarThumb.height()
        const scrollableHeight = visibleHeight - thumbHeight
        const scrollRatio = this.vScrollPosition / maxScroll
        const newThumbY = this.headerHeight + scrollRatio * scrollableHeight
        this.vScrollbarThumb.y(newThumbY)
      }
    }

    this.initBody()
    this.layer.draw()
  }

  // 初始化表格
  init() {
    this.initHeader()
    this.initBody()
    this.initHScrollbar()
    this.initVScrollbar()
    this.setupWheelEvents()
    this.layer.draw()
  }

  close() {
    this.stage.off('wheel.tableScroll')
    this.headerGroup.destroy()
    this.bodyGroup.destroy()
    this.hScrollbarGroup.destroy()
    this.vScrollbarGroup.destroy()
    this.layer.destroy()
  }
}
