<template>
  <div class="b-led">
    <Icon
      :icon="ledIcon"
      :width="size"
      :height="size"
      :style="{
        color: isActive ? onColor : offColor,
        filter: isActive ? `drop-shadow(0 0 5px ${onColor})` : 'none'
      }"
    />
  </div>
</template>

<script>
import { Icon } from '@iconify/vue'
import ledIcon from '@iconify/icons-mdi/led-variant-outline'

export default {
  name: 'BLed',
  components: {
    Icon
  },
  props: {
    modelValue: {
      type: [String, Number, Boolean],
      default: false
    },
    onColor: {
      type: String,
      default: '#00ff00' // Default green color when active
    },
    offColor: {
      type: String,
      default: '#666666' // Default dark gray color when inactive
    },
    size: {
      type: Number,
      default: 50 // Default size in pixels
    }
  },
  data() {
    return {
      ledIcon
    }
  },
  computed: {
    isActive() {
      return Boolean(this.modelValue)
    }
  }
}
</script>

<style scoped>
.b-led {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}
</style>
