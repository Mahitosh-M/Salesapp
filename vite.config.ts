import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') } },
  plugins: [tailwindcss(), react()],
  server: { port: 5175, strictPort: true },
});
