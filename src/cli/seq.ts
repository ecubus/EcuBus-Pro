import { openCanDevice } from 'src/main/docan/can'
import { UDSTesterMain } from 'src/main/docan/uds'
import { TesterInfo } from 'src/main/share/tester'
import { UdsDevice } from 'src/main/share/uds'
import { DataSet } from 'src/preload/data'

async function runSeq(
  projectPath: string,
  projectName: string,
  tester: TesterInfo,
  device: UdsDevice,
  seqName?: string,
  cycle = 1
) {
  const uds = new UDSTesterMain(
    {
      projectPath,
      projectName
    },
    tester,
    device
  )
  if (device.type == 'can' && device.canDevice) {
    //initialize the can device
    const canBase = openCanDevice(device.canDevice)
    if (canBase) {
      await uds.setCanBase(canBase)
    } else {
      throw new Error('can device not found')
    }
    //find sequence index
    let seqIndex = 0
    if (seqName) {
      let found = false
      for (let i = 0; i < tester.seqList.length; i++) {
        if (tester.seqList[i].name == seqName) {
          seqIndex = i
          found = true
          break
        }
      }
      if (!found) {
        throw new Error(`sequence name ${seqName} not found`)
      }
    }
    if (tester.seqList[seqIndex]) {
      await uds.runSequence(seqIndex, cycle)
      canBase.close()
    } else {
      if (seqName) {
        throw new Error(`sequence ${seqName} not found`)
      } else {
        throw new Error(`sequence 0 not found`)
      }
    }
  }
}

export default async function main(
  projectPath: string,
  projectName: string,
  data: DataSet,
  testerName: string,
  seqName?: string,
  cycle = 1
) {
  //find tester by name
  sysLog.debug(`run sequence ${seqName} for tester ${testerName}`)
  sysLog.debug(
    `valid testers:${Object.values(data.tester)
      .map((t) => t.name)
      .join(',')}`
  )
  const tester = Object.values(data.tester).find((t) => t.name == testerName)
  if (!tester) {
    throw new Error(`tester ${testerName} not found`)
  }
  //find device
  if (tester.targetDeviceId) {
    const device = data.devices[tester.targetDeviceId]
    if (!device) {
      throw new Error(`tester device not found`)
    }
    await runSeq(projectPath, projectName, tester, device, seqName, cycle)
  } else {
    throw new Error(`tester ${testerName} has no target device`)
  }
}

