import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue()],
  resolve: {
    alias: {
      '@r': resolve(__dirname, '../../src/renderer/src'),
      src: resolve(__dirname, '../../src'),
      nodeCan: resolve(__dirname, '../../src/main/share')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5199,
    strictPort: true,
    fs: { allow: [resolve(__dirname, '../..')] }
  }
})
