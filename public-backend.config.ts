// Public build configuration shared by web and the bundled iOS client.
export function configurePublicBackend() {
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
}
