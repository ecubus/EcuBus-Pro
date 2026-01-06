<template>
  <fc-designer
    v-if="delayLoad"
    ref="designer"
    :config="config"
    :locale="locale"
    :height="h"
    @save="save"
    @copy="edit"
    @delete="edit"
    @drag="edit"
    @clear="edit"
    @change-device="edit"
  />
</template>
<script setup lang="ts">
// import fcDesigner from './panel-designer/index.js'
import En from './panel-designer/locale/en.js' // 导入英文语言包
import {
  ref,
  computed,
  toRef,
  provide,
  inject,
  onMounted,
  onUnmounted,
  onBeforeMount,
  nextTick
} from 'vue'
import { useDataStore } from '@r/stores/data'
import { useProjectStore } from '@r/stores/project'
import { ElMessage, ElMessageBox } from 'element-plus'
import { v4 } from 'uuid'
import { Layout } from '@r/views/uds/layout'
import uniqueId from '@form-create/utils/lib/unique'

const panels = useDataStore().panels

// 可以在此处获取设计器实例或进行其他操作
const designer = ref<any>()
const props = defineProps<{
  height: number
  editIndex: string
}>()

const delayLoad = ref(false)
const h = toRef(props, 'height')
const layout = inject('layout') as Layout
const locale = En
const config = computed(() => {
  const result: any = {
    // 配置项
    showDevice: false,
    showJsonPreview: false,
    showInputData: false,
    showSaveBtn: true,
    editIndex: props.editIndex,
    formOptions: {
      submitBtn: false
    },
    appendConfigData: ['signal', 'variable'],
    componentRule: {
      //给所有组件增加
      default: {
        prepend: true,
        // append: true, // 添加到底部
        rule(t) {
          // if (t.type == 'grid' || t.type == 'fcRow') {
          //   return []
          // }
          if (t.field) {
            return [
              {
                type: 'Signal',
                field: 'signal',
                title: 'Signal',
                warning: 'Please import a database before using this feature',
                props: {
                  onChange: (node) => {
                    if (t.type == 'select' || t.type == 'checkbox' || t.type == 'radio') {
                      if (node.yAxis.enums) {
                        //confirm use enum to replace options
                        ElMessageBox.confirm(
                          'Use signal value table as select options?',
                          'Confirm',
                          {
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'No',
                            type: 'warning',
                            appendTo: `#win${props.editIndex}`
                          }
                        ).then(() => {
                          t.options = node.yAxis.enums
                        })
                      }
                    }
                  }
                }
              },
              {
                type: 'Variable',
                field: 'variable',
                warning: 'When both signal and variable are set, only variable will take effect',
                title: 'Variable'
              }
            ]
          } else {
            return []
          }
        }
      },
      grid: {
        prepend: true,
        rule(t) {
          return [
            {
              type: 'elButton',
              field: 'button',
              title: 'Button',
              props: {
                icon: 'Plus',
                type: 'primary',
                plain: true,
                onClick: () => {
                  const newId = uniqueId()
                  t.props.rule.layout.push({
                    i: newId,
                    x: 0,
                    y: Math.max(...t.props.rule.layout.map((item) => item.y + item.h), 0),
                    w: 8,
                    h: 1
                  })
                }
              },

              warning: 'Add new grid item'
            }
          ]
        }
      }
    }
  }
  return result
})

provide('dialogId', `#win${props.editIndex}`)
provide('height', h)

const edit = () => {
  layout.setWinModified(props.editIndex, true)
}
let initId = props.editIndex
const save = (data) => {
  data.options = JSON.parse(data.options)
  data.rule = JSON.parse(data.rule)
  const name = data.options.formName
  if (name) {
    //check name exist in data,
    const existingPanel = Object.values(panels).find(
      (panel) => panel.id !== initId && panel.name === name
    )
    if (existingPanel) {
      ElMessage({
        message: 'Panel name already exists',
        plain: true,
        offset: 30,
        type: 'error',
        appendTo: `#win${props.editIndex}`
      })
      ;(designer.value as any).activeTab = 'form'
      return
    } else {
      if (initId && initId != 'panel') {
        panels[initId] = {
          name: name,
          id: initId,
          rule: data.rule,
          options: data.options
        }
      } else {
        initId = v4()
        panels[initId] = {
          name: name,
          id: initId,
          rule: data.rule,
          options: data.options
        }
      }
      layout.setWinModified(props.editIndex, false)
      layout.changeWinName(`p${props.editIndex}`, name)
      ElMessage({
        message: 'Save successful',
        plain: true,
        offset: 30,
        duration: 500,
        type: 'success',
        appendTo: `#win${props.editIndex}`
      })
    }
  } else {
    ElMessage({
      message: 'Panel name is required',
      plain: true,
      offset: 30,
      type: 'error',
      duration: 500,
      appendTo: `#win${props.editIndex}`
    })
    ;(designer.value as any).activeTab = 'form'
  }
}
onBeforeMount(() => {
  delayLoad.value = false
})
onMounted(() => {
  delayLoad.value = true
  nextTick(() => {
    const item = panels[props.editIndex]
    if (item && designer.value) {
      designer.value.setOptions(item.options)
      designer.value.setRule(item.rule)
    }
  })
})
onUnmounted(() => {
  delayLoad.value = false
})
</script>
