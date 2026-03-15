import { app, BrowserWindow } from 'electron';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import QRCode from 'qrcode';

type StatusPayload = {
  status: string;
  message?: string;
  token?: string;
  ips?: string[];
  port?: number;
  qrDataUrl?: string;
};

let mainWindow: BrowserWindow | null = null;
let serverProcess: ReturnType<typeof spawn> | null = null;
let currentToken: string | undefined;
let currentPort: number | undefined;
let currentScheme: 'ws' | 'wss' = 'ws';
let currentQrDataUrl: string | undefined;
let lastStatus: StatusPayload | null = null;
let lastErrorMessage = '';

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log('[TapBridge Desktop]', ...args);
};

const getLocalIps = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface?.address)
    .filter(Boolean) as string[];

const sendStatus = (payload: StatusPayload) => {
  if (!mainWindow) return;
  const merged = {
    ...payload,
    token: payload.token ?? currentToken,
    port: payload.port ?? currentPort,
    qrDataUrl: payload.qrDataUrl ?? currentQrDataUrl
  } satisfies StatusPayload;
  lastStatus = merged;
  mainWindow.webContents.send('status-update', merged);
};

const parseTokenFromLog = (line: string) => {
  const match = line.match(/Pairing token:\s*([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
};

const parseServerListening = (line: string) => {
  const match = line.match(/Server listening on (ws|wss):\/\/.*:(\d+)/);
  if (!match) return undefined;
  return { scheme: match[1] as 'ws' | 'wss', port: Number(match[2]) };
};

const buildPairingUrl = (ip: string, port: number, token: string, scheme: 'ws' | 'wss') =>
  `tapbridge://pair?ip=${ip}&port=${port}&token=${encodeURIComponent(token)}${
    scheme === 'wss' ? '&tls=1' : ''
  }`;

const emitQrIfReady = async (ips: string[]) => {
  if (!currentToken || !currentPort || ips.length === 0) return;
  const pairingUrl = buildPairingUrl(ips[0], currentPort, currentToken, currentScheme);
  try {
    const qrDataUrl = await QRCode.toDataURL(pairingUrl, { margin: 1, width: 240 });
    currentQrDataUrl = qrDataUrl;
    sendStatus({
      status: 'running',
      ips,
      message: pairingUrl,
      token: currentToken,
      port: currentPort,
      qrDataUrl
    });
  } catch (error) {
    log('Failed to generate QR', error);
  }
};

const startServer = () => {
  const ips = getLocalIps();
  sendStatus({ status: 'starting', ips });
  lastErrorMessage = '';

  if (app.isPackaged) {
    const serverEntry = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
    const serverConfig = path.join(process.resourcesPath, 'server', 'config.json');
    serverProcess = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        TAPBRIDGE_CONFIG: serverConfig
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    serverProcess = spawn(npmCmd, ['run', 'dev'], {
      cwd: path.join(__dirname, '../../pc-client'),
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  serverProcess.stdout?.on('data', (data) => {
    const text = data.toString();
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      log(line);
      const token = parseTokenFromLog(line);
      if (token) {
        currentToken = token;
      }
      const serverInfo = parseServerListening(line);
      if (serverInfo) {
        currentPort = serverInfo.port;
        currentScheme = serverInfo.scheme;
      }
    }
    void emitQrIfReady(ips);
  });

  serverProcess.stderr?.on('data', (data) => {
    const text = data.toString();
    lastErrorMessage = [lastErrorMessage, text].filter(Boolean).join('\n');
    log(text);
    sendStatus({ status: 'error', message: 'Server error. Check logs.' });
  });

  serverProcess.on('exit', (code) => {
    const message = lastErrorMessage.trim()
      ? lastErrorMessage.trim().split(/\r?\n/).slice(-3).join('\n')
      : `Server exited (code ${code ?? 'unknown'})`;
    sendStatus({ status: 'stopped', message });
  });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 420,
    webPreferences: {
      preload: path.join(__dirname, '../src/preload.js')
    }
  });

  const page = path.join(__dirname, '../src/renderer/index.html');
  mainWindow.loadFile(page);
  mainWindow.webContents.on('did-finish-load', () => {
    if (lastStatus) {
      mainWindow?.webContents.send('status-update', lastStatus);
    } else {
      sendStatus({ status: 'starting', ips: getLocalIps() });
    }
  });
};

app.whenReady().then(() => {
  createWindow();
  startServer();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
