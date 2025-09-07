import { SomeipMessageRequest, SomeipMessageResponse, output } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  console.log(msg)
  if (msg instanceof SomeipMessageRequest) {
    const response = SomeipMessageResponse.fromSomeipRequest(msg)
    await output(response)
  }
})
