import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.liad.shiftclock',
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
