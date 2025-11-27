import { CAN_ID_TYPE, CanMessage, outputCan } from 'ECB'
Util.Init(() => {
  //CAPL write
  // console.log("Hello World")
  setTimeout(() => {
    console.log('Hello World')
  }, 2000)

  let i = 1
  const timer = setInterval(() => {
    console.log(i++)
    if (i == 5) {
      clearInterval(timer)
    }
  }, 1000)
})

Util.OnKey('e', async () => {
  console.log('e pressed')
  const msg: CanMessage = {
    data: Buffer.from([1, 2, 3]),
    dir: 'OUT',
    id: 5,
    msgType: {
      brs: false,
      canfd: false,
      idType: CAN_ID_TYPE.STANDARD,
      remote: false
    },
    device: '',
    ts: 0
  }
  await outputCan(msg)
})
// let i=0;
// Util.OnKey('c', async () => {
//     const msg:CanMessage={
//         data: Buffer.from([1, 2, i++]),
//         dir: "OUT",
//         id: 5,
//         msgType: {
//             brs: false,
//             canfd: false,
//             idType:'STANDARD' as CAN_ID_TYPE,
//             remote: false,
//         },
//         device: '',
//         ts: 0
//     }
//     await outputCan(msg)
// });

Util.OnCan(0x1, (msg) => {
  console.log(msg)
})
