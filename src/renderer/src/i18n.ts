import i18next from 'i18next'
import I18NextVue from 'i18next-vue'
import type { App } from 'vue'

// 翻译资源缓存
const resources: Record<string, any> = {}

// 加载指定语言的翻译（同步版本）
function loadLanguageSync(lang: string) {
  try {
    const allTranslations = window.electron.ipcRenderer.sendSync('get-all-translations-sync', lang)
    return allTranslations
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error)
    return { translation: {} }
  }
}

// 初始化 i18next - 只加载当前语言
export const initRendererI18n = (lng: string = 'en') => {
  // 只加载当前语言的翻译
  const translations = loadLanguageSync(lng)
  resources[lng] = translations

  // 获取所有命名空间（主应用 + 所有插件）
  const namespaces = Object.keys(translations)

  i18next.init({
    lng,
    fallbackLng: 'en',
    resources,
    ns: namespaces,
    defaultNS: 'translation',
    debug: false,
    interpolation: {
      escapeValue: false
    }
  })

  console.log(`i18n initialized with language: ${lng}`)
  return i18next
}

// 切换语言（按需加载新语言）
export const reloadRendererTranslations = (lng: string) => {
  // 检查该语言是否已加载
  if (!resources[lng]) {
    console.log(`Loading translations for language: ${lng}`)
    // 加载新语言的翻译
    const translations = loadLanguageSync(lng)
    resources[lng] = translations

    // 添加到 i18next
    for (const [ns, content] of Object.entries(translations)) {
      i18next.addResourceBundle(lng, ns, content, true, true)
    }
  } else {
    console.log(`Using cached translations for language: ${lng}`)
  }

  // 切换到新语言
  i18next.changeLanguage(lng)

  // 保存语言偏好到 electron-store
  try {
    window.electron.ipcRenderer.sendSync('set-language-sync', lng)
  } catch (error) {
    console.error('Failed to save language preference:', error)
  }
}

// 预加载指定语言（可选，用于预加载常用语言）
export const preloadLanguages = (languages: string[]) => {
  console.log(`Preloading languages: ${languages.join(', ')}`)

  for (const lang of languages) {
    if (!resources[lang]) {
      const translations = loadLanguageSync(lang)
      resources[lang] = translations

      // 添加到 i18next
      for (const [ns, content] of Object.entries(translations)) {
        i18next.addResourceBundle(lang, ns, content, false, false)
      }
    }
  }
}

// Vue 插件
export const i18nPlugin = {
  install: (app: App) => {
    app.use(I18NextVue, { i18next })
  }
}

export { i18next }
