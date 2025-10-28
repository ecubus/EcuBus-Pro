// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool from 'workerpool'
import { workerData } from 'node:worker_threads'
import { DataSet } from 'src/preload/data'

type ServiceMap = {
  [key: string]: any
  start: (globalData: DataSet) => void
  stop: () => void
}

export function registerService<K extends keyof ServiceMap>(name: K, func: ServiceMap[K]) {
  workerpool.worker({
    [name]: func
  })
}

export function emitEvent(name: string, data: any) {
  workerpool.workerEmit({
    event: name,
    data: data
  })
}

export function getPluginPath() {
  return workerData.pluginPath
}
