// stores/counter.js
import * as joint from '@joint/core'
import { EventEmitter } from 'events'
import { CanBaseInfo } from 'nodeCan/can'
import { TesterInfo } from 'nodeCan/tester'
import { v4 } from 'uuid'
import { ElMessageBox } from 'element-plus'
import { UdsDevice } from 'nodeCan/uds'
import { Layout } from '../layout'
import { useDataStore } from '@r/stores/data'
import nodeConfig from './config/node/nodeConfig.vue'
import { h } from 'vue'
import { useProjectStore } from '@r/stores/project'
import { cloneDeep, get } from 'lodash'
import { Inter, NodeItem } from 'src/preload/data'
import { nextTick } from 'vue'
import testConfig from '@iconify/icons-grommet-icons/test'
import { useDark } from '@vueuse/core'

export interface udsBase {
  name: string
  type: string
  id: string
}

class Region extends joint.dia.Element {
  defaults() {
    return joint.util.defaultsDeep(
      {
        type: 'link.region',
        attrs: {
          body: {
            width: 'calc(w)',
            height: 'calc(h)',
            strokeWidth: 2,
            stroke: '#000000',
            fill: '#FFFFFF'
          },
          labelTop: {
            x: 'calc(1*w)',
            y: '10',
            fontSize: 10,
            fill: '#333333',
            'font-weight': 700
          },
          label: {
            textVerticalAnchor: 'middle',
            textAnchor: 'middle',
            refX: '50%',
            refY: 'calc(50%+100)',
            fontSize: 10,
            fill: '#333333',
            textWrap: {
              width: 120, // 相对于元素宽度的偏移
              height: 22, // 设置为与字体大小相同的固定高度
              ellipsis: true // 如果文本太长，以省略号结尾
            }
          },
          labelBottom: {
            textVerticalAnchor: 'middle',
            textAnchor: 'middle',
            refX: '50%',
            refY: '75%',
            fontSize: 10,
            fill: '#333333',
            textWrap: {
              width: 120, // 修改为所需的宽度，例如 0 表示不限制宽度
              height: 22, // 设置为与字体大小相同的固定高度
              ellipsis: true // 如果文本太长，以省略号结尾
            }
          },
          title: {
            x: 'calc(0.5*w)',
            y: '9',
            textVerticalAnchor: 'middle',
            textAnchor: 'middle',
            fontSize: 12,
            fill: '#333333'
          },
          line: {
            x1: 0,
            y1: 16,
            x2: 'calc(w)',
            y2: 16,
            stroke: '#000000',
            strokeWidth: 1
          }
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        /*@ts-ignore*/
      },
      super.defaults
    )
  }
  markup = [
    {
      tagName: 'rect',
      selector: 'body'
    },
    {
      tagName: 'text',
      selector: 'labelTop'
    },
    {
      tagName: 'text',
      selector: 'label'
    },
    {
      tagName: 'text',
      selector: 'labelBottom'
    },

    {
      tagName: 'text',
      selector: 'title'
    },
    {
      tagName: 'line',
      selector: 'line'
    },
    {
      tagName: 'circle',
      selector: 'cornerCircle'
    },
    {
      tagName: 'text',
      selector: 'cornerText'
    },
    {
      tagName: 'text',
      selector: 'cornerText1'
    },
    {
      tagName: 'path',
      selector: 'testIcon'
    }
  ]
}
export const colorMap: Record<string, { fill: string; color: string }> = {
  device: {
    fill: 'rgb(51.2, 126.4, 204)',
    color: '#FFFFFF'
  },
  interactive: {
    fill: 'rgb(121.3, 187.1, 255)',
    color: '#FFFFFF'
  },
  node: {
    fill: 'rgb(184, 129.6, 48)',
    color: '#FFFFFF'
  }
}

export class udsCeil {
  graph: joint.dia.Graph
  rect: joint.shapes.standard.Rectangle
  events: EventEmitter = new EventEmitter()

  data: udsBase
  title?: string
  enable = true

