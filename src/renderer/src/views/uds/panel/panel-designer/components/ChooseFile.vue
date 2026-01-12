<template>
  <el-input
    class="_fd-language-input"
    :placeholder="placeholder"
    :disabled="disabled"
    :modelValue="modelValue"
    @update:modelValue="onInput"
    @blur="$emit('blur')"
    :size="size || 'small'"
  >
    <template #append>
      <i class="fc-icon icon-folder" @click="chooseFile"></i>
    </template>
  </el-input>
</template>

<script>
import { defineComponent } from 'vue'
import { useProjectStore } from '@r/stores/project'
export default defineComponent({
  name: 'ChooseFile',
  inject: ['designer'],
  emits: ['update:modelValue', 'blur', 'change'],
  props: {
    size: String,
    placeholder: String,
    modelValue: String,
    disabled: Boolean
  },
  computed: {
    t() {
      return this.designer.setupState.t
    }
  },
  methods: {
    async chooseFile() {
      const project = useProjectStore()
      const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
        defaultPath: project.projectInfo.path,
        title: 'Choose File',
        properties: ['openFile'],
        filters: [
          { name: 'images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      let file = r.filePaths[0]
      if (file) {
        if (project.projectInfo.path) file = window.path.relative(project.projectInfo.path, file)

        this.onInput(file)
      }
    },
    onInput(val) {
      this.$emit('update:modelValue', val)
      this.$emit('change', val)
    }
  },
  mounted() {}
})
</script>
