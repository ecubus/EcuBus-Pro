<template>
  <div style="display: relative">
    <el-tabs v-model="activeName" style="width: 600px">
      <el-tab-pane :label="i18next.t('uds.network.replayConfig.tabs.general')" name="general">
        <div style="height: 270px; width: 560px; overflow-y: auto; padding-right: 10px">
          <el-form
            ref="ruleFormRef"
            :model="formData"
            label-width="100px"
            :rules="rules"
            size="small"
            :disabled="globalStart"
            hide-required-asterisk
          >
            <el-form-item
              :label="i18next.t('uds.network.replayConfig.labels.name')"
              prop="name"
              required
            >
              <el-input
                v-model="formData.name"
                :placeholder="i18next.t('uds.network.replayConfig.placeholders.name')"
              />
            </el-form-item>

            <el-form-item
              :label="i18next.t('uds.network.replayConfig.labels.replayEnable')"
              prop="disabled"
            >
              <el-switch
                v-model="formData.disabled"
                disabled
                :active-text="i18next.t('uds.network.replayConfig.options.disabled')"
                :inactive-text="i18next.t('uds.network.replayConfig.options.enabled')"
              />
            </el-form-item>

            <el-form-item
              :label="i18next.t('uds.network.replayConfig.labels.filePath')"
              prop="filePath"
            >
              <el-input
                v-model="formData.filePath"
                :placeholder="i18next.t('uds.network.replayConfig.placeholders.replayFilePath')"
              >
                <template #append>
                  <el-button size="small" @click="browseFile">{{
                    i18next.t('uds.network.replayConfig.buttons.browse')
                  }}</el-button>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item
              :label="i18next.t('uds.network.replayConfig.labels.format')"
              prop="format"
            >
              <el-select
                v-model="formData.format"
                :placeholder="i18next.t('uds.network.replayConfig.placeholders.format')"
              >
                <el-option
                  :label="i18next.t('uds.network.replayConfig.options.ascFormat')"
                  value="asc"
                />
                <el-option
                  :label="i18next.t('uds.network.replayConfig.options.blfFormat')"
                  value="blf"
                  disabled
                />
              </el-select>
            </el-form-item>

            <el-form-item :label="i18next.t('uds.network.replayConfig.labels.mode')" prop="mode">
              <el-select
                v-model="formData.mode"
                :placeholder="i18next.t('uds.network.replayConfig.placeholders.mode')"
              >
                <el-option
                  :label="i18next.t('uds.network.replayConfig.options.offlineMode')"
                  value="offline"
                />
                <el-option
                  :label="i18next.t('uds.network.replayConfig.options.onlineMode')"
                  value="online"
                  disabled
                />
              </el-select>
            </el-form-item>

            <el-form-item
              :label="i18next.t('uds.network.replayConfig.labels.speedFactor')"
              prop="speedFactor"
            >
              <el-input-number
                v-model="formData.speedFactor"
                :min="0"
                :max="100"
                :step="0.1"
                :precision="1"
              />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                {{ i18next.t('uds.network.replayConfig.hints.speedFactor') }}
              </span>
            </el-form-item>

            <el-form-item
              :label="i18next.t('uds.network.replayConfig.labels.repeatCount')"
              prop="repeatCount"
            >
              <el-input-number v-model="formData.repeatCount" :min="0" :max="9999" :step="1" />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                {{ i18next.t('uds.network.replayConfig.hints.repeatCount') }}
              </span>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="i18next.t('uds.network.replayConfig.tabs.connected')" name="Connected">
        <div
          style="
            text-align: center;
            padding-top: 10px;
            padding-bottom: 10px;
            width: 570px;
            height: 250px;
            overflow: auto;
          "
        >
          <el-transfer
            v-model="formData.channel"
            class="canit"
            style="text-align: left; display: inline-block"
            :data="allDeviceLabel"
            :titles="[
              i18next.t('uds.network.replayConfig.transfer.valid'),
              i18next.t('uds.network.replayConfig.transfer.assigned')
            ]"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="i18next.t('uds.network.replayConfig.tabs.channelMap')" name="ChannelMap">
        <div style="padding: 10px; width: 570px; height: 250px; overflow: auto">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 15px">
            <template #title>
              {{ i18next.t('uds.network.replayConfig.channelMap.hint') }}
            </template>
          </el-alert>

          <el-table :data="channelMapData" size="small" style="width: 100%">
            <el-table-column
              prop="logChannel"
              :label="i18next.t('uds.network.replayConfig.channelMap.logChannel')"
              width="140"
            >
              <template #default="{ row, $index }">
                <el-input-number
                  v-model="row.logChannel"
                  :min="1"
                  :controls="true"
                  :disabled="globalStart"
                  size="small"
                  style="width: 100%"
                  @change="onLogChannelChange($index, row)"
                />
              </template>
            </el-table-column>
            <el-table-column
              :label="i18next.t('uds.network.replayConfig.channelMap.arrow')"
              width="60"
              align="center"
            >
              <template #default>
                <Icon :icon="arrowIcon" />
              </template>
            </el-table-column>
            <el-table-column
              prop="deviceIds"
              :label="i18next.t('uds.network.replayConfig.channelMap.targetDevices')"
            >
              <template #default="{ row, $index }">
                <el-select
                  v-model="row.deviceIds"
                  :placeholder="i18next.t('uds.network.replayConfig.channelMap.selectDevices')"
                  size="small"
                  multiple
                  :disabled="globalStart"
                  collapse-tags
                  collapse-tags-tooltip
                  @change="updateChannelMap($index, row.logChannel, $event)"
                >
                  <el-option
                    v-for="device in assignedDevices"
                    :key="device.key"
                    :label="device.label"
                    :value="device.key"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column width="80" align="center">
              <template #header>
                <el-button size="small" type="primary" link @click="addChannelMapping">
                  <Icon :icon="addIcon" />
                </el-button>
              </template>
              <template #default="{ $index }">
                <el-button size="small" type="danger" link @click="removeChannelMapping($index)">
                  <Icon :icon="deleteIcon" />
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- Bottom buttons -->
    <div class="bottom-buttons">
      <div style="flex: 1"></div>
      <el-button size="small" @click="handleCancel">{{
        i18next.t('uds.network.replayConfig.buttons.cancel')
      }}</el-button>
      <el-button size="small" type="primary" :disabled="globalStart" @click="handleConfirm">{{
        i18next.t('uds.network.replayConfig.buttons.ok')
      }}</el-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, computed, toRef } from 'vue'
