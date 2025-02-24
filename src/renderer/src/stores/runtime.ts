// stores/counter.js
import { defineStore } from 'pinia'

export type TestTree = {
  label: string
  canAdd: boolean
  id: string
  type: 'test' | 'config'
  children: TestTree[]

  time?: string
  status?: 'pass' | 'fail' | 'skip' | 'running'

  nesting?: number
  parent?: TestTree
}
export type RunTimeStatus = {
  testStates: {
    tData: TestTree[]
    activeTest?: TestTree
    realActiveId?: string
    isRunning: Record<string, boolean>
    leftWidth: number
  }
  canPeriods: Record<string, boolean>
}

export const useRuntimeStore = defineStore('useRuntimeStore', {
  state: (): RunTimeStatus => ({
    testStates: {
      tData: [],
      isRunning: {},
      leftWidth: 300
    },
    canPeriods: {}
  }),
  actions: {
    setCanPeriod(key: string, value: boolean) {
      this.canPeriods[key] = value
    },
    removeCanPeriod(key: string) {
      delete this.canPeriods[key]
    }
  }
})
