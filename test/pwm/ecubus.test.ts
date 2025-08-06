import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { EcuBusPwm, PwmCalculationResult } from '../../src/main/pwm/ecubus/index'
import { PwmBaseInfo, PwmDevice } from '../../src/main/share/uds'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
describe('EcuBus PWM Tests', () => {
  let pwm: EcuBusPwm
  let mockDevice: PwmDevice
  let mockPwmInfo: PwmBaseInfo
  let mockSerialPort: any

  beforeAll(() => {
    // 创建模拟设备信息
    mockDevice = {
      label: 'Test EcuBus PWM',
      id: 'test-pwm-001',
      handle: 'COM8',
      busy: false,
      serialNumber: 'TEST123'
    }

    mockPwmInfo = {
      id: 'test-pwm',
      device: mockDevice,
      freq: 1000, // 1000Hz
      initDuty: 50, // 50%
      polarity: false,
      resetStatus: false,
      vendor: 'ecubus',
      name: 'Test PWM Device'
    }

    // 创建PWM实例
    pwm = new EcuBusPwm(mockPwmInfo)
  })

  test('应该能够设置不同的占空比值', async () => {
    await delay(100)
    const dutyCycle = pwm.getDutyCycle()
    console.log(`dutyCycle: ${dutyCycle}`)
    await pwm.setDutyCycle(10)
    await delay(100)
  })
  afterAll(() => {
    pwm.close()
  })
})

