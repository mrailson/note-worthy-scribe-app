import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.91f618167ac843e0a21d31572f57dcab',
  appName: 'meetingmagic',
  webDir: 'dist',
  server: {
    url: 'https://91f61816-7ac8-43e0-a21d-31572f57dcab.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: true,
      spinnerColor: '#000000'
    }
  }
};

export default config;