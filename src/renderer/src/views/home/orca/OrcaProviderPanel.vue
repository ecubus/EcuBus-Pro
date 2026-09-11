<template>
  <div class="orca-provider" data-test="orca-provider">
    <div class="orca-header">
      <img class="orca-logo" :src="orcaLogo" alt="OrcaRouter" />
      <div class="orca-heading">
        <h3>{{ $t('ai.orcaProviderTitle') }}</h3>
        <p class="orca-subtitle">{{ $t('ai.orcaProviderSubtitle') }}</p>
      </div>
      <el-tag
        v-if="degraded"
        type="warning"
        size="small"
        class="orca-degraded-tag"
        data-test="orca-degraded"
      >
        {{ $t('ai.orcaDegraded') }}
      </el-tag>
    </div>

    <!-- Two explicit authentication choices, side by side. -->
    <div class="orca-auth" data-test="orca-auth-methods">
      <!-- Choice 1: an existing OrcaRouter API key. -->
      <section class="orca-auth-card" data-test="orca-auth-apikey">
        <h4 class="orca-auth-title">{{ $t('ai.orcaAuthMethodApiKey') }}</h4>
        <p class="orca-hint">{{ $t('ai.orcaApiKeyHint') }}</p>
        <el-input
          v-model="apiKeyDraft"
          type="password"
          show-password
          autocomplete="off"
          :placeholder="$t('ai.orcaApiKeyPlaceholder')"
          data-test="orca-api-key-input"
        />
        <div class="orca-actions">
          <el-button
            type="primary"
            :loading="savingKey"
            data-test="orca-api-key-save"
            @click="saveApiKey"
          >
            {{ $t('ai.orcaSaveKey') }}
          </el-button>
          <el-button
            :disabled="status.status === 'none'"
            data-test="orca-api-key-clear"
            @click="clearCredential"
          >
            {{ $t('ai.orcaClearKey') }}
          </el-button>
        </div>
        <p class="orca-hint">
          <el-link type="primary" :href="config.consoleUrl" target="_blank" rel="noopener">
            {{ $t('ai.orcaManageKeys') }}
          </el-link>
        </p>
      </section>

      <!-- Choice 2: sign in with an OrcaRouter account (OAuth 2.0 + PKCE). -->
      <section class="orca-auth-card" data-test="orca-auth-pkce">
        <h4 class="orca-auth-title">{{ $t('ai.orcaAuthMethodPkce') }}</h4>
        <p class="orca-hint">
          {{ $t('ai.orcaPkceHint', { origin: config.authBase }) }}
        </p>
        <div class="orca-actions">
          <el-button
            type="success"
            plain
            :loading="connectBusy"
            data-test="orca-connect-button"
            @click="startConnect"
          >
            {{ connectBusy ? $t('ai.orcaConnecting') : $t('ai.orcaConnect') }}
          </el-button>
          <el-button v-if="connectBusy" data-test="orca-connect-cancel" @click="cancelConnect">
            {{ $t('ai.orcaCancel') }}
          </el-button>
        </div>
        <div v-if="authorizeUrl" class="orca-authorize" data-test="orca-authorize-url">
          <span class="orca-hint">{{ $t('ai.orcaOpenManually') }}</span>
          <el-input v-model="authorizeUrl" readonly size="small" />
        </div>
      </section>
    </div>

    <!-- Credential state. Never shows the key itself. -->
    <el-alert
      v-if="status.status === 'needsReauth'"
      type="error"
      :closable="false"
      show-icon
      data-test="orca-needs-reauth"
      :title="$t('ai.orcaNeedsReauth')"
    />
    <p v-else-if="status.status === 'configured'" class="orca-status" data-test="orca-status">
      {{ $t('ai.orcaStatusConfigured', { source: sourceLabel }) }}
      <code class="orca-masked">{{ status.maskedKey }}</code>
    </p>
    <p v-else class="orca-status" data-test="orca-status">{{ $t('ai.orcaStatusNone') }}</p>

    <el-alert
      v-if="errorMessage"
      type="error"
      :closable="true"
      show-icon
      data-test="orca-error"
      :title="errorMessage"
      @close="errorMessage = ''"
    />

    <!-- The one AI entry point this build has: a model-driven request. -->
    <section class="orca-inference" data-test="orca-inference">
      <!--
        The attachment choice comes first: it decides which models the selector
        below is allowed to offer, so it must be made before the model is picked.
      -->
      <div class="orca-inference-row">
        <el-switch
          v-model="attachImage"
          :disabled="status.status !== 'configured'"
          data-test="orca-attach-image"
        />
        <span class="orca-hint">{{ $t('ai.orcaAttachImage') }}</span>
        <span v-if="degraded && degradedReason" class="orca-hint" data-test="orca-degraded-reason">
          {{ degradedReason }}
        </span>
      </div>

      <div class="orca-inference-row">
        <div class="orca-field">
          <label class="orca-label">{{ $t('ai.orcaModelLabel') }}</label>
          <el-select
            v-model="selectedModel"
            filterable
            clearable
            class="orca-model-select"
            popper-class="orca-model-popper"
            :loading="loadingModels"
            :disabled="status.status !== 'configured'"
            :placeholder="modelPlaceholder"
            data-test="orca-model-select"
          >
            <el-option
              v-for="model in models"
              :key="model.id"
              :label="model.name || model.id"
              :value="model.id"
            >
              <span class="orca-option-row">
                <span class="orca-option-id">{{ model.id }}</span>
                <span v-if="model.contextLength" class="orca-option-meta">
                  {{ formatContext(model.contextLength) }}
                </span>
              </span>
            </el-option>
          </el-select>
        </div>

        <el-button
          :disabled="status.status !== 'configured'"
          :loading="loadingModels"
          data-test="orca-refresh-models"
          @click="loadModels(true)"
        >
          {{ $t('ai.orcaRefreshModels') }}
        </el-button>
      </div>

      <el-input
        v-model="prompt"
        type="textarea"
        :rows="3"
        :placeholder="$t('ai.orcaPromptPlaceholder')"
        data-test="orca-prompt"
      />
      <div class="orca-actions">
        <el-button
          type="primary"
          :loading="sending"
          :disabled="status.status !== 'configured' || !selectedModel || !prompt"
          data-test="orca-send"
          @click="send"
        >
          {{ $t('ai.orcaSend') }}
        </el-button>
      </div>
      <pre v-if="response" class="orca-response" data-test="orca-response">{{ response }}</pre>
      <p
        v-if="!loadingModels && models.length === 0 && status.status === 'configured'"
        class="orca-hint"
        data-test="orca-empty"
      >
        {{ $t('ai.orcaNoModels') }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import i18next from 'i18next'
import orcaLogo from '../../../../../../resources/icon/orcarouter.png'
import { useOrcaConnect } from './useOrcaConnect'
// Pure, dependency-free module: the same capability rules the catalog tests
// cover, so the selector cannot drift from the tested behaviour.
import {
  isModelSelectable,
  type OrcaModel as OrcaCatalogModel
} from '../../../../../../src/main/orcarouter/catalog'

/**
 * The credential never reaches this process: every call below is an IPC round
 * trip to the main process, which owns the key and the model catalog.
 */
interface OrcaStatus {
  status: 'none' | 'configured' | 'needsReauth'
  source?: 'apiKey' | 'pkce'
  accountId?: string
  scope?: string
  generation: number
  maskedKey?: string
}

interface OrcaConfig {
  authBase: string
  apiBase: string
  appName: string
  consoleUrl: string
  secretEncrypted: boolean
}

/** The catalog model shape, as the panel receives it over IPC. */
type OrcaModel = OrcaCatalogModel

interface CatalogResponse {
  ok: boolean
  models?: OrcaModel[]
  source?: 'live' | 'cache' | 'seed'
  degraded?: boolean
  reason?: string
  itemCount?: number
  error?: { message: string; code: string }
}

/** Translate outside a template, matching how the rest of the renderer does it. */
const t = (key: string, options?: Record<string, unknown>): string =>
  i18next.t(key, options as never) as unknown as string

const config = ref<OrcaConfig>({
  authBase: 'https://www.orcarouter.ai',
  apiBase: 'https://api.orcarouter.ai',
  appName: 'EcuBus-Pro',
  consoleUrl: 'https://www.orcarouter.ai/console/authorized-apps',
  secretEncrypted: true
})
const status = ref<OrcaStatus>({ status: 'none', generation: 0 })
const models = ref<OrcaModel[]>([])
const degraded = ref(false)
const degradedReason = ref('')
const selectedModel = ref<string | undefined>(undefined)
const attachImage = ref(false)
const loadingModels = ref(false)
const savingKey = ref(false)
const sending = ref(false)
const response = ref('')
const errorMessage = ref('')
const apiKeyDraft = ref('')
const prompt = ref('')

const sourceLabel = computed(() =>
  status.value.source === 'pkce' ? t('ai.orcaAuthMethodPkce') : t('ai.orcaAuthMethodApiKey')
)
const modelPlaceholder = computed(() => {
  if (status.value.status === 'needsReauth') return t('ai.orcaNeedsReauthShort')
  if (status.value.status !== 'configured') return t('ai.orcaConfigureFirst')
  return loadingModels.value ? t('ai.orcaLoadingModels') : t('ai.orcaSelectModel')
})

const orca = () => (window as any).orca

function formatContext(value: number): string {
  return value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)
}

