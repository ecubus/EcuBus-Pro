import { ipcMain } from 'electron'
import { join } from 'path'
import fsSync from 'fs'
import log from 'electron-log'
import Store from 'electron-store'
import {
  getAllTranslationsSync,
  getAppLocalesPath,
  getPluginsDir,
  reloadTranslations
} from '../i18n'

const store = new Store()

// 语言信息接口
export interface LanguageInfo {
  code: string // 语言代码，如 'en', 'zh'
  name: string // 语言名称，如 'English', '中文'
  nativeName: string // 本地语言名称
}

// 支持的语言配置
const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' }
]

// 返回所有翻译（主应用 + 插件）- 同步版本
ipcMain.on('get-all-translations-sync', (event, lang: string) => {
  event.returnValue = getAllTranslationsSync(lang)
})

// 返回系统支持的所有语言 - 同步版本
ipcMain.on('get-supported-languages-sync', (event) => {
  const appLocalesPath = getAppLocalesPath()
  const appLanguages: string[] = []

  // 获取主应用支持的语言
  try {
    const entries = fsSync.readdirSync(appLocalesPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const translationPath = join(appLocalesPath, entry.name, 'translation.json')
      if (fsSync.existsSync(translationPath)) {
        appLanguages.push(entry.name)
      }
    }
  } catch (error) {
    log.error('Failed to scan app locales:', error)
  }

  // 获取插件支持的语言
  const pluginLanguagesSet = new Set<string>()
  const pluginsDir = getPluginsDir()

  try {
    const entries = fsSync.readdirSync(pluginsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pluginLocalesPath = join(pluginsDir, entry.name, 'locales')
      try {
        const localeEntries = fsSync.readdirSync(pluginLocalesPath, { withFileTypes: true })
        for (const localeEntry of localeEntries) {
          if (!localeEntry.isDirectory()) continue
          const translationPath = join(pluginLocalesPath, localeEntry.name, 'translation.json')
          if (fsSync.existsSync(translationPath)) {
            pluginLanguagesSet.add(localeEntry.name)
          }
        }
      } catch {
        // 插件没有 locales 目录
      }
    }
  } catch {
    // 插件目录不存在
  }

  // 合并语言
  const allLanguageCodes = new Set([...appLanguages, ...pluginLanguagesSet])
  const supportedLanguages: LanguageInfo[] = []

  for (const code of allLanguageCodes) {
    const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === code)
    if (langInfo) {
      supportedLanguages.push(langInfo)
    } else {
      supportedLanguages.push({
        code,
        name: code.toUpperCase(),
        nativeName: code.toUpperCase()
      })
    }
  }

  // 按代码排序，确保 en 在前
  event.returnValue = supportedLanguages.sort((a, b) => {
    if (a.code === 'en') return -1
    if (b.code === 'en') return 1
    return a.code.localeCompare(b.code)
  })
})

// 设置语言（同步保存并异步更新主进程 i18next）
ipcMain.on('set-language-sync', (event, lang: string) => {
  try {
    // 保存到 electron-store
    store.set('language', lang)

    // 异步重新加载主进程翻译（不阻塞响应）
    reloadTranslations(lang).catch((error) => {
      log.error('Failed to reload main process translations:', error)
    })

    log.info(`Language changed to: ${lang}`)
    event.returnValue = { success: true }
  } catch (error) {
    log.error('Failed to set language:', error)
    event.returnValue = { success: false, error: String(error) }
  }
})
