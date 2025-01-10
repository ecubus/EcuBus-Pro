// stores/counter.js
import { Action, ElMessage, ElMessageBox } from 'element-plus'
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { sortBy, toPairs, fromPairs, cloneDeep, assign } from 'lodash'
import { error,info} from 'electron-log'



export interface ProjectInfo {
  name: string
  path: string
}

export interface Project {
  displayName?: string,
  desc?: string,
  wins:Record<string,{
    pos:{x:number,y:number,w:number,h:number}
    backupPos?:{x:number,y:number,w:number,h:number}
    title:string,
    label:string,
    id:string,

    options: {
      name?: string
      params: Record<string, string>
    }
    isMax?:boolean
    hide?:boolean
   
  }>
  example?:{
    catalog:string,
  }
}

export interface ProjectList {
  name: string
  path: string
  pined?: boolean
  lastOpenTime: number
}
export interface State {
  open: boolean
  projectInfo: ProjectInfo
  projectDirty: boolean
  project: Project
}

export const useProjectList = defineStore('projectList', {
  state: () => {
    return {
      projectList: window.store.get('projectList') as ProjectList[] || []
    }
  },
  actions: {
    pinProject(item: ProjectList) {
      const eitem = this.projectList.find((v) => v.path == item.path && v.name == item.name)
      if (eitem) {
        const index = this.projectList.indexOf(eitem)
        this.projectList[index].pined = !this.projectList[index].pined
        window.store.set('projectList', cloneDeep(this.projectList))
      }
    },
    deleteProject(item: ProjectList) {
      const eitem = this.projectList.find((v) => v.path == item.path && v.name == item.name)
      if (eitem) {
        const index = this.projectList.indexOf(eitem)
        this.projectList.splice(index, 1)
        window.store.set('projectList', cloneDeep(this.projectList))
      }
    },
  }
})
const historyLimit=window.store.get('historyLimit') as number||20
function printNestedKeys(obj:any, prefix = '') {
  for (const key in obj) {
    // 构建当前key的完整路径
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    // 打印当前key的路径
    info(currentPath);
    
    // 如果当前值是对象且不是null，则递归处理
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      printNestedKeys(obj[key], currentPath);
    }
  }
}
export const useProjectStore = defineStore('project', {
  state: (): State => ({
    projectDirty: false,
    open: false,
    projectInfo: {
      name: 'Untitled',
      path: '',
    },
    project: {
      wins: {}
    },
  }),
  // could also be defined as
  // state: () => ({ count: 0 })
  actions: {
    async createNewProject() {
      const val = await this.closeProject()
      if (val) {
        const data = useDataStore()
        data.$reset()
        this.open = true
        this.projectDirty = true
        this.router.push('/uds')
      }
    },
    async createExampleProject(example: string) {
      const val = await this.closeProject()
      if (val) {
        const r = await window.electron.ipcRenderer.invoke('ipc-fs-readFile', example)
        try {
          const rdata = JSON.parse(r)
          const data = useDataStore()
          data.$patch((ss) => {
            assign(ss,rdata.data)
          })
          this.project = rdata.project
          const info=window.path.parse(example)
          this.projectInfo.name = info.base
          this.projectInfo.path = info.dir
          this.open = true
          this.projectDirty = false
          await this.saveProject()
          this.router.push('/uds')
        } catch (e) {
          ElMessage.error(`${example} is not a valid project file`)
        }
      }
    },
    async openProject() {

      {
        const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
          title: 'Open Project', properties: ['openFile '], filters: [
            { name: 'EcuBus-Pro', extensions: ['ecb'] },
          ]

        })
        const file = r.filePaths[0]
        if (file == undefined) {
          return
        }
        if (this.open) {
          await this.closeProject(file)
        }
        await this.openProjectByPath(file, true)
      }
    },
    async openProjectByPath(file: string, skipClose = false) {
      if (!skipClose) {
        skipClose = await this.closeProject(file)
      }
      if (skipClose) {
        window.electron.ipcRenderer.invoke('ipc-fs-readFile', file).then((r) => {
          try {
            const rdata = JSON.parse(r)
            const parse = window.path.parse(file)

            this.projectInfo.name = parse.base
            this.projectInfo.path = parse.dir
            const data = useDataStore()

            data.$patch((ss) => {
              assign(ss,rdata.data)
            })
            this.project = rdata.project
            this.open = true

            this.router.push('/uds')
          } catch (e) {
            ElMessage.error(`${file} is not a valid project file`)
          }
        }).catch((e) => {
          error(e)
          ElMessage.error(`Failed to open project ${file}`)
        })
      }
    },
    async saveProject() {

      if (this.open) {
        if (this.projectInfo.path == '') {
          const res = await window.electron.ipcRenderer.invoke('ipc-show-save-dialog', {
            title: 'Save Project',
            defaultPath: 'Config.ecb',
            filters: [{ name: 'EcuBus-Pro', extensions: ['ecb'] }]
          })
          if (res.canceled || res.filePath == undefined) {
            return
          }
          const parse = window.path.parse(res.filePath)

          this.projectInfo.path = parse.dir
          this.projectInfo.name = parse.base
        }
        const projectData = useDataStore()
        
        const data = cloneDeep({
          project: this.project,
          data: projectData.getData()
        })
       
        //sort
        const sortedPairsProject = sortBy(toPairs(data), 0)
        const sortedData = fromPairs(sortedPairsProject)

        const fullPath = window.path.join(this.projectInfo.path, this.projectInfo.name)
        // printNestedKeys(sortedData)
        await window.electron.ipcRenderer.invoke('ipc-fs-writeFile', fullPath, JSON.stringify(sortedData, null, 2))

        this.projectDirty = false
        //update projectList
        //if file exist
        const projectList = useProjectList()
        const exist = projectList.projectList.find((v) => v.path == this.projectInfo.path && v.name == this.projectInfo.name)
        let pined
        if (exist) {
          //remove and reinsert
          pined = exist.pined
          const index = projectList.projectList.indexOf(exist)
          projectList.projectList.splice(index, 1)
        }
        //put it first
        projectList.projectList.unshift({
          name: this.projectInfo.name,
          path: this.projectInfo.path,
          pined: pined,
          lastOpenTime: Date.now()
        })
        
        if(projectList.projectList.length>historyLimit){
          projectList.projectList.pop()
        }
        window.store.set('projectList', cloneDeep(projectList.projectList))
      }
    },
    async closeProject(filePath?: string): Promise<boolean> {
      return new Promise((resolve, reject) => {
        if (filePath && this.open && this.projectDirty) {
          if (window.path.normalize(window.path.join(this.projectInfo.path, this.projectInfo.name)) == window.path.normalize(filePath)) {
            resolve(true)
            return

          }
          //工程没有保存，关闭会丢失数据
          ElMessageBox.confirm('You have unsaved changes in the current project, do you want to save them?', 'Warning', {
            confirmButtonText: 'Save',
            cancelButtonText: 'Don\'t Save',
            type: 'warning',
            buttonSize: 'small',
            distinguishCancelAndClose: true
          }).then(() => {
            this.saveProject().then(() => {
              this.$reset()
              const data = useDataStore()
              data.$reset()
              resolve(true)
            }).catch((e) => {
              error('Save project failed', e)
              ElMessage.error('Save project failed')
              resolve(false)
            })
          }).catch((action: Action) => {
            if (action == 'cancel') {
              this.$reset()
              resolve(true)
            } else {
              resolve(false)
            }
          })
        } else {
          this.$reset()
          resolve(true)
        }

      })
    },

  }
})
