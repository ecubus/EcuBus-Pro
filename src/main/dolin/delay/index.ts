import delay from '../build/Release/delay.node'
import { v4 } from 'uuid'

export default class Delay {
  private id: string
  constructor() {
    this.id = v4()
  }
  delay(ms: number) {
    return new Promise<void>((resolve) => {
      const cb = () => {
        resolve()
      }

      delay.startDelay(ms, this.id, cb)
    })
  }
  close() {
    delay.cancelDelay(this.id)
  }
  timeout(cb: () => void, ms: number) {
    delay.startDelay(ms, this.id, cb)
  }
}