import { useDataStore } from '@r/stores/data'
import { useProjectStore } from '@r/stores/project'
import { ElMessageBox, FormInstance, FormRules } from 'element-plus'
import { cloneDeep } from 'lodash'
import { Replay, getCeilInstanceAs } from './udsView'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'
import { Icon } from '@iconify/vue'
import playIcon from '@iconify/icons-material-symbols/play-arrow-rounded'
import stopIcon from '@iconify/icons-material-symbols/stop-rounded'
import arrowIcon from '@iconify/icons-material-symbols/arrow-forward-rounded'
import addIcon from '@iconify/icons-material-symbols/add-rounded'
import deleteIcon from '@iconify/icons-material-symbols/delete-rounded'
import type { ReplayChannelMap } from 'src/preload/data'

const activeName = ref('general')
const props = defineProps<{
  editIndex: string
}>()
const globalStart = useGlobalStart()
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()
const formData = ref(cloneDeep(dataBase.replays[editIndex.value]))

// Set default values if not set
if (formData.value.speedFactor === undefined) {
  formData.value.speedFactor = 1
}
if (formData.value.repeatCount === undefined) {
  formData.value.repeatCount = 1
}
if (formData.value.mode === undefined) {
  formData.value.mode = 'offline'
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.replays)) {
      const hasName = dataBase.replays[key].name
      if (hasName == value && key != editIndex.value) {
        callback(new Error(i18next.t('uds.network.replayConfig.validation.replayNameExists')))
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.network.replayConfig.validation.inputReplayName')))
  }
}

const rules = computed(() => {
  const rules: FormRules = {
    name: [
      {
        required: true,
        trigger: 'blur',
        validator: nameCheck
      }
    ],
    filePath: [
      {
        required: true,
        message: i18next.t('uds.network.replayConfig.validation.inputReplayFilePath')
      }
    ]
  }
  return rules
})

const project = useProjectStore()

