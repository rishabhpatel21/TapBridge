import { Platform } from 'react-native';

export const softShadow = {
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 }
    },
    android: {
      elevation: 8
    }
  })
};
