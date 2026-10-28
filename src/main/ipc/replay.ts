import { ipcMain } from 'electron'
import i18next from 'i18next'
import { scanReplayLogChannels } from '../replay'
import type { ReplayLogChannelScan } from 'src/preload/data'

function emptyScan(): ReplayLogChannelScan {
  return { channels: [], truncated: false, scanned: 0 }
}

ipcMain.handle(
  'ipc-replay-scan-channels',
  async (_event, arg: { filePath?: string; format?: string }): Promise<ReplayLogChannelScan> => {
    if (!arg?.filePath || (arg.format !== 'blf' && arg.format !== 'asc')) {
      return emptyScan()
    }
    try {
      return await scanReplayLogChannels(arg.filePath, arg.format)
    } catch (err: any) {
      global.sysLog.warn(
        i18next.t('uds.network.replayConfig.messages.scanFailed', {
          file: arg.filePath,
          msg: err?.message || String(err)
        })
      )
      return emptyScan()
    }
  }
)
