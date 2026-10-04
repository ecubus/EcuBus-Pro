import { CAN_ID_TYPE, getVar, output, setVars } from 'ECB'

let busy = false
let received = 0

Util.OnCan(0x101, (message) => {
  if (message.data.length < 2) return
  const target = message.data.readUInt16LE(0) / 10
  setVars({ HtmlRxTarget: target, HtmlRxCount: ++received, HtmlLevel: target })
})

Util.Init(() => {
  setVars({
    HtmlLevel: getVar('HtmlLevel'),
    HtmlEnabled: getVar('HtmlEnabled'),
    HtmlRxTarget: 0,
    HtmlRxCount: 0
  })
  setInterval(async () => {
    if (busy) return
    busy = true
    try {
      const speed = Number(getVar('HtmlEnabled')) === 1 ? Number(getVar('HtmlLevel')) * 2 : 0
      const data = Buffer.alloc(8)
      data.writeUInt16LE(Math.round(speed * 10), 0)
      await output({
        id: 0x100,
        data,
        dir: 'OUT',
        device: 'HTML_ECU',
        database: 'html-demo-db',
        name: 'Status',
        msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false }
      })
    } catch (error) {
      console.error(error)
    } finally {
      busy = false
    }
  }, 100)
})
