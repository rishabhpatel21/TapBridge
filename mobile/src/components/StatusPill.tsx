import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';

export type StatusVariant = 'connected' | 'connecting' | 'disconnected' | 'error';

type Props = {
  status: StatusVariant;
  label?: string;
};

export const StatusPill = ({ status, label }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const statusColors: Record<StatusVariant, string> = {
    connected: colors.success,
    connecting: colors.warning,
    disconnected: colors.danger,
    error: colors.danger
  };

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: statusColors[status] }]} />
      <Text style={styles.label}>{label ?? status}</Text>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.glass
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase'
  }
  });