  constructor(
    paper: joint.dia.Paper,
    graph: joint.dia.Graph,
    e: udsBase,
    private x: number,
    private y: number,
    button: {
      edit: boolean
      panel: boolean
      remove: boolean
      lockY?: boolean
      lockX?: boolean
    }
  ) {
    this.graph = graph

    const width = 150
    const height = 100
    this.data = e

    this.rect = new Region({
      position: { x: x, y: y },
      size: { width: width, height: height },
      attrs: {
        body: {
          fill: colorMap[e.type].fill
        },
        label: {
          text: e.name,
          fontSize: 12,
          fill: colorMap[e.type].color
        },
        labelBottom: {
          text: '',
          fontSize: 10,
          fill: colorMap[e.type].color
        }
      },
      id: e.id,
      meta: this
    })

    this.graph.addCell(this.rect)
    ;(this.rect as any).on('change:position', (cell: any, newPos) => {
      if (newPos.x == this.x && newPos.y == this.y) {
        return
      }

      if (newPos.x > -100) {
        newPos.x = -100
      }
      if (newPos.y < -100) {
        newPos.y = -100
      }
      if (button.lockY && !button.lockX) {
        this.x = newPos.x
        cell.set('position', {
          x: newPos.x,
          y: this.y
        })

        nodeXOffset = newPos.x - 200
      } else if (button.lockX && !button.lockY) {
        this.y = newPos.y
        cell.set('position', {
          x: this.x,
          y: newPos.y
        })

        deviceYOffset = newPos.y + 200
      } else if (button.lockX && button.lockY) {
        cell.set('position', {
          x: this.x,
          y: this.y
        })
      }
    })

    this.rect.attr('title', {
      text: e.type.toLocaleUpperCase(),
      fill: colorMap[e.type].color
    })
    //make name label lower
    this.rect.attr('label/refY', '56%')

    const view = this.rect.findView(paper)
    if (view) {
      const boundaryTool = new joint.elementTools.Boundary()
      const toolsList = [boundaryTool]
      let offset = -8

      if (button.edit) {
        const editButtonClass = (joint.elementTools.Button as any).extend({
          name: 'edit-button',
          options: {
            markup: [
              {
                tagName: 'circle',
                selector: 'button',
                attributes: {
                  r: 7,
                  fill: 'var(--el-color-warning)',
                  cursor: 'pointer'
                }
              },
              {
                tagName: 'path',
                selector: 'icon',
                attributes: {
                  d: [
                    'M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1',
                    'M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3zM16 5l3 3'
                  ],
                  fill: 'none',
                  stroke: '#FFFFFF',
                  'stroke-width': 2,
                  'pointer-events': 'none',
                  transform: ['translate(-5.5,-5.5)', 'scale(0.45)']
                }
              }
            ],
            x: '0%',
            y: '100%',
            offset: {
              x: 8,
              y: offset
            },
            rotate: true,
            action: () => {
              this.events.emit('edit', this)
            }
          }
        })
        const edit = new editButtonClass()
        toolsList.push(edit)
        offset -= 17
      }

      if (button.panel) {
        const editButtonClass = (joint.elementTools.Button as any).extend({
          name: 'edit-button',
          options: {
            markup: [
              {
                tagName: 'circle',
                selector: 'button',
                attributes: {
                  r: 7,
                  fill: 'var(--el-color-primary)',
                  cursor: 'pointer'
                }
              },
              {
                tagName: 'path',
                selector: 'icon',
                attributes: {
                  d: [
                    'M10.05 23q-.75 0-1.4-.337T7.575 21.7L1.2 12.375l.6-.575q.475-.475 1.125-.55t1.175.3L7 13.575V4q0-.425.288-.712T8 3t.713.288T9 4v8h2V2q0-.425.288-.712T12 1t.713.288T13 2v10h2V3q0-.425.288-.712T16 2t.713.288T17 3v9h2V5q0-.425.288-.712T20 4t.713.288T21 5v14q0 1.65-1.175 2.825T17 23z'
                  ],
                  fill: 'none',
                  stroke: '#FFFFFF',
                  'stroke-width': 2,
                  'pointer-events': 'none',
                  transform: ['translate(-5.5,-5.5)', 'scale(0.45)']
                }
              }
            ],
            x: '0%',
            y: '100%',
            offset: {
              x: 8,
              y: offset
            },
            rotate: true,
            action: () => {
              this.events.emit('panel', this)
            }
          }
        })
        const edit = new editButtonClass()
        toolsList.push(edit)
        offset -= 17
      }

      if (button.remove) {
        const removeTools = new joint.elementTools.Remove({
          x: '0%',
          y: '100%',
          offset: {
            x: 8,
            y: offset
          },
          action: () => {
            this.events.emit('remove', this)
          }
        })
        toolsList.push(removeTools)
        offset -= 17
      }

      const toolsView = new joint.dia.ToolsView({
        tools: toolsList
      })
      view.addTools(toolsView)
      view.hideTools()
    }
  }
  getId() {
    return this.data.id
  }
  on(event: 'edit' | 'add' | 'remove' | 'panel', cb: (ceil: udsCeil) => void) {
    this.events.on(event, cb)
  }
  changeName(name: string) {
    this.data.name = name
    this.rect.attr('label/text', name)
  }
  changeNameBottom(name: string) {
    this.rect.attr('labelBottom/text', name)
  }
  setEnable(enable: boolean) {
    this.enable = enable
    if (enable) {
      this.rect.attr('body/opacity', 1)
    } else {
      this.rect.attr('body/opacity', 0.2)
    }
  }
  destroy() {
    this.rect.remove()
    this.events.removeAllListeners()
  }
}

export class udsHardware extends udsCeil {
  vendor = ''
  constructor(
    paper: joint.dia.Paper,
    graph: joint.dia.Graph,
    id: string,
    device: UdsDevice,
    x = 100,
    y = 100
  ) {
    let name = 'Device'
    if (device.type == 'can' && device.canDevice) {
      name = device.canDevice.name
    } else if (device.type == 'eth' && device.ethDevice) {
      name = device.ethDevice.name
    } else if (device.type == 'lin' && device.linDevice) {
      name = device.linDevice.name
    }
    super(
      paper,
      graph,
      {
        name: name,
        type: 'device',
        id: id
      },
      x,
      y,
      {
        panel: false,
        edit: true,
        remove: false,
        lockX: true,
        lockY: false
      }
    )
  }
}
export class IG extends udsCeil {
  vendor = ''
  constructor(
    paper: joint.dia.Paper,
    graph: joint.dia.Graph,
    id: string,
    ig: Inter,
    x: number,
    y: number
  ) {
    super(
      paper,
      graph,
      {
        name: ig.name,
        type: 'interactive',
        id: id
      },
      x,
      y,
      {
        panel: false,
        edit: true,
        remove: true,
        lockX: false,
        lockY: true
      }
    )
  }
}

export class Node extends udsCeil {
  vendor = ''
  constructor(
    paper: joint.dia.Paper,
    graph: joint.dia.Graph,
    id: string,
    private ig: NodeItem,
    x: number,
    y: number
  ) {
    super(
      paper,
      graph,
      {
        name: ig.name,
        type: 'node',
        id: id
      },
      x,
      y,
      {
        panel: true,
        edit: true,
        remove: true,
        lockX: false,
        lockY: true
      }
    )
    const t = this.getNodeBottomName()
    this.changeNameBottom(t)

    // Add test icon if isTest is true
    if (this.ig.isTest) {
      this.addTestIcon()
    }
  }

