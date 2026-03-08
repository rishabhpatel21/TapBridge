import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWebSocketClient, ConnectionStatus } from '../hooks/useWebSocketClient';
import { AppEntry, ClientMessage, ServerMessage } from '../types/ws';

const STORAGE_KEY = 'tapbridge_connection_v1';
const DEFAULT_PORT = 5050;

type ConnectionContextValue = {
  ip: string;
  port: number;
  status: ConnectionStatus;
  lastError?: string;
  apps: AppEntry[];
  appsLoading: boolean;
  iconsLoading: boolean;
  iconsTotal: number;
  appsError?: string;
  connect: (nextIp?: string, nextPort?: number) => void;
  disconnect: () => void;
  send: (message: ClientMessage) => boolean;
  requestApps: (includeIcons?: boolean) => void;
  setIp: (value: string) => void;
  setPort: (value: number) => void;
};

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

export const ConnectionProvider = ({ children }: { children: React.ReactNode }) => {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(DEFAULT_PORT);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [iconsLoading, setIconsLoading] = useState(false);
  const [iconsTotal, setIconsTotal] = useState(0);
  const [appsError, setAppsError] = useState<string | undefined>(undefined);
  const [iconCache, setIconCache] = useState<Record<string, string>>({});
  const [pendingAppsRequest, setPendingAppsRequest] = useState<null | { includeIcons: boolean }>(null);
  const requestAppsRef = useRef<(includeIcons?: boolean) => void>();
  const lastAppsChangeRef = useRef(0);
  const appsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAppsTimeout = useCallback(() => {
    if (appsTimeoutRef.current) {
      clearTimeout(appsTimeoutRef.current);
      appsTimeoutRef.current = null;
    }
  }, []);

  const clearIconsTimeout = useCallback(() => {
    if (iconsTimeoutRef.current) {
      clearTimeout(iconsTimeoutRef.current);
      iconsTimeoutRef.current = null;
    }
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === 'apps') {
        clearAppsTimeout();
        const incoming = message.payload.apps;
        const total = message.payload.iconsTotal ?? 0;

        setIconCache((prev) => {
          const next = { ...prev };
          const merged = incoming.map((app) =>
            next[app.id] ? { ...app, icon: { dataUri: next[app.id] } } : app
          );
          setApps(merged);
          setAppsError(undefined);

          return next;
        });

        setAppsLoading(false);
        setIconsTotal(total);
        if (total === 0) {
          setIconsLoading(false);
        }
      }

      if (message.type === 'app_icons') {
        const icons = message.payload.icons;
        if (icons.length === 0) return;
        const iconMap = new Map(icons.map((icon) => [icon.id, icon.dataUri]));
        setIconCache((prev) => {
          const next = { ...prev };
          for (const icon of icons) {
            next[icon.id] = icon.dataUri;
          }
          return next;
        });
        setApps((current) =>
          current.map((app) =>
            iconMap.has(app.id) ? { ...app, icon: { dataUri: iconMap.get(app.id)! } } : app
          )
        );
      }

      if (message.type === 'app_icons_done') {
        clearIconsTimeout();
        setIconsLoading(false);
      }
      if (message.type === 'apps_changed') {
        const now = Date.now();
        if (now - lastAppsChangeRef.current < 2000) return;
        lastAppsChangeRef.current = now;
        requestAppsRef.current?.(true);
      }
      if (message.type === 'error' && appsLoading) {
        clearAppsTimeout();
        setAppsLoading(false);
        setAppsError(message.payload.message);
      }
      if (message.type === 'error' && iconsLoading) {
        clearIconsTimeout();
        setIconsLoading(false);
        setAppsError(message.payload.message);
      }
    },
    [appsLoading, iconsLoading, clearAppsTimeout, clearIconsTimeout]
  );

  const { status, lastError, connect, disconnect, send } = useWebSocketClient({ onMessage: handleMessage });

  useEffect(() => {
    if (status !== 'connected') {
      clearAppsTimeout();
      clearIconsTimeout();
      setAppsLoading(false);
      setIconsLoading(false);
    }
  }, [status, clearAppsTimeout, clearIconsTimeout]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as { ip?: string; port?: number };
        if (parsed.ip) setIp(parsed.ip);
        if (parsed.port) setPort(parsed.port);
        if (parsed.ip) connect(parsed.ip, parsed.port ?? DEFAULT_PORT);
      } catch {
        // ignore
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [connect]);

  const persist = useCallback(async (nextIp: string, nextPort: number) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ip: nextIp, port: nextPort }));
  }, []);

  const connectToServer = useCallback(
    (nextIp = ip, nextPort = port) => {
      setIp(nextIp);
      setPort(nextPort);
      connect(nextIp, nextPort);
      persist(nextIp, nextPort);
    },
    [ip, port, connect, persist]
  );

  const requestApps = useCallback(
    (includeIcons = true) => {
      if (status === 'connecting') {
        setPendingAppsRequest({ includeIcons });
        setAppsError(undefined);
        return;
      }
      if (status !== 'connected') {
        if (!ip) {
          setAppsError('Not connected');
          setAppsLoading(false);
          setIconsLoading(false);
          return;
        }
        setPendingAppsRequest({ includeIcons });
        setAppsError(undefined);
        connect(ip, port);
        return;
      }
      if (includeIcons && apps.length > 0) {
        const loadedCount = apps.filter((app) => iconCache[app.id]).length;
        if (iconsTotal === 0) {
          setIconsLoading(false);
          return;
        }
        if (loadedCount >= iconsTotal) {
          setAppsLoading(false);
          setIconsLoading(false);
          setAppsError(undefined);
          return;
        }
      }
      const needsAppsResponse = !includeIcons || apps.length === 0;
      if (includeIcons) {
        if (apps.length === 0) {
          setAppsLoading(true);
        }
        setIconsLoading(true);
      } else {
        setAppsLoading(true);
      }
      setAppsError(undefined);
      const ok = send({ type: 'list_apps', payload: { includeIcons } });
      if (!ok) {
        setAppsLoading(false);
        setIconsLoading(false);
        setAppsError('Not connected');
        clearAppsTimeout();
        clearIconsTimeout();
        return;
      }

      if (needsAppsResponse) {
        clearAppsTimeout();
        appsTimeoutRef.current = setTimeout(() => {
          setAppsLoading(false);
          setIconsLoading(false);
          setAppsError('No response from PC. Check that the server is running and reachable.');
        }, 10000);
      }
      if (includeIcons) {
        clearIconsTimeout();
        iconsTimeoutRef.current = setTimeout(() => {
          setIconsLoading(false);
          setAppsError('Icon loading timed out. Try again.');
        }, 12000);
      }
    },
    [send, status, apps, iconCache, iconsTotal, ip, port, connect, clearAppsTimeout, clearIconsTimeout]
  );

  useEffect(() => {
    requestAppsRef.current = requestApps;
  }, [requestApps]);

  useEffect(() => {
    if (status === 'connected' && pendingAppsRequest) {
      const { includeIcons } = pendingAppsRequest;
      setPendingAppsRequest(null);
      requestApps(includeIcons);
    }
  }, [status, pendingAppsRequest, requestApps]);

  const memo = useMemo(
    () => ({
      ip,
      port,
      status,
      lastError,
      apps,
      appsLoading,
      iconsLoading,
      iconsTotal,
      appsError,
      connect: connectToServer,
      disconnect,
      send,
      requestApps,
      setIp,
      setPort
    }),
    [
      ip,
      port,
      status,
      lastError,
      apps,
      appsLoading,
      iconsLoading,
      iconsTotal,
      appsError,
      connectToServer,
      disconnect,
      send,
      requestApps
    ]
  );

  return <ConnectionContext.Provider value={memo}>{children}</ConnectionContext.Provider>;
};

export const useConnectionContext = () => {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnectionContext must be used within ConnectionProvider');
  }
  return ctx;
};
