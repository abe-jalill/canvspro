import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.canvaspro.mobile',
  appName: 'CanvasPro',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  },
  server: {
    cleartext: false
  }
};

export default config;