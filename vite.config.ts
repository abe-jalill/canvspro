// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Load non-VITE_ env vars into process.env for server routes only (never into the client bundle).
Object.assign(process.env, loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), ""));

// Public (publishable) backend config fallback: publish builds run without .env,
// which blanked the live site. These values are safe to ship to the browser.
const PUBLIC_BACKEND: Record<string, string> = {
  VITE_SUPABASE_PROJECT_ID: "vqmzhzvugzhmtprklzfm",
  VITE_SUPABASE_URL: "https://vqmzhzvugzhmtprklzfm.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_CG0S1Gz01JTdr_8PO2DTtg_GCmSY5Sx",
};
for (const [k, v] of Object.entries(PUBLIC_BACKEND)) {
  if (!process.env[k]) process.env[k] = v;
  const serverKey = k.replace(/^VITE_/, "");
  if (!process.env[serverKey]) process.env[serverKey] = v;
}

export default defineConfig({
  tanstackStart: {
 
  // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
  // nitro/vite builds from this
   server: { entry: "server" },
},
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
