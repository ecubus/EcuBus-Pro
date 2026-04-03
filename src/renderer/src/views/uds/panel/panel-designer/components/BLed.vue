<template>
  <div class="b-led">
    <span v-if="svgMarkup" class="b-led-custom" :style="customSvgWrapStyle" v-html="svgMarkup" />
    <Icon v-else :icon="ledIcon" :width="size" :height="size" :style="defaultIconStyle" />
  </div>
</template>

<script>
import { Icon } from '@iconify/vue'
import ledIcon from '@iconify/icons-mdi/led-variant-outline'

function stripUnsafeSvg(s) {
  if (!s) return ''
  return s
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
}

function isInlineSvgString(s) {
  const t = s.trim()
  return t.startsWith('<') && /<svg[\s>/]/i.test(t)
}

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
      default: '#00ff00'
    },
    offColor: {
      type: String,
      default: '#666666'
    },
    size: {
      type: Number,
      default: 50
    },
    /** Pasted SVG markup (<svg>...</svg>). On/off colors use currentColor. */
    customSvg: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      ledIcon
    }
  },
  computed: {
    isActive() {
      return Number(this.modelValue) != 0
    },
    activeColor() {
      return this.isActive ? this.onColor : this.offColor
    },
    defaultIconStyle() {
      return {
        color: this.activeColor,
        filter: this.isActive ? `drop-shadow(0 0 5px ${this.onColor})` : 'none'
      }
    },
    customSvgWrapStyle() {
      return {
        color: this.activeColor,
        width: `${this.size}px`,
        height: `${this.size}px`,
        filter: this.isActive ? `drop-shadow(0 0 5px ${this.onColor})` : 'none'
      }
    },
    svgMarkup() {
      const raw = (this.customSvg || '').trim()
      if (!raw || !isInlineSvgString(raw)) return ''
      return stripUnsafeSvg(raw)
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

.b-led-custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.b-led-custom :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

/* Tint SVG with on/off color (SVG only; raster images cannot use this). */
.b-led-custom :deep(svg) * {
  fill: currentColor !important;
  stroke: currentColor !important;
}
</style>
