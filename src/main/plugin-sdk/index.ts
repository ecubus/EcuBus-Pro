// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool from 'workerpool'

export function registerService(name: string, func: any) {
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
