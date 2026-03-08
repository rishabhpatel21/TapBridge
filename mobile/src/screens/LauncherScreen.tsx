import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { AddEditModal } from '../components/AddEditModal';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { LauncherTile } from '../components/LauncherTile';
import { StatusPill } from '../components/StatusPill';
import { useLauncherItemsContext } from '../state/LauncherItemsContext';
import { useConnectionContext } from '../state/ConnectionContext';
import { IconSpec, LauncherItem } from '../types/launcher';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';

const NUM_COLUMNS = 3;
const KNOWN_APPS_KEY = 'tapbridge_known_apps_v1';
const AUTO_ADD_APPS = true;
const defaultAutoIcon: IconSpec = { set: 'Ionicons', name: 'apps', color: '#7fe5ff' };

type Props = NativeStackScreenProps<RootStackParamList, 'Launcher'>;

type AnimatedTileProps = {
  delay: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const AnimatedTile = ({ delay, style, children }: AnimatedTileProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        delay,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        delay,
        useNativeDriver: true
      })
    ]);

    animation.start();

    return () => animation.stop();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

const LauncherScreen = ({ navigation }: Props) => {
  const { items, loading, upsertItem, updateItem, removeItem, reorderItems } = useLauncherItemsContext();
  const { status, send, ip, apps } = useConnectionContext();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LauncherItem | undefined>(undefined);
  const { colors, scheme, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const knownAppsRef = useRef<Set<string> | null>(null);
  const [knownLoaded, setKnownLoaded] = useState(false);

  const gridData = useMemo(() => items, [items]);

  useEffect(() => {
    let mounted = true;
    const loadKnown = async () => {
      try {
        const raw = await AsyncStorage.getItem(KNOWN_APPS_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          knownAppsRef.current = new Set(parsed);
        } else {
          knownAppsRef.current = null;
        }
      } catch {
        knownAppsRef.current = null;
      }
      setKnownLoaded(true);
    };
    loadKnown();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!knownLoaded || apps.length === 0) return;
    const currentIds = new Set(apps.map((app) => app.id));
    if (knownAppsRef.current === null) {
      knownAppsRef.current = currentIds;
      AsyncStorage.setItem(KNOWN_APPS_KEY, JSON.stringify([...currentIds])).catch(() => {
        // ignore
      });
      return;
    }

    const known = knownAppsRef.current;
    const newApps = apps.filter((app) => !known.has(app.id));
    if (AUTO_ADD_APPS && newApps.length > 0) {
      newApps.forEach((app) => {
        const iconSpec: IconSpec =
          app.icon?.dataUri && app.icon.dataUri.length > 0
            ? { type: 'image', uri: app.icon.dataUri }
            : defaultAutoIcon;
        upsertItem({
          id: app.id,
          name: app.name,
          kind: 'app',
          target: app.target,
          icon: iconSpec
        });
      });
    }

    knownAppsRef.current = currentIds;
    AsyncStorage.setItem(KNOWN_APPS_KEY, JSON.stringify([...currentIds])).catch(() => {
      // ignore
    });
  }, [apps, knownLoaded, upsertItem]);

  useEffect(() => {
    if (apps.length === 0 || items.length === 0) return;
    apps.forEach((app) => {
      const dataUri = app.icon?.dataUri;
      if (!dataUri) return;
      const existing = items.find((item) => item.id === app.id && item.kind === 'app');
      if (!existing) return;
      if ('uri' in existing.icon && existing.icon.uri === dataUri) return;
      if ('uri' in existing.icon) return;
      updateItem({
        ...existing,
        icon: { type: 'image', uri: dataUri }
      });
    });
  }, [apps, items, updateItem]);

  const handleLaunch = (item: LauncherItem) => {
    send({
      type: 'launch',
      payload: {
        id: item.id,
        name: item.name,
        kind: item.kind,
        target: item.target
      }
    });
  };

  const openAdd = () => {
    setEditingItem(undefined);
    setShowModal(true);
  };

  const openEdit = (item: LauncherItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  return (
    <LinearGradient colors={[colors.bg, colors.bgElevated]} style={styles.container}>
      <View style={styles.orb} />
      <View style={styles.orbAccent} />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Launchpad</Text>
          <Text style={styles.subtitle}>Connected to {ip || 'PC'}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={toggleTheme} style={styles.themeToggle}>
            <Ionicons
              name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={colors.textPrimary}
            />
          </Pressable>
          <StatusPill
            status={
              status === 'error'
                ? 'error'
                : status === 'connected'
                ? 'connected'
                : status === 'connecting'
                ? 'connecting'
                : 'disconnected'
            }
            label={status}
          />
        </View>
      </View>

      {status === 'disconnected' ? (
        <View style={styles.disconnectedBanner}>
          <Text style={styles.disconnectedText}>Connection lost.</Text>
          <Text style={styles.disconnectedLink} onPress={() => navigation.replace('Connection')}>
            Tap to reconnect
          </Text>
        </View>
      ) : null}

      {loading ? (
        <Text style={styles.subtitle}>Loading...</Text>
      ) : (
        <DraggableFlatList
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          onDragEnd={({ data }) => reorderItems(data)}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          renderItem={({ item, index, drag }) => (
            <ScaleDecorator>
              <AnimatedTile delay={index * 40} style={styles.tileWrap}>
                <LauncherTile
                  item={item}
                  index={index}
                  onPress={() => handleLaunch(item)}
                  onLongPress={() => openEdit(item)}
                  onDrag={drag}
                />
              </AnimatedTile>
            </ScaleDecorator>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No shortcuts yet</Text>
              <Text style={styles.subtitle}>Tap + to add your first app or website.</Text>
            </View>
          )}
        />
      )}

      <FloatingActionButton onPress={openAdd} />

      <AddEditModal
        visible={showModal}
        initialItem={editingItem}
        onClose={() => setShowModal(false)}
        onSave={(item) => {
          if (editingItem) {
            updateItem(item);
          } else {
            upsertItem(item);
          }
        }}
        onDelete={(item) => {
          removeItem(item.id);
          setShowModal(false);
        }}
      />
    </LinearGradient>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.xl
  },
  orb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(93, 228, 199, 0.08)',
    top: -80,
    left: -60
  },
  orbAccent: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 180, 84, 0.08)',
    bottom: -60,
    right: -40
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  themeToggle: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  disconnectedBanner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(246, 196, 83, 0.12)',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  disconnectedText: {
    ...typography.body,
    color: colors.textPrimary
  },
  disconnectedLink: {
    ...typography.label,
    color: colors.accentWarm
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120
  },
  row: {
    gap: spacing.md
  },
  tileWrap: {
    flex: 1,
    marginBottom: spacing.md
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm
  },
  disconnectedHint: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    color: colors.warning,
    ...typography.body
  }
  });

export default LauncherScreen;
