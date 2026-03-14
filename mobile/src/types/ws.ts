import { LauncherKind } from './launcher';

export type AppEntry = {
  id: string;
  name: string;
  target: string;
  icon?: {
    dataUri?: string;
  };
};

export type LaunchMessage = {
  type: 'launch';
  payload: {
    id?: string;
    name?: string;
    kind: LauncherKind;
    target: string;
  };
};

export type PingMessage = {
  type: 'ping';
};

export type ListAppsMessage = {
  type: 'list_apps';
  payload?: {
    includeIcons?: boolean;
  };
};

export type ClientMessage = LaunchMessage | PingMessage | ListAppsMessage;

export type AuthPayload = {
  token: string;
};

export type WireClientMessage = ClientMessage & { auth: AuthPayload };

export type ServerMessage =
  | { type: 'pong'; payload?: { ts: number } }
  | { type: 'status'; payload: { ok: boolean; message?: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'apps'; payload: { apps: AppEntry[]; iconsTotal?: number } }
  | { type: 'apps_changed'; payload?: { total?: number } }
  | { type: 'app_icons'; payload: { icons: { id: string; dataUri: string }[] } }
  | { type: 'app_icons_done'; payload?: { total?: number } };
