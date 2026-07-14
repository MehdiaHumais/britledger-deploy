import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.britledger.app',
  appName: 'BritLedger',
  webDir: 'out',
  server: {
    url: 'https://ledger.britsyncai.com',
    cleartext: true,
  },
  android: {
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