  addTestIcon() {
    // Extract path data from SVG string
    const svgContent = testConfig.body
    const pathMatch = svgContent.match(/d="([^"]*)"/)
    const pathData = pathMatch ? pathMatch[1] : 'M0,0'

    // Add SVG test icon to the bottom-right corner
    this.rect.attr('testIcon', {
      d: pathData,
      fill: '#00C853',
      stroke: '#FFFFFF',
      'stroke-width': 1,
      transform: 'translate(125, 75) scale(0.8)',
      'pointer-events': 'none'
    })
  }
  getNodeBottomName() {
    this.rect.attr('labelBottom/text', '')
    if (this.ig.workNode) {
      const txt = `${this.ig.workNode}`
      return txt
    }

    return ''
  }
}

export interface udsVEcu {
  name: string
  type: string
  joined: string[]
}

export interface udsLoger {
  name: string
  toConsole: boolean
  toFile: boolean
  filePath?: string
  joined: string[]
}
let deviceYOffset = 0
let nodeXOffset = -200
export class UDSView {
  graph: joint.dia.Graph
  paper?: joint.dia.Paper
  ceilMap: Map<string, udsCeil> = new Map()
  private isDark = useDark()

  constructor(
    graph: joint.dia.Graph,
    private layout: Layout
  ) {
    this.graph = graph
    const t: any = this.graph
  }
  setPaper(paper: joint.dia.Paper) {
    this.paper = paper
  }
  clear() {
    deviceYOffset = 0
    nodeXOffset = -200
    this.graph.clear()
    this.ceilMap.clear()
  }
  graphInit(obj: any) {
    if (obj) {
      this.graph.fromJSON(obj)
    } else {
      this.graph.clear()
    }
  }
  changeName(key: string, name: string) {
    const item = this.ceilMap.get(key)
    if (item) {
      item.changeName(name)
    }
  }
  saveGraph() {
    return this.graph.toJSON()
  }
  removeElement(id: string) {
    const item = this.ceilMap.get(id)
    if (item) {
      this.graph.removeCells([item.rect])
    }
  }

