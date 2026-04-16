import { SomeipMessageRequest, SomeipMessageResponse, output, someipNotify } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  console.log('received', msg)
  if (msg instanceof SomeipMessageRequest) {
    const response = SomeipMessageResponse.fromSomeipRequest(msg, Buffer.from('ecbbus-pro someip'))
    await output(response)
  }
})

Util.Init(() => {
  setInterval(() => {
    console.log('send notify')
    void someipNotify({
      service: 0x1234,
      instance: 0x1111,
      eventId: 0x8777,
      payload: Buffer.from('ecbbus-pro someip')
    }).catch((e) => {
      console.error('notify failed', e)
    })
  }, 1000)
})
