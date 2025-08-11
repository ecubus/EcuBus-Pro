/* eslint-disable no-var */
import { Command, program } from 'commander'
import { version } from '../../package.json'
import seqMain from './seq'
import path from 'path'
import fsP from 'fs/promises'
import fs from 'fs'
import { DataSet, VarItem } from 'src/preload/data'
import { Logger, transports } from 'winston'
import { exit } from 'process'
import { format } from 'winston'
import { createLogs } from 'src/main/log'
import Transport from 'winston-transport'
import colors from 'colors'
import { CanMessage } from 'src/main/share/can'
import { ServiceItem } from 'src/main/share/uds'
import { LinMsg } from 'src/main/share/lin'
import vm from 'vm'
import pnpmScript from '../../resources/bin/pnpm/pnpm.cjs?asset&asarUnpack'
import glob from 'glob'
import testMain from './test'
import { TestEvent } from 'node:test/reporters'
import dllLib from '../../resources/lib/zlgcan.dll?asset&asarUnpack'
import { build as buildFunc } from './build'
import { getAllSysVar } from '../main/share/sysVar'
import { cloneDeep } from 'lodash'

// import async_hooks from 'async_hooks';

// const stacks = new Map();

// const hook = async_hooks.createHook({
//   init(asyncId, type, triggerAsyncId) {
//     if (type === 'PROMISE') {
//       stacks.set(asyncId, new Error().stack);
//     }
//   },
//   destroy(asyncId) {
//     stacks.delete(asyncId);
//   }
// });

// hook.enable();

// // 定时打印还活着的 Promise 创建位置
// setInterval(() => {
//   if (stacks.size > 0) {
//     console.log('Pending Promises:');
//     for (const [id, stack] of stacks) {
//       console.log(`Promise ID=${id} 创建堆栈:\n${stack}`);
//     }
//   }
// }, 2000);

// 创建一个自定义的 Transport 来过滤掉不需要的日志
class FilteredConsoleTransport extends Transport {
  constructor(options: any) {
    super(options)
  }

  log(info: any, callback: () => void) {
    const m = info[Symbol.for('message')]
    if (m) {
      console.log(m)
    }

    // 对于其他日志，正常处理
    callback()
  }
}

async function parseProject(projectPath: string): Promise<{
  data: DataSet
  projectPath: string
  projectName: string
}> {
  if (!path.isAbsolute(projectPath)) {
    projectPath = path.join(process.cwd(), projectPath)
  }
  if (!fs.existsSync(projectPath)) {
    throw new Error(`project file ${projectPath} not found`)
  }

  try {
    const content = await fsP.readFile(projectPath, 'utf-8')
    const data = JSON.parse(content)
    const info = path.parse(projectPath)
    global.database = data.data.database
    global.vars = {}
    global.tester = data.data.tester
    const vars: Record<string, VarItem> = cloneDeep(data.data.vars)
    const sysVars = getAllSysVar(data.data.devices, data.data.tester)
    for (const v of Object.values(sysVars)) {
      vars[v.id] = cloneDeep(v)
    }
    for (const key of Object.keys(vars)) {
      const v = vars[key]

      if (v.value) {
        const parentName: string[] = []

        // 递归查找所有父级名称
        let currentVar = v
        while (currentVar.parentId) {
          const parent = vars[currentVar.parentId]
          if (parent) {
            parentName.unshift(parent.name) // 将父级名称添加到数组开头
            currentVar = parent
          } else {
            break
          }
        }

        parentName.push(v.name)
        v.name = parentName.join('.')
      }
      global.vars[key] = v
    }

    return {
      data: data.data,
      projectPath: info.dir,
      projectName: info.base
    }
  } catch (e) {
    throw new Error(`project file ${projectPath} is not a valid file`)
  }
}

