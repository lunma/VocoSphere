import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
  server: {
    port: 5173,
    strictPort: true,
  },
})