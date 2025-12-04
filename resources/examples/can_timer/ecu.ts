import { setVars, setVar } from 'ECB'

let t1: number | undefined
let t2: number | undefined
let t3: number | undefined
let t4: number | undefined
Util.OnCan(1, (msg) => {
  const t = msg.ts
  if (t1 == undefined) {
    t1 = t
  } else {
    const diff = (t - t1) / 1000
    setVar('DIFF1', diff)
    t1 = t
  }
})

Util.OnCan(2, (msg) => {
  const t = msg.ts
  if (t2 == undefined) {
    t2 = t
  } else {
    const diff = (t - t2) / 1000
    setVars({
      DIFF2: diff
    })
    t2 = t
  }
})

Util.OnCan(3, (msg) => {
  const t = msg.ts
  if (t3 == undefined) {
    t3 = t
  } else {
    const diff = (t - t3) / 1000
    setVar('DIFF3', diff)
    t3 = t
  }
})

Util.OnCan(4, (msg) => {
  const t = msg.ts
  if (t4 == undefined) {
    t4 = t
  } else {
    const diff = (t - t4) / 1000
    setVar('DIFF4', diff)
    t4 = t
  }
})
