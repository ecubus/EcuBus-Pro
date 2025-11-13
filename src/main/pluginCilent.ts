// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool, { Pool } from 'workerpool'
import { PluginLOG } from './log'
import path from 'path'
import { error, log } from 'electron-log'
import { NodeClass } from './nodeItem'

export default class PluginClient {
  nodeItem: NodeClass
  worker: any
  selfStop = false
  log: PluginLOG

  constructor(
    public name: string,
    private id: string,
    jsFilePath: string,
    nodeItem?: NodeClass
  ) {
    this.log = new PluginLOG(this.id)
    if (nodeItem) {
      this.nodeItem = nodeItem
    } else {
      const pluginPath = path.dirname(jsFilePath)
      this.nodeItem = new NodeClass(
        {
          id: this.id,
          name: this.name,
          channel: [],
          script: jsFilePath
        },
        pluginPath,
        name
      )
      this.nodeItem.pool?.registerHandler('pluginEvent', this.eventHandler.bind(this))
    }
  }

  eventHandler(payload: { name: string; data: any }) {
    const name = payload.name
    const data = payload.data
    this.log.pluginEvent(name, data)
  }

  async exec(method: string, ...params: any[]): Promise<any> {
    return this.nodeItem.pool?.exec('plugin', method, params)
  }
  stop() {
    this.nodeItem.pool?.clearHandlers()
    this.nodeItem.pool?.registerHandler('pluginEvent', this.eventHandler.bind(this))
    this.nodeItem.pool?.stopEmit()
  }
  close() {
    this.log.close()
    this.nodeItem.close()
  }
}
