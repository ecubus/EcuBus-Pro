<template>
  <el-col :span="24">
    <div class="_fd-grid-view">
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
          v-for="item in rule.layout"
          :key="item.i"
          :x="item.x"
          :y="item.y"
          :w="item.w"
          :h="item.h"
          :i="item.i"
          :min-w="1"
          :min-h="1"
          :static="true"
          :style="[(style && style[item.i]) || {}]"
          :class="(rule.class && rule.class[item.i]) || ''"
          style="overflow: auto"
        >
          <div class="_fd-grid-view-cell">
            <slot :name="item.i"></slot>
          </div>
        </GridItem>
      </GridLayout>
    </div>
  </el-col>
</template>

<script>
import { GridLayout, GridItem } from 'vue-grid-layout-v3'
export default {
  name: 'Grid',
  components: {
    GridLayout,
    GridItem
  },
  props: {
    rule: {
      type: Object,
      default: () => ({ layout: [], row: 24, rowHeight: 80, margin: 10 })
    }
  },

  data() {
    return {
      style: {}
    }
  },
  computed: {
    gridStyle() {
      const style = {}
      if (this.width) {
        style.width = typeof this.width === 'number' ? `${this.width}px` : this.width
      } else {
        style.width = '100%'
      }
      return style
    }
  },
  methods: {},
  watch: {
    rule: {
      handler() {
        this.style = this.rule.style || {}
      },
      immediate: true
    }
  }
}
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

.vue-grid-item {
  margin-bottom: 10px;
  transition: all 200ms ease;
  box-sizing: border-box;
}

.vue-grid-item:not(.vue-grid-placeholder) {
  background: transparent;
}

.vue-grid-item.vue-grid-placeholder {
  background: #f0f9eb;
  opacity: 0.5;
}
</style>
