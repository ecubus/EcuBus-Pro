// stores/counter.js
import { defineStore } from 'pinia'



export type RunTimeStatus={
  testStates: {
    tData: any[],
    isRunning: Record<string, boolean>,
  
    leftWidth: number
  },
  canPeriods: Record<string, boolean>
}

export const useRuntimeStore = defineStore('useRuntimeStore', {
  state: (): RunTimeStatus => ({
   
    testStates: {
      tData: [] as any[],
      isRunning: {} as Record<string, boolean>,
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
