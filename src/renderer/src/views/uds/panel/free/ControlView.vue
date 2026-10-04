<template>
  <div
    class="panel-control-content"
    :class="{
      compact: control.type === 'switch',
      'led-control': control.type === 'led',
      'image-control': control.type === 'image',
      'html-control': control.type === 'html',
      [`label-${labelPosition(control)}`]: supportsLabelPosition(control)
    }"
    :style="{ fontSize: `${control.fontSize}px`, color: control.color || undefined }"
  >
    <span v-if="control.type === 'text'" class="panel-text">{{ control.label }}</span>
    <template v-else-if="control.type === 'image'">
      <img
        v-if="control.imageSrc && !imageFailed"
        :src="control.imageSrc"
        :alt="control.label"
        :style="{ objectFit: control.imageFit || 'contain' }"
        draggable="false"
        @error="imageFailed = true"
      />
      <span v-else class="panel-control-label">{{
        t(control.imageSrc ? 'imageFailed' : 'noImage')
      }}</span>
    </template>
    <HtmlPanel
      v-else-if="control.type === 'html'"
      :control="control"
      :running="running"
      :editing="editing"
    />
    <template v-else>
      <span
        v-if="
          !['button', 'startStop'].includes(control.type) && labelPosition(control) !== 'hidden'
        "
        class="panel-control-label"
        :class="{ 'range-label': control.type === 'progress' }"
        ><span>{{
          ['display', 'number'].includes(control.type) ? numericLabel(control) : control.label
        }}</span
        ><span
          v-if="
            control.type === 'progress' &&
            labelPosition(control) === 'top' &&
            !control.progressValuePosition &&
            control.progressText !== 'hidden'
          "
          class="panel-digital"
          >{{ progress.text }}</span
        ></span
      >
      <div class="panel-control-body">
        <div
          v-if="control.type === 'display'"
          class="panel-reading"
          :style="{ backgroundColor: alarmColor(control, value) }"
        >
          <strong>{{ formatNumber(control, value) }}</strong>
        </div>
        <HexTextEditor
          v-else-if="control.type === 'input'"
          :control="control"
          :value="value"
          :disabled="disabled"
          @write="emit('write', $event)"
        />
        <el-input
          v-else-if="control.type === 'path'"
          :model-value="value == null ? '' : String(value)"
          :disabled="disabled"
          size="small"
          :aria-label="control.label"
          @change="emit('write', $event)"
        >
          <template v-if="control.type === 'path'" #append>
            <el-button :disabled="disabled" :aria-label="t('browse')" @click="emit('action')"
              >…</el-button
            >
          </template>
        </el-input>
        <el-checkbox
          v-else-if="control.type === 'checkbox'"
          :model-value="value != null && numeric === control.pressValue"
          :disabled="disabled"
          :aria-label="control.label"
          @change="emit('write', $event ? control.pressValue : control.releaseValue)"
        />
        <el-radio-group
          v-else-if="control.type === 'radio'"
          :model-value="Array.isArray(value) ? undefined : value"
          :disabled="disabled"
          :aria-label="control.label"
          @change="change"
        >
          <el-radio v-for="option in control.options" :key="option.value" :value="option.value">{{
            option.label
          }}</el-radio>
        </el-radio-group>
        <NumericInput
          v-else-if="
            control.type === 'number' && control.numberFormat && control.numberFormat !== 'decimal'
          "
          :control="control"
          :value="value"
          :disabled="disabled"
          size="small"
          :aria-label="control.label"
          :style="{
            '--el-input-bg-color': alarmColor(control, value),
            '--el-disabled-bg-color': alarmColor(control, value)
          }"
          @write="emit('write', $event)"
        />
        <el-input-number
          v-else-if="control.type === 'number'"
          :model-value="numeric"
          :min="control.min"
          :max="control.max"
          :step="control.step"
          :precision="control.numberDecimals"
          :style="{
            '--el-input-bg-color': alarmColor(control, value),
            '--el-disabled-bg-color': alarmColor(control, value)
          }"
          :disabled="disabled"
          size="small"
          controls-position="right"
          :aria-label="control.label"
          @change="change"
        />
        <div v-else-if="control.type === 'startStop'" class="measurement-buttons">
          <el-button type="success" :disabled="disabled || running" @click="emit('action')">{{
            t('startMeasurement')
          }}</el-button>
          <el-button type="danger" :disabled="disabled || !running" @click="emit('action')">{{
            t('stopMeasurement')
          }}</el-button>
        </div>
        <el-button
          v-else-if="control.type === 'button'"
          :disabled="disabled"
          :type="pressed ? 'primary' : control.buttonVariant || 'default'"
          :plain="control.buttonPlain"
          size="small"
          class="panel-action"
          :class="`button-${control.buttonShape || 'rounded'}`"
          :style="
            control.buttonShape === 'circle'
              ? { width: `${buttonDiameter}px`, height: `${buttonDiameter}px` }
              : undefined
          "
          @pointerdown="press"
          @pointerup="release"
          @pointerleave="release"
          @pointercancel="release"
          @keydown.space.prevent="keyPress"
          @keyup.space.prevent="release"
          @keydown.enter.prevent="keyPress"
          @keyup.enter.prevent="release"
          @blur="release"
          @click="actionButton ? emit('action') : toggle()"
          >{{ control.label }}</el-button
        >
        <el-switch
          v-else-if="control.type === 'switch'"
          size="small"
          :model-value="numeric === control.pressValue"
          :disabled="disabled"
          :aria-label="control.label"
          @change="emit('write', $event ? control.pressValue : control.releaseValue)"
        />
        <div v-else-if="control.type === 'led'" class="panel-led-row">
          <svg
            class="panel-led"
            :class="led.state"
            :style="{ width: `${led.width}px`, height: `${led.height}px` }"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            :aria-label="`${control.label}: ${t(`led_${led.state}`)}`"
          >
            <path
              :d="led.path"
              :fill="led.fill"
              :stroke="led.stroke"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
              :stroke-dasharray="led.state === 'unknown' ? '3 2' : undefined"
            />
          </svg>
        </div>
        <el-slider
          v-else-if="control.type === 'slider'"
          class="panel-slider"
          :model-value="numeric"
          :min="control.min"
          :max="control.max"
          :step="control.step"
          :disabled="disabled"
          :show-tooltip="false"
          :aria-label="control.label"
          @change="change"
        />
        <el-select
          v-else-if="control.type === 'select'"
          :model-value="Array.isArray(value) ? undefined : value"
          :disabled="disabled"
          size="small"
          placeholder=""
          :aria-label="control.label"
          @change="change"
        >
          <el-option
            v-for="option in control.options"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <div
          v-else-if="control.type === 'progress'"
          class="panel-progress"
          :class="[
            { vertical: progress.vertical },
            `direction-${progress.direction}`,
            `value-${progressValuePosition(control)}`
          ]"
          role="progressbar"
          :aria-label="control.label"
          :aria-valuemin="control.min"
          :aria-valuemax="control.max"
          :aria-valuenow="
            fraction == null ? undefined : Math.max(control.min, Math.min(control.max, numeric))
          "
          :aria-valuetext="progress.text"
          :aria-orientation="progress.vertical ? 'vertical' : 'horizontal'"
        >
          <span
            v-if="
              progressValuePosition(control) !== 'hidden' &&
              (control.progressValuePosition || labelPosition(control) !== 'top')
            "
            class="panel-digital progress-value"
            >{{ progress.text }}</span
          >
          <div class="panel-progress-bar">
            <div class="panel-progress-track">
              <div :style="{ ...progress.fill, background: control.color || undefined }"></div>
            </div>
            <div v-if="control.progressShowLimits" class="panel-progress-limits panel-digital">
              <span>{{ control.min }}</span
              ><span>{{ control.max }}</span>
            </div>
          </div>
        </div>
        <svg
          v-else-if="control.type === 'gauge'"
          class="panel-gauge"
          viewBox="0 0 160 100"
          role="img"
          :aria-label="`${control.label}: ${gaugeText}`"
        >
          <path class="gauge-track" d="M 20 76 A 60 60 0 0 1 140 76" />
          <path
            v-if="fraction != null"
            class="gauge-fill"
            d="M 20 76 A 60 60 0 0 1 140 76"
            pathLength="100"
            :stroke-dasharray="`${fraction * 100} 100`"
            :style="{ stroke: control.color || undefined }"
          />
          <line
            v-if="fraction != null"
            x1="80"
            y1="76"
            x2="80"
            y2="30"
            :transform="`rotate(${fraction * 180 - 90} 80 76)`"
            class="gauge-needle"
          />
          <text
            x="80"
            y="96"
            text-anchor="middle"
            class="gauge-value"
            :style="{ fontSize: `${control.fontSize}px` }"
          >
            {{ gaugeText }}
          </text>
          <text x="16" y="91" text-anchor="middle" class="gauge-limit">{{ control.min }}</text>
          <text x="144" y="91" text-anchor="middle" class="gauge-limit">{{ control.max }}</text>
        </svg>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PanelControl } from 'src/preload/panel'
