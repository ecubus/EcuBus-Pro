<template>
  <div class="_fd-struct">
    <el-badge type="warning" is-dot :hidden="!configured">
      <div @click="visible = true">
        <slot>
          <el-button class="_fd-plain-button" plain size="small">
            {{ title || t('variable.title') }}
          </el-button>
        </slot>
      </div>
    </el-badge>
    <el-dialog
      class="_fd-struct-con"
      :title="title || t('variable.title')"
      v-model="visible"
      destroy-on-close
      :close-on-click-modal="false"
      align-center
      :append-to="dialogId"
      width="800px"
    >
      <xignal
        :height="height - 200"
        @add-variable="handleAddVariable"
        :highlight-id="modelValue?.id"
      />
    </el-dialog>
  </div>
</template>

<script>
import { defineComponent, markRaw } from 'vue'
import is from '@form-create/utils/lib/type'
import xignal from '../../components/addVar.vue'

export default defineComponent({
  name: 'Variable',
  emits: ['update:modelValue', 'change'],
  props: {
    modelValue: [Object],
    title: String,
    defaultValue: {
      require: false
    },
    validate: Function
  },
  components: {
    xignal
  },
  inject: ['designer', 'dialogId', 'height'],
  computed: {
    t() {
      return this.designer.setupState.t
    },
    configured() {
      return !is.empty(this.modelValue) && Object.keys(this.modelValue).length > 0
    }
  },

  data() {
    return {
      editor: null,
      visible: false,
      oldVal: null
    }
  },
  methods: {
    handleAddVariable(node) {
      this.visible = false
      this.$emit('update:modelValue', node)
      this.$emit('change', node)
    }
  }
})
</script>

<style>
._fd-struct {
  width: 100%;
}

._fd-struct .el-badge {
  width: 100%;
}

._fd-struct .el-button {
  font-weight: 400;
  width: 100%;
  border-color: #2e73ff;
  color: #2e73ff;
}

._fd-struct-con .CodeMirror {
  height: 500px;
}

._fd-struct-con .el-dialog__body {
  padding: 0px;
}
</style>

