import { SomeipMessageRequest, SomeipMessageResponse, output, someipNotify } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  if (msg instanceof SomeipMessageRequest) {
    console.log('received request', msg.msg)
    const response = SomeipMessageResponse.fromSomeipRequest(msg, Buffer.from('ecbbus-pro someip'))
    await output(response)
  }
})

Util.Init(() => {
  setInterval(() => {
    console.log('send notify')
    someipNotify({
      service: 0x1234,
      instance: 0x1111,
      eventId: 0x8777,
      payload: Buffer.from('ecbbus-pro someip')
    })
  }, 1000)
})
