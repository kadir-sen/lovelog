import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovelog',
  appName: 'LoveLog',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // Native uygulama bundle'ından static dist'i serve eder. Canlı backend
    // çağrıları services/apiClient.ts → VITE_API_BASE_URL kontrolünde.
  },
  ios: {
    contentInset: 'always',
    // 'capacitor://localhost' origin → server CORS allowlist'inde.
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a0b2e',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1a0b2e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
