<template>
  <div class="_fd-grid-view" v-if="formCreateInject">
    <GridLayout
      v-model:layout="rule.layout"
      :col-num="rule.row"
      :row-height="rule.rowHeight"
      :is-draggable="true"
      :is-resizable="true"
      :vertical-compact="true"
      :use-css-transforms="true"
      :margin="[rule.margin, rule.margin]"
      :auto-size="true"
    >
      <GridItem
        v-for="(item, index) in rule.layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        :style="[(style && style[item.i]) || {}]"
        :class="(rule.class && rule.class[item.i]) || ''"
        :static="activeId === item.i"
      >
        <div class="_fd-grid-view-cell">
          <button
            v-if="deleteId === item.i"
            class="grid-item-delete-btn"
            @click.stop="deleteGridItem(item.i)"
          >
            ×
          </button>
          <DragTool :drag-btn="false" :handle-btn="false" @active="active(item.i)" :unique="item.i">
            <DragBox
              v-bind="dragProp"
              @add="(e) => dragAdd(e, item.i)"
              :ref="'drag' + item.i"
              @end="(e) => dragEnd(e, item.i)"
              @start="(e) => dragStart(e)"
              @click="activex"
              @unchoose="(e) => dragUnchoose(e)"
              :list="getSlotChildren([item.i])"
            >
              <slot :name="item.i"></slot>
            </DragBox>
          </DragTool>
        </div>
      </GridItem>
    </GridLayout>
  </div>
</template>

