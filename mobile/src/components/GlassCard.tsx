import React, { useMemo } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/spacing';
import { softShadow } from '../theme/shadow';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const GlassCard = ({ children, style }: Props) => {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (Platform.OS === 'android') {
    return <View style={[styles.android, style]}>{children}</View>;
  }

  return (
    <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'} style={[styles.blur, style]}>
      <View style={styles.inner}>{children}</View>
    </BlurView>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => ({
  blur: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.outline,
    ...softShadow
  } as ViewStyle,
  inner: {
    padding: 14,
    backgroundColor: colors.glass
  } as ViewStyle,
  android: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 14,
    ...softShadow
  } as ViewStyle
});
