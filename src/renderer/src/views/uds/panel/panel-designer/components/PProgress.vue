<template>
  <el-progress v-bind="$attrs" :percentage="modelValue"> </el-progress>
</template>

<script>
export default {
  name: 'Progress',
  inheritAttrs: false, // Prevents attributes from being automatically inherited by root element
  props: {
    modelValue: {
      type: [Number],
      default: 15
    }
  }
}
</script>

<style scoped></style>
