import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from './Icon';
import { LauncherItem } from '../types/launcher';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { softShadow } from '../theme/shadow';
import { Ionicons } from '@expo/vector-icons';
import { buildWebsiteIcon } from '../utils/website';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  item: LauncherItem;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
  onDrag?: () => void;
};

export const LauncherTile = ({ item, onPress, onLongPress, onDrag }: Props) => {
  const scale = useSharedValue(1);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const displayIcon = useMemo(() => {
    if (item.kind !== 'website') return item.icon;
    if ('uri' in item.icon) return item.icon;
    if (item.icon.set === 'Ionicons' && (item.icon.name === 'apps' || item.icon.name === 'globe-outline')) {
      return buildWebsiteIcon(item.target) ?? item.icon;
    }
    return item.icon;
  }, [item]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 180 });
      }}
      android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
      style={[styles.tile, animatedStyle]}
    >
      <View style={styles.iconWrap}>
        <Icon icon={displayIcon} size={32} />
      </View>
      <Text numberOfLines={1} style={styles.label}>
        {item.name}
      </Text>
      {onDrag ? (
        <Pressable onLongPress={onDrag} style={styles.dragHandle}>
          <Ionicons name="reorder-three" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </AnimatedPressable>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow
  },
  iconWrap: {
    height: 52,
    width: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center'
  },
  dragHandle: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    padding: 4
  }
  });
