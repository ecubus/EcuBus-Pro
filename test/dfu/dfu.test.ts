import { test } from 'vitest'
import DFU from '../../src/main/dfu'

test('dfu device list', () => {
  DFU.getDeviceInfo()
})
