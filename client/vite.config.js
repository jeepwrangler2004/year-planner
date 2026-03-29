import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:7777',
      '/auth': 'http://localhost:7777',
    }
  },
  preview: {
    host: true,
    allowedHosts: ['2004s-mac-mini.tail0be3ed.ts.net', 'localhost'],
    port: 5173,
    proxy: {
      '/api': 'http://localhost:7777',
      '/auth': 'http://localhost:7777',
    }
  }
})
