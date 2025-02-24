import { IconifyIcon } from '@iconify/vue'
import hardwareOutline from '@iconify/icons-material-symbols/hardware-outline'
import networkNode from '@iconify/icons-material-symbols/network-node'
import textFields from '@iconify/icons-material-symbols/text-fields'
import PhAddressBook from '@iconify/icons-ph/address-book'
import database from '@iconify/icons-material-symbols/database'
import { Component, Ref, defineAsyncComponent, nextTick, ref } from 'vue'
import { isEqual, cloneDeep } from 'lodash'
import { ElMessageBox } from 'element-plus'
import EventEmitter from 'events'
import deviceIcon from '@iconify/icons-material-symbols/important-devices-outline'
import logIcon from '@iconify/icons-material-symbols/text-ad-outline-rounded'
import scriptIcon from '@iconify/icons-material-symbols/code-blocks-outline'
import { useProjectStore, State as ProjectState } from '@r/stores/project'
import stepIcon from '@iconify/icons-material-symbols/step-rounded'
import msgIcon from '@iconify/icons-material-symbols/terminal'
import interIcon from '@iconify/icons-material-symbols/interactive-space-outline'
import panelIcon from '@iconify/icons-material-symbols/pan-tool'
import log from 'electron-log'
import graphIcon from '@iconify/icons-ep/histogram'
import testIcon from '@iconify/icons-grommet-icons/test'

type WinsType = ProjectState['project']['wins']
type WinValueType = WinsType[keyof WinsType]
export interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  key: string
  icon?: IconifyIcon
  params?: Record<string, string>
  component: Component
  minW?: number
  minH?: number
  label: string
  layoutType?: 'bottom' | 'top' | 'left' | 'right'
}
const layoutMap: Record<string, LayoutItem> = {
  test: {
    i: 'Test',
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    label: 'Test',
    key: 'test',
    component: defineAsyncComponent(() => import('./test.vue')),
    icon: testIcon
  },
  graph: {
    i: 'Graph',
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    label: 'Graph',
    key: 'graph',
    component: defineAsyncComponent(() => import('./graph.vue')),
    icon: graphIcon
  },
  network: {
    i: 'Network',
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    label: 'Network',
    key: 'network',
    component: defineAsyncComponent(() => import('./components/network.vue')),
    icon: networkNode
  },
  hardware: {
    i: 'Hardware',
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    label: 'Devices',
    key: 'hardware',
    component: defineAsyncComponent(() => import('./components/hardware.vue')),
    icon: deviceIcon
  },
  tester: {
    i: 'Tester',
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    label: 'UDS Tester',
    key: 'tester',
    component: defineAsyncComponent(() => import('./components/tester.vue')),
    icon: textFields
  },
  // can: {
  //   i: 'CanConfig',
  //   x: 0,
  //   y: 0,
  //   w: 600,
  //   h: 400,
  //   key: 'can',
  //   component: defineAsyncComponent(() => import('./components/config/node/canNode.vue'))
  // },
  message: {
    i: 'Message',
    x: 0,
    y: 0,
    w: 600,
    h: 300,
    layoutType: 'bottom',
    label: 'Message',
    key: 'message',
    component: defineAsyncComponent(() => import('./log.vue')),
    icon: msgIcon
  },
  testerService: {
    i: 'TesterService',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'Service',
    key: 'testerService',
    component: defineAsyncComponent(() => import('./components/config/tester/service.vue')),
    icon: database
  },
  testerSequence: {
    i: 'TesterSequence',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'Sequence',
    key: 'testerSequence',
    component: defineAsyncComponent(() => import('./components/config/tester/sequence.vue')),
    icon: stepIcon
  },
  trace: {
    i: 'Trace',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'Trace',
    key: 'trace',
    component: defineAsyncComponent(() => import('./components/trace.vue')),
    icon: logIcon
  },
  cani: {
    i: 'IA',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'IA',
    key: 'IA',
    component: defineAsyncComponent(() => import('./cani.vue')),
    icon: interIcon
  },
  lini: {
    i: 'IA',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'IA',
    key: 'IA',
    component: defineAsyncComponent(() => import('./lini.vue')),
    icon: interIcon
  },
  linPanel: {
    i: 'Panel',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'Panel',
    key: 'Panel',
    component: defineAsyncComponent(() => import('./linPanel.vue')),
    icon: panelIcon
  },
  ldf: {
    i: 'LDF',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'LDF',
    key: 'LDF',
    component: defineAsyncComponent(() => import('../../database/ldf/index.vue')),
    icon: database
  },
  dbc: {
    i: 'DBC',
    x: 0,
    y: 0,
    w: 700,
    h: 400,
    label: 'DBC',
    key: 'DBC',
    component: defineAsyncComponent(() => import('../../database/dbc/index.vue')),
    icon: database
  }
  // script: {
  //   i: 'Script',
  //   x: 0,
  //   y: 0,
  //   w: 700,
  //   h: 400,
  //   label: 'Script',
  //   key: 'script',
  //   component: defineAsyncComponent(() => import('./components/editor.vue')),
  //   icon: scriptIcon
  // }
}