const myFormat = format.printf(({ level, message, label, timestamp }) => {
  const map: Record<string, any> = {
    info: colors.blue,
    warn: colors.yellow,
    error: colors.red,
    debug: colors.gray
  }
  let msg = message as any
  let fn = map[level] || colors.white

  if (typeof msg === 'object') {
    if (msg.method == 'canBase') {
      const data = msg.data as CanMessage
      //hex string  with space two by two
      const hexData = data.data.toString('hex').match(/.{2}/g)?.join(' ')
      const msgTypeStr = [
        data.msgType.canfd ? 'CAN-FD' : 'CAN',
        data.msgType.brs ? 'BRS' : '',
        data.msgType.remote ? 'REMOTE' : ''
      ]
        .filter(Boolean)
        .join(' ')
      // 将 ID 转换为十六进制
      const hexId = data.id.toString(16)
      msg = ` ${data.device} | ${data.dir} |ID: 0x${hexId} | TS: ${data.ts} | ${msgTypeStr} | ${hexData}`
    } else if (msg.method == 'udsSent' || msg.method == 'udsRecv') {
      const data = msg.data as { service: ServiceItem; ts: number; recvData?: Buffer; msg?: string }
      const hexData = data.recvData?.toString('hex').match(/.{2}/g)?.join(' ')
      msg = `${data.service.name} | ${msg.method == 'udsSent' ? 'Req' : 'Resp'} |TS: ${data.ts} | ${hexData}`
    } else if (msg.method == 'udsIndex') {
      const data = msg.data as {
        index: number
        serviceName: string
        action: 'start' | 'finished' | 'progress'
        percent?: number
      }
      if (data.percent != undefined) {
        msg = `${data.serviceName}#${data.index} | ${data.action} | ${data.percent.toFixed(2)}%`
      } else {
        msg = `${data.serviceName}#${data.index} | ${data.action}`
      }
    } else if (msg.method == 'linBase') {
      const data = msg.data as LinMsg
      //hex string  with space two by two
      const hexData = data.data.toString('hex').match(/.{2}/g)?.join(' ')
      const msgTypeStr = [
        'LIN',
        data.checksumType === 'CLASSIC' ? 'CLASSIC' : 'ENHANCED',
        data.direction === 'SEND' ? 'SEND' : 'RECV'
      ]
        .filter(Boolean)
        .join(' ')
      // 将 ID 转换为十六进制
      const hexId = data.frameId.toString(16)
      msg = ` ${data.name || 'LIN'} | ${data.direction} |ID: 0x${hexId} | TS: ${data.ts} | ${msgTypeStr} | ${hexData}`
    } else if (msg.method == 'linError') {
      const data = msg.data as { msg: string; ts: number; data?: LinMsg }
      if (data.data) {
        const hexId = data.data.frameId.toString(16)
        msg = `LIN Error | ID: 0x${hexId} | TS: ${data.ts} | ${data.msg}`
      } else {
        msg = `LIN Error | TS: ${data.ts} | ${data.msg}`
      }
    } else if (msg.method == 'linEvent') {
      const data = msg.data as { msg: string; ts: number }
      msg = `LIN Event | TS: ${data.ts} | ${data.msg}`
    } else if (msg.method == 'canError' || msg.method == 'udsError') {
      fn = colors.red
      const data = msg.data as { ts: number; msg?: string }
      msg = `${data.msg || 'error'}`
    } else if (msg.method == 'testInfo') {
      const testEvent = msg.data as TestEvent
      if ((testEvent.data as any).name == '____ecubus_pro_test___') {
        // 使用特殊标记来跳过这条日志
        return null
      }
      if (testEvent.type == 'test:dequeue') {
        msg = `----- Test ${testEvent.data.name} starting -----`
      } else if (testEvent.type == 'test:pass') {
        if (testEvent.data.skip) {
          fn = colors.yellow
          msg = `----- Test ${testEvent.data.name} skipped, ${testEvent.data.details.duration_ms}ms -----`
        } else {
          fn = colors.green
          msg = `----- Test ${testEvent.data.name} passed, ${testEvent.data.details.duration_ms}ms -----`
        }
      } else if (testEvent.type == 'test:fail') {
        fn = colors.red
        let file = testEvent.data.file
        if (file) {
          file = path.relative(process.cwd(), file)
        }
        msg = `----- Test ${testEvent.data.name} failed, ${testEvent.data.details.duration_ms}ms, file: ${file}:${testEvent.data.line}, details: ${testEvent.data.details.error.message} -----`
      } else if (testEvent.type == 'test:diagnostic') {
        msg = testEvent.data.message
        fn = colors.yellow
      } else {
        // 使用特殊标记来跳过这条日志
        return null
      }
    } else if (msg.method.endsWith('udsSystem')) {
      const data = msg.data as { ts: number; msg?: string }
      msg = `${data.msg || 'error'}`
    } else if (msg.method.endsWith('udsError')) {
      const data = msg.data as { ts: number; msg?: string }
      msg = `${data.msg || 'error'}`
      fn = colors.red
    } else if (msg.method.endsWith('udsScript')) {
      const data = msg.data as { ts: number; msg?: string }
      msg = `${data.msg || 'error'}`
    } else {
      console.log('raw', msg)
    }
  } else if (typeof msg === 'string') {
    msg = msg.trim()
    // msg=''
  }
  return fn(`[${timestamp}][${label}]:${msg}`)
})

function addLoggingOption(command: Command) {
  command.option(
    '-l,--log-level <level>',
    'print log messages of given level and above only, error->warning->info->debug ',
    'info'
  )
  // .option('--log-file <file>', 'print log messages to file')
}

