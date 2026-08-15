import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the GitHub Pages subpath build resolves assets.
export default defineConfig({
  base: './',
  plugins: [react()],
})
