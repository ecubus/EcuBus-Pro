<template>
  <div class="_fd-config-item">
    <div class="_fd-ci-head">
      <div
        class="_fd-ci-label"
        :class="$slots.append && arrow !== false ? 'is-arrow' : ''"
        @click="visit = $slots.append && arrow !== false && !visit"
      >
        <template v-if="warning">
          <Warning :tooltip="warning">
            <slot name="label">
              <span>{{ label }}</span>
            </slot>
          </Warning>
        </template>
        <template v-else>
          <slot name="label">
            <span>{{ label }}</span>
          </slot>
        </template>
        <i
          class="fc-icon icon-down"
          v-if="$slots.append && arrow !== false"
          :class="showAppend || visit ? 'down' : ''"
        ></i>
      </div>
      <div class="_fd-ci-con" v-if="$slots.default || info">
        <template v-if="$slots.default">
          <slot></slot>
        </template>
        <span class="_fd-ci-info" v-else>{{ info }}</span>
      </div>
    </div>
    <div class="_fd-ci-append" v-if="showAppend || visit" :style="'background:' + appendBackground">
      <slot name="append"></slot>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import Warning from '../Warning.vue'

export default defineComponent({
  name: 'ConfigItem',
  components: { Warning },
  props: {
    label: String,
    info: String,
    warning: String,
    appendBackground: String,
    arrow: {
      type: Boolean,
      default: true
    },
    showAppend: Boolean
  },
  data() {
    return {
      visit: false
    }
  }
})
</script>

<style>
._fd-config-item {
  display: flex;
  width: 100%;
  flex-direction: column;
  font-size: 12px;
  color: #666666;
  margin-bottom: 10px;
}

._fd-ci-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

._fd-ci-label {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #262626;
}

._fd-ci-con {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 150px;
}

._fd-ci-label.is-arrow {
  cursor: pointer;
}

._fd-ci-append {
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  margin: 5px 3px 3px;
  padding: 4px;
}

._fd-ci-label i {
  font-size: 12px;
  font-weight: 600;
}

._fd-ci-label i.down {
  transform: rotate(-180deg);
}

._fd-ci-info {
  font-size: 12px;
  padding-right: 5px;
}
</style>
