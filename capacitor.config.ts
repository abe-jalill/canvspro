import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.canvaspro.mobile',
  appName: 'CanvasPro',
  webDir: 'dist',
  server: {
    url: 'https://canvaspro.app',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#090909',
      showSpinner: false
    }
  }
};

export default config;