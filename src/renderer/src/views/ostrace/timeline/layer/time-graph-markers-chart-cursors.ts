import { TimelineChart } from '../time-graph-model'
import { TimeGraphChartCursors } from './time-graph-chart-cursors'

export class TimeGraphMarkersChartCursors extends TimeGraphChartCursors {
  protected afterAddToContainer() {
    super.afterAddToContainer()
    this.removeOnCanvasEvent('keydown', this._keyboardShortcutKeyDownHandler as any)
    this._keyboardShortcutKeyDownHandler = (event: KeyboardEvent) => {
      switch (event.key) {
        case ',':
          this.selectClosestStateAndMakeSelectionRange('prev')
          break
        case '.':
          this.selectClosestStateAndMakeSelectionRange('next')
          break
        default:
          return
      }
    }
    this.onCanvasEvent('keydown', this._keyboardShortcutKeyDownHandler as any)
  }

  protected selectClosestStateAndMakeSelectionRange = (direction: 'next' | 'prev') => {
    const next = direction === 'next'
    const selectedRow = this.rowController.selectedRow

    if (this.unitController.selectionRange && selectedRow) {
      const { start, end } = this.unitController.selectionRange
      let point1 = next ? end : start
      let closestState: TimelineChart.TimeGraphState | undefined
      let closestDiff = Number.POSITIVE_INFINITY
      let isValid = false

      selectedRow?.states.forEach((marker, key) => {
        const { start, end } = marker.range

        if (
          start === this.unitController.selectionRange?.start &&
          end === this.unitController.selectionRange?.end
        ) {
          return
        }

        let point2 = next ? start : end
        let innerIsValid = next ? point1 <= point2 : point1 >= point2
        let diff = Math.abs(Number(point1 - point2))

        if (diff < closestDiff && innerIsValid) {
          closestDiff = diff
          closestState = marker
          isValid = innerIsValid
        }
      })

      if (isValid && closestState) {
        this.unitController.selectionRange = closestState.range
        this.maybeCenterCursor()
        this.update()
      }
    }
  }
}