async function browseFile() {
  const formatExtensions: Record<string, string[]> = {
    asc: ['asc'],
    blf: ['blf'],
    trc: ['trc'],
    mf4: ['mf4']
  }

  const formatNames: Record<string, string> = {
    asc: i18next.t('uds.network.replayConfig.options.ascFormat'),
    blf: i18next.t('uds.network.replayConfig.options.blfFormat'),
    trc: i18next.t('uds.network.replayConfig.options.trcFormat'),
    mf4: i18next.t('uds.network.replayConfig.options.mf4Format')
  }

  const currentFormat = formData.value.format || 'asc'
  const extensions = formatExtensions[currentFormat] || ['*']
  const formatName =
    formatNames[currentFormat] || i18next.t('uds.network.replayConfig.dialog.replayFile')

  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: i18next.t('uds.network.replayConfig.dialog.selectReplayFile'),
    properties: ['openFile'],
    filters: [
      { name: formatName, extensions: extensions },
      {
        name: i18next.t('uds.network.replayConfig.dialog.allLogFiles'),
        extensions: ['asc', 'blf', 'trc', 'mf4']
      },
      { name: i18next.t('uds.network.replayConfig.dialog.allFiles'), extensions: ['*'] }
    ]
  })

  const file = r.filePaths[0]
  if (file) {
    if (project.projectInfo.path) {
      formData.value.filePath = window.path.relative(project.projectInfo.path, file)
    } else {
      formData.value.filePath = file
    }

    // Auto-detect format from file extension
    const ext = file.split('.').pop()?.toLowerCase()
    if (ext && ['asc', 'blf', 'trc', 'mf4'].includes(ext)) {
      formData.value.format = ext as 'asc' | 'blf' | 'trc' | 'mf4'
    }
  }
}

interface Option {
  key: string
  label: string
  disabled: boolean
}
const allDeviceLabel = computed(() => {
  const dd: Option[] = []
  for (const d of Object.keys(allDevices.value)) {
    const deviceDisabled = false
    dd.push({
      key: d,
      label: allDevices.value[d].name,
      disabled: globalStart.value || deviceDisabled
    })
  }
  return dd
})
const allDevices = computed(() => {
  const dd: Record<
    string,
    {
      name: string
    }
  > = {}
  for (const d in dataBase.devices) {
    if (dataBase.devices[d].type == 'can' && dataBase.devices[d].canDevice) {
      dd[d] = dataBase.devices[d].canDevice
    } else if (dataBase.devices[d].type == 'lin' && dataBase.devices[d].linDevice) {
      dd[d] = dataBase.devices[d].linDevice
    }
  }
  return dd
})

// Channel mapping - only show assigned devices
const assignedDevices = computed(() => {
  const dd: Option[] = []
  for (const deviceId of formData.value.channel) {
    if (allDevices.value[deviceId]) {
      dd.push({
        key: deviceId,
        label: allDevices.value[deviceId].name,
        disabled: false
      })
    }
  }
  return dd
})

// Channel map data for the table
const channelMapData = ref<ReplayChannelMap[]>([])

// Initialize channel map from formData
if (formData.value.channelMap && formData.value.channelMap.length > 0) {
  channelMapData.value = cloneDeep(formData.value.channelMap)
} else {
  // Default: add channel 1 mapping (logChannel must start from 1)
  channelMapData.value = [{ logChannel: 1, deviceIds: [] }]
}

// Add a new channel mapping row (logChannel starts from 1)
const addChannelMapping = () => {
  const existingChannels = channelMapData.value.map((m) => m.logChannel)
  let nextChannel = 1
  while (existingChannels.includes(nextChannel)) {
    nextChannel++
  }
  channelMapData.value.push({ logChannel: nextChannel, deviceIds: [] })
}

// Remove a channel mapping row
const removeChannelMapping = (index: number) => {
  channelMapData.value.splice(index, 1)
}

// Update channel mapping
const updateChannelMap = (index: number, logChannel: number, deviceIds: string[]) => {
  channelMapData.value[index] = { logChannel, deviceIds }
}

const onLogChannelChange = (index: number, row: ReplayChannelMap) => {
  updateChannelMap(index, row.logChannel, row.deviceIds)
}

const ruleFormRef = ref<FormInstance>()
// const isPlaying = ref(false)

// Get replay instance from global map
const getReplayCeil = (): Replay | undefined => {
  return getCeilInstanceAs<Replay>(editIndex.value)
}

// Initialize playing state from replay instance

const handleCancel = () => {
  ElMessageBox.close()
}

const handleConfirm = async () => {
  if (!ruleFormRef.value) return

  await ruleFormRef.value.validate((valid, fields) => {
    if (valid) {
      // Save channel map (filter out empty device mappings)
      formData.value.channelMap = channelMapData.value.filter((m) => m.deviceIds.length > 0)

      dataBase.replays[editIndex.value] = cloneDeep(formData.value)
      const ceil = getReplayCeil()
      if (ceil) {
        ceil.changeName(dataBase.replays[editIndex.value].name)
      }
      ElMessageBox.close()
    }
  })
}

onMounted(() => {
  // Initialize if needed
})
</script>
<style lang="scss">
.canit {
  --el-transfer-panel-body-height: 200px;
}
</style>
<style scoped>
.lr {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
}

.bottom-buttons {
  display: flex;
  align-items: center;
  margin-top: 10px;
  padding-right: 10px;
}
</style>
