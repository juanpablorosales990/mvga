import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.mvga.wallet',
  appName: 'MVGA Wallet',
  webDir: 'dist',
  server: {
    hostname: 'app.mvga.io',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 300,
      backgroundColor: '#0a0a0a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    scheme: 'mvga',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