export class Layout {
  parentElement: HTMLElement | null = null
  grid = 20
  zIndex = 1
  width = 0
  height = 0
  maxWinId = ref<undefined | string>()
  validLayout: Record<string, LayoutItem> = {}
  winRef: Record<string, any> = {}
  modify = ref<Record<string, boolean>>({})
  private winEl: Record<string, any> = {}
  event = new EventEmitter()
  activeWin = ref('')
  left1 = ref(false)
  left2 = ref(false)
  left = ref(false)
  right = ref(false)
  right1 = ref(false)
  right2 = ref(false)
  leftThret = 80
  data: ProjectState
  constructor(grid?: number) {
    this.validLayout = layoutMap
    if (grid) {
      this.grid = grid
    }
    this.data = useProjectStore()
  }
  setWinSize(h: number, w: number) {
    this.width = w
    this.height = h

    for (const l of Object.keys(this.data.project.wins)) {
      if (this.winEl[l]) {
        nextTick(() => {
          const offset = this.winEl[l].offset()
          const topGap = offset.top - this.data.project.wins[l].pos.y
          if (this.data.project.wins[l].layoutType != 'bottom') {
            this.winEl[l].draggable('option', 'containment', [
              200 - this.data.project.wins[l].pos.w,
              topGap,
              this.width - 100,
              topGap + this.height - 50
            ])
          }
        })
      }
    }
  }
  async restoreWin() {
    if (Object.values(this.data.project.wins).length == 0) {
      this.data.project.wins['message'] = {
        pos: {
          x: 383,
          y: 219,
          w: 1280,
          h: 200
        },
        options: {
          params: {}
        },
        title: 'message',
        label: 'Message',
        id: 'message',
        layoutType: 'bottom'
      }
    }
    for (const l of Object.values(this.data.project.wins)) {
      await this.addWin(l.title, l.id, { name: l.options.name, params: l.options.params }, false)
    }
    for (const l of Object.values(this.data.project.wins)) {
      if (l.isMax) {
        this.maxWinId.value = l.id
      }
    }
    this.winSizeCheck(this.height, this.width)
  }
  setupParentElement(parentSelector: string) {
    this.parentElement = document.querySelector(parentSelector)
  }
  registerLayout(title: string, layout: LayoutItem) {
    this.validLayout[title] = layout
  }
  clickWin(id: string) {
    const e = document.getElementById(`win${id}`)
    if (e) {
      const event = new MouseEvent('mousedown')
      e.dispatchEvent(event)
    }
  }

