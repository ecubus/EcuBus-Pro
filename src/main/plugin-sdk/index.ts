// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool from 'workerpool'
import { workerData, isMainThread } from 'worker_threads'
import { DataSet } from 'src/preload/data'

// Re-export all worker capabilities
export * from '../worker'

type ServiceMap = {
  [key: string]: any
  start: (globalData: DataSet) => void
  stop: () => void
}

export function registerService<K extends keyof ServiceMap>(name: K, func: ServiceMap[K]) {
  if (!isMainThread) {
    workerpool.worker({
      [`plugin.${name}`]: func
    })
  } else {
    exports[name] = func
  }
}

export function emitEvent(name: string, data: any) {
  if (!isMainThread) {
    workerpool.workerEmit({
      event: name,
      data: data
    })
  }
}

export function getPluginPath(): string {
  return workerData?.pluginPath || ''
}
