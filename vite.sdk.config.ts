import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  // 禁止复制 public 目录（库模式不需要静态资源）
  publicDir: false,
  build: {
    lib: {
      // 入口文件
      entry: resolve(__dirname, 'src/renderer/src/plugin-sdk/index.ts'),
      // 只生成ESM格式
      formats: ['es'],
      // 输出文件名
      fileName: 'index'
    },
    rollupOptions: {
      // 确保外部化依赖，不打包进库中
      external: ['vue']
    },
    // 输出目录
    outDir: resolve(__dirname, 'dist/plugin-sdk'),
    // 清空输出目录
    emptyOutDir: true,
    // 生成sourcemap
    sourcemap: true,
    // 目标环境
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@r': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [
    // 生成.d.ts类型声明文件
    dts({
      tsconfigPath: resolve(__dirname, 'tsconfig.sdk.json'),
      outDir: resolve(__dirname, 'dist/plugin-sdk'),
      rollupTypes: true,
      copyDtsFiles: false,
      logLevel: 'error',
      // 内联打包 mitt 的类型定义
      bundledPackages: ['mitt']
    })
  ]
})
