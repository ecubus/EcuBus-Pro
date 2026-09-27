/**
 * JavaScript appended to every compiled test script.
 *
 * Test discovery starts the worker with `ONLY=true` and `--test-only`. The
 * sentinel has to be an `only` test in that mode, otherwise Node skips it and
 * discovery never sees the completion event.
 *
 * A real run leaves `ONLY` unset and does not pass `--test-only`. Node 24
 * (Electron 44 and later) honors `test.only()` even without `--test-only`
 * (https://github.com/nodejs/node/pull/54881). A sentinel that is always
 * `test.only()` therefore skips every user test.
 */
export const testSentinelFooterJs = [
  `const { test: ____ecubus_pro_test___ } = require('node:test');`,
  `if (process.env.ONLY == 'true') {`,
  `____ecubus_pro_test___.only('____ecubus_pro_test___', () => {});`,
  `} else {`,
  `____ecubus_pro_test___('____ecubus_pro_test___', () => {});`,
  `}`
].join('')
