import fs from 'fs';
import path from 'path';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';
import { ClientMessage, DiscoveredApp, LauncherItem, ServerConfig, ServerMessage } from './types';
import { DiscoveredAppInternal, canLoadIcon, discoverApps, iconPathToDataUri } from './appDiscovery';

const CONFIG_PATH = process.env.TAPBRIDGE_CONFIG || path.resolve(process.cwd(), 'config.json');

const loadConfig = (): ServerConfig => {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found at ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(raw) as ServerConfig;
  if (!config.port || !config.launchers) {
    throw new Error('Invalid config. Expected port and launchers.');
  }
  return config;
};

const config = loadConfig();

const wss = new WebSocketServer({ port: config.port });

const APP_CACHE_TTL_MS = 30_000;
const APP_REFRESH_MS = 15_000;
let cachedApps: DiscoveredAppInternal[] | null = null;
let cachedAppsAt = 0;
let appsSignature = '';
const iconDataCache = new Map<string, string>();

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log('[TapBridge]', ...args);
};

const getLocalIps = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface?.address)
    .filter(Boolean) as string[];

const broadcast = (message: ServerMessage) => {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const isUrl = (target: string) => /^https?:\/\//i.test(target);

const getAppsSignature = (apps: DiscoveredAppInternal[]) =>
  apps.map((app) => `${app.id}:${app.target}:${app.iconPath ?? ''}`).join('|');

const getDiscoveredApps = (forceRefresh = false) => {
  const now = Date.now();
  const cacheValid = cachedApps && now - cachedAppsAt < APP_CACHE_TTL_MS;

  if (!forceRefresh && cacheValid) {
    return cachedApps ?? [];
  }

  const apps = discoverApps();
  cachedApps = apps;
  cachedAppsAt = now;
  appsSignature = getAppsSignature(apps);
  const activeIds = new Set(apps.map((app) => app.id));
  for (const id of iconDataCache.keys()) {
    if (!activeIds.has(id)) {
      iconDataCache.delete(id);
    }
  }
  return apps;
};

const refreshAppsCache = () => {
  try {
    const apps = discoverApps();
    const signature = getAppsSignature(apps);
    if (signature === appsSignature) return;
    cachedApps = apps;
    cachedAppsAt = Date.now();
    appsSignature = signature;
    iconDataCache.clear();
    broadcast({ type: 'apps_changed', payload: { total: apps.length } } satisfies ServerMessage);
    log(`Apps changed. Found ${apps.length} apps.`);
  } catch (error) {
    log('Failed to refresh apps', error);
  }
};

const findDiscoveredApp = (payload?: { id?: string; target?: string }) => {
  if (!payload) return null;
  const apps = getDiscoveredApps(false);
  if ('id' in payload && payload.id) {
    const foundById = apps.find((app) => app.id === payload.id);
    if (foundById) return foundById;
  }
  if ('target' in payload && payload.target) {
    const foundByTarget = apps.find((app) => app.target === payload.target);
    if (foundByTarget) return foundByTarget;
  }
  return null;
};

const toPublicApps = (apps: DiscoveredAppInternal[]): DiscoveredApp[] =>
  apps.map((app) => ({
    id: app.id,
    name: app.name,
    target: app.target,
    icon: iconDataCache.has(app.id) ? { dataUri: iconDataCache.get(app.id) } : undefined
  }));

const countAppsWithIcons = (apps: DiscoveredAppInternal[]) =>
  apps.reduce((count, app) => count + (canLoadIcon(app.iconPath) ? 1 : 0), 0);

const streamIcons = (socket: WebSocket, apps: DiscoveredAppInternal[]) => {
  const candidates = apps.filter((app) => canLoadIcon(app.iconPath));
  const total = candidates.length;
  if (total === 0) {
    socket.send(JSON.stringify({ type: 'app_icons_done', payload: { total } } satisfies ServerMessage));
    return;
  }

  const queue = candidates.filter((app) => !iconDataCache.has(app.id));
  if (queue.length === 0) {
    socket.send(JSON.stringify({ type: 'app_icons_done', payload: { total } } satisfies ServerMessage));
    return;
  }

  const BATCH_SIZE = 1;
  let index = 0;
  const MAX_BUFFERED_BYTES = 512 * 1024;

  const sendBatch = () => {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      setTimeout(sendBatch, 60);
      return;
    }

    const icons: { id: string; dataUri: string }[] = [];
    for (; index < queue.length && icons.length < BATCH_SIZE; index += 1) {
      const app = queue[index];
      const dataUri = iconPathToDataUri(app.iconPath);
      if (dataUri) {
        iconDataCache.set(app.id, dataUri);
        icons.push({ id: app.id, dataUri });
      }
    }

    if (icons.length > 0) {
      socket.send(JSON.stringify({ type: 'app_icons', payload: { icons } } satisfies ServerMessage));
    }

    if (index < queue.length) {
      setTimeout(sendBatch, 120);
    } else {
      socket.send(JSON.stringify({ type: 'app_icons_done', payload: { total } } satisfies ServerMessage));
    }
  };

  sendBatch();
};

