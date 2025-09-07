<template>
  <div class="pwm-controller" :style="{ height: height + 'px' }">
    <el-tabs v-model="activeTab" type="card" class="pwm-tabs">
      <!-- 设备连接Tab -->

      <!-- PWM控制Tab -->
      <el-tab-pane label="PWM Control" name="control">
        <template #label>
          <span class="tab-label">
            <Icon :icon="waveIcon" class="tab-icon" />
            <span>Control</span>
          </span>
        </template>
        <div class="tab-content" style="margin: 20px">
          <!-- 占空比控制 -->
          <div class="duty-cycle-section">
            <div class="section-header">
              <h4>Duty Cycle Control</h4>
              <!-- <div class="value-display">
                <span class="value-text">{{ dutyCycle.toFixed(1) }}%</span>
              </div> -->
            </div>

            <div class="slider-container">
              <el-slider
                v-model="dutyCycle"
                :min="0"
                :max="100"
                :step="0.1"
                :disabled="!isConnected"
                show-input
                :show-input-controls="false"
                class="duty-slider"
                @change="onDutyCycleChange"
              />
            </div>
          </div>

          <!-- 快速预设 -->
          <div class="presets-section">
            <h4>Quick Presets</h4>
            <el-button-group>
              <el-button
                v-for="preset in dutyCyclePresets"
                :key="preset.value"
                :disabled="!isConnected"
                :type="dutyCycle === preset.value ? 'primary' : 'default'"
                @click="setDutyCyclePreset(preset.value)"
              >
                {{ preset.label }}
              </el-button>
            </el-button-group>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="Device Connection" name="device">
        <template #label>
          <span class="tab-label">
            <Icon :icon="deviceIcon" class="tab-icon" />
            <span>Device</span>
          </span>
        </template>
        <div class="tab-content">
          <!-- 设备穿梭框 -->
          <div class="transfer-section">
            <div class="transfer-container">
              <el-transfer
                v-model="dataBase.ia[editIndex].devices"
                class="pwm-transfer"
                style="text-align: left; display: inline-block"
                :data="allDeviceLabel"
                :titles="['Valid', 'Assigned']"
                :disabled="!isConnected"
              />
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, toRef, watchEffect } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@r/stores/data'
import type { PwmBaseInfo } from 'src/main/share/uds'

// Icons
import deviceIcon from '@iconify/icons-material-symbols/device-hub'
import connectIcon from '@iconify/icons-material-symbols/link'
import disconnectIcon from '@iconify/icons-material-symbols/link-off'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import waveIcon from '@iconify/icons-material-symbols/graphic-eq'
import playIcon from '@iconify/icons-material-symbols/play-arrow'
import stopIcon from '@iconify/icons-material-symbols/stop'
import { useGlobalStart } from '@r/stores/runtime'
import { cloneDeep } from 'lodash'

interface PwmDevice {
  id: string
  label: string
  handle: string
  busy: boolean
  serialNumber?: string
}

interface PwmCalculationResult {
  prescaler: number
  autoReload: number
  compareValue: number
  actualFrequency: number
  actualDutyCycle: number
}

interface Option {
  key: string
  label: string
  disabled: boolean
}

const props = defineProps<{
  height: number
  editIndex: string
}>()

const height = toRef(props, 'height')
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()

// Tab控制
const activeTab = ref('control')

const isConnected = useGlobalStart()
const dutyCycle = ref(10.0)

// 预设值
const dutyCyclePresets = [
  { label: '0%', value: 0 },
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 }
]
const availableDevices = computed(() => {
  const dd: Record<string, PwmBaseInfo> = {}
  for (const d in dataBase.devices) {
    if (dataBase.devices[d] && dataBase.devices[d].type == 'pwm' && dataBase.devices[d].pwmDevice) {
      dd[d] = dataBase.devices[d].pwmDevice
    }
  }
  return dd
})
// 所有可用设备的标签列表
const allDeviceLabel = computed(() => {
  const dd: Option[] = []
  for (const device of Object.keys(availableDevices.value)) {
    dd.push({
      key: device,
      label: availableDevices.value[device].name,
      disabled: false
    })
  }
  return dd
})

watchEffect(() => {
  if (isConnected.value == false && dataBase.ia[editIndex.value].devices.length > 0) {
    const device = dataBase.devices[dataBase.ia[editIndex.value].devices[0]]
    if (device && device.pwmDevice) {
      dutyCycle.value = device.pwmDevice.initDuty
    }
  }
})

// 占空比变化
function onDutyCycleChange(value: number) {
  if (!isConnected.value) return
  window.electron.ipcRenderer.send(
    'ipc-pwm-set-duty',
    cloneDeep(dataBase.ia[editIndex.value]),
    value
  )
}

function setDutyCyclePreset(value: number) {
  dutyCycle.value = value
  onDutyCycleChange(value)
}
</script>

<style scoped>
.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pwm-tabs {
  height: 100%;
}

.tab-icon {
  font-size: 16px;
}

.transfer-container {
  margin: 16px 0;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.value-display {
  background: var(--el-color-primary);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 18px;
}

.value-text {
  font-family: 'Consolas', 'Monaco', monospace;
}

.slider-container {
  padding: 0 16px;
}

.duty-slider {
  width: 100%;
}

.presets-section {
  margin-bottom: 24px;
}

.presets-section h4 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
}

/* 穿梭框样式 */
.pwm-transfer {
  --el-transfer-panel-body-height: 200px;
}

/* 自定义滑块样式 */
:deep(.el-slider__runway) {
  height: 8px;
  background: linear-gradient(to right, #ff4757, #ffa502, #2ed573);
}

:deep(.el-slider__button) {
  border: 3px solid white;
  width: 24px;
  height: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

:deep(.el-slider__input) {
  width: 100px;
}
</style>
