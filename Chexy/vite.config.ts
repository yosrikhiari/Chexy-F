import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import * as http from 'node:http';

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
        ws: true,
        agent: new http.Agent({ keepAlive: true }),
        timeout: 60000, // 60 second timeout
        proxyTimeout: 60000
      },
      '/ws': {
        target: 'http://localhost:8081', // Changed from ws:// to http://
        changeOrigin: true,
        secure: false,
        ws: true,
        rewriteWsOrigin: true,
        timeout: 0, // No timeout for WebSocket connections
        proxyTimeout: 0,
        // Add custom headers for WebSocket upgrade
        configure: (proxy, options) => {
          proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
            console.log('[Vite Proxy] WebSocket upgrade request:', req.url);
            // Ensure proper headers are passed through
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });

          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] Proxy error:', err.message);
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Vite Proxy] Response status:', proxyRes.statusCode);
          });
        }
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
