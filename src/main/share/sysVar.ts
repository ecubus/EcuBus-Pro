import { VarItem } from 'src/preload/data'
import { UdsDevice } from './uds'
import { TesterInfo } from './tester'

export const MonitorVar: VarItem[] = [
  {
    type: 'system',
    id: 'EventLoopDelay.min',
    name: `EventLoopDelayMin`,
    parentId: 'EventLoopDelay',
    desc: 'Minimum event loop delay - lower values indicate better performance',
    value: {
      type: 'number',
      initValue: 0,
      unit: 'ms'
    }
  },
  {
    type: 'system',
    id: 'EventLoopDelay.max',
    name: `EventLoopDelayMax`,
    desc: 'Maximum event loop delay - higher values indicate potential performance issues',
    parentId: 'EventLoopDelay',
    value: {
      type: 'number',
      initValue: 0,
      unit: 'ms'
    }
  },
  {
    type: 'system',
    id: 'EventLoopDelay.avg',
    name: `EventLoopDelayAvg`,
    desc: 'Average event loop delay - a good balance between performance and stability',
    parentId: 'EventLoopDelay',
    value: {
      type: 'number',
      initValue: 0,
      unit: 'ms'
    }
  }
]

export function getAllSysVar(
  devices: Record<string, UdsDevice>,
  testers: Record<string, TesterInfo>
): Record<string, VarItem> {
  const list: Record<string, VarItem> = {
    Statistics: {
      type: 'system',
      id: 'Statistics',
      name: `Statistics`
    }
  }

  for (const device of Object.values(devices)) {
    const buslist = [
      'BusLoad',
      'BusLoadMin',
      'BusLoadMax',
      'BusLoadAvg',
      'FrameSentFreq',
      'FrameRecvFreq',
      'FrameFreq'
    ]
    if (device.type === 'can' && device.canDevice) {
      list[`Statistics.${device.canDevice.id}`] = {
        type: 'system',
        id: `Statistics.${device.canDevice.id}`,
        name: device.canDevice.name,
        parentId: 'Statistics'
      }
      for (const item of buslist) {
        const isFrameFreq = item.includes('Frame')

        list[`Statistics.${device.canDevice.id}.${item}`] = {
          type: 'system',
          id: `Statistics.${device.canDevice.id}.${item}`,
          name: `${item}`,
          parentId: `Statistics.${device.canDevice.id}`,
          value: {
            type: 'number',
            initValue: 0,
            min: 0,
            max: isFrameFreq ? 10000 : 100,
            unit: isFrameFreq ? 'f/s' : '%'
          }
        }
      }
    }
  }

  for (const tester of Object.values(testers)) {
    list[`Statistics.${tester.id}`] = {
      type: 'system',
      id: `Statistics.${tester.id}`,
      name: tester.name,
      parentId: 'Statistics',
      desc: 'UDS Tester'
    }
    if (tester.seqList.length > 0) {
      for (const [index, seq] of tester.seqList.entries()) {
        list[`Statistics.${tester.id}.${index}`] = {
          type: 'system',
          id: `Statistics.${tester.id}.${index}`,
          name: `Seq #${index}`,
          parentId: `Statistics.${tester.id}`,
          value: {
            type: 'number',
            initValue: 0,
            min: 0,
            max: 100,
            unit: '%'
          },
          desc: `UDS sequence download progress`
        }
      }
    }
  }
  //monitor var
  list[`EventLoopDelay`] = {
    type: 'system',
    id: 'EventLoopDelay',
    name: `EventLoopDelay`
  }
  for (const item of MonitorVar) {
    list[item.id] = item
  }
  return list
}

