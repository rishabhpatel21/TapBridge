import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';
import { ClientMessage, DiscoveredApp, LauncherItem, ServerConfig, ServerMessage } from './types';
import { DiscoveredAppInternal, canLoadIcon, discoverApps, iconPathToDataUri } from './appDiscovery';

const CONFIG_PATH = process.env.TAPBRIDGE_CONFIG || path.resolve(process.cwd(), 'config.json');

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log('[TapBridge]', ...args);
};

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

const security = config.security ?? {};
const MAX_MESSAGE_BYTES = security.maxMessageBytes ?? 64 * 1024;
const RATE_LIMIT_WINDOW_MS = security.rateLimitWindowMs ?? 10_000;
const RATE_LIMIT_MAX_MESSAGES = security.rateLimitMaxMessages ?? 80;
const MAX_INVALID_MESSAGES = security.maxInvalidMessages ?? 5;

const authToken = resolveAuthToken(config.authToken);
const authTokenBuffer = Buffer.from(authToken, 'utf8');

const tlsEnabled = Boolean(config.tls?.keyPath && config.tls?.certPath);
if (config.tls && !tlsEnabled) {
  log('TLS config incomplete. Provide both keyPath and certPath to enable wss.');
}
const { wss, tlsServer } = createWebSocketServer();

const APP_CACHE_TTL_MS = 30_000;
const APP_REFRESH_MS = 15_000;
let cachedApps: DiscoveredAppInternal[] | null = null;
let cachedAppsAt = 0;
let appsSignature = '';
const iconDataCache = new Map<string, string>();
const authorizedSockets = new WeakSet<WebSocket>();
const socketState = new WeakMap<WebSocket, { windowStart: number; count: number; invalidCount: number }>();

const getLocalIps = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface?.address)
    .filter(Boolean) as string[];

function resolveAuthToken(configToken?: string) {
  const envToken = process.env.TAPBRIDGE_AUTH_TOKEN?.trim();
  if (envToken) return envToken;
  const cleaned = (configToken ?? '').trim();
  if (cleaned && !/^change[-_ ]?me$/i.test(cleaned)) return cleaned;
  const generated = crypto.randomBytes(16).toString('hex');
  log('Generated pairing token. Set authToken in config.json or TAPBRIDGE_AUTH_TOKEN to persist.');
  log(`Pairing token: ${generated}`);
  return generated;
}

function resolveFilePath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function handleListening() {
  const scheme = tlsEnabled ? 'wss' : 'ws';
  log(`Server listening on ${scheme}://0.0.0.0:${config.port}`);
  const ips = getLocalIps();
  log(`Local IPs: ${ips.join(', ')}`);
  if (ips.length > 0) {
    const pairingUrl = `tapbridge://pair?ip=${ips[0]}&port=${config.port}&token=${encodeURIComponent(
      authToken
    )}${tlsEnabled ? '&tls=1' : ''}`;
    log('Scan this QR in the mobile app to pair:');
    qrcode.generate(pairingUrl, { small: true });
  }
  const configToken = (config.authToken ?? '').trim();
  if (configToken.length > 0 && !/^change[-_ ]?me$/i.test(configToken)) {
    log(`Pairing token: ${authToken}`);
  }
}

function createWebSocketServer() {
  if (tlsEnabled) {
    const keyPath = resolveFilePath(config.tls!.keyPath);
    const certPath = resolveFilePath(config.tls!.certPath);
    const caPath = config.tls?.caPath ? resolveFilePath(config.tls.caPath) : undefined;
    if (!fs.existsSync(keyPath)) {
      throw new Error(`TLS key not found at ${keyPath}`);
    }
    if (!fs.existsSync(certPath)) {
      throw new Error(`TLS cert not found at ${certPath}`);
    }
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    const ca = caPath ? fs.readFileSync(caPath) : undefined;
    const server = https.createServer({ key, cert, ca });
    const wsServer = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });
    server.listen(config.port, handleListening);
    return { wss: wsServer, tlsServer: server };
  }
  const wsServer = new WebSocketServer({ port: config.port, maxPayload: MAX_MESSAGE_BYTES });
  wsServer.on('listening', handleListening);
  return { wss: wsServer, tlsServer: null };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown, maxLength: number) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;

const isOptionalString = (value: unknown, maxLength: number) =>
  value === undefined || (typeof value === 'string' && value.length <= maxLength);

const getSocketState = (socket: WebSocket) => {
  const existing = socketState.get(socket);
  if (existing) return existing;
  const next = { windowStart: Date.now(), count: 0, invalidCount: 0 };
  socketState.set(socket, next);
  return next;
};

const isTokenValid = (token: string) => {
  const incoming = Buffer.from(token, 'utf8');
  if (incoming.length !== authTokenBuffer.length) return false;
  return crypto.timingSafeEqual(incoming, authTokenBuffer);
};

const recordInvalid = (socket: WebSocket, state: { invalidCount: number }) => {
  state.invalidCount += 1;
  if (state.invalidCount >= MAX_INVALID_MESSAGES) {
    sendError(socket, 'Too many invalid requests');
    socket.close(1008, 'Policy violation');
    return true;
  }
  return false;
};

