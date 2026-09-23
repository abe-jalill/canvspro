import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.canvaspro.mobile",
  appName: "CanvasPro",
  // The iOS shell must boot the dedicated client bundle, never the live site.
  webDir: "dist-mobile",
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#090909",
      showSpinner: false,
    },
  },
};

export default config;
