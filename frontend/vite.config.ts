import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: process.env.GITHUB_PAGES === '1' ? '/finance_tracker/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@finance': fileURLToPath(new URL('../shared/finance', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
  },
})
