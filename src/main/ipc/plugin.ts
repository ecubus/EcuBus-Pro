import { ipcMain, app, shell } from 'electron'
import runtimeDom from '../../../resources/lib/js/runtime-dom.esm-browser.min.js?asset&asarUnpack'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import PluginClient from '../pluginCilent'
import axios from 'axios'
import { RemotePluginInfo } from 'src/preload/plugin'
import AdmZip from 'adm-zip'

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
    } catch (error) {
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

const plugins: Record<string, PluginClient> = {}

ipcMain.handle(
  'ipc-plugin-create',
  async (event, pluginId: string, pluginDir: string, mainEntry: string) => {
    if (plugins[pluginId]) {
      await plugins[pluginId].close()
    }
    const mainEntryPath = path.join(pluginDir, mainEntry)
    if (fs.existsSync(mainEntryPath)) {
      plugins[pluginId] = new PluginClient(pluginId, mainEntryPath)
      console.log('plugin created', pluginId)
    } else {
      throw new Error(`Main entry file not found: ${mainEntryPath}`)
    }
  }
)

ipcMain.handle('ipc-plugin-close', async (event, pluginId) => {
  if (plugins[pluginId]) {
    await plugins[pluginId].close()
    delete plugins[pluginId]
  }
})

ipcMain.handle('ipc-plugin-exec', async (event, { pluginId, id }, method, ...params) => {
  if (!plugins[pluginId]) {
    throw new Error(`Plugin ${pluginId} not found`)
  }

  return await plugins[pluginId].exec(method, [...params])
})

// 资源 API 返回的数据结构
interface ResourceItem {
  owner: string
  name: string
  createdTime: string
  user: string
  provider: string
  application: string
  tag: string
  parent: string
  fileName: string
  fileType: string
  fileFormat: string
  fileSize: number
  url: string
  description: string
}

interface ResourceApiResponse {
  status: string
  msg: string
  sub: string
  name: string
  data: ResourceItem[]
  data2: null
  data3: null
}

// 获取所有可用的远程插件
ipcMain.handle('ipc-get-remote-plugins', async () => {
  const apiUrl = 'https://app.whyengineer.com/resources/api/get-resources'
  const response = await axios.get<ResourceApiResponse>(apiUrl)

  if (response.data.status !== 'ok') {
    throw new Error(`API error: ${response.data.msg || 'Unknown error'}`)
  }

  const resources = response.data.data

  // 按 parent 分组资源
  const pluginMap = new Map<string, RemotePluginInfo>()

  for (const resource of resources) {
    const pluginId = resource.parent

    if (!pluginMap.has(pluginId)) {
      pluginMap.set(pluginId, {
        id: pluginId,
        version: resource.tag,
        createdTime: resource.createdTime,
        user: resource.user
      })
    }

    const plugin = pluginMap.get(pluginId)!

    // 根据文件类型设置对应的 URL
    if (resource.fileType === 'image') {
      plugin.icon = resource.url
    } else if (resource.fileName.startsWith('readme')) {
      plugin.readme = resource.url
    } else if (resource.fileFormat === '.zip') {
      plugin.zipUrl = resource.url
    } else if (resource.fileFormat === '.json') {
      plugin.manifestUrl = resource.url
      // 从 description 字段解析插件基本信息
      if (resource.description) {
        try {
          const info = JSON.parse(resource.description)
          plugin.name = info.name
          plugin.description = info.description
          plugin.author = info.author
        } catch (e) {
          null
        }
      }
    }
  }

  // 过滤出完整的插件（至少包含 image, zip, json）
  const completePlugins = Array.from(pluginMap.values()).filter(
    (plugin) => plugin.icon && plugin.zipUrl && plugin.manifestUrl && plugin.name && plugin.author
  )

  return completePlugins
})

// 安装远程插件
ipcMain.handle(
  'ipc-install-remote-plugin',
  async (event, pluginId: string, zipUrl: string, shouldUpgrade: boolean) => {
    try {
      // 获取插件目录
      const userDataPath = app.getPath('userData')
      const pluginsDir = path.join(userDataPath, 'plugins')

      // 确保插件目录存在
      if (!fs.existsSync(pluginsDir)) {
        await fsPromises.mkdir(pluginsDir, { recursive: true })
      }

      const pluginDir = path.join(pluginsDir, pluginId)
      const tempZipPath = path.join(pluginsDir, `${pluginId}.zip`)

      try {
        // 如果是升级，先关闭并删除旧版本
        if (shouldUpgrade && fs.existsSync(pluginDir)) {
          // 关闭插件
          if (plugins[pluginId]) {
            await plugins[pluginId].close()
            delete plugins[pluginId]
          }

          // 删除旧目录
          await fsPromises.rm(pluginDir, { recursive: true, force: true })
        }

        const response = await axios.get(zipUrl, {
          responseType: 'arraybuffer'
        })

        // 保存到临时文件
        await fsPromises.writeFile(tempZipPath, Buffer.from(response.data))

        const zip = new AdmZip(tempZipPath)
        zip.extractAllTo(pluginDir, true)

        // 验证 manifest.json 是否存在
        const manifestPath = path.join(pluginDir, 'manifest.json')
        if (!fs.existsSync(manifestPath)) {
          throw new Error('manifest.json not found in extracted plugin')
        }

        // 删除临时 ZIP 文件
        await fsPromises.unlink(tempZipPath)

        return {
          success: true,
          message: shouldUpgrade
            ? `Plugin ${pluginId} upgraded successfully`
            : `Plugin ${pluginId} installed successfully`,
          pluginDir
        }
      } catch (error) {
        // 清理失败的安装
        if (fs.existsSync(tempZipPath)) {
          await fsPromises.unlink(tempZipPath).catch(() => {})
        }
        if (fs.existsSync(pluginDir)) {
          await fsPromises.rm(pluginDir, { recursive: true, force: true }).catch(() => {})
        }
        throw error
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to install plugin: ${error.message || 'Unknown error'}`
      }
    }
  }
)
