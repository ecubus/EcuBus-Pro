// stores/counter.js
import { defineStore } from 'pinia'
import { cloneDeep } from 'lodash'
import { ElMessageBox } from 'element-plus'
import { useProjectStore } from './project'
import { DataSet } from 'src/preload/data'
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
    tests: {}
  }),
  actions: {
    globalRun(type: 'start' | 'stop') {
      if (type == 'start' && window.globalStart.value == false) {
        window.globalStart.value = true

        const project = useProjectStore()
        window.dataParseWorker.postMessage({
          method: 'initDataBase',
          data: cloneDeep(this.database)
        })
        window.electron.ipcRenderer
          .invoke(
            'ipc-global-start',
            cloneDeep(project.projectInfo),
            cloneDeep(this.devices),
            cloneDeep(this.tester),
            cloneDeep(this.nodes),
            cloneDeep(this.database)
          )
          .then(() => {
            window.startTime = Date.now()
          })
          .catch((e: any) => {
            window.globalStart.value = false
            window.startTime = Date.now()
          })
      }
      if (type == 'stop' && window.globalStart.value == true) {
        window.electron.ipcRenderer.invoke('ipc-global-stop').finally(() => {
          window.globalStart.value = false
        })
        // globalStart.value = false
      }
    },
    getData() {
      return {
        devices: this.devices,
        ia: this.ia,
        tester: this.tester,
        subFunction: this.subFunction,
        nodes: this.nodes,
        database: this.database,
        graphs: this.graphs,
        tests: this.tests
      }
    }
  }
})
