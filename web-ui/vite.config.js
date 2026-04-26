import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isPublic = process.env.VITE_PUBLIC_BUILD === 'true'

  return {
    plugins: [react(), tailwindcss()],
    // GitHub Pages uses repo name as base path
    // Local dev uses root
    base: isPublic ? '/xixero/' : '/',
    define: {
      'import.meta.env.VITE_PUBLIC_BUILD': JSON.stringify(process.env.VITE_PUBLIC_BUILD || 'false'),
    },
    build: {
      // In public build, exclude admin code via tree-shaking
      rollupOptions: isPublic ? {
        output: {
          manualChunks: undefined,
        },
      } : {},
    },
  }
})
