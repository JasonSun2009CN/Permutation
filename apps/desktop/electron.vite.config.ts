import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

const alias = {
  '@permutation/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
  '@permutation/db': resolve(__dirname, '../../packages/db/src/index.ts'),
  '@permutation/agent': resolve(__dirname, '../../packages/agent/src/index.ts'),
  '@permutation/tools': resolve(__dirname, '../../packages/tools/src/index.ts'),
  '@permutation/scheduler': resolve(__dirname, '../../packages/scheduler/src/index.ts'),
  '@permutation/connectors': resolve(__dirname, '../../packages/connectors/src/index.ts'),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
})
