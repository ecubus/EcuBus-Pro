import { SomeipMessageRequest, SomeipMessageResponse, output } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  if (msg instanceof SomeipMessageRequest) {
    console.log('received request', msg.msg)
    const response = SomeipMessageResponse.fromSomeipRequest(msg, Buffer.from('ecbbus-pro someip'))
    await output(response)
  }
})
