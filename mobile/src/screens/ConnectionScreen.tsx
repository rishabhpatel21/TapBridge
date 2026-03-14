import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { useConnectionContext } from '../state/ConnectionContext';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { StatusPill } from '../components/StatusPill';
import { QrScannerModal } from '../components/QrScannerModal';


type Props = NativeStackScreenProps<RootStackParamList, 'Connection'>;

const ConnectionScreen = ({ navigation }: Props) => {
  const { ip, port, token, useTls, setIp, setPort, setToken, setUseTls, status, connect, lastError } =
    useConnectionContext();
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(16)).current;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (status === 'connected') {
      navigation.replace('Launcher');
    }
  }, [status, navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true
      })
    ]).start();
  }, [fade, lift]);

  return (
    <LinearGradient colors={[colors.bg, colors.bgElevated]} style={styles.container}>
      <View style={styles.orb} />
      <View style={styles.orbAccent} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
        <Animated.View style={[styles.hero, { opacity: fade, transform: [{ translateY: lift }] }]}>
          <View style={styles.appIcon}>
            <Ionicons name="flash" size={26} color={colors.bg} />
          </View>
          <Text style={styles.title}>TapBridge</Text>
          <Text style={styles.subtitle}>Connect to your PC and launch apps instantly.</Text>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: fade, transform: [{ translateY: lift }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Connection</Text>
            <StatusPill status={status === 'error' ? 'error' : status} label={status} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PC IP Address</Text>
            <TextInput
              value={ip}
              onChangeText={setIp}
              placeholder="192.168.1.20"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              value={String(port)}
              onChangeText={(value) => setPort(Number(value) || 0)}
              placeholder="5050"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pairing Token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="Scan QR or paste token"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Secure TLS (wss)</Text>
            <Switch
              value={useTls}
              onValueChange={setUseTls}
              trackColor={{ false: colors.outlineStrong, true: colors.accent }}
              thumbColor={colors.bg}
            />
          </View>

          {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}

          <Pressable
            style={[styles.button, status === 'connecting' && styles.buttonDisabled]}
            onPress={() => connect()}
            disabled={status === 'connecting'}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentCool]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonFill}
            >
              <Ionicons name="wifi" size={18} color={colors.bg} />
              <Text style={styles.buttonText}>
                {status === 'connecting' ? 'Connecting...' : 'Connect to PC'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => setShowQr(true)}>
            <Ionicons name="qr-code-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.secondaryButtonText}>Scan QR</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>

      <QrScannerModal
        visible={showQr}
        onClose={() => setShowQr(false)}
        onPair={(nextIp, nextPort, nextToken, nextUseTls) => {
          setShowQr(false);
          connect(nextIp, nextPort, nextToken ?? token, nextUseTls ?? useTls);
        }}
      />
    </LinearGradient>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center'
  },
  orb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(93, 228, 199, 0.12)',
    top: -40,
    right: -60
  },
  orbAccent: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(90, 169, 255, 0.1)',
    bottom: -60,
    left: -40
  },
  hero: {
    marginBottom: spacing.lg,
    alignItems: 'flex-start'
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 260
  },
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.panel,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    gap: spacing.sm
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary
  },
  inputGroup: {
    gap: spacing.xs
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  input: {
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm
  },
  toggleRow: {
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textPrimary
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.danger,
    ...typography.caption
  },
  button: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  buttonFill: {
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    ...typography.subtitle,
    color: colors.bg
  },
  secondaryButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.glass,
    height: 46
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary
  }
  });

export default ConnectionScreen;
