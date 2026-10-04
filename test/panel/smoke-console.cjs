const { Console } = require('node:console')
const fs = require('node:fs')
const path = require('node:path')
const { Writable } = require('node:stream')

module.exports = function installSmokeConsole(artifacts) {
  const filename = path.join(artifacts, 'console.log')
  const output = new Writable({
    write(chunk, _encoding, callback) {
      try {
        fs.appendFileSync(filename, chunk)
        callback()
      } catch (error) {
        callback(error)
      }
    }
  })
  global.console = new Console({ stdout: output, stderr: output, ignoreErrors: false })
}
