<template>
  <div class="general-settings">
    <el-form :model="form" label-width="auto">
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.theme') }}</span>
            <el-tooltip :content="$t('general.themeTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-switch
          v-model="isDark"
          inline-prompt
          :active-icon="Moon"
          :inactive-icon="Sunny"
          @change="handleThemeChange"
        />
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.language') }}</span>
          </div>
        </template>
        <LanguageSwitcher v-model="form.language" />
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.uiZoom') }}</span>
            <el-tooltip :content="$t('general.uiZoomTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <div class="zoom-container">
          <el-slider
            v-model="form.zoom"
            :min="50"
            :max="200"
            :step="1"
            @change="handleZoomChange"
          />
          <span class="zoom-value">{{ form.zoom }}%</span>
        </div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.rpcServer') }}</span>
            <el-tooltip :content="$t('general.rpcServerTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-switch v-model="form.rpcEnabled" />
      </el-form-item>
      <el-form-item :label="$t('general.rpcHost')">
        <el-input v-model="form.rpcHost" style="max-width: 280px" :disabled="!form.rpcEnabled" />
      </el-form-item>
      <el-form-item :label="$t('general.rpcPort')">
        <el-input-number
          v-model="form.rpcPort"
          :min="1"
          :max="65535"
          :step="1"
          :disabled="!form.rpcEnabled"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="rpcApplying" @click="applyRpc">
          {{ $t('general.rpcApply') }}
        </el-button>
        <span class="rpc-status">{{ rpcStatusText }}</span>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { QuestionFilled, Moon, Sunny } from '@element-plus/icons-vue'
import { assign, isEqual, cloneDeep } from 'lodash'
import { useDark } from '@vueuse/core'
import LanguageSwitcher from './LanguageSwitcher.vue'

const isDark = useDark()
const OldVal = window.store.get('general.settings') as any
const form = ref({
  zoom: OldVal?.zoom || 100,
  language: OldVal?.language || 'en',
  rpcEnabled: OldVal?.rpcEnabled !== false,
  rpcHost: OldVal?.rpcHost || '127.0.0.1',
  rpcPort: OldVal?.rpcPort || 17320
})
const rpcApplying = ref(false)
const rpcStatusText = ref('')

type RpcHostStatus = {
  enabled: boolean
  listening: boolean
  host: string
  port: number
  error?: string
  controllers: number
}

function formatRpcStatus(status: RpcHostStatus) {
  if (!status.enabled) {
    return 'JSON-RPC off'
  }
  if (status.error) {
    return status.error
  }
  if (status.listening) {
    return `tcp://${status.host}:${status.port}`
  }
  return 'JSON-RPC not listening'
}

async function refreshRpcStatus() {
  try {
    const status = (await window.electron.ipcRenderer.invoke('ipc-rpc-status')) as RpcHostStatus
    rpcStatusText.value = formatRpcStatus(status)
  } catch {
    rpcStatusText.value = ''
  }
}

async function applyRpc() {
  rpcApplying.value = true
  try {
    window.store.set('general.settings', cloneDeep(form.value))
    const status = (await window.electron.ipcRenderer.invoke('ipc-rpc-apply')) as RpcHostStatus
    rpcStatusText.value = formatRpcStatus(status)
  } catch (err) {
    rpcStatusText.value = err instanceof Error ? err.message : String(err)
  } finally {
    rpcApplying.value = false
  }
}

watch(
  form,
  (v) => {
    if (isEqual(v, OldVal)) {
      return
    }
    window.store.set('general.settings', cloneDeep(v))
  },
  { deep: true }
)

const handleZoomChange = (value: number) => {
  window.electron.webFrame.setZoomFactor(value / 100)
}

const handleThemeChange = (value: boolean) => {
  isDark.value = value
}

onMounted(() => {
  if (OldVal) {
    assign(form.value, OldVal)
    form.value.rpcEnabled = OldVal.rpcEnabled !== false
    form.value.rpcHost = OldVal.rpcHost || '127.0.0.1'
    form.value.rpcPort = OldVal.rpcPort || 17320
  }
  void refreshRpcStatus()
})
</script>

<style scoped>
.general-settings {
  padding: 20px;
}

.zoom-container {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.zoom-container :deep(.el-slider) {
  width: 400px;
}

.zoom-value {
  min-width: 60px;
  color: #606266;
}

.rpc-status {
  margin-left: 12px;
  color: #909399;
  font-size: 13px;
}

.label-container {
  display: flex;
  align-items: center;
}

.question-icon {
  margin-left: 4px;
  font-size: 14px;
  color: #909399;
  cursor: help;
  line-height: 1;
}
</style>
