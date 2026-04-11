import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 集成 ESLint，在开发时实时显示 lint 错误和警告
    eslint({
      // 只检查 src 目录下的文件
      include: ['src/**/*.{ts,tsx}'],
      // 遇到错误时不阻止构建，仅显示警告
      failOnError: false,
      // 遇到警告时不阻止构建
      failOnWarning: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        subtitle: 'subtitle-overlay.html',
      },
    },
  },
})