import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      process: path.resolve(__dirname, 'node_modules/process/browser.js'),
      buffer: path.resolve(__dirname, 'node_modules/buffer'),
      util: path.resolve(__dirname, 'node_modules/util'),
      stream: path.resolve(__dirname, 'node_modules/stream-browserify'),
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    target: 'esnext',
  },
})