import { SomeipMessageEvent, output } from 'ECB'

Util.OnSomeipMessage('1234.*.*', async (msg) => {
  if (msg instanceof SomeipMessageEvent) {
    console.log('event received', msg)
  }
})