import type { PanelValue } from './runtime'
import { rangeFraction, labelPosition, supportsLabelPosition } from './model'
import { usePanelLocale } from './locale'
import { formatNumber, gaugeValueText, numericLabel, alarmColor } from './numeric'
import { ledPresentation } from './led'
import NumericInput from './NumericInput.vue'
import HexTextEditor from './HexTextEditor.vue'
import HtmlPanel from './HtmlPanel.vue'
import { progressPresentation, progressValuePosition } from './progress'
const props = defineProps<{
  control: PanelControl
  value?: PanelValue
  disabled?: boolean
  running?: boolean
  editing?: boolean
}>()
const emit = defineEmits<{ write: [value: PanelValue]; action: [] }>()
const actionButton = computed(
  () =>
    props.control.type === 'button' &&
    !!props.control.buttonAction &&
    props.control.buttonAction !== 'write'
)
const led = computed(() => ledPresentation(props.control, props.value))
const held = ref(false)
const buttonDiameter = computed(() =>
  Math.max(0, Math.min(props.control.width - 20, props.control.height - 12))
)
const t = usePanelLocale()
const imageFailed = ref(false)
watch(
  () => props.control.imageSrc,
  () => {
    imageFailed.value = false
  }
)
const fraction = computed(() =>
  rangeFraction(
    Array.isArray(props.value) ? undefined : props.value,
    props.control.min,
    props.control.max
  )
)
const progress = computed(() =>
  progressPresentation(props.control, Array.isArray(props.value) ? undefined : props.value)
)
const gaugeText = computed(() =>
  fraction.value == null ? '—' : gaugeValueText(props.control, props.value)
)
const numeric = computed(() => Number(props.value ?? props.control.initialValue))
const pressed = computed(
  () => held.value || (props.value != null && numeric.value === props.control.pressValue)
)
function change(value: string | boolean | number | number[] | undefined) {
  if (typeof value === 'number') emit('write', value)
}
function press(event?: PointerEvent) {
  if (event && event.button !== 0) return
  if (actionButton.value || props.disabled || props.control.toggle || held.value) return
  held.value = true
  emit('write', props.control.pressValue)
}
function keyPress(event: KeyboardEvent) {
  if (actionButton.value) {
    if (!event.repeat && !props.disabled) emit('action')
    return
  }
  if (event.repeat) return
  if (props.control.toggle) toggle()
  else press()
}
function release() {
  if (!held.value) return
  held.value = false
  emit('write', props.control.releaseValue)
}
function toggle() {
  if (props.control.toggle && !props.disabled)
    emit(
      'write',
      numeric.value === props.control.pressValue
        ? props.control.releaseValue
        : props.control.pressValue
    )
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) release()
  }
)
onMounted(() => window.addEventListener('blur', release))
onUnmounted(() => {
  release()
  window.removeEventListener('blur', release)
})
</script>
<style scoped>
.measurement-buttons {
  display: flex;
  gap: 8px;
  width: 100%;
  height: 100%;
}
.measurement-buttons .el-button {
  flex: 1;
  margin: 0;
  height: 100%;
  min-width: 0;
  padding: 4px;
  font-size: inherit;
}
.panel-control-content:has(.hex-text-editor) > .panel-control-body,
.panel-control-content:has(.measurement-buttons) > .panel-control-body {
  flex: 1;
  height: 100%;
}
.led-control {
  padding: 6px;
}
.led-control .panel-led-row {
  justify-content: center;
}
.led-control .panel-led {
  flex-shrink: 0;
}

