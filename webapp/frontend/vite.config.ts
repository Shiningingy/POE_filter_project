import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
// Base path: '/' for Cloudflare Pages / custom domain (sharketfilter.xyz);
// the GitHub Pages preview workflow sets VITE_BASE_PATH=/POE_filter_project/.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      react: resolve('node_modules/react'),
      'react-dom': resolve('node_modules/react-dom'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/sounds': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})