  addDevice(id: string, data: UdsDevice) {
    const e = this.ceilMap.get(id)
    if (!e) {
      const element = new udsHardware(this.paper!, this.graph, id, data, 0, deviceYOffset)
      deviceYOffset += 200
      this.ceilMap.set(id, element)
      element.on('edit', (ceil) => {
        this.layout.addWin('hardware', 'hardware', {
          params: {
            deviceId: ceil.getId()
          }
        })
      })
      return element
    } else {
      return e
    }
  }
  addIg(id: string, data: Inter) {
    /* check name exist*/
    const e = this.ceilMap.get(id)
    if (e) {
      return e
    }
    const element = new IG(this.paper!, this.graph, id, data, nodeXOffset, -200)
    nodeXOffset -= 250
    element.on('remove', (ceil) => {
      const dataBase = useDataStore()
      delete dataBase.ia[ceil.getId()]
      ceil.events.removeAllListeners()
      this.graph.removeCells([ceil.rect])
      this.layout.removeWin(ceil.getId())
    })
    element.on('edit', (ceil) => {
      const dataBase = useDataStore()
      const id = ceil.getId()
      const item = dataBase.ia[id]
      if (item.type == 'can') {
        this.layout.addWin('cani', `${id}_ia`, {
          name: item.name,
          params: {
            'edit-index': id
          }
        })
      } else if (item.type == 'lin') {
        this.layout.addWin('lini', `${id}_ia`, {
          name: item.name,
          params: {
            'edit-index': id
          }
        })
      }
    })
    this.ceilMap.set(id, element)

    return element
  }
  addNode(id: string, data: NodeItem) {
    /* check name exist*/
    const e = this.ceilMap.get(id)
    if (e) {
      return e
    }
    const element = new Node(this.paper!, this.graph, id, data, nodeXOffset, -200)
    nodeXOffset -= 250
    element.on('remove', (ceil) => {
      const dataBase = useDataStore()
      const project = useProjectStore()
      window.electron.ipcRenderer.invoke(
        'ipc-delete-node',
        project.projectInfo.path,
        project.projectInfo.name,
        cloneDeep(dataBase.nodes[ceil.getId()])
      )
      delete dataBase.nodes[ceil.getId()]
      ceil.events.removeAllListeners()
      this.graph.removeCells([ceil.rect])
      this.layout.removeWin(ceil.getId())
    })
    element.on('edit', (ceil) => {
      const dataBase = useDataStore()
      const id = ceil.getId()
      const item = dataBase.nodes[id]

      ElMessageBox({
        buttonSize: 'small',
        showConfirmButton: false,
        title: `Edit Node ${item.name}`,
        showClose: false,
        customStyle: {
          width: '600px',
          maxWidth: 'none'
        },
        message: () =>
          h(nodeConfig, {
            editIndex: id,
            ceil: ceil
          })
      }).catch(null)
    })
    element.on('panel', (ceil) => {
      const dataBase = useDataStore()
      const item = dataBase.nodes[id]
      const workNode = item.workNode
      if (workNode) {
        const dbName = workNode.split(':')[0]

        for (const ld of Object.values(dataBase.database.lin)) {
          if (ld.name == dbName) {
            this.layout.addWin('linPanel', id, {
              name: item.name,
              params: {
                editIndex: id
              }
            })
            return
          }
        }
      } else {
        ElMessageBox.alert('Please select a work node')
      }
    })
    this.ceilMap.set(id, element)

    return element
  }
  addLink(from: string, to: string) {
    if (this.getLink(from, to)) {
      return
    }
    const link = new joint.shapes.standard.Link()
    link.source({
      id: from,
      anchor: {
        name: 'bottom'
      }
    })
    link.target({
      id: to,
      anchor: {
        name: 'left'
      }
    })
    link.router('rightAngle')
    // Add styling for better visibility based on theme
    const linkColor = this.isDark.value ? '#FFFFFF' : '#000000'
    link.attr({
      line: {
        stroke: linkColor,
        strokeWidth: 2,
        targetMarker: {
          type: 'path',
          d: 'M 10 -5 0 0 10 5 Z',
          fill: linkColor
        }
      }
    })
    this.graph.addCell(link)
  }
  getLink(from: string, to: string) {
    const links = this.graph.getLinks()
    for (const link of links) {
      if (link.source().id == from && link.target().id == to) {
        return link
      }
    }
    return undefined
  }
  removeLink(from: string, to: string) {
    const link = this.getLink(from, to)
    if (link) {
      this.graph.removeCells([link])
    }
  }
}