  on(event: string, cb: (activeLayout: WinValueType) => void) {
    this.event.on(event, cb)
  }
  off(event: string, cb: (activeLayout: WinValueType) => void) {
    this.event.off(event, cb)
  }
  offAll(event: string) {
    this.event.removeAllListeners(event)
  }
  getLayoutType(id: string) {
    return this.validLayout[this.data.project.wins[id].title].layoutType
  }
  layoutInit(
    id: string,
    dragSelect: string,
    resizeSelect: string,
    enable: boolean,
    layoutType?: 'bottom' | 'top' | 'left' | 'right'
  ) {
    const target = document.querySelector(resizeSelect) as HTMLElement
    target.style.position = 'absolute'
    target.style.zIndex = `${this.zIndex++}`
    //store id into element data
    target.dataset.id = id
    if (this.winEl[id] == undefined) {
      this.winEl[id] = window.jQuery(target)

      target.addEventListener('mousedown', () => {
        this.activeWin.value = id
        target.style.zIndex = `${this.zIndex++}`
      })
    }
    const data = this.data.project.wins[id]
    const drag = document.querySelector(dragSelect) as HTMLElement
    if (target && this.parentElement && data) {
      let v = 'e, s'

      if (layoutType == 'bottom') {
        v = 'n'
      }

      this.winEl[id].resizable({
        containment: layoutType == 'bottom' ? false : this.parentElement,
        handles: v,
        // grid: [this.grid, this.grid],
        animate: false,
        disabled: !enable,
        aspectRatio: false,
        minWidth: this.validLayout[data.title].minW || 200,
        minHeight: this.validLayout[data.title].minH || 100,
        resize: (e, ui) => {
          data.pos.w = ui.size.width
          data.pos.h = ui.size.height
          if (layoutType == 'bottom') {
            //remove element height and top style
            this.winEl[id].css('height', '')
            this.winEl[id].css('top', '')
          }
        }
      })
      if (drag) {
        //get this.winEl[id] offset form client
        const offset = this.winEl[id].offset()
        const topGap = offset.top - data.pos.y

        this.winEl[id].draggable({
          snapTolerance: 10,
          handle: drag,
          cancel: '.uds-no-drag',
          scroll: false,
          disabled: !enable,

          cursor: 'move',
          containment: [200 - data.pos.w, topGap, this.width - 100, topGap + this.height - 50],
          snap: '.uds-window',
          snapMode: 'outer',
          drag: (e, ui) => {
            if (data.isMax) {
              e.preventDefault()
            }
          },
          stop: (e, ui) => {
            data.pos.x = ui.position.left
            data.pos.y = ui.position.top
          }
        })

        // interact(drag).draggable({
        //   // enable inertial throwing
        //   inertia: true,
        //   enabled: enable,
        //   ignoreFrom: '.uds-no-drag',
        //   // keep the element within the area of it's parent
        //   modifiers: [
        //     interact.modifiers.restrictRect({
        //       restriction: this.parentElement,
        //       endOnly: false,
        //       elementRect: { top: 0, left: 0.7, bottom: 1, right: 0.1 }
        //     }),
        //     interact.modifiers.snap({
        //       targets: [
        //         // 定义吸附点
        //         interact.snappers.grid({ x: this.grid, y: this.grid })
        //       ],
        //       range: Infinity // 吸附范围
        //     })
        //   ],
        //   // // enable autoScroll
        //   // autoScroll: true,

        //   listeners: {
        //     // call this function on every dragmove event
        //     move: (event) => {
        //       if (data.isMax) {
        //         return
        //       }

        //       if ((event.pageX < this.leftThret) || ((this.left1.value || this.left2.value || this.left.value) && event.pageX <= this.leftThret + 20)) {
        //         if (event.pageY < this.height / 3) {
        //           this.left.value = false
        //           this.left1.value = true
        //           this.left2.value = false
        //           this.right.value = false
        //           this.right1.value = false
        //           this.right2.value = false
        //         } else if (event.pageY > this.height / 3 * 2) {
        //           this.left.value = false
        //           this.left1.value = false
        //           this.left2.value = true
        //           this.right.value = false
        //           this.right1.value = false
        //           this.right2.value = false
        //         } else {
        //           this.left.value = true
        //           this.left1.value = false
        //           this.left2.value = false
        //           this.right.value = false
        //           this.right1.value = false
        //           this.right2.value = false
        //         }
        //       } else if ((this.left1.value || this.left2.value || this.left.value) && event.pageX > this.leftThret + 20) {
        //         this.left.value = false
        //         this.left1.value = false
        //         this.left2.value = false
        //         this.right.value = false
        //         this.right1.value = false
        //         this.right2.value = false
        //       }

        //       if ((event.pageX > (this.width - this.leftThret)) || ((this.right.value || this.right1.value || this.right2.value) && event.pageX >= (this.width - this.leftThret - 20))) {
        //         if (event.pageY < this.height / 3) {
        //           this.left.value = false
        //           this.left1.value = false
        //           this.left2.value = false
        //           this.right.value = false
        //           this.right1.value = true
        //           this.right2.value = false
        //         } else if (event.pageY > this.height / 3 * 2) {
        //           this.left.value = false
        //           this.left1.value = false
        //           this.left2.value = false
        //           this.right.value = false
        //           this.right1.value = false
        //           this.right2.value = true
        //         } else {
        //           this.left.value = false
        //           this.left1.value = false
        //           this.left2.value = false
        //           this.right.value = true
        //           this.right1.value = false
        //           this.right2.value = false
        //         }
        //       } else if ((this.right.value || this.right1.value || this.right2.value) && event.pageX < (this.width - this.leftThret - 20)) {
        //         this.left.value = false
        //         this.left1.value = false
        //         this.left2.value = false
        //         this.right.value = false
        //         this.right1.value = false
        //         this.right2.value = false
        //       }

        //       // keep the dragged position in the data-x/data-y attributes
        //       let x = data.pos.x + event.dx

        //       let y = data.pos.y + event.dy
        //       const xL = Math.floor(x / this.grid) * this.grid
        //       const xH = Math.ceil(x / this.grid) * this.grid

        //       const yL = Math.floor(y / this.grid) * this.grid
        //       const yH = Math.ceil(y / this.grid) * this.grid
        //       if (x - xL < xH - x) {
        //         x = xL
        //       } else {
        //         x = xH
        //       }
        //       if (y - yL < yH - y) {
        //         y = yL
        //       } else {
        //         y = yH
        //       }
        //       data.pos.x = x
        //       data.pos.y = y

        //     },

        //     // call this function on every dragend event
        //     end: () => {
        //       if (this.left1.value) {
        //         data.pos.x = 0
        //         data.pos.y = 0
        //         data.pos.w = this.width / 2
        //         data.pos.h = this.height / 2
        //       }
        //       else if (this.left2.value) {
        //         data.pos.x = 0
        //         data.pos.y = this.height / 2
        //         data.pos.w = this.width / 2
        //         data.pos.h = this.height / 2
        //       }
        //       else if (this.left.value) {
        //         data.pos.x = 0
        //         data.pos.y = 0
        //         data.pos.w = this.width / 2
        //         data.pos.h = this.height
        //       }
        //       else if (this.right1.value) {
        //         data.pos.x = this.width / 2
        //         data.pos.y = 0
        //         data.pos.w = this.width / 2
        //         data.pos.h = this.height / 2
        //       }
        //       else if (this.right2.value) {
        //         data.pos.x = this.width / 2
        //         data.pos.y = this.height / 2
        //         data.pos.w = this.width / 2
        //         data.pos.h = this.height / 2
        //       }
        //       else if (this.right.value) {
        //         data.pos.x = this.width / 2
        //         data.pos.y = 0
        //         data.pos.w = this.width / 2
        //         data.pos.h = this.height
        //       }
        //       this.left1.value = false
        //       this.left2.value = false
        //       this.left.value = false
        //       this.right1.value = false
        //       this.right2.value = false
        //       this.right.value = false
        //       this.data.project.wins[id].pos
        //     }
        //   }
        // })
      }
    }
  }
  maxWin(key: string) {
    const item = this.data.project.wins[key]
    if (item == undefined) {
      return
    }
    const layoutType = this.validLayout[item.title].layoutType
    if (item.isMax) {
      item.isMax = false
      this.maxWinId.value = undefined
      item.pos = cloneDeep(item.backupPos ?? item.pos)
      this.layoutInit(key, `#win${key} .uds-draggable`, `#win${key}`, true, layoutType)
      this.event.emit(`max:${key}`, item, false)
    } else {
      this.maxWinId.value = key
      for (const layoutItem of Object.values(this.data.project.wins)) {
        layoutItem.hide = true
      }
      item.backupPos = cloneDeep(item.pos)
      item.pos = { x: 0, y: -28, w: this.width, h: this.height + 30 }
      item.hide = false
      item.isMax = true
      this.layoutInit(key, `#win${key} .uds-draggable`, `#win${key}`, false, layoutType)
      this.event.emit(`max:${key}`, item, false)
    }
  }
  changeWinName(id: string, name: string) {
    const item = this.data.project.wins[id]
    if (item) {
      item.options.name = name
    }
  }
  winSizeCheck(maxH: number, maxW: number) {
    for (const item of Object.values(this.data.project.wins)) {
      if (item.isMax) {
        item.pos.w = maxW
        item.pos.h = maxH + 28
        if (item.backupPos) {
          if (item.backupPos.x > maxW - 50) {
            item.backupPos.x = maxW - 50
          }
          if (item.backupPos.y > maxH - 50) {
            item.backupPos.y = maxH - 50
          }
        }
      } else {
        if (item.pos.x > maxW - 50) {
          item.pos.x = maxW - 50
        }
        if (item.pos.y > maxH - 50) {
          item.pos.y = maxH - 50
        }
        if (item.pos.y < 0 && !item.isMax) {
          item.pos.y = 0
        }
      }
    }
  }
  async addWin(
    title: string,
    id: string,
    options?: {
      name?: string
      params?: Record<string, any>
    },
    switchHide = true
  ) {
    if (this.validLayout[title] == undefined) {
      log.error('layoutMap not found key:', title)
      return
    }
    if (this.maxWinId.value && this.maxWinId.value != id) {
      this.maxWin(this.maxWinId.value)
    }
    const layoutType = this.validLayout[title].layoutType
    const item = this.data.project.wins[id]
    if (item) {
      /* the same win is already exist*/

      /* update sp*/
      if (options?.name != undefined) {
        if (item.options.name != options.name) {
          item.options.name = options.name
          // this.data.projectDirty = true
        }
      }
      if (options?.params) {
        if (!isEqual(item.options.params, options.params)) {
          item.options.params = options.params
          // this.data.projectDirty = true
        }
      }
      if (item.hide && switchHide) {
        item.hide = false
      }
      if (item.pos.y < 0 && !item.isMax) {
        item.pos.y = 0
      }

      this.data.project.wins[id].layoutType = layoutType
      await nextTick()
      this.layoutInit(id, `#win${id} .uds-draggable`, `#win${id}`, true, layoutType)
      this.clickWin(id)
      this.event.emit('add', this.data.project.wins[id])
    } else {
      const t1 = this.validLayout[title]

      let x = 0,
        y = 0

      x = this.width / 2 - t1.w / 2
      y = this.height / 2 - t1.h / 2
      if (this.activeWin.value && this.data.project.wins[this.activeWin.value]) {
        const activePos = this.data.project.wins[this.activeWin.value].pos

        if (
          activePos &&
          activePos.x > 100 &&
          activePos.y > 100 &&
          activePos.x < this.width - 100 &&
          activePos.y < this.height - 100
        ) {
          x = activePos.x + 20
          y = activePos.y + 20
        }
      }

      if (x < 0) {
        x = this.width / 2
      }
      if (y < 0) {
        y = this.height / 2
      }
      this.data.project.wins[id] = {
        pos: this.data.project.wins[id]?.pos ?? { x: x, y: y, w: t1.w, h: t1.h },
        title: title,
        label: t1.label,
        id: id,
        options: {
          params: this.data.project.wins[id]?.options.params,
          name: options?.name
        },
        layoutType: layoutType
      }
      if (options?.params) {
        this.data.project.wins[id].options.params = options.params
      }

      await nextTick()
      this.layoutInit(id, `#win${id} .uds-draggable`, `#win${id}`, true, layoutType)
      this.event.emit('add', this.data.project.wins[id])
      // this.data.projectDirty = true
      this.clickWin(id)
    }
    this.activeWin.value = id
  }
  setWinModified(key: string, modified: boolean) {
    this.modify.value[key] = modified
  }
  removeWin(key: string, force?: boolean) {
    const item = this.data.project.wins[key]
    if (item) {
      const done = () => {
        this.modify.value[key] = false
        this.event.emit('close', item)
        delete this.winRef[key]
        delete this.winEl[key]
        delete this.data.project.wins[key]
        // this.data.projectDirty = true
        if (key == this.maxWinId.value) {
          this.maxWinId.value = undefined
        }
      }

      if (this.modify.value[key] && !force) {
        ElMessageBox.confirm(
          `Your changes will not be saved${item.options.name ? ` in ${item.options.name}` : ``}, continue?`,
          'Warning',
          {
            confirmButtonText: 'OK',
            cancelButtonText: 'Cancel',
            type: 'warning',
            buttonSize: 'small',
            appendTo: `#win${key}`
          }
        )
          .then(() => {
            done()
          })
          .catch(() => {
            null
          })
        return
      } else {
        done()
      }
    }
  }
  showWin(id: string) {
    if (this.maxWinId.value) {
      this.maxWin(this.maxWinId.value)
    }
    this.activeWin.value = id
    const q = this.data.project.wins[id]
    if (q) {
      this.clickWin(id)
      q.hide = false
      if (this.winEl[id]) {
        nextTick(() => {
          const offset = this.winEl[id].offset()
          const topGap = offset.top - this.data.project.wins[id].pos.y

          if (this.data.project.wins[id].layoutType != 'bottom') {
            this.winEl[id].draggable('option', 'containment', [
              200 - this.data.project.wins[id].pos.w,
              topGap,
              this.width - 100,
              topGap + this.height - 50
            ])
          }
        })
      }
      this.event.emit('show', q)
    }
  }
  minWin(key: string) {
    const item = this.data.project.wins[key]
    if (item == undefined) {
      return
    }
    if (this.maxWinId.value == key) {
      this.maxWin(this.maxWinId.value)
    }
    //fix style with Jquery
    // this.winEl[key].style.zIndex = '-1'
    this.winEl[key].css('z-index', '-1')
    item.hide = true
    this.event.emit('min', item)
  }
}
