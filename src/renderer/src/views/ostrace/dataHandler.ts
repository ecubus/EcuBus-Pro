import { VisibleBlock } from 'nodeCan/osEvent'

const isWorker = typeof self !== 'undefined'
let globalData: VisibleBlock[] = []

const maxData = 100

if (isWorker) {
  self.onmessage = (event) => {
    const { method, data } = event.data as { method: string; data: VisibleBlock[] }
    switch (method) {
      case 'initData': {
        globalData = data

        break
      }
    }
  }
}
