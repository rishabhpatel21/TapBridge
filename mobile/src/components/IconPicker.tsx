import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlatList } from 'react-native-gesture-handler';
import { Icon } from './Icon';
import { IconSpec, VectorIconSpec } from '../types/launcher';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const ICON_OPTIONS: VectorIconSpec[] = [
  { set: 'Ionicons', name: 'logo-chrome', color: '#f7b500' },
  { set: 'Ionicons', name: 'logo-github', color: '#ffffff' },
  { set: 'Ionicons', name: 'logo-youtube', color: '#ff4e45' },
  { set: 'Ionicons', name: 'logo-apple', color: '#ffffff' },
  { set: 'Ionicons', name: 'logo-windows', color: '#4aa3ff' },
  { set: 'Ionicons', name: 'terminal', color: '#8ad1ff' },
  { set: 'Ionicons', name: 'globe-outline', color: '#7fe5ff' },
  { set: 'MaterialCommunityIcons', name: 'microsoft-visual-studio-code', color: '#4aa3ff' },
  { set: 'MaterialCommunityIcons', name: 'google-chrome', color: '#f7b500' },
  { set: 'MaterialCommunityIcons', name: 'spotify', color: '#2fd566' },
  { set: 'MaterialCommunityIcons', name: 'steam', color: '#9bb3c9' },
  { set: 'MaterialCommunityIcons', name: 'rocket-launch-outline', color: '#ffb86c' },
  { set: 'MaterialCommunityIcons', name: 'folder-open-outline', color: '#ffd166' },
  { set: 'MaterialCommunityIcons', name: 'file-document-outline', color: '#6f9cff' },
  { set: 'FontAwesome5', name: 'gamepad', color: '#f38ba8' },
  { set: 'FontAwesome5', name: 'music', color: '#cba6f7' },
  { set: 'FontAwesome5', name: 'code', color: '#7fe5ff' },
  { set: 'FontAwesome5', name: 'bolt', color: '#ffe066' }
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (icon: IconSpec) => void;
};

export const IconPicker = ({ visible, onClose, onSelect }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Pick an Icon</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
          <FlatList
            data={ICON_OPTIONS}
            numColumns={4}
            keyExtractor={(item, index) => `${item.set}-${item.name}-${index}`}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <Pressable
                style={styles.iconButton}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={styles.iconWrap}>
                  <Icon icon={item} size={26} />
                </View>
              </Pressable>
            )}
          />
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
    paddingBottom: spacing.xl
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.outline,
    marginTop: spacing.sm
  },
  header: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary
  },
  grid: {
    paddingHorizontal: spacing.lg
  },
  iconButton: {
    flex: 1,
    padding: spacing.sm
  },
  iconWrap: {
    height: 54,
    width: 54,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    alignItems: 'center',
    justifyContent: 'center'
  }
  });
