<template>
  <el-button
    v-bind="$attrs"
    @click="toggleValue"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    :class="{ 'is-pressed': isPressed }"
  >
    <slot></slot>
  </el-button>
</template>

<script>
export default {
  name: 'BButton',
  inheritAttrs: false, // Prevents attributes from being automatically inherited by root element
  props: {
    modelValue: {
      type: [String, Number, Boolean],
      default: 0
    },
    pressValue: {
      type: [String, Number, Boolean],
      default: 1
    },
    releaseValue: {
      type: [String, Number, Boolean],
      default: 0
    },
    toggleMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isPressed: false
    }
  },
  watch: {
    modelValue(newValue) {
      if (newValue === this.pressValue) {
        this.isPressed = true
      } else {
        this.isPressed = false
      }
    }
  },
  emits: ['update:modelValue', 'change'],
  methods: {
    toggleValue() {
      if (this.toggleMode) {
        this.isPressed = !this.isPressed
        const newValue = this.isPressed ? this.pressValue : this.releaseValue
        this.$emit('update:modelValue', newValue)
        this.$emit('change', newValue)
      }
    },
    handleMouseDown() {
      if (!this.toggleMode) {
        this.isPressed = true
        this.$emit('update:modelValue', this.pressValue)
        this.$emit('change', this.pressValue)
      }
    },
    handleMouseUp() {
      if (!this.toggleMode) {
        this.isPressed = false
        this.$emit('update:modelValue', this.releaseValue)
        this.$emit('change', this.releaseValue)
      }
    },
    handleMouseLeave() {
      if (!this.toggleMode && this.isPressed) {
        this.isPressed = false
        this.$emit('update:modelValue', this.releaseValue)
        this.$emit('change', this.releaseValue)
      }
    }
  }
}
</script>

<style scoped>
.is-pressed {
  transform: scale(0.98);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.1);
  filter: brightness(0.95);
  transition: all 0.1s ease;
}

/* Improve transition */
.el-button {
  transition: all 0.2s ease;
}
</style>
