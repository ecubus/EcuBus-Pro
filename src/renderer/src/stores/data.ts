// stores/counter.js
import { defineStore } from 'pinia'
import { cloneDeep, result } from 'lodash'
import { ElLoading, ElMessageBox, ElProgress } from 'element-plus'
import { useProjectStore } from './project'
import { DataSet, NodeItem } from 'src/preload/data'
import { useGlobalStart } from './runtime'
import { nextTick, h, ref } from 'vue'
import i18next from 'i18next'

export type { DataSet }

export const useDataStore = defineStore('useDataStore', {
  state: (): DataSet => ({
    devices: {},
    ia: {},
    tester: {},
    subFunction: {},
    nodes: {},
    database: {
      lin: {},
      can: {},
      orti: {}
    },
    graphs: {},
    guages: {},
    vars: {},
    datas: {},
    panels: {},
    logs: {},
    traces: {},
    pluginData: {},
    replays: {}
  }),
  actions: {
    globalRun(type: 'start' | 'stop') {
      const globalStart = useGlobalStart()
      if (type == 'start' && globalStart.value == false) {
        globalStart.value = true

        const project = useProjectStore()
        window.dataParseWorker.postMessage({
          method: 'initDataBase',
          data: cloneDeep(this.database)
        })
        nextTick(() => {
          const nodes = Object.values(this.nodes).filter((e) => !e.isTest)

          const checkScriptStatus = async () => {
            const needBuild: NodeItem[] = []
            for (const node of nodes) {
              if (node.script) {
                const status = await window.electron.ipcRenderer.invoke(
                  'ipc-get-build-status',
                  project.projectInfo.path,
                  project.projectInfo.name,
                  node.script
                )
                if (status != 'success') {
                  needBuild.push(node)
                }
              }
            }
            if (needBuild.length > 0) {
              const totalScripts = needBuild.length
              const process = ref(0)

              // Create a reactive component for the progress dialog
              const ProgressComponent = {
                setup() {
                  return () =>
                    h(
                      'div',
                      {
                        style: 'width: 400px;'
                      },
                      [
                        h(ElProgress, {
                          percentage: process.value,
                          status: process.value === 100 ? 'success' : undefined,
                          strokeWidth: 13
                        })
                      ]
                    )
                }
              }

              ElMessageBox({
                title: i18next.t('runtime.dialog.buildingScripts'),
                message: h(ProgressComponent),
                buttonSize: 'small',
                showCancelButton: false,
                showConfirmButton: false,
                showClose: false,
                closeOnClickModal: false,
                closeOnPressEscape: false
              })
              let hasError = false
              for (const node of needBuild) {
                try {
                  await window.electron.ipcRenderer.invoke(
                    'ipc-build-project',
                    project.projectInfo.path,
                    project.projectInfo.name,
                    cloneDeep(this.getData()),
                    node.script,
                    false
                  )
                } catch (e: any) {
                  hasError = true
                }
                process.value += Math.round(100 / totalScripts)
                // Force update the dialog content
                await nextTick()
              }
              process.value = 100

              const delay = new Promise((resolve) => setTimeout(resolve, 500))
              await delay
              ElMessageBox.close()

              if (hasError) {
                throw new Error(i18next.t('runtime.messages.buildScriptsFailed'))
              }
            }
          }

          checkScriptStatus()
            .then(() => {
              const loading = ElLoading.service({
                lock: true,
                text: i18next.t('runtime.messages.loading'),
                background: 'rgba(0, 0, 0, 0.7)'
              })
              window.electron.ipcRenderer
                .invoke(
                  'ipc-global-start',
                  cloneDeep(project.projectInfo),
                  cloneDeep(this.getData())
                )
                .then(() => {
                  window.startTime = Date.now()
                })
                .catch((e: any) => {
                  globalStart.value = false
                  window.startTime = Date.now()
                })
                .finally(() => {
                  loading.close()
                })
            })
            .catch((e: any) => {
              globalStart.value = false
              window.startTime = Date.now()
            })
        })
      }
      if (type == 'stop' && globalStart.value == true) {
        window.electron.ipcRenderer.invoke('ipc-global-stop').finally(() => {
          globalStart.value = false
        })
        // globalStart.value = false
      }
    },
    getData(): DataSet {
      return {
        devices: this.devices,
        ia: this.ia,
        tester: this.tester,
        subFunction: this.subFunction,
        nodes: this.nodes,
        database: this.database,
        graphs: this.graphs,
        guages: this.guages,
        vars: this.vars,
        datas: this.datas,
        panels: this.panels,
        logs: this.logs,
        traces: this.traces,
        pluginData: this.pluginData,
        replays: this.replays
      }
    }
  }
})