async function loadModels(force = false): Promise<void> {
  const api = orca()
  if (!api) return
  loadingModels.value = true
  errorMessage.value = ''
  try {
    const result: CatalogResponse = await api.listModels({
      capability: 'chat',
      modality: attachImage.value ? 'image' : 'text',
      force
    })
    if (!result.ok) {
      errorMessage.value = result.error?.message ?? t('ai.orcaCatalogFailed')
      return
    }
    models.value = result.models ?? []
    degraded.value = result.degraded === true
    degradedReason.value = result.reason ?? ''
    // A model that is no longer offered for the current capability/modality is
    // cleared rather than silently kept, so an incompatible value cannot be sent.
    // `isModelSelectable` is the same predicate the catalog filter tests cover.
    if (!isModelSelectable(models.value, selectedModel.value)) {
      selectedModel.value = undefined
    }
  } finally {
    loadingModels.value = false
  }
}

async function refreshStatus(): Promise<void> {
  const api = orca()
  if (!api) return
  status.value = await api.getStatus()
}

async function saveApiKey(): Promise<void> {
  const api = orca()
  if (!api || savingKey.value) return
  savingKey.value = true
  errorMessage.value = ''
  try {
    const result = await api.setApiKey(apiKeyDraft.value)
    if (!result.ok) {
      errorMessage.value = result.error?.message ?? t('ai.orcaKeyRejected')
      return
    }
    // Clear the draft immediately: the main process now owns the key.
    apiKeyDraft.value = ''
    status.value = result.status
    await loadModels(true)
  } finally {
    savingKey.value = false
  }
}

