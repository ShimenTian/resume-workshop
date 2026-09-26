import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative assets let the same build run at a domain root or a static subdirectory.
  base: './',
  plugins: [react()],
});
