import { EthBaseInfo } from 'nodeCan/doip'
import { UdsDevice } from 'nodeCan/uds'
import { exit } from 'process'
import { CanBase } from 'src/main/docan/base'
import { openCanDevice } from 'src/main/docan/can'
import { openLinDevice } from 'src/main/dolin'
import LinBase from 'src/main/dolin/base'
import { createPwmDevice, PwmBase } from 'src/main/pwm'

export default async function main(
  projectPath: string,
  projectName: string,
  devices: Record<string, UdsDevice>
) {
  const canBaseMap = new Map<string, CanBase>()
  const ethBaseMap = new Map<string, EthBaseInfo>()
  const linBaseMap = new Map<string, LinBase>()
  const pwmBaseMap = new Map<string, PwmBase>()
  for (const key in devices) {
    const device = devices[key]
    if (device.type == 'can' && device.canDevice) {
      const canDevice = device.canDevice

      const canBase = openCanDevice(canDevice)

      sysLog.info(`start can device ${canDevice.vendor}-${canDevice.handle} success`)
      if (canBase) {
        canBase.event.on('close', (errMsg: any) => {
          if (errMsg) {
            sysLog.error(`${canDevice.vendor}-${canDevice.handle} error: ${errMsg}`)
            exit(-1)
          }
        })
        canBaseMap.set(key, canBase)
      }
    } else if (device.type == 'eth' && device.ethDevice) {
      const ethDevice = device.ethDevice

      ethBaseMap.set(key, ethDevice)
    } else if (device.type == 'lin' && device.linDevice) {
      const linDevice = device.linDevice

      const linBase = openLinDevice(linDevice)
      sysLog.info(`start lin device ${linDevice.vendor}-${linDevice.device.handle} success`)
      if (linBase) {
        linBase.event.on('close', (errMsg) => {
          if (errMsg) {
            sysLog.error(`${linDevice.vendor}-${linDevice.device.handle} error: ${errMsg}`)
            exit(-1)
          }
        })
        linBaseMap.set(key, linBase)
      }
    } else if (device.type == 'pwm' && device.pwmDevice) {
      const pwmDevice = device.pwmDevice
      const pwmBase = createPwmDevice(pwmDevice)
      sysLog.info(`start pwm device ${pwmDevice.vendor}-${pwmDevice.device.handle} success`)
      if (pwmBase) {
        pwmBase.event.on('close', (errMsg) => {
          if (errMsg) {
            sysLog.error(`${pwmDevice.vendor}-${pwmDevice.device.handle} error: ${errMsg}`)
            exit(-1)
          }
        })
        pwmBaseMap.set(key, pwmBase)
      }
    }
  }
  return { canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap }
}
