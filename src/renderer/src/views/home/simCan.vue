<template>
  <div class="sim-can-settings">
    <el-form :model="form" label-width="auto">
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
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.rpcHost') }}</span>
            <el-tooltip :content="$t('general.rpcHostTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input v-model="form.rpcHost" style="max-width: 280px" :disabled="!form.rpcEnabled" />
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.rpcPort') }}</span>
            <el-tooltip :content="$t('general.rpcPortTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
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
import { QuestionFilled } from '@element-plus/icons-vue'

const stored = (window.store.get('general.settings') as Record<string, unknown> | undefined) || {}
const form = ref({
  rpcEnabled: stored.rpcEnabled !== false,
  rpcHost: typeof stored.rpcHost === 'string' && stored.rpcHost ? stored.rpcHost : '127.0.0.1',
  rpcPort: typeof stored.rpcPort === 'number' && stored.rpcPort > 0 ? stored.rpcPort : 17320
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
  projectSimulateCount: number
}

function persistRpc() {
  const current = (window.store.get('general.settings') as Record<string, unknown>) || {}
  window.store.set('general.settings', {
    ...current,
    rpcEnabled: form.value.rpcEnabled,
    rpcHost: form.value.rpcHost,
    rpcPort: form.value.rpcPort
  })
}

function formatRpcStatus(status: RpcHostStatus) {
  if (!status.enabled) {
    return 'JSON-RPC disabled'
  }
  if (status.error) {
    return status.error
  }
  if (status.listening) {
    return `listening tcp://${status.host}:${status.port} (${status.projectSimulateCount} simulate)`
  }
  return 'idle (starts when Simulate CAN is running)'
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
    persistRpc()
    const status = (await window.electron.ipcRenderer.invoke('ipc-rpc-apply')) as RpcHostStatus
    rpcStatusText.value = formatRpcStatus(status)
  } catch (err) {
    rpcStatusText.value = err instanceof Error ? err.message : String(err)
  } finally {
    rpcApplying.value = false
  }
}

watch(form, persistRpc, { deep: true })

onMounted(() => {
  void refreshRpcStatus()
})
</script>

<style scoped>
.sim-can-settings {
  padding: 20px;
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
