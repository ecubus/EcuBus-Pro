/* eslint-disable @typescript-eslint/no-namespace */
export namespace TimelineChart {
  export interface TimeGraphRange {
    start: bigint
    end: bigint
  }

  export interface TimeGraphModel {
    id: string
    totalLength: bigint
    rows: TimeGraphRowModel[]
    rangeEvents: TimeGraphAnnotation[]
    arrows: TimeGraphArrow[]
    readonly data?: { [key: string]: any }
  }

  export interface TimeGraphRowModel {
    id: number
    name: string
    range: TimeGraphRange
    states: TimeGraphState[]
    annotations: TimeGraphAnnotation[]
    selected?: boolean
    readonly data?: { [key: string]: any }
    prevPossibleState: bigint
    nextPossibleState: bigint
    /**
     * When the gap style is set, gap states will be drawn using this style
     * in between the model's states when the gap between these states is visible.
     * These gap states represent the unknown state between known states.
     * Known blank states (with no style) must then be included in the model.
     */
    gapStyle?: any
  }

  export interface TimeGraphState {
    readonly id: string
    readonly range: TimeGraphRange
    readonly label?: string
    selected?: boolean
    readonly data?: { [key: string]: any }
  }

  export interface TimeGraphArrow {
    sourceId: number
    destinationId: number
    range: TimeGraphRange
    data?: { [key: string]: any }
    // Q: Can I select an arrow?
  }

  export interface TimeGraphAnnotation {
    readonly id: string
    readonly category: string
    readonly range: TimeGraphRange
    readonly label: string
    selected?: boolean
    readonly data?: { [key: string]: any }
  }
}
