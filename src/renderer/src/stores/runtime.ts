// stores/counter.js
import { defineStore } from 'pinia'
import { toRef } from 'vue'

export type TestTree = {
  label: string
  canAdd: boolean
  id: string
  type: 'test' | 'config' | 'root'
  children: TestTree[]
  time?: string
  status?: 'pass' | 'fail' | 'skip' | 'running'
  disabled?: boolean
  testCnt?: number
  nesting?: number
  parent?: TestTree
}

export type RunTimeStatus = {
  testStates: {
    tData: TestTree[]
    activeTest?: TestTree
    realActiveId?: string
    isRunning: Record<string, boolean>
  }
  globalStart: boolean
  canPeriods: Record<string, boolean>
  someipPeriods: Record<string, boolean>
  rearrangeWindows: boolean
}

export const useRuntimeStore = defineStore('useRuntimeStore', {
  state: (): RunTimeStatus => ({
    testStates: {
      tData: [],
      isRunning: {}
    },
    canPeriods: {},
    someipPeriods: {},
    globalStart: false,
    rearrangeWindows: false
  }),

  actions: {
    setCanPeriod(key: string, value: boolean) {
      this.canPeriods[key] = value
    },
    removeCanPeriod(key: string) {
      delete this.canPeriods[key]
    },
    setSomeipPeriod(key: string, value: boolean) {
      this.someipPeriods[key] = value
    },
    removeSomeipPeriod(key: string) {
      delete this.someipPeriods[key]
    }
  }
})

export function useGlobalStart() {
  const runtime = useRuntimeStore()
  return toRef(runtime, 'globalStart')
}
