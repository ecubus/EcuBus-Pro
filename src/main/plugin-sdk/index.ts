// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import { workerData, isMainThread } from 'worker_threads'
import { DataSet } from 'src/preload/data'
import { registerWorker, workerEmit } from '../worker/uds'

// Re-export all worker capabilities
export * from '../worker/uds'
export * from '../worker/crc'
export * from '../worker/cryptoExt'
export * from '../worker/utli'

type ServiceMap = {
  [key: string]: any
  start: (globalData: DataSet) => void
  stop: () => void
}

export function registerService<K extends keyof ServiceMap>(name: K, func: ServiceMap[K]) {
  if (!isMainThread) {
    registerWorker({
      [`plugin.${name}`]: func
    })
  } else {
    exports[name] = func
  }
}

export function emitEvent(name: string, data: any) {
  if (!isMainThread) {
    workerEmit({
      event: 'pluginEvent',
      data: {
        name,
        data
      }
    })
  }
}

export function getPluginPath(): string {
  return workerData?.pluginPath || ''
}
