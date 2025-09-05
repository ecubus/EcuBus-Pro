// stores/counter.js
import { defineStore } from 'pinia'
import { cloneDeep } from 'lodash'
import { ElMessageBox } from 'element-plus'
import { useProjectStore } from './project'
import { DataSet } from 'src/preload/data'
import { useGlobalStart } from './runtime'
import { nextTick } from 'vue'
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
      can: {}
    },
    graphs: {},
    guages: {},
    vars: {},
    datas: {},
    panels: {},
    logs: {}
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
          window.electron.ipcRenderer
            .invoke('ipc-global-start', cloneDeep(project.projectInfo), cloneDeep(this.getData()))
            .then(() => {
              window.startTime = Date.now()
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
        logs: this.logs
      }
    }
  }
})
