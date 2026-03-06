import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // for npm run dev
    port: 5173,
  },
  preview: {
    host: true,   // for npm run preview
    port: 4173,
  },
})
