import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("chart.js") || id.includes("react-chartjs-2")) {
            return "charts";
          }

          if (id.includes("jspdf")) {
            return "pdf";
          }

          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }

          if (id.includes("@supabase") || id.includes("axios")) {
            return "network";
          }

          return "vendor";
        }
      }
    }
  }
})
