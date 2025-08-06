//fake unused file
// console.log(process.env)
// console.log(process.env)
process.stdin.resume()
process.stdin.on('data', (data) => {
  console.log(`You typed: ${data.toString()}`)
  process.exit() // 如果你想在用户输入后退出程序
})

