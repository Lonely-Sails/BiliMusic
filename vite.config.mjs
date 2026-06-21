import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  build: {
    crossorigin: false,
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'desktop-lyrics': resolve(__dirname, 'pages/desktop-lyrics/index.html'),
        'lyrics-editor': resolve(__dirname, 'pages/lyrics-editor/index.html'),
      }
    }
  },
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.js',
        vite: {
          build: {
            outDir: 'dist-electron',
            rolldownOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'electron/preload.js',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rolldownOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ]
})
