import { setVar } from 'ECB'
let timer: NodeJS.Timeout
Util.OnVar('Program.run', async (args) => {
  console.log('Program.run', args.value)
  if (args.value == 1) {
    setVar('Program.success', 1)
    setVar('Program.failed', 0)
    setVar('Program.msg', 'Starting program execution')
    // simulate failed test
    timer = setTimeout(async () => {
      console.log('Simulating program failure')
      setVar('Program.msg', 'Program failed after random time')
      setVar('Program.failed', 1)
      setVar('Program.success', 0)
      setVar('Program.run', 0)
    }, randomTime)
  } else {
    setVar('Program.msg', 'Manual stop of program execution')
    setVar('Program.success', 0)
    setVar('Program.failed', 0)
    clearTimeout(timer)
  }
})

//2s - 5s
const randomTime = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000
