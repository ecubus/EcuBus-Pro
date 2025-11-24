<template>
  <div class="mainWindow">
    <el-row style="margin: 20px">
      <el-col :span="6">
        <el-button
          v-if="hasUpdate == false"
          type="info"
          plain
          style="width: 100%"
          @click="checkUpdate"
        >
          {{ $t('homeUpdate.check') }}
        </el-button>
        <el-button
          v-if="hasUpdate == true && started == false"
          type="success"
          plain
          style="width: 100%"
          @click="startUpdate"
        >
          {{ $t('homeUpdate.start') }}
        </el-button>
        <el-button
          v-if="started == true && downloaded == false"
          type="danger"
          plain
          style="width: 100%"
          @click="cancelUpdate"
        >
          {{ $t('homeUpdate.cancel') }}
        </el-button>
        <el-button
          v-if="hasUpdate == true && downloaded == true"
          type="primary"
          plain
          style="width: 100%"
          @click="installUpdate"
        >
          {{ $t('homeUpdate.install') }}
        </el-button>
      </el-col>
      <el-col :span="16" :offset="2">
        <el-progress
          v-if="started"
          :percentage="percent"
          :status="downloaded ? 'success' : ''"
          style="margin-top: 10px"
        />
      </el-col>
    </el-row>

    <el-divider content-position="left">
      <el-tag v-if="updateInfo == undefined || updateInfo?.version == version" type="info">
        {{ version }}
      </el-tag>
      <el-tag v-else type="success"> {{ version }} -> {{ updateInfo?.version }} </el-tag>
    </el-divider>
    <div id="release_note">
      <div v-if="doc != ''" style="text-align: left; margin: 20px; color: #303133">
        <div class="readme" v-html="doc" />
      </div>
      <div v-else>
        <el-skeleton :rows="5" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, inject, Ref, onMounted, onUnmounted, toRef } from 'vue'
import { ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater'
import { version } from '../../../../../package.json'
import { ElMessage } from 'element-plus'
import { marked, MarkedExtension } from 'marked'
import './readme.css'
import { i18next } from '@r/i18n'

function addLocalBaseUrl() {
  // extension code here
  const reIsAbsolute = /[\w+\-+]+:\/\//
  return {
    walkTokens: (token: any) => {
      // Markdown links/images
      if (['link', 'image'].includes(token.type)) {
        const tempToken = token
        if (reIsAbsolute.test(tempToken.href)) {
          return
        }
        if (tempToken.href.startsWith('http')) {
          return
        }
        tempToken.href = 'https://ecubus.oss-cn-chengdu.aliyuncs.com/app/' + tempToken.href
        return
      }
      // Raw HTML <img> tags inside markdown
      if (token.type === 'html' && typeof token.text === 'string') {
        const html: string = token.text
        const replaced = html.replace(
          /<img\s+([^>]*?)src=("|')([^"']+)(\2)([^>]*)>/gi,
          (_m, pre, q, src, _q2, post) => {
            if (reIsAbsolute.test(src) || /^data:/i.test(src)) {
              return `<img ${pre}src=${q}${src}${q}${post}>`
            }
            if (src.startsWith('http')) {
              return `<img ${pre}src=${q}${src}${q}${post}>`
            }
            const newSrc = 'https://ecubus.oss-cn-chengdu.aliyuncs.com/app/' + src
            return `<img ${pre}src=${q}${newSrc}${q}${post}>`
          }
        )
        token.text = replaced
      }
    }
  } as MarkedExtension
}

const hasUpdate = defineModel({
  required: true,
  type: Boolean
})
// eslint-disable-next-line vue/no-dupe-keys
const updateInfo = ref<UpdateInfo>()
const started = ref(false)
const downloaded = ref(false)
const percent = ref(0)
const doc = ref('')
const props = defineProps<{
  height: number
}>()
const mainH = toRef(props, 'height')

onMounted(() => {
  document.getElementById('release_note')?.addEventListener('click', (e) => {
    //if e is <a> tag

    if ((e.target as HTMLElement).tagName == 'A') {
      e.preventDefault()
      //get href
      const href = (e.target as HTMLElement).getAttribute('href')

      window.electron.ipcRenderer.send('ipc-open-link', href)
    }
  })
  marked.use(addLocalBaseUrl())
  window.electron.ipcRenderer.on('ipc-update-available', (event, info: UpdateInfo) => {
    /* open dialog when a new verison available */

    hasUpdate.value = true
    updateInfo.value = info
  })
  window.electron.ipcRenderer.on('ipc-update-not-available', (event, info: UpdateInfo) => {
    hasUpdate.value = false
    updateInfo.value = info
    // ElMessage({
    //   message: `You are using the newest version`,
    //   type: 'success',
    // })
  })
  window.electron.ipcRenderer.on('ipc-update-error', (event, err: Error) => {
    // ElMessage.error(err.message)
    null
  })
  window.electron.ipcRenderer.on('ipc-update-download-progress', (event, per: ProgressInfo) => {
    percent.value = Math.round(per.percent)
  })
  window.electron.ipcRenderer.on('ipc-update-downloaded', (event, err: UpdateDownloadedEvent) => {
    ElMessage({
      message: i18next.t('homeUpdate.downloadOk'),
      type: 'success'
    })
    downloaded.value = true
    percent.value = 100
  })
  checkUpdate()
  window.electron.ipcRenderer
    .invoke('ipc-update-releases-note')
    .then((html: string) => {
      doc.value = marked.parse(html) as any
    })
    .catch((err: Error) => {
      null
    })
})
onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('ipc-update-available')
  window.electron.ipcRenderer.removeAllListeners('ipc-update-not-available')
  window.electron.ipcRenderer.removeAllListeners('ipc-update-error')
  window.electron.ipcRenderer.removeAllListeners('ipc-update-download-progress')
  window.electron.ipcRenderer.removeAllListeners('ipc-update-downloaded')
  window.electron.ipcRenderer.send('ipc-stop-update')
})

function checkUpdate() {
  //fix it
  hasUpdate.value = false
  window.electron.ipcRenderer.send('ipc-check-update')
}
function startUpdate() {
  window.electron.ipcRenderer.send('ipc-start-update')
  started.value = true
  downloaded.value = false
}
function installUpdate() {
  window.electron.ipcRenderer.send('ipc-install-update')
}
function cancelUpdate() {
  started.value = false
  downloaded.value = false
  window.electron.ipcRenderer.send('ipc-stop-update')
}
</script>

<style scoped>
.mainWindow {
  /* height: v-bind(mainH-250+'px') !important; */
  /* height: 500px; */
  /* background-color: var(--el-color-primary-light-9); */
  border-radius: 4px;
  overflow: auto;
}
.readme {
  height: v-bind(mainH-210 + 'px') !important;
  overflow-y: auto;
  /* background-color: red; */
}
</style>
