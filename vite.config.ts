import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Tauri expects a fixed port and no screen clearing so Rust errors stay visible.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  preview: { port: 4330, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: { target: 'es2022' },
});
