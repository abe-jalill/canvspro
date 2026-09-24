import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import { rename } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

function capacitorIndexHtml(): Plugin {
  return {
    name: "capacitor-index-html",
    async closeBundle() {
      await rename(
        path.resolve(import.meta.dirname, "dist-mobile/mobile.html"),
        path.resolve(import.meta.dirname, "dist-mobile/index.html"),
      );
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.mobile.gen.ts",
      routeFileIgnorePattern: "(api|lovable)",
    }),
    react(),
    capacitorIndexHtml(),
  ],

  resolve: {
    tsconfigPaths: true,
    alias: {
      "@/lib/account.functions": path.resolve(
        import.meta.dirname,
        "src/mobile-stubs/account.functions.ts",
      ),
      "@/utils/payments.functions": path.resolve(
        import.meta.dirname,
        "src/mobile-stubs/payments.functions.ts",
      ),
    },
  },

  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: {
      input: "mobile.html",
    },
  },
});
