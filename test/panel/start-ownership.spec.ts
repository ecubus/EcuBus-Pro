import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'
import { waitForStart } from '../../src/main/startCancellation'

it('settles cancellation before the operation and handles its late rejection', async () => {
  let reject!: (error: Error) => void
  const operation = new Promise<void>((_, fail) => {
    reject = fail
  })
  const controller = new AbortController()
  const starting = waitForStart(operation, controller.signal)
  controller.abort(new Error('cancelled'))
  await expect(starting).rejects.toThrow('cancelled')
  await expect(waitForStart(Promise.resolve(42), new AbortController().signal)).resolves.toBe(42)
  reject(new Error('late failure'))
  await new Promise((resolve) => setImmediate(resolve))
})

it('does not let the previous router exit clear the replacement router', async () => {
  const file = 'src/main/vsomeip/index.ts'
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const functions = source.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        ['startRouterCounter', 'stopRouterCounter', 'isRouterCounterRunning'].includes(
          node.name?.text || ''
        )
    )
    .map((node) => node.getText(source))
    .join('\n')
  const children: any[] = []
  const logs: any[] = []
  const context: any = {
    exports: {},
    routingManagerProcess: null,
    routerLog: null,
    path: { join: () => 'lock', isAbsolute: () => true },
    os: { tmpdir: () => '' },
    fs: { existsSync: () => false },
    __dirname: '',
    resolve: () => '',
    fork: () => {
      const child = Object.assign(new EventEmitter(), {
        send: vi.fn(),
        kill: vi.fn(),
        killed: false
      })
      children.push(child)
      return child
    },
    SomeipLOG: class {
      close = vi.fn()
      constructor() {
        logs.push(this)
      }
    },
    EventEmitter,
    sysLog: { error: vi.fn() }
  }
  vm.runInNewContext(
    ts.transpileModule(functions, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText,
    context
  )
  const first = context.exports.startRouterCounter('first')
  const rejected = expect(first).rejects.toThrow('Routing manager exited')
  context.exports.stopRouterCounter()
  const second = context.exports.startRouterCounter('second')
  children[0].emit('exit', 0, null)
  await rejected
  expect(context.exports.isRouterCounterRunning()).toBe(true)
  expect(logs[1].close).not.toHaveBeenCalled()
  children[1].emit('message', { id: 0, data: 'initRouter' })
  await second
  context.exports.stopRouterCounter()
  expect(children[1].kill).toHaveBeenCalledOnce()
})
