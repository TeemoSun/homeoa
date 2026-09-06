import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地开发时前端由 Vite 托管，/api 代理到 Go 后端；生产构建产物由 go:embed 托管
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2048,
  },
})