async function clearCredential(): Promise<void> {
  const api = orca()
  if (!api) return
  const result = await api.logout()
  if (result?.ok) status.value = result.status
  selectedModel.value = undefined
  models.value = []
  degraded.value = false
  response.value = ''
}

// The connect lifecycle (monotonic attempt id, cancel, pagehide, unmount) lives
// in its own module so those async paths are unit tested directly.
const connect = useOrcaConnect({
  bridge: () => orca(),
  onStatus: (next) => {
    status.value = next as OrcaStatus
  },
  onConnected: () => loadModels(true),
  onError: (message) => {
    errorMessage.value = message
  },
  onUnmounted: () => {
    orca()?.offStatusChanged?.(onStatusChanged)
  }
})
const authorizeUrl = connect.authorizeUrl
const connectBusy = connect.busy

async function startConnect(): Promise<void> {
  await connect.start()
}

async function cancelConnect(): Promise<void> {
  await connect.cancel()
}

function onStatusChanged(event: unknown, payload: OrcaStatus): void {
  if (payload) status.value = payload
}

onMounted(async () => {
  const api = orca()
  if (!api) return
  config.value = { ...config.value, ...(await api.getConfig()) }
  await refreshStatus()
  if (status.value.status === 'configured') await loadModels()
  window.addEventListener('pagehide', connect.handlePageHide)
  api.onStatusChanged?.(onStatusChanged)
})

onUnmounted(() => {
  window.removeEventListener('pagehide', connect.handlePageHide)
  // A real unmount cancels the server task without writing UI state.
  connect.handleUnmount()
})

// Recompute the selector whenever the request shape changes.
watch(attachImage, () => {
  void loadModels(true)
})

async function send(): Promise<void> {
  const api = orca()
  if (!api || !selectedModel.value || sending.value) return
  sending.value = true
  errorMessage.value = ''
  response.value = ''
  try {
    const text = attachImage.value
      ? `${prompt.value}\n\n[image attachment placeholder]`
      : prompt.value
    const result = await api.chat({
      model: selectedModel.value,
      messages: [{ role: 'user', content: text }]
    })
    if (!result.ok) {
      errorMessage.value = result.error?.message ?? t('ai.orcaRequestFailed')
      return
    }
    response.value = result.result?.content ?? ''
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.orca-provider {
  --orca-model-select-width: 360px;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.orca-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.orca-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex: 0 0 auto;
}

.orca-heading h3 {
  margin: 0;
  font-size: 16px;
}

.orca-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.orca-degraded-tag {
  margin-left: auto;
}

.orca-auth {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.orca-auth-card {
  flex: 1 1 320px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.orca-auth-title {
  margin: 0;
  font-size: 14px;
}

.orca-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.orca-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.orca-authorize {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.orca-status {
  margin: 0;
  font-size: 13px;
}

.orca-masked {
  font-family: monospace;
}

.orca-inference {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

.orca-inference-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.orca-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
}

.orca-label {
  font-size: 13px;
}

.orca-model-select {
  width: var(--orca-model-select-width);
}

/*
 * Keep a long `vendor/model` id from stretching the dropdown past the trigger:
 * the panel takes the select's width, and the id truncates instead.
 */
.orca-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.orca-option-id {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orca-option-meta {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.orca-response {
  margin: 0;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  max-height: 240px;
  overflow: auto;
}
</style>

<style>
/*
 * The model dropdown is teleported to <body>, so it cannot be scoped to this
 * component. It is sized to the select itself: Element Plus otherwise lets a
 * long `vendor/model` id widen the panel past its trigger.
 */
.el-select__popper.orca-model-popper {
  width: 358px; /* +2px border = the 360px select */
}
</style>
