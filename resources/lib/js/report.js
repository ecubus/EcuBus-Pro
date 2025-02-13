
const {
    parentPort
  } = require('node:worker_threads');






module.exports = async function * customReporter(source) {
    for await (const event of source) {
        parentPort.postMessage(event)
    }
  };