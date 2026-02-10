import path from 'path'
import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // Allow imports like "@/App.jsx" to resolve to ./src/App.jsx
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Fix for Rollup "Cannot release a lock that's no longer owned" error
    rollupOptions: {
      maxParallelFileOps: 1,
    },
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    react(),
  ]
});
