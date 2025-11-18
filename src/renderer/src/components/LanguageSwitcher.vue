<template>
  <div class="language-switcher">
    <el-select
      v-model="currentLanguage"
      size="small"
      :loading="loading"
      style="width: 200px"
      @change="handleLanguageChange"
    >
      <el-option
        v-for="lang in supportedLanguages"
        :key="lang.code"
        :label="lang.nativeName"
        :value="lang.code"
      >
        <span>{{ lang.nativeName }}</span>
        <span style="color: var(--el-text-color-secondary); float: right">
          {{ lang.name }}
        </span>
      </el-option>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTranslation } from 'i18next-vue'
import { reloadRendererTranslations } from '../i18n'

interface LanguageInfo {
  code: string
  name: string
  nativeName: string
}

const { i18next } = useTranslation()

const currentLanguage = ref(i18next.language || 'en')
const supportedLanguages = ref<LanguageInfo[]>([])
const loading = ref(false)

// 加载支持的语言列表（同步）
const loadSupportedLanguages = () => {
  try {
    const languages = window.electron.ipcRenderer.sendSync('get-supported-languages-sync')
    supportedLanguages.value = languages
  } catch (error) {
    console.error('Failed to load supported languages:', error)
    // 回退到默认语言
    supportedLanguages.value = [{ code: 'en', name: 'English', nativeName: 'English' }]
  }
}

// 切换语言（同步）
const handleLanguageChange = (lang: string) => {
  try {
    loading.value = true

    // 重新加载翻译（同步）
    reloadRendererTranslations(lang)

    currentLanguage.value = lang

    console.log(`Language changed to: ${lang}`)
  } catch (error) {
    console.error('Failed to change language:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSupportedLanguages()

  // 同步当前语言状态（已在 main.ts 初始化时设置）
  currentLanguage.value = i18next.language || 'en'
})
</script>

<style scoped>
.language-switcher {
  display: inline-block;
}

:deep(.el-select__wrapper) {
  min-width: 120px;
}
</style>
