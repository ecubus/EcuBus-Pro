import { defineConfig, mergeConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs/promises'
import { normalizePath, Plugin } from 'vite'

export const nodejsPolarsDirnamePlugin = () => {
  const name = 'nodejs-polars-dirname-plugin'
  return {
    name,

    transform(code: string, id: string) {
      // aim for the node_modules/nodejs-polars/bin/native-polars.js file
      if (id.endsWith('.node')) {
        const file = path.basename(id)
        return `
                // create a custom require function to load .node files
                import { createRequire } from 'module';
                const customRequire = createRequire(import.meta.url)

                // load the .node file expecting it to be in the same directory as the output bundle
                const content = customRequire('./${file}')

                // export the content straight back out again
                export default content
                `
      } else if (id.includes('?asset')) {
        const file = path.basename(id)
        // Remove query parameters
        const cleanFile = file.split('?')[0]
        return `
                import { join } from 'path'
                export default join(__dirname, "${cleanFile}")
                `
      } else if (id.includes('?asarUnpack')) {
        const file = path.basename(id)
        // Remove query parameters
        const cleanFile = file.split('?')[0]
        return `
                import { join } from 'path'
                export default join(__dirname, "${cleanFile}")
                `
      }
      // else return the original code (leave code unrelated to nodejs-polars untouched)
      return code
    }
  }
}

//export default mergeConfig(config.main as any, defineConfig({
export default defineConfig({
  test: {
    // 全局设置文件，在所有测试文件运行前执行
    setupFiles: ['./test/setup.ts']
    // 或者使用 setupFilesAfterEnv，在测试环境设置后执行
    // setupFilesAfterEnv: ['./test/setup-after-env.ts'],
    // 全局设置，在整个测试套件开始前执行一次
    // globalSetup: './test/global-setup.ts',
    // 全局清理，在整个测试套件结束后执行一次
    // globalTeardown: './test/global-teardown.ts',
  },
  plugins: [nodejsPolarsDirnamePlugin()]
})
