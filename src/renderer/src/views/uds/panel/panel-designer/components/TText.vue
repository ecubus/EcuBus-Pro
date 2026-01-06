<template>
  <span>{{ text }}</span>
</template>

<script>
export default {
  name: 'TText',
  inheritAttrs: false, // Prevents attributes from being automatically inherited by root element
  props: {
    modelValue: {},
    initValue: {
      default: 'Text'
    }
  },
  computed: {
    text() {
      return this.modelValue != undefined ? this.modelValue : this.initValue
    }
  }
}
</script>

<style scoped></style>