const spawnDetached = (command: string, args: string[], options?: { shell?: boolean }) => {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: options?.shell ?? false
  });
  child.unref();
};

const openUrl = (url: string) => {
  switch (process.platform) {
    case 'win32':
      spawnDetached('cmd', ['/c', 'start', '""', url], { shell: true });
      break;
    case 'darwin':
      spawnDetached('open', [url]);
      break;
    default:
      spawnDetached('xdg-open', [url]);
  }
};

const launchApp = (target: string, args: string[] = []) => {
  switch (process.platform) {
    case 'win32':
      spawnDetached('cmd', ['/c', 'start', '""', target, ...args], { shell: true });
      break;
    case 'darwin':
      if (target.endsWith('.app') || !target.includes('/')) {
        spawnDetached('open', ['-a', target, ...args]);
      } else {
        spawnDetached('open', [target, ...args]);
      }
      break;
    default:
      spawnDetached(target, args, { shell: true });
  }
};

const resolveLauncher = (message: ClientMessage): LauncherItem | null => {
  if (message.type !== 'launch') return null;
  if (message.payload.id) {
    const found = config.launchers.find((item) => item.id === message.payload.id);
    if (found) return found;
  }
  if (message.payload.kind === 'app') {
    const discovered = findDiscoveredApp(message.payload);
    if (discovered) {
      return {
        id: discovered.id,
        name: discovered.name,
        kind: 'app',
        target: discovered.target
      };
    }
  }
  if (!config.allowUnregistered) {
    return null;
  }
  return {
    id: message.payload.id ?? 'unregistered',
    name: message.payload.name ?? 'Unregistered',
    kind: message.payload.kind,
    target: message.payload.target
  };
};

wss.on('listening', () => {
  log(`Server listening on ws://0.0.0.0:${config.port}`);
  const ips = getLocalIps();
  log(`Local IPs: ${ips.join(', ')}`);
  if (ips.length > 0) {
    const pairingUrl = `tapbridge://pair?ip=${ips[0]}&port=${config.port}`;
    log('Scan this QR in the mobile app to pair:');
    qrcode.generate(pairingUrl, { small: true });
  }
});

wss.on('connection', (socket, req) => {
  log(`Client connected from ${req.socket.remoteAddress}`);

  socket.send(JSON.stringify({ type: 'status', payload: { ok: true, message: 'connected' } } satisfies ServerMessage));

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', payload: { ts: Date.now() } } satisfies ServerMessage));
        return;
      }

      if (message.type === 'list_apps') {
        const includeIcons = message.payload?.includeIcons ?? false;
        const started = Date.now();
        try {
          const appsInternal = getDiscoveredApps(false);
          const apps = toPublicApps(appsInternal);
          const iconsTotal = countAppsWithIcons(appsInternal);
          socket.send(
            JSON.stringify({ type: 'apps', payload: { apps, iconsTotal } } satisfies ServerMessage)
          );
          log(`Sent ${apps.length} apps (icons: ${iconsTotal}) in ${Date.now() - started}ms`);
          if (includeIcons) {
            streamIcons(socket, appsInternal);
          }
        } catch (error) {
          log('Failed to list apps', error);
          socket.send(
            JSON.stringify({ type: 'error', payload: { message: 'Failed to list apps' } } satisfies ServerMessage)
          );
        }
        return;
      }

      if (message.type === 'launch') {
        const launcher = resolveLauncher(message);
        if (!launcher) {
          socket.send(
            JSON.stringify({ type: 'error', payload: { message: 'Launcher not allowed' } } satisfies ServerMessage)
          );
          return;
        }

        if (launcher.kind === 'website' || isUrl(launcher.target)) {
          openUrl(launcher.target);
        } else {
          launchApp(launcher.target, launcher.args);
        }

        socket.send(
          JSON.stringify({ type: 'status', payload: { ok: true, message: `Launched ${launcher.name}` } })
        );
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message' } } satisfies ServerMessage));
    }
  });

  socket.on('close', () => {
    log('Client disconnected');
  });
});

process.on('SIGINT', () => {
  log('Shutting down...');
  wss.close();
  process.exit(0);
});

setInterval(refreshAppsCache, APP_REFRESH_MS);