<script>
/* eslint-disable vue/no-mutating-props */
import DragTool from '../DragTool.vue'
import DragBox from '../DragBox.vue'
import { defineComponent } from 'vue'
import uniqueId from '@form-create/utils/lib/unique'
import { GridLayout, GridItem } from 'vue-grid-layout-v3'
export default defineComponent({
  name: 'GridView',
  props: {
    formCreateInject: Object,

    rule: {
      type: Object,
      default: () => ({ layout: [], row: 24, rowHeight: 80, margin: 10 })
    }
  },
  inject: {
    designer: {
      default: () => ({
        setupState: {
          t: () => ''
        }
      })
    }
  },
  components: {
    DragTool,
    DragBox,
    GridLayout,
    GridItem
  },

  watch: {
    rule: {
      handler() {
        this.initRule()
        this.style = this.rule.style
        this.loadRule()
      },
      immediate: true
    }
  },
  data() {
    return {
      style: {},
      activeId: null,
      deleteId: null,
      dragProp: {
        rule: {
          props: {
            tag: 'el-col',
            group: 'default',
            ghostClass: 'ghost',
            animation: 150,
            handle: '._fd-drag-btn',
            emptyInsertThreshold: 0,
            direction: 'vertical',
            itemKey: 'type'
          }
        },
        tag: 'tableCell'
      }
    }
  },
  computed: {
    t() {
      return this.designer.setupState.t
    }
  },
  methods: {
    getSlotChildren(slots) {
      const children = []
      this.formCreateInject.children.forEach((child) => {
        if (slots.indexOf(child.slot) > -1) {
          children.push(child)
        }
      })
      return children
    },
    dragAdd(e, key) {
      this.activeId = key
      // console.log('dragAdd');
      const designer = this.designer.setupState
      const children = this.formCreateInject.children
      const slot = key
      const rule = e.item._underlying_vm_
      const flag = designer.addRule && designer.addRule.children === designer.moveRule
      if (flag) {
        designer.moveRule.splice(designer.moveRule.indexOf(rule), 1)
      }
      let idx = 0
      const refKey = 'drag' + key
      if (this.$refs[refKey][0].list.length) {
        let beforeRule = this.$refs[refKey][0].list[!e.newIndex ? 0 : e.newIndex - 1]
        idx = children.indexOf(beforeRule) + (e.newIndex ? 1 : 0)
      } else if (children.length) {
        const dragSlotKeys = Object.keys(this.$refs)
        for (let i = dragSlotKeys.indexOf(refKey) - 1; i >= 0; i--) {
          if (!this.$refs[dragSlotKeys[i]] || !this.$refs[dragSlotKeys[i]].length) {
            continue
          }
          const list = this.$refs[dragSlotKeys[i]][0].list || []
          if (list.length) {
            idx = children.indexOf(list[list.length - 1]) + 1
            break
          }
        }
      }
      e.newIndex = idx
      if (flag) {
        rule.slot = slot
        children.splice(e.newIndex, 0, rule)
        designer.added = true
        designer.handleSortAfter({ rule })
      } else {
        designer.dragAdd(children, e, key)
      }
    },
    dragEnd(e, key) {
      // console.log('dragEnd');
      const designer = this.designer.setupState
      const children = this.formCreateInject.children
      const rule = e.item._underlying_vm_
      const oldIdx = children.indexOf(rule)
      e.newIndex = oldIdx + (e.newIndex - e.oldIndex)
      e.oldIndex = oldIdx
      designer.dragEnd(this.formCreateInject.children, e, key)
    },
    dragStart() {
      // console.log('dragStart');
      this.designer.setupState.dragStart(this.formCreateInject.children)
    },
    dragUnchoose(e) {
      // console.log('dragUnchoose');
      this.designer.setupState.dragUnchoose(this.formCreateInject.children, e)
    },
    initRule() {
      const rule = this.rule
      if (!rule.style) {
        rule.style = {}
      }
      if (!rule.class) {
        rule.class = {}
      }
      if (!rule.layout) {
        rule.layout = []
      }
      if (!rule.row) {
        rule.row = 1
      }
      if (!rule.col) {
        rule.col = 1
      }
    },
    activex(key) {
      this.deleteId = null
      this.activeId = key.parentKey
    },
    active(key) {
      this.activeId = null
      this.deleteId = key
      // this.activeId=key
      this.designer.setupState.customActive({
        name: 'Grid',
        onPaste: (rule) => {
          rule.slot = key
          this.formCreateInject.children.push(rule)
        },
        style: {
          formData: {
            style: {
              sizeEnabled: false,
              ...this.rule.style[key]
            } || {
              sizeEnabled: false
            },
            class: this.rule.class[key] || ''
          },
          change: (field, value) => {
            this.rule[field][key] = value || {}
          }
        }
      })
    },
    deleteGridItem(key) {
      const children = this.formCreateInject.children
      let del = 0
      ;[...children].forEach((child, index) => {
        if (child.slot === key) {
          children.splice(index - del, 1)
          del++
        }
      })

      delete this.style[key]
      const layoutIndex = this.rule.layout.findIndex((item) => item.i === key)
      if (layoutIndex > -1) {
        this.rule.layout.splice(layoutIndex, 1)
      }
    },
    loadRule() {
      if (this.formCreateInject) {
        const rule = this.rule
        if (rule.layout.length == 0) {
          // 从rule.layout初始化布局

          // 否则创建默认布局
          for (let index = 0; index < 2; index++) {
            for (let idx = 0; idx < rule.row / 8; idx++) {
              rule.layout.push({
                i: uniqueId(),
                x: idx * 8,
                y: index,
                w: 8,
                h: 1
              })
            }
          }
        }

        this.formCreateInject.rule.props.rule = rule
      }
    }
  },
  beforeMount() {
    this.loadRule()
  },
  beforeUnmount() {}
})
</script>

<style scoped>
.vue-grid-layout {
  background-color: transparent;
  height: 100%;
}

._fd-grid-view-cell {
  height: 100%;
  width: 100%;
  background-color: transparent;
  position: relative;
}

.grid-item-delete-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  background: transparent;
  color: #666;
  border: none;
  border-radius: 0;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  z-index: 10;
  transition: color 0.2s;
  padding: 0;
}

.grid-item-delete-btn:hover {
  color: #f56c6c;
}

.vue-grid-item {
  margin-bottom: 10px;
  transition: all 200ms ease;
  box-sizing: border-box;
}

.vue-grid-item:not(.vue-grid-placeholder) {
  background: transparent;
  border: 1px solid #ebeef5;
}

.vue-grid-item.vue-grid-placeholder {
  background: #f0f9eb;
  opacity: 0.5;
}
</style>