function createLog(level: string, file?: string) {
  const t: (() => Transport)[] = []
  const f = []
  // const cliFormat = format.cli();
  const timestamp = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })

  // 使用自定义的过滤 transport 替代标准控制台 transport
  t.push(() => new FilteredConsoleTransport({ level }))

  f.push(timestamp)
  f.push(myFormat)

  createLogs(t, f)
}

program.version(version).description('EcuBus-Pro command line tool')

// createCliLogs
const seq = program.command('seq').description('run uds sequence')
seq.argument('<project>', 'EcuBus-Pro project path')
seq.argument('<testerName>', 'tester name')
seq.option('-sn, --seqName <seqName>', 'spacial sequence name, empty run first sequence')
seq.option('-c, --cycle <number>', 'cycle number', '1')
addLoggingOption(seq)

seq.action(async (project, testerName, options) => {
  createLog(options.logLevel, options.logFile)
  try {
    const { data, projectPath, projectName } = await parseProject(project)
    await seqMain(projectPath, projectName, data, testerName, options.seqName, options.cycle)
  } catch (e: any) {
    sysLog.error(e.message || 'failed to run sequence')
    exit(1)
  }
})

const test = program.command('test').description('run test config')
test.argument('<project>', 'EcuBus-Pro project path')
test.argument('<name>', 'test config name')
test.option('-r, --report <report>', 'report file name')
test.option('-b, --build', 'force build')
test.option('-t, --testNamePattern <pattern>', 'test name pattern')
test.option('-v, --view', 'just show test tree')
addLoggingOption(test)
test.action(async (project, name, options) => {
  createLog(options.logLevel, options.logFile)
  try {
    const { data, projectPath, projectName } = await parseProject(project)

    await testMain(
      projectPath,
      projectName,
      data,
      name,
      options.report,
      options.build,
      options.view,
      options.testNamePattern
    )
  } catch (e: any) {
    console.trace(e)
    console.error(e.message || 'failed to run test config')
    exit(1)
  }
  //打印还有哪些pending的promise
})

const build = program.command('build').description('buils script file')
build.argument('<project>', 'EcuBus-Pro project path')
build.argument('<file>', 'scriptfile')

addLoggingOption(build)
build.action(async (project, file, options) => {
  createLog(options.logLevel, options.logFile)
  try {
    const { data, projectPath, projectName } = await parseProject(project)
    if (!path.isAbsolute(file)) {
      file = path.join(process.cwd(), file)
    }

    await buildFunc(projectPath, projectName, data, file, options.test)
  } catch (e: any) {
    sysLog.error(e.message || 'failed to run test config')
    exit(1)
  }
})

const npm = program
  .command('pnpm')
  .description(
    'run pnpm command, see "https://pnpm.io/" or ecb_cli pnpm --help for more information'
  )
npm.argument('<command>', 'pnpm command')
// npm.option('-i, --install <package>', 'Prints the location of the globally installed executables.')
// npm.action(async (command)=>{
//     console.log('run npm command',command)

// })
if (process.argv[1] == 'pnpm' || process.argv[2] == 'pnpm') {
  const index = process.argv.findIndex((v) => v == 'pnpm')
  if (process.argv[index + 1] == 'init') {
    if (fs.existsSync('package.json')) {
      console.log('package.json already exists')
      exit(0)
    }
    //create package.json
    //read *.ecb in current folder
    const files = glob.globSync('*.ecb')
    let name = 'EcuBus-Pro'
    if (files.length > 0) {
      name = path.parse(files[0]).name
    }
    const packageJson = {
      name,
      version: '1.0.0',
      description: 'EcuBus-Pro project',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1'
      },
      keywords: ['EcuBus-Pro']
    }
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
    console.log(`created package.json to ${path.join(process.cwd(), 'package.json')}`)
    exit(0)
  }
  //修改process.argv
  process.argv = ['ecubus-pro', 'pnpm', ...process.argv.slice(index + 1)]
  const [major, minor] = process.version.slice(1).split('.')
  const vmModule = { exports: {} }
  process.env.XDG_CONFIG_HOME = path.join(process.cwd(), '.config')
  const context = vm.createContext({
    exports: vmModule.exports,
    module: vmModule,
    process: process,
    require: require,
    global: global,
    Buffer: Buffer,
    major: major,
    minor: minor,
    pnpm__startedAt: Date.now(),
    URLSearchParams: URLSearchParams,
    console: console,
    __dirname: path.dirname(pnpmScript),
    __filename: __filename,
    URL: URL,
    setInterval: setInterval,
    clearInterval: clearInterval,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setImmediate: setImmediate,
    clearImmediate: clearImmediate
  })
  const content = fs.readFileSync(pnpmScript, 'utf-8')
  const script = new vm.Script(content)
  script.runInContext(context)
} else {
  program.parse()
}
// console.log(process.argv)
