import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// strictPort keeps the dev server on 5173 so the backend CORS whitelist
// in backend/main.py always matches during the demo.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
