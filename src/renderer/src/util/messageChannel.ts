const portMap = new Map<string, MessagePort>()

export function getPort(channel: string): Promise<MessagePort> {
  return new Promise((resolve, reject) => {
    const port = portMap.get(channel)
    if (port) {
      resolve(port)
      return
    }
    window.electron.ipcRenderer.once(channel, (event) => {
      const receivedPort = event.ports?.[0]
      if (!receivedPort) {
        reject(new Error('No port received'))
      }
      resolve(receivedPort)
    })
  })
}
