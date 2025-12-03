export interface ScriptExecutionEvents {
  onMessage: (msg: any) => void
  onLog: (log: string, type: 'info' | 'error') => void
  onError: (err: any) => void
  onExit: (code: number) => void
}

export abstract class ScriptExecutor {
  protected eventHandler?: ScriptExecutionEvents

  constructor(
    protected scriptPath: string,
    protected env: any
  ) {}

  setEventHandler(handler: ScriptExecutionEvents) {
    this.eventHandler = handler
  }

  abstract init(): void
  abstract postMessage(msg: any): void
  abstract terminate(): Promise<void>
  abstract isHealthy(): boolean
}
