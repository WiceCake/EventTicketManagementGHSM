import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: { watch: { usePolling: true } },
  plugins: [
    vue(),
    tailwindcss()
  ],
})
