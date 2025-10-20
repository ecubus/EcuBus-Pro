import { ipcMain, app, shell } from 'electron'
import runtimeDom from '../../../resources/lib/js/runtime-dom.esm-browser.min.js?asset&asarUnpack'
import path from 'path'
import fs from 'fs'

const libPath = path.dirname(runtimeDom)

ipcMain.on('ipc-plugin-lib-path', async (event, ...arg) => {
  event.returnValue = libPath.replaceAll('\\', '/')
})

// 获取插件目录
ipcMain.handle('ipc-get-plugins-dir', async () => {
  // 插件目录位于用户数据目录下的 plugins 文件夹
  const userDataPath = app.getPath('userData')
  const pluginsDir = path.join(userDataPath, 'plugins')

  // 如果目录不存在，创建它
  if (!fs.existsSync(pluginsDir)) {
    try {
      fs.mkdirSync(pluginsDir, { recursive: true })
      console.log(`Plugins directory created: ${pluginsDir}`)
    } catch (error) {
      console.error('Failed to create plugins directory:', error)
      return null
    }
  }

  return pluginsDir
})

// 列出插件目录下的所有子目录（按字母顺序）
ipcMain.handle('ipc-list-plugin-dirs', async (event, pluginsDir: string) => {
  try {
    if (!fs.existsSync(pluginsDir)) {
      return []
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })
    const pluginDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(pluginsDir, entry.name))
      .filter((dir) => {
        // 检查是否包含 manifest.json
        const manifestPath = path.join(dir, 'manifest.json')
        return fs.existsSync(manifestPath)
      })
      .sort() // 按字母顺序排序，确保加载顺序一致

    return pluginDirs
  } catch (error) {
    console.error('Failed to list plugin directories:', error)
    return []
  }
})

ipcMain.handle('callServerMethod', async (event, ...arg) => {
  // const [pluginId, id, method, ...params] = arg
  // const plugin = plugins.find((p) => p.id === pluginId)
  // if (plugin) {
  //   return plugin.callServerMethod(method, ...params)
  // }
  // return null
})
