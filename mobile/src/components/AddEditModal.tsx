import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LauncherItem, LauncherKind, IconSpec } from '../types/launcher';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Icon } from './Icon';
import { IconPicker } from './IconPicker';
import { createId } from '../utils/id';
import { useConnectionContext } from '../state/ConnectionContext';
import { AppPickerModal } from './AppPickerModal';

const defaultIcon: IconSpec = { set: 'Ionicons', name: 'apps', color: '#7fe5ff' };

type Props = {
  visible: boolean;
  initialItem?: LauncherItem;
  onClose: () => void;
  onSave: (item: LauncherItem) => void;
  onDelete?: (item: LauncherItem) => void;
};

export const AddEditModal = ({ visible, initialItem, onClose, onSave, onDelete }: Props) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LauncherKind>('app');
  const [target, setTarget] = useState('');
  const [icon, setIcon] = useState<IconSpec>(defaultIcon);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { status, apps, appsLoading, iconsLoading, iconsTotal, appsError, requestApps } = useConnectionContext();

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name);
      setKind(initialItem.kind);
      setTarget(initialItem.target);
      setIcon(initialItem.icon ?? defaultIcon);
    } else {
      setName('');
      setKind('app');
      setTarget('');
      setIcon(defaultIcon);
    }
  }, [initialItem, visible]);

  const title = useMemo(() => (initialItem ? 'Edit Shortcut' : 'New Shortcut'), [initialItem]);

  const handleSave = () => {
    const trimmedName = name.trim() || 'Untitled';
    const trimmedTarget = target.trim();
    const item: LauncherItem = {
      id: initialItem?.id ?? createId(),
      name: trimmedName,
      kind,
      target: trimmedTarget,
      icon
    };
    onSave(item);
    onClose();
  };

  const handleSelectApp = (app: { id: string; name: string; target: string; icon?: { dataUri?: string } }) => {
    const iconSpec: IconSpec =
      app.icon?.dataUri && app.icon.dataUri.length > 0
        ? { type: 'image', uri: app.icon.dataUri }
        : defaultIcon;

    onSave({
      id: app.id,
      name: app.name,
      kind: 'app',
      target: app.target,
      icon: iconSpec
    });
    setShowAppPicker(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Brave Browser"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.segmented}>
              {(['app', 'website'] as LauncherKind[]).map((value) => (
                <Pressable
                  key={value}
                  style={[styles.segment, kind === value && styles.segmentActive]}
                  onPress={() => setKind(value)}
                >
                  <View style={styles.segmentContent}>
                    <Ionicons
                      name={value === 'app' ? 'apps' : 'globe-outline'}
                      size={16}
                      color={kind === value ? colors.textPrimary : colors.textSecondary}
                    />
                    <Text style={[styles.segmentText, kind === value && styles.segmentTextActive]}>
                      {value === 'app' ? 'App' : 'Website'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {!initialItem && kind === 'app' ? (
            <View style={styles.formRow}>
              <Text style={styles.label}>Installed Apps</Text>
              {status === 'connected' ? (
                <Pressable
                  style={styles.iconSelect}
                  onPress={() => {
                    requestApps(false);
                    setShowAppPicker(true);
                  }}
                >
                  <Ionicons name="desktop-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.iconText}>Browse on PC</Text>
                </Pressable>
              ) : (
                <Text style={styles.helper}>Connect to your PC to browse installed apps.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.formRow}>
            <Text style={styles.label}>{kind === 'app' ? 'Command / Path' : 'URL'}</Text>
            <TextInput
              value={target}
              onChangeText={setTarget}
              placeholder={kind === 'app' ? 'C:/Program Files/App/app.exe' : 'https://'}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Icon</Text>
            <Pressable style={styles.iconSelect} onPress={() => setShowIconPicker(true)}>
              <View style={styles.iconPreview}>
                <Icon icon={icon} size={22} />
              </View>
              <Text style={styles.iconText}>Choose Icon</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            {initialItem && onDelete ? (
              <Pressable style={[styles.button, styles.delete]} onPress={() => onDelete(initialItem)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.buttonText, styles.deleteText]}>Delete</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.button, styles.primary]} onPress={handleSave}>
              <Ionicons name="checkmark" size={18} color={colors.bg} />
              <Text style={[styles.buttonText, styles.primaryText]}>
                {initialItem ? 'Save Changes' : 'Add Shortcut'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      <IconPicker visible={showIconPicker} onClose={() => setShowIconPicker(false)} onSelect={setIcon} />
      <AppPickerModal
        visible={showAppPicker}
        apps={apps}
        loading={appsLoading}
        iconsLoading={iconsLoading}
        iconsTotal={iconsTotal}
        error={appsError}
        onClose={() => setShowAppPicker(false)}
        onRefresh={() => requestApps(true)}
        onSelect={handleSelectApp}
      />
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
    padding: spacing.lg
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.outline,
    marginBottom: spacing.md
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary
  },
  formRow: {
    marginBottom: spacing.md
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  input: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    overflow: 'hidden'
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center'
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  segmentActive: {
    backgroundColor: colors.glassStrong
  },
  segmentText: {
    ...typography.body,
    color: colors.textSecondary
  },
  segmentTextActive: {
    color: colors.textPrimary
  },
  iconSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    gap: spacing.sm
  },
  iconPreview: {
    height: 36,
    width: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: spacing.sm
  },
  iconText: {
    ...typography.body,
    color: colors.textPrimary
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: spacing.md
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  delete: {
    borderColor: colors.danger
  },
  primary: {
    backgroundColor: colors.accent
  },
  buttonText: {
    ...typography.body,
    color: colors.textPrimary
  },
  primaryText: {
    color: colors.bg
  },
  deleteText: {
    color: colors.danger
  }
  });