const checkRateLimit = (socket: WebSocket, state: { windowStart: number; count: number }) => {
  const now = Date.now();
  if (now - state.windowStart > RATE_LIMIT_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  state.count += 1;
  if (state.count > RATE_LIMIT_MAX_MESSAGES) {
    sendError(socket, 'Rate limit exceeded');
    socket.close(1008, 'Rate limit');
    return false;
  }
  return true;
};

function sendError(socket: WebSocket, message: string) {
  socket.send(JSON.stringify({ type: 'error', payload: { message } } satisfies ServerMessage));
}

const extractAuthToken = (value: Record<string, unknown>) => {
  if (!isObject(value.auth)) return null;
  if (typeof value.auth.token !== 'string') return null;
  return value.auth.token.trim();
};

const parseClientMessage = (
  value: Record<string, unknown>
): { ok: true; message: ClientMessage } | { ok: false; error: string } => {
  const type = value.type;
  if (type === 'ping') {
    return { ok: true, message: { type: 'ping' } };
  }

  if (type === 'list_apps') {
    if (value.payload === undefined) {
      return { ok: true, message: { type: 'list_apps' } };
    }
    if (!isObject(value.payload)) {
      return { ok: false, error: 'Invalid list_apps payload' };
    }
    const includeIcons = value.payload.includeIcons;
    if (includeIcons !== undefined && typeof includeIcons !== 'boolean') {
      return { ok: false, error: 'Invalid list_apps payload' };
    }
    return { ok: true, message: { type: 'list_apps', payload: { includeIcons } } };
  }

  if (type === 'launch') {
    if (!isObject(value.payload)) {
      return { ok: false, error: 'Invalid launch payload' };
    }
    const payload = value.payload;
    const kind = payload.kind;
    if (typeof kind !== 'string' || (kind !== 'app' && kind !== 'website')) {
      return { ok: false, error: 'Invalid launch kind' };
    }
    if (!isNonEmptyString(payload.target, 2048)) {
      return { ok: false, error: 'Invalid launch target' };
    }
    if (!isOptionalString(payload.id, 120) || !isOptionalString(payload.name, 200)) {
      return { ok: false, error: 'Invalid launch metadata' };
    }
    return {
      ok: true,
      message: {
        type: 'launch',
        payload: {
          id: payload.id as string | undefined,
          name: payload.name as string | undefined,
          kind,
          target: payload.target as string
        }
      }
    };
  }

  return { ok: false, error: 'Unsupported message type' };
};

const broadcast = (message: ServerMessage) => {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && authorizedSockets.has(client)) {
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

wss.on('connection', (socket, req) => {
  log(`Client connected from ${req.socket.remoteAddress}`);

  socket.send(JSON.stringify({ type: 'status', payload: { ok: true, message: 'connected' } } satisfies ServerMessage));

  socket.on('message', (data) => {
    const state = getSocketState(socket);
    if (!checkRateLimit(socket, state)) return;

    const raw = typeof data === 'string' ? data : data.toString();
    if (Buffer.byteLength(raw, 'utf8') > MAX_MESSAGE_BYTES) {
      sendError(socket, 'Message too large');
      socket.close(1009, 'Message too large');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendError(socket, 'Invalid message');
      recordInvalid(socket, state);
      return;
    }

    if (!isObject(parsed)) {
      sendError(socket, 'Invalid message');
      recordInvalid(socket, state);
      return;
    }

    const token = extractAuthToken(parsed);
    if (!token || !isTokenValid(token)) {
      authorizedSockets.delete(socket);
      sendError(socket, 'Unauthorized');
      recordInvalid(socket, state);
      return;
    }

    authorizedSockets.add(socket);

    const candidate = { ...parsed } as Record<string, unknown>;
    delete candidate.auth;
    const validation = parseClientMessage(candidate);
    if (!validation.ok) {
      sendError(socket, validation.error);
      recordInvalid(socket, state);
      return;
    }

    const message = validation.message;

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
        socket.send(JSON.stringify({ type: 'apps', payload: { apps, iconsTotal } } satisfies ServerMessage));
        log(`Sent ${apps.length} apps (icons: ${iconsTotal}) in ${Date.now() - started}ms`);
        if (includeIcons) {
          streamIcons(socket, appsInternal);
        }
      } catch (error) {
        log('Failed to list apps', error);
        sendError(socket, 'Failed to list apps');
      }
      return;
    }

    if (message.type === 'launch') {
      const launcher = resolveLauncher(message);
      if (!launcher) {
        sendError(socket, 'Launcher not allowed');
        return;
      }

      if (launcher.kind === 'website' && !isUrl(launcher.target)) {
        sendError(socket, 'Invalid URL');
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
  });

  socket.on('close', () => {
    authorizedSockets.delete(socket);
    socketState.delete(socket);
    log('Client disconnected');
  });
});

process.on('SIGINT', () => {
  log('Shutting down...');
  wss.close();
  if (tlsServer) {
    tlsServer.close();
  }
  process.exit(0);
});

setInterval(refreshAppsCache, APP_REFRESH_MS);
