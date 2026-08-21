/// <reference types="@capacitor-firebase/authentication" />
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
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com']
    }
  }
};

export default config;
