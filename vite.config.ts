import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Đường dẫn tương đối để chạy được trên GitHub Pages (https://user.github.io/repo/)
  base: './',
})
