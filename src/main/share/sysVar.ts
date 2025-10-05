import { VarItem } from 'src/preload/data'
import { UdsDevice } from './uds'
import { TesterInfo } from './tester'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import { TaskType } from './osEvent'

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
  testers: Record<string, TesterInfo>,
  orti: Record<string, ORTIFile>
): Record<string, VarItem> {
  const list: Record<string, VarItem> = {
    Statistics: {
      type: 'system',
      id: 'Statistics',
      name: `Statistics`
    },
    OsTrace: {
      type: 'system',
      id: 'OsTrace',
      name: `OsTrace`
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

  for (const item of Object.values(orti)) {
    const Ortilist: Record<
      string,
      { type: 'string' | 'number'; min?: number; max?: number; unit?: string; desc?: string }
    > = {
      DelayTimeMin: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务激活成功（Start）到任务运行（Runninng）的最小时间'
      },
      DelayTimeMax: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务激活成功（Start）到任务运行（Runninng）的最大时间'
      },
      DelayTimeAvg: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务激活成功（Start）到任务运行（Runninng）的平均时间'
      },
      ActivationIntervalMin: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务激活间隔最小时间'
      },
      ActivationIntervalMax: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务激活间隔最大时间'
      },
      ActivationIntervalAvg: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务激活间隔平均时间'
      },
      StartIntervalMin: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务开始间隔最小时间'
      },
      StartIntervalMax: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务开始间隔最大时间'
      },
      StartIntervalAvg: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务开始间隔平均时间'
      },
      ExecutionTimeMin: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务执行时间最小时间'
      },
      ExecutionTimeMax: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务执行时间最大时间'
      },
      ExecutionTimeAvg: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: '任务执行时间平均时间'
      },
      StartCount: {
        type: 'number',
        min: 0,
        desc: '任务开始次数'
      },
      Status: {
        type: 'string',
        desc: 'Task当前状态'
      },
      ActiveCount: {
        type: 'number',
        min: 0,
        desc: '任务激活次数'
      },
      RunningRate: {
        type: 'number',
        min: 0,
        max: 100,
        unit: '%',
        desc: 'Task实际运行次数与被激活次数的百分比'
      },
      Jitter: {
        type: 'number',
        min: 0,
        max: 100,
        unit: '%',
        desc: '（实际任务开始间隔时间-实际激活间隔时间）/实际激活间隔时间'
      }
    }

    const ISRList: Record<
      string,
      { type: 'string' | 'number'; min?: number; max?: number; unit?: string; desc?: string }
    > = {
      ExecutionTimeMin: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: 'ISR执行时间最小时间'
      },
      ExecutionTimeMax: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: 'ISR执行时间最大时间'
      },
      ExecutionTimeAvg: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: 'ISR执行时间平均时间'
      },
      RunCount: {
        type: 'number',
        min: 0,
        desc: 'ISR运行次数'
      },
      Status: {
        type: 'string',
        desc: 'ISR当前状态'
      },
      CallIntervalMin: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: 'ISR调用间隔最小时间'
      },
      CallIntervalMax: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: 'ISR调用间隔最大时间'
      },
      CallIntervalAvg: {
        type: 'number',
        min: 0,
        unit: 'us',
        desc: 'ISR调用间隔平均时间'
      }
    }
    list[`OsTrace.${item.id}`] = {
      type: 'system',
      id: `OsTrace.${item.id}`,
      name: item.name,
      parentId: 'OsTrace'
    }
    let coreNum = 0

    for (const core of item.coreConfigs) {
      coreNum = Math.max(coreNum, core.coreId + 1)
      if (core.type == TaskType.TASK) {
        list[`OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}`] = {
          type: 'system',
          id: `OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}`,
          name: core.name,
          parentId: `OsTrace.${item.id}`
        }
        for (const key of Object.keys(Ortilist)) {
          const vitem = Ortilist[key as keyof typeof Ortilist]
          const vkey = `OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}.${key}`
          list[vkey] = {
            type: 'system',
            id: vkey,
            name: `${key}`,
            parentId: `OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}`,
            value: {
              type: vitem.type,
              min: vitem.min,
              max: vitem.max,
              unit: vitem.unit
            },
            desc: vitem.desc
          }
        }
      } else if (core.type == TaskType.ISR) {
        list[`OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}`] = {
          type: 'system',
          id: `OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}`,
          name: core.name,
          parentId: `OsTrace.${item.id}`
        }
        for (const key of Object.keys(ISRList)) {
          const vitem = ISRList[key as keyof typeof ISRList]
          const vkey = `OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}.${key}`
          list[vkey] = {
            type: 'system',
            id: vkey,
            name: `${key}`,
            parentId: `OsTrace.${item.id}.${core.type}_${core.id}_${core.coreId}`,
            value: {
              type: vitem.type,
              min: vitem.min,
              max: vitem.max,
              unit: vitem.unit
            },
            desc: vitem.desc
          }
        }
      }
    }
    for (let i = 0; i < coreNum; i++) {
      list[`OsTrace.${item.id}.Core${i}`] = {
        type: 'system',
        id: `OsTrace.${item.id}.Core${i}`,
        name: `Core${i}`,
        parentId: `OsTrace.${item.id}`
      }
      const coreList: Record<
        string,
        { type: 'string' | 'number'; min?: number; max?: number; unit?: string; desc?: string }
      > = {
        LoadPercent: {
          type: 'number',
          min: 0,
          max: 100,
          unit: '%',
          desc: 'Core负载百分比'
        },
        ExecutionTime: {
          type: 'number',
          min: 0,
          unit: 'ms',
          desc: 'Core执行时间'
        },
        TotalTime: {
          type: 'number',
          min: 0,
          unit: 'ms',
          desc: 'Core总时间'
        }
      }
      for (const key of Object.keys(coreList)) {
        const vitem = coreList[key as keyof typeof coreList]
        const vkey = `OsTrace.${item.id}.Core${i}.${key}`
        list[vkey] = {
          type: 'system',
          id: vkey,
          name: `${key}`,
          parentId: `OsTrace.${item.id}.Core${i}`,
          value: {
            type: vitem.type,
            min: vitem.min,
            max: vitem.max,
            unit: vitem.unit
          },
          desc: vitem.desc
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
