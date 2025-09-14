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
    const buslist: Record<string, { min: number; max?: number; unit?: string }> = {
      BusLoad: {
        min: 0,
        max: 100,
        unit: '%'
      },
      BusLoadMin: {
        min: 0,
        max: 100,
        unit: '%'
      },
      BusLoadMax: {
        min: 0,
        max: 100,
        unit: '%'
      },
      BusLoadAvg: {
        min: 0,
        max: 100,
        unit: '%'
      },
      FrameSentFreq: {
        min: 0,
        max: 100,
        unit: 'f/s'
      },
      FrameRecvFreq: {
        min: 0,
        max: 100,
        unit: 'f/s'
      },
      FrameFreq: {
        min: 0,
        max: 100,
        unit: 'f/s'
      },
      SentCnt: {
        min: 0
      },
      RecvCnt: {
        min: 0
      }
    }

    if (device.type === 'can' && device.canDevice) {
      list[`Statistics.${device.canDevice.id}`] = {
        type: 'system',
        id: `Statistics.${device.canDevice.id}`,
        name: device.canDevice.name,
        parentId: 'Statistics'
      }
      for (const key of Object.keys(buslist)) {
        const item = buslist[key as keyof typeof buslist]

        list[`Statistics.${device.canDevice.id}.${key}`] = {
          type: 'system',
          id: `Statistics.${device.canDevice.id}.${key}`,
          name: `${key}`,
          parentId: `Statistics.${device.canDevice.id}`,
          value: {
            type: 'number',
            initValue: 0,
            min: item.min,
            max: item.max,
            unit: item.unit
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
