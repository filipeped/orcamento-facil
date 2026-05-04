import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    // Remove console.logs em produção
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // html2pdf é ~982KB mas é lazy loaded
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          vendor: ["react", "react-dom", "react-router-dom"],
          // Supabase client
          supabase: ["@supabase/supabase-js"],
          // UI components (Radix primitives)
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
          ],
          // Form and validation
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          // Date utilities
          dates: ["date-fns", "react-day-picker"],
          // React Query
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));
