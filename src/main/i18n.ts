import i18next from 'i18next'
import { dirname, join, relative } from 'path'
import fs from 'fs/promises'
import { glob } from 'glob'
import localesPath from '../../resources/locales/.gitkeep?asset&asarUnpack'
import log from 'electron-log'
import { getPluginsDirectory } from './ipc/plugin'

// 缓存
const translationsCache = new Map<string, Record<string, any>>()
let supportedLanguagesCache: string[] | null = null

// 获取主应用 locales 目录路径
export const getAppLocalesPath = () => {
  // localesPath 会指向 resources/locales/en/translation.json
  // 我们需要返回 resources/locales 目录
  const localesDir = dirname(localesPath)
  return localesDir
}

// 使用 glob 加载指定语言的所有翻译文件并合并为一个大的 JSON
async function loadAllTranslations(lng: string): Promise<Record<string, any>> {
  const merged: Record<string, any> = {}
  const appLocalesPath = getAppLocalesPath()

  try {
    // 加载主应用翻译：locales/{lng}/translation.json
    const appPattern = join(appLocalesPath, lng, 'translation.json').replace(/\\/g, '/')
    const appFiles = await glob(appPattern)

    for (const file of appFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        const translations = JSON.parse(content)
        Object.assign(merged, translations)
      } catch (error) {
        log.error(`Failed to load app translation from ${file}:`, error)
      }
    }

    // 加载插件翻译：plugins/*/locales/{lng}/translation.json
    const pluginsDir = getPluginsDirectory()
    const pluginPattern = join(pluginsDir, '*', 'locales', lng, 'translation.json').replace(
      /\\/g,
      '/'
    )
    const pluginFiles = await glob(pluginPattern)

    for (const file of pluginFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8')
        const translations = JSON.parse(content)
        // 插件翻译直接覆盖主应用翻译
        Object.assign(merged, translations)
      } catch (error) {
        log.error(`Failed to load plugin translation from ${file}:`, error)
      }
    }
  } catch (error) {
    log.error(`Failed to load translations for ${lng}:`, error)
  }

  return merged
}

// 从 i18next 获取已加载的翻译（如果已初始化）
export function getAllTranslationsFromI18next(lng: string): Record<string, any> | null {
  if (!i18next.isInitialized) {
    return null
  }

  // 使用 hasResourceBundle 检查该语言是否已加载
  if (!i18next.hasResourceBundle(lng, 'translation')) {
    return null
  }

  // 获取 translation 命名空间的翻译（插件翻译已合并到其中）
  const bundle = i18next.getResourceBundle(lng, 'translation')
  return bundle || null
}

// 获取所有翻译 - 供 IPC 使用
// 优先从 i18next 获取，如果未初始化则读取文件
export async function getAllTranslations(lng: string): Promise<Record<string, any>> {
  // 优先从已加载的 i18next 获取
  const cachedTranslations = getAllTranslationsFromI18next(lng)
  if (cachedTranslations) {
    return cachedTranslations
  }

  // 检查缓存
  if (translationsCache.has(lng)) {
    return translationsCache.get(lng)!
  }

  // 如果 i18next 未初始化或该语言未加载，则使用 glob 读取文件
  const translations = await loadAllTranslations(lng)
  translationsCache.set(lng, translations)
  return translations
}

export const initMainI18n = async (lng: string = 'en') => {
  // 使用 glob 加载所有翻译并合并为一个大的 JSON
  const mergedTranslations = await loadAllTranslations(lng)

  // 更新缓存
  translationsCache.set(lng, mergedTranslations)

  // 构建资源对象
  const resources = {
    [lng]: {
      translation: mergedTranslations
    }
  }

  await i18next.init({
    lng,
    fallbackLng: 'en',
    resources,
    ns: ['translation'],
    defaultNS: 'translation',
    debug: false
  })

  return i18next
}

// 重新加载翻译（用于语言切换或插件动态加载）
export const reloadTranslations = async (lng: string) => {
  // 使用 glob 加载所有翻译并合并为一个大的 JSON
  const mergedTranslations = await loadAllTranslations(lng)

  // 更新缓存
  translationsCache.set(lng, mergedTranslations)

  // 添加或更新资源
  i18next.addResourceBundle(lng, 'translation', mergedTranslations, true, true)

  await i18next.changeLanguage(lng)
}

// 清除翻译缓存（用于插件加载/卸载后）
export function clearTranslationsCache(lng?: string) {
  if (lng) {
    translationsCache.delete(lng)
  } else {
    translationsCache.clear()
  }
}

// 清除支持语言缓存
export function clearSupportedLanguagesCache() {
  supportedLanguagesCache = null
}

// 获取所有支持的语言（使用 glob 从主应用和插件中扫描）
export async function getAllSupportedLanguages(): Promise<string[]> {
  // 检查缓存
  if (supportedLanguagesCache) {
    return supportedLanguagesCache
  }

  const languageSet = new Set<string>()
  const appLocalesPath = getAppLocalesPath()

  try {
    // 扫描主应用支持的语言：locales/*/translation.json
    const appPattern = join(appLocalesPath, '*', 'translation.json').replace(/\\/g, '/')
    const appFiles = await glob(appPattern)

    for (const file of appFiles) {
      const relativePath = relative(appLocalesPath, file)
      const lng = relativePath.split(/[/\\]/)[0]
      languageSet.add(lng)
    }

    // 扫描插件支持的语言：plugins/*/locales/*/translation.json
    const pluginsDir = getPluginsDirectory()
    const pluginPattern = join(pluginsDir, '*', 'locales', '*', 'translation.json').replace(
      /\\/g,
      '/'
    )
    const pluginFiles = await glob(pluginPattern)

    for (const file of pluginFiles) {
      const relativePath = relative(pluginsDir, file)
      const parts = relativePath.split(/[/\\]/)
      const lng = parts[parts.length - 2] // locales 目录下的子目录名
      languageSet.add(lng)
    }
  } catch (error) {
    log.error('Failed to scan supported languages:', error)
  }

  // 返回排序后的语言列表（确保 en 在前）
  const languages = Array.from(languageSet).sort((a, b) => {
    if (a === 'en') return -1
    if (b === 'en') return 1
    return a.localeCompare(b)
  })

  // 更新缓存
  supportedLanguagesCache = languages

  return languages
}

export { i18next }
