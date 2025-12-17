import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Important for Chrome Extensions to load assets correctly
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});