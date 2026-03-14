import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPair: (ip: string, port: number, token?: string, useTls?: boolean) => void;
};

const parsePairingData = (data: string): { ip: string; port: number; token?: string; useTls?: boolean } | null => {
  if (!data) return null;

  try {
    if (data.startsWith('tapbridge://')) {
      const url = new URL(data);
      const ip = url.searchParams.get('ip');
      const port = Number(url.searchParams.get('port') ?? 0);
      const token = url.searchParams.get('token') ?? undefined;
      const tlsParam = url.searchParams.get('tls');
      const useTls = tlsParam === '1' || tlsParam === 'true';
      if (ip && port) return { ip, port, token, useTls };
    }
  } catch {
    // ignore
  }

  try {
    const parsed = JSON.parse(data) as { ip?: string; port?: number; token?: string; tls?: boolean; scheme?: string };
    if (parsed.ip && parsed.port) {
      const useTls = parsed.tls === true || parsed.scheme === 'wss';
      return { ip: parsed.ip, port: Number(parsed.port), token: parsed.token, useTls };
    }
  } catch {
    // ignore
  }

  if (data.startsWith('ws://') || data.startsWith('wss://')) {
    try {
      const url = new URL(data);
      const ip = url.hostname;
      const port = Number(url.port ?? 0);
      const token = url.searchParams.get('token') ?? undefined;
      const useTls = url.protocol === 'wss:';
      if (ip && port) return { ip, port, token, useTls };
    } catch {
      // ignore
    }
  }

  const simpleMatch = data.match(/^([0-9.]+):([0-9]{2,5})$/);
  if (simpleMatch) {
    return { ip: simpleMatch[1], port: Number(simpleMatch[2]) };
  }

  return null;
};

export const QrScannerModal = ({ visible, onClose, onPair }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setError(undefined);
      return;
    }
    if (!permission?.granted) {
      requestPermission().catch(() => {
        setError('Camera permission is required to scan QR codes.');
      });
    }
  }, [visible, permission, requestPermission]);

  const handleScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    const parsed = parsePairingData(result.data);
    if (!parsed) {
      setError('Invalid QR code. Please scan the TapBridge pairing QR.');
      return;
    }
    setScanned(true);
    onPair(parsed.ip, parsed.port, parsed.token, parsed.useTls);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan Pairing QR</Text>
            <Pressable onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />
            <View style={styles.scanFrame} />
          </View>

          <Text style={styles.helper}>
            Align the QR from your PC terminal inside the frame.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      padding: spacing.lg
    },
    sheet: {
      backgroundColor: colors.panel,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.outline,
      padding: spacing.lg,
      gap: spacing.md
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    title: {
      ...typography.subtitle,
      color: colors.textPrimary
    },
    close: {
      height: 32,
      width: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.outlineStrong,
      backgroundColor: colors.glass
    },
    cameraWrap: {
      height: 260,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outlineStrong
    },
    camera: {
      flex: 1
    },
    scanFrame: {
      position: 'absolute',
      top: 40,
      left: 40,
      right: 40,
      bottom: 40,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.accent
    },
    helper: {
      ...typography.caption,
      color: colors.textSecondary
    },
    error: {
      ...typography.caption,
      color: colors.danger
    }
  });
