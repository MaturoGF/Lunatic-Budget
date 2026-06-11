import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lunaticbudget.app',
  appName: 'LunaticBudget',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
