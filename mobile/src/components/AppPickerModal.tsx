import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { AppEntry } from '../types/ws';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  visible: boolean;
  apps: AppEntry[];
  loading: boolean;
  iconsLoading?: boolean;
  iconsTotal?: number;
  error?: string;
  onClose: () => void;
  onRefresh: () => void;
  onSelect: (app: AppEntry) => void;
};

const SVG_PREFIX = 'data:image/svg+xml;utf8,';

export const AppPickerModal = ({
  visible,
  apps,
  loading,
  iconsLoading = false,
  iconsTotal = 0,
  error,
  onClose,
  onRefresh,
  onSelect
}: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(needle) || app.target.toLowerCase().includes(needle)
    );
  }, [apps, query]);

  const showList = !loading || apps.length > 0;
  const iconsLoadedCount = apps.filter((app) => app.icon?.dataUri).length;
  const totalWithIcons = iconsTotal || iconsLoadedCount;
  const allIconsLoaded = totalWithIcons > 0 && iconsLoadedCount >= totalWithIcons;
  const showHeaderSpinner = iconsLoading;
  const showIconProgress = showHeaderSpinner && totalWithIcons > 0;

  const renderIcon = (app: AppEntry) => {
    const uri = app.icon?.dataUri;
    if (!uri) {
      return <Text style={styles.iconFallback}>{app.name.slice(0, 1).toUpperCase()}</Text>;
    }
    if (uri.startsWith(SVG_PREFIX)) {
      try {
        const xml = decodeURIComponent(uri.slice(SVG_PREFIX.length));
        return <SvgXml xml={xml} width={24} height={24} />;
      } catch {
        return <Text style={styles.iconFallback}>{app.name.slice(0, 1).toUpperCase()}</Text>;
      }
    }
    return <Image source={{ uri }} style={styles.iconImage} />;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Installed Apps</Text>
              <Text style={styles.subtitle}>{apps.length} apps</Text>
            </View>
            <View style={styles.headerActions}>
              {showHeaderSpinner ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : null}
              {showIconProgress ? (
                <Text style={styles.progressText}>
                  {iconsLoadedCount}/{totalWithIcons}
                </Text>
              ) : null}
              <Pressable
                onPress={onRefresh}
                disabled={iconsLoading || allIconsLoaded || totalWithIcons === 0}
                style={[
                  styles.actionButton,
                  (iconsLoading || allIconsLoaded || totalWithIcons === 0) && styles.actionButtonDisabled
                ]}
              >
                <Ionicons name="image-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.actionText}>
                  {allIconsLoaded ? 'Icons Ready' : totalWithIcons === 0 ? 'No Icons' : 'Load Icons'}
                </Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search apps"
              placeholderTextColor={colors.textSecondary}
              style={styles.search}
            />
          </View>

          {!showList ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>Scanning apps...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.muted}>No apps found.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                  onPress={() => onSelect(item)}
                >
                  <View style={styles.iconWrap}>
                    {renderIcon(item)}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {item.target}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    maxHeight: '85%'
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.outline,
    marginTop: spacing.sm
  },
  header: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: 2
  },
  progressText: {
    ...typography.label,
    color: colors.textSecondary
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.glass
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionText: {
    ...typography.label,
    color: colors.textPrimary
  },
  closeButton: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.glass
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.md,
    height: 44
  },
  search: {
    flex: 1,
    color: colors.textPrimary
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    marginBottom: spacing.sm
  },
  iconWrap: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  iconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain'
  },
  iconFallback: {
    ...typography.label,
    color: colors.textPrimary
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    ...typography.body,
    color: colors.textPrimary
  },
  rowSubtitle: {
    ...typography.label,
    color: colors.textSecondary
  },
  center: {
    alignItems: 'center',
    padding: spacing.lg
  },
  muted: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.sm
  },
  error: {
    ...typography.body,
    color: colors.danger
  }
  });
