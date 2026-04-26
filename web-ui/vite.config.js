import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isPublic = process.env.VITE_PUBLIC_BUILD === 'true'

  return {
    plugins: [react(), tailwindcss()],
    base: isPublic ? '/' : '/',
    define: {
      'import.meta.env.VITE_PUBLIC_BUILD': JSON.stringify(process.env.VITE_PUBLIC_BUILD || 'false'),
    },
    build: {
      rollupOptions: {
        output: {
          // Stable filenames (no hash) so Go server can reference them
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  }
})
