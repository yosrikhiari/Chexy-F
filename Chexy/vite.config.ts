import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    // Add proxy configuration to forward API requests to your Spring backend
    proxy: {
      '/api': {
        target: 'http://localhost:8081', // Your Spring backend URL
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
      '/ws': {
        target: 'http://localhost:8081', // Your Spring backend URL for WebSocket
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
  plugins: [
    react(),
    mode === 'development'
  ].filter(Boolean) as any[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis',
  },
}));
