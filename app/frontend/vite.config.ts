import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "PTSaq — Hub de Operações",
        short_name: "PTSaq",
        description: "Hub de operações do Parque Tecnológico de Saquarema",
        start_url: "/",
        display: "standalone",
        background_color: "#FFF9E7",
        theme_color: "#136AA0",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the read paths so the shell keeps working offline; writes
        // (PATCH/POST) always go straight to the network — offline queuing
        // for those is handled client-side, not by the service worker.
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.method === "GET",
            handler: "NetworkFirst",
            options: { cacheName: "app-shell", networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
