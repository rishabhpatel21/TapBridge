export type LauncherKind = 'app' | 'website';

export type LauncherItem = {
  id: string;
  name: string;
  kind: LauncherKind;
  target: string;
  args?: string[];
};

export type DiscoveredApp = {
  id: string;
  name: string;
  target: string;
  icon?: {
    dataUri?: string;
  };
};

export type ServerConfig = {
  port: number;
  allowUnregistered?: boolean;
  launchers: LauncherItem[];
  authToken?: string;
  tls?: {
    keyPath: string;
    certPath: string;
    caPath?: string;
  };
  security?: {
    maxMessageBytes?: number;
    rateLimitWindowMs?: number;
    rateLimitMaxMessages?: number;
    maxInvalidMessages?: number;
  };
};

export type ClientMessage =
  | { type: 'ping' }
  | {
      type: 'launch';
      payload: {
        id?: string;
        name?: string;
        kind: LauncherKind;
        target: string;
      };
    }
  | { type: 'list_apps'; payload?: { includeIcons?: boolean } };

export type AuthPayload = {
  token: string;
};

export type WireClientMessage = ClientMessage & { auth: AuthPayload };

export type ServerMessage =
  | { type: 'pong'; payload: { ts: number } }
  | { type: 'status'; payload: { ok: boolean; message?: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'apps'; payload: { apps: DiscoveredApp[]; iconsTotal?: number } }
  | { type: 'apps_changed'; payload?: { total?: number } }
  | { type: 'app_icons'; payload: { icons: { id: string; dataUri: string }[] } }
  | { type: 'app_icons_done'; payload?: { total?: number } };
