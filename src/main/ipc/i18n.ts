import { ipcMain } from 'electron'
import log from 'electron-log'
import Store from 'electron-store'
import { getAllSupportedLanguages, getAllTranslations, reloadTranslations } from '../i18n'

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

// 返回指定语言的翻译（主应用 + 插件）
ipcMain.handle('get-all-translations', async (_event, lang: string) => {
  return getAllTranslations(lang)
})

// 返回系统支持的所有语言
ipcMain.handle('get-supported-languages', async () => {
  const languageCodes = await getAllSupportedLanguages()
  const supportedLanguages: LanguageInfo[] = []

  for (const code of languageCodes) {
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

  return supportedLanguages
})

// 设置语言
ipcMain.handle('set-language', async (_event, lang: string) => {
  try {
    // 保存到 electron-store
    store.set('language', lang)

    // 重新加载主进程翻译
    await reloadTranslations(lang)

    log.info(`Language changed to: ${lang}`)
    return { success: true }
  } catch (error) {
    log.error('Failed to set language:', error)
    return { success: false, error: String(error) }
  }
})
