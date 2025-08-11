import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import ConditionalCompile from 'vite-plugin-conditional-compiler'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), ConditionalCompile()],
    resolve: {
      // src
      alias: {
        src: resolve(__dirname, 'src')
      }
    },
    build: {
      target: 'node18',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/cli/index.ts'),
          fake: resolve(__dirname, 'src/cli/fake.ts')
        },
        output: {
          entryFileNames: 'ecb_cli.js',
          format: 'cjs',
          dir: resolve(__dirname, 'cli/out/')
        }
      }
    }
  }
})
