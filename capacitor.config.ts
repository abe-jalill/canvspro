import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.canvaspro.mobile',
  appName: 'CanvasPro',
  webDir: 'dist',
  server: {
    url: 'https://canvaspro.app',
    cleartext: false
  }
};

export default config;