.panel-control-content {
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 6px 10px;
  overflow: hidden;
}
.html-control {
  display: block;
  padding: 0;
}
.panel-control-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  line-height: 14px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-control-label > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
}
.range-label {
  font-size: inherit;
  line-height: 1.2;
}
.panel-control-content.compact {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
}
.compact > .panel-control-label {
  flex: 1;
}
.compact > .panel-control-body,
.panel-led-row {
  flex-shrink: 0;
}
.image-control {
  padding: 0;
  align-items: center;
}
.image-control img {
  width: 100%;
  height: 100%;
}
.panel-progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-height: 0;
  width: 100%;
}
.panel-progress.value-left,
.panel-progress.value-right {
  flex-direction: row;
  align-items: stretch;
}
.value-left > .progress-value,
.value-right > .progress-value {
  align-self: center;
  flex-shrink: 0;
}
.value-right > .progress-value,
.value-bottom > .progress-value {
  order: 1;
}
.panel-progress-bar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-height: 0;
}
.panel-progress-track {
  position: relative;
  flex: 1;
  min-height: 6px;
  overflow: hidden;
  background: var(--el-fill-color-darker);
  border-radius: 2px;
}
.panel-progress-track > div {
  position: absolute;
  height: 100%;
  background: var(--el-color-primary);
}
.panel-progress-limits {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  line-height: 12px;
}
.direction-left .panel-progress-limits {
  flex-direction: row-reverse;
}
.vertical .panel-progress-bar {
  flex-direction: row;
}
.vertical .panel-progress-track > div {
  width: 100%;
}
.vertical .panel-progress-limits {
  flex-direction: column;
}
.direction-up .panel-progress-limits {
  flex-direction: column-reverse;
}
.progress-value {
  text-align: right;
}
.panel-gauge {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.gauge-track,
.gauge-fill {
  fill: none;
  stroke-width: 8;
}
.gauge-track {
  stroke: var(--el-fill-color-darker);
}
.gauge-fill {
  stroke: var(--el-color-primary);
}
.gauge-needle {
  stroke: var(--el-text-color-regular);
  stroke-width: 2;
}
.gauge-value {
  fill: var(--el-text-color-primary);
  font:
    12px Consolas,
    monospace;
}
.gauge-limit {
  fill: var(--el-text-color-secondary);
  font:
    8px Consolas,
    monospace;
}
.panel-text {
  white-space: pre-wrap;
}
.panel-reading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-family: Consolas, monospace;
}
.panel-reading strong {
  font-size: 1.5em;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-reading > span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.el-radio-group {
  gap: 4px 12px;
  flex-wrap: wrap;
}
.el-radio {
  margin-right: 0;
}
.panel-action,
.el-input-number,
.el-select {
  width: 100%;
}
.panel-action {
  height: 100%;
  font-size: inherit;
}
.panel-action.button-rectangle {
  border-radius: 0;
}
.panel-action.button-circle {
  border-radius: 50%;
  align-self: center;
  flex-shrink: 0;
  padding: 4px;
}
.button-circle :deep(span) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-led-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.panel-led {
  display: block;
  overflow: visible;
}
.panel-digital {
  font-family: Consolas, monospace;
}

.panel-control-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  width: 100%;
}
.panel-slider {
  box-sizing: border-box;
  padding-inline: calc(var(--el-slider-button-wrapper-size) / 2);
}
.panel-control-content:has(.panel-gauge) > .panel-control-body,
.panel-control-content:has(.panel-progress) > .panel-control-body,
.panel-control-content:has(.panel-action) > .panel-control-body {
  flex: 1;
}
.panel-control-content:has(.panel-progress) > .panel-control-body {
  align-self: stretch;
}
.panel-control-body > .panel-gauge {
  flex: auto;
}
.panel-control-content.label-left,
.panel-control-content.label-right,
.panel-control-content.label-center {
  flex-direction: row;
  align-items: center;
}
.label-left > .panel-control-body,
.label-right > .panel-control-body {
  flex: 1;
}
.label-left > .panel-control-label,
.label-right > .panel-control-label {
  flex: 0 1 auto;
}
.label-right > .panel-control-label {
  order: 1;
}
.compact > .panel-control-body {
  width: auto;
  flex: 0 0 auto;
}
.panel-control-content.label-center {
  justify-content: center;
}
.label-center > .panel-control-label {
  flex: 0 1 auto;
}
.label-center > .panel-control-body {
  width: 65%;
  flex: 0 1 auto;
  min-width: 0;
}
.compact.label-center > .panel-control-body {
  width: auto;
  flex: 0 0 auto;
}
.panel-control-content.label-top,
.panel-control-content.label-bottom {
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
}
.label-bottom > .panel-control-label {
  order: 1;
}
.compact.label-top,
.compact.label-bottom {
  padding: 0 8px;
  gap: 0;
}
.compact.label-top > .panel-control-label,
.compact.label-bottom > .panel-control-label {
  flex: 0 0 auto;
  justify-content: center;
}
.compact.label-top > .panel-control-body,
.compact.label-bottom > .panel-control-body {
  align-items: center;
}
.compact.label-top :deep(.el-switch),
.compact.label-bottom :deep(.el-switch) {
  height: 18px;
}
.panel-control-content.label-hidden {
  align-items: center;
  justify-content: center;
}
.progress-value {
  text-align: right;
}
</style>
