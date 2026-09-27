/**
 * Mini harness matching src/main/worker/uds.ts plus a suite shaped like
 * resources/examples/test_simple.
 *
 * describe() does not consume testCnt. test() and test.skip() do.
 * Leaf indexes, in execution order:
 *   0 top level
 *   1 sync pass
 *   2 async pass
 *   3 explicit skip
 *   4 nested pass
 *   5 nested skip
 *   6 duplicate name
 *   7 duplicate name
 *
 * ENABLE_ALL=true runs every index. ENABLE=1,4 runs only those indexes.
 * ONLY=true switches describe/test to node:test's only variants, which is
 * what discovery does.
 */
const {
  test: nodeTest,
  describe: nodeDescribe,
  beforeEach: nodeBeforeEach,
  afterEach: nodeAfterEach,
  before: nodeBefore,
  after: nodeAfter
} = require('node:test')
const assert = require('node:assert')

const selfDescribe = process.env.ONLY == 'true' ? nodeDescribe.only : nodeDescribe
const selfTest = process.env.ONLY == 'true' ? nodeTest.only : nodeTest

let testCnt = 0
const testEnableControl = {}
const enableAll = process.env.ENABLE_ALL == 'true'
if (process.env.ENABLE) {
  for (const part of process.env.ENABLE.split(',')) {
    if (part !== '') testEnableControl[Number(part)] = true
  }
}

function isEnabled(idx) {
  if (enableAll) return true
  return testEnableControl[idx] == true
}

function hasEnabledTests() {
  if (enableAll) return true
  return Object.values(testEnableControl).some((enabled) => enabled === true)
}

function test(name, fn) {
  selfTest(name, async (t) => {
    const currentTestCnt = testCnt
    const enabled = isEnabled(currentTestCnt)
    let advanced = false
    const advanceTestCnt = () => {
      if (!advanced) {
        testCnt = Math.max(testCnt, currentTestCnt + 1)
        advanced = true
      }
    }
    t.before(async () => {
      if (enabled) console.log(`TEST_START ${currentTestCnt} ${name}`)
    })
    t.after(() => {
      if (enabled) console.log(`TEST_END ${currentTestCnt} ${name}`)
      advanceTestCnt()
    })
    if (!enabled) {
      advanceTestCnt()
      t.skip()
    } else {
      console.log(`RAN ${currentTestCnt} ${name}`)
      return fn()
    }
  })
}

test.skip = function (name, fn) {
  selfTest(name, (t) => {
    const currentTestCnt = testCnt
    let advanced = false
    const advanceTestCnt = () => {
      if (!advanced) {
        testCnt = Math.max(testCnt, currentTestCnt + 1)
        advanced = true
      }
    }
    t.before(() => {
      console.log(`TEST_START ${currentTestCnt} ${name}`)
    })
    t.after(() => {
      console.log(`TEST_END ${currentTestCnt} ${name}`)
      advanceTestCnt()
    })
    advanceTestCnt()
    t.skip()
  })
}

function beforeEach(fn) {
  nodeBeforeEach(async () => {
    if (isEnabled(testCnt)) return fn()
  })
}

function afterEach(fn) {
  nodeAfterEach(async () => {
    if (isEnabled(testCnt)) return fn()
  })
}

function before(fn) {
  nodeBefore(async () => {
    if (hasEnabledTests()) return fn()
  })
}

function after(fn) {
  nodeAfter(async () => {
    if (hasEnabledTests()) return fn()
  })
}

function describe(name, fn) {
  selfDescribe(name, async () => fn())
}

test('top level', () => {
  assert.strictEqual(1, 1)
})

describe('CAN Test', () => {
  before(() => console.log('HOOK before CAN'))
  beforeEach(() => console.log('HOOK beforeEach CAN'))
  afterEach(() => console.log('HOOK afterEach CAN'))
  after(() => console.log('HOOK after CAN'))

  test('sync pass', () => {
    assert.strictEqual(1, 1)
  })

  test('async pass', async () => {
    await new Promise((resolve) => setImmediate(resolve))
    assert.strictEqual(1, 1)
  })

  test.skip('explicit skip', () => {
    console.log('RAN_SKIP_BODY')
    assert.strictEqual(1, 1)
  })

  describe('nested', () => {
    before(() => console.log('HOOK before nested'))
    beforeEach(() => console.log('HOOK beforeEach nested'))
    afterEach(() => console.log('HOOK afterEach nested'))
    after(() => console.log('HOOK after nested'))

    test('nested pass', () => {
      assert.strictEqual(1, 1)
    })

    test.skip('nested skip', () => {
      console.log('RAN_NESTED_SKIP_BODY')
    })
  })
})

describe('UDS Test', () => {
  test('duplicate name', () => {
    console.log('DUP_A')
    assert.strictEqual(1, 1)
  })

  test('duplicate name', () => {
    console.log('DUP_B')
    if (process.env.FAIL == '1') assert.strictEqual(1, 2)
    else assert.strictEqual(1, 1)
  })
})

describe('empty suite', () => {})
