import i18next from 'i18next'
import { dirname, join } from 'path'
import { app } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import localesPath from '../../resources/locales/.gitkeep?asset&asarUnpack'
import log from 'electron-log'

// 获取主应用 locales 目录路径
export const getAppLocalesPath = () => {
  // localesPath 会指向 resources/locales/en/translation.json
  // 我们需要返回 resources/locales 目录
  const localesDir = dirname(localesPath)
  return localesDir
}

// 获取插件目录
export const getPluginsDir = () => {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'plugins')
}

// 加载主应用翻译
async function loadAppTranslations(lng: string): Promise<any> {
  try {
    const translationPath = join(getAppLocalesPath(), lng, 'translation.json')
    const content = await fs.readFile(translationPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    log.error(`Failed to load app translation for ${lng}:`, error)
    return {}
  }
}

// 加载所有插件的翻译
async function loadPluginTranslations(lng: string): Promise<Record<string, any>> {
  const pluginTranslations: Record<string, any> = {}
  const pluginsDir = getPluginsDir()

  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginId = entry.name
      const pluginLocalesPath = join(pluginsDir, pluginId, 'locales', lng, 'translation.json')

      try {
        const content = await fs.readFile(pluginLocalesPath, 'utf-8')
        pluginTranslations[pluginId] = JSON.parse(content)
      } catch (error) {
        // 插件可能没有提供翻译文件，这是正常的
        continue
      }
    }
  } catch (error) {
    log.error('Failed to load plugin translations:', error)
  }

  return pluginTranslations
}

// 加载主应用翻译（同步版本）
export function loadAppTranslationsSync(lng: string): any {
  try {
    const translationPath = join(getAppLocalesPath(), lng, 'translation.json')
    const content = fsSync.readFileSync(translationPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    log.error(`Failed to load app translation for ${lng}:`, error)
    return {}
  }
}

// 加载所有插件的翻译（同步版本）
export function loadPluginTranslationsSync(lng: string): Record<string, any> {
  const pluginTranslations: Record<string, any> = {}
  const pluginsDir = getPluginsDir()

  try {
    const entries = fsSync.readdirSync(pluginsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginId = entry.name
      const pluginLocalesPath = join(pluginsDir, pluginId, 'locales', lng, 'translation.json')

      try {
        const content = fsSync.readFileSync(pluginLocalesPath, 'utf-8')
        pluginTranslations[pluginId] = JSON.parse(content)
      } catch {
        // 插件可能没有提供翻译文件，这是正常的
        continue
      }
    }
  } catch (error) {
    log.error('Failed to load plugin translations:', error)
  }

  return pluginTranslations
}

// 从 i18next 获取已加载的翻译（如果已初始化）
export function getAllTranslationsFromI18next(lng: string): Record<string, any> | null {
  if (!i18next.isInitialized) {
    return null
  }

  // 检查该语言是否已加载
  const languages = i18next.languages || []
  if (!languages.includes(lng)) {
    return null
  }

  // 获取所有命名空间的翻译
  const namespaces = i18next.options.ns as string[]
  const result: Record<string, any> = {}

  for (const ns of namespaces) {
    const bundle = i18next.getResourceBundle(lng, ns)
    if (bundle) {
      result[ns] = bundle
    }
  }

  return result
}

// 获取所有翻译（同步版本）- 供 IPC 使用
// 优先从 i18next 获取，如果未初始化则读取文件
export function getAllTranslationsSync(lng: string): Record<string, any> {
  // 优先从已加载的 i18next 获取
  const cachedTranslations = getAllTranslationsFromI18next(lng)
  if (cachedTranslations) {
    return cachedTranslations
  }

  // 如果 i18next 未初始化或该语言未加载，则读取文件
  const appTranslations = loadAppTranslationsSync(lng)
  const pluginTranslations = loadPluginTranslationsSync(lng)

  return {
    translation: appTranslations,
    ...pluginTranslations
  }
}

export const initMainI18n = async (lng: string = 'en') => {
  // 加载主应用翻译
  const appTranslations = await loadAppTranslations(lng)

  // 加载插件翻译
  const pluginTranslations = await loadPluginTranslations(lng)

  // 构建资源对象
  const resources = {
    [lng]: {
      translation: appTranslations,
      ...pluginTranslations // 插件翻译作为独立的命名空间
    }
  }

  await i18next.init({
    lng,
    fallbackLng: 'en',
    resources,
    ns: ['translation', ...Object.keys(pluginTranslations)],
    defaultNS: 'translation',
    debug: false
  })

  return i18next
}

// 重新加载翻译（用于语言切换或插件动态加载）
export const reloadTranslations = async (lng: string) => {
  const appTranslations = await loadAppTranslations(lng)
  const pluginTranslations = await loadPluginTranslations(lng)

  // 添加或更新资源
  i18next.addResourceBundle(lng, 'translation', appTranslations, true, true)

  for (const [pluginId, translations] of Object.entries(pluginTranslations)) {
    i18next.addResourceBundle(lng, pluginId, translations, true, true)
  }

  await i18next.changeLanguage(lng)
}

export { i18next }
