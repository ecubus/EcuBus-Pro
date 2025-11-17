import { setVar } from 'ECB'

let t1: number | undefined
Util.OnCan(1, (msg) => {
  const t = msg.ts
  if (!t1) {
    t1 = t
  } else {
    const diff = (t - t1) / 1000
    setVar('DIFF', diff)
    t1 = t
  }
})
