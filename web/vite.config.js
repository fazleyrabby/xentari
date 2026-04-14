import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/chat': 'http://127.0.0.1:3000',
      '/session': 'http://127.0.0.1:3000',
      '/config': 'http://127.0.0.1:3000',
      '/state': 'http://127.0.0.1:3000',
    }
  }
})
