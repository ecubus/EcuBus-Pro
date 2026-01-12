import i18next from 'i18next'
import I18NextVue from 'i18next-vue'
import type { App } from 'vue'

// 翻译资源缓存
const resources: Record<string, { translation: Record<string, any> }> = {}

// 加载指定语言的翻译
async function loadLanguage(lang: string): Promise<Record<string, any>> {
  try {
    const allTranslations = await window.electron.ipcRenderer.invoke('get-all-translations', lang)
    return allTranslations
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error)
    return {}
  }
}

// 初始化 i18next - 只加载当前语言
export const initRendererI18n = async (lng: string = 'en') => {
  // check lng exists in supported languages
  const supportedLanguages = await getSupportedLanguages()
  if (!supportedLanguages.some((l) => l.code === lng)) {
    lng = 'en'
  }

  // 只加载当前语言的翻译
  const translations = await loadLanguage(lng)

  // 构建正确的 resources 结构: { lng: { translation: {...} } }
  resources[lng] = { translation: translations }

  await i18next.init({
    lng,
    fallbackLng: 'en',
    resources,
    ns: ['translation'],
    defaultNS: 'translation',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  })
  return i18next
}

// 切换语言（按需加载新语言）
export const reloadRendererTranslations = async (lng: string) => {
  // 检查该语言是否已加载
  if (!resources[lng]) {
    // 加载新语言的翻译
    const translations = await loadLanguage(lng)
    resources[lng] = { translation: translations }

    // 添加到 i18next
    i18next.addResourceBundle(lng, 'translation', translations, true, true)
  }

  // 切换到新语言
  await i18next.changeLanguage(lng)

  // 保存语言偏好到 electron-store
  try {
    await window.electron.ipcRenderer.invoke('set-language', lng)
  } catch (error) {
    console.error('Failed to save language preference:', error)
  }
}

// 获取支持的语言列表
export const getSupportedLanguages = async () => {
  try {
    return await window.electron.ipcRenderer.invoke('get-supported-languages')
  } catch (error) {
    console.error('Failed to get supported languages:', error)
    return [{ code: 'en', name: 'English', nativeName: 'English' }]
  }
}

// Vue 插件
export const i18nPlugin = {
  install: (app: App) => {
    app.use(I18NextVue, { i18next })
  }
}
