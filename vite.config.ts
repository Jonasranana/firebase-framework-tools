import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Bibliothèques séparées du code du site : elles changent rarement, donc le navigateur les garde en cache
        // d'une mise en ligne à l'autre (seul le code modifié est retéléchargé) et les télécharge en parallèle.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|wouter)\//.test(id)) return "vendor-react";
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return "vendor-firebase";
          if (/node_modules\/(@radix-ui|cmdk|vaul|lucide-react|class-variance-authority|clsx|tailwind-merge)\//.test(id)) return "vendor-ui";
          if (/node_modules\/(date-fns|react-day-picker)\//.test(id)) return "vendor-date";
          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
