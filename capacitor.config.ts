import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.liadbenaharon.shiftclock',
  appName: 'שעון נוכחות',
  webDir: 'web',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
