import fs from 'fs';
import path from 'path';
import os from 'os';
export type DiscoveredAppInternal = {
  id: string;
  name: string;
  target: string;
  iconPath?: string;
};

type DiscoverOptions = {
  includeIcons?: boolean;
};

const MAX_ICON_BYTES = 300 * 1024;

const getIconMime = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return '';
};

export const canLoadIcon = (filePath?: string) => {
  if (!filePath) return false;
  const mime = getIconMime(filePath);
  if (!mime) return false;

  try {
    const stat = fs.statSync(filePath);
    return stat.size <= MAX_ICON_BYTES;
  } catch {
    return false;
  }
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'app';

const hash = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
};

const makeId = (name: string, target: string) => `${slugify(name)}-${hash(target)}`;

const listFilesRecursive = (dir: string, predicate: (file: string) => boolean, out: string[]) => {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursive(full, predicate, out);
    } else if (entry.isFile() && predicate(full)) {
      out.push(full);
    }
  }
};

export const iconPathToDataUri = (filePath?: string) => {
  if (!filePath) return undefined;
  const mime = getIconMime(filePath);
  if (!mime) return undefined;
  if (!canLoadIcon(filePath)) return undefined;

  try {
    if (mime === 'image/svg+xml') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const encoded = encodeURIComponent(raw);
      return `data:${mime};utf8,${encoded}`;
    }
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return undefined;
  }
};

const resolveLinuxIconPath = (iconName?: string) => {
  if (!iconName) return undefined;

  if (iconName.includes('/') && fs.existsSync(iconName)) {
    return iconName;
  }

  const home = os.homedir();
  const iconDirs = [
    path.join(home, '.local/share/icons'),
    path.join(home, '.icons'),
    '/usr/local/share/icons',
    '/usr/share/icons',
    '/usr/share/pixmaps',
    '/var/lib/snapd/desktop/icons'
  ];

  const sizes = ['512x512', '256x256', '192x192', '128x128', '96x96', '64x64', '48x48', '32x32', '24x24', '22x22', '16x16'];
  const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  const hasExt = path.extname(iconName).length > 0;
  const names = hasExt ? [iconName] : exts.map((ext) => `${iconName}.${ext}`);

  for (const base of iconDirs) {
    for (const size of sizes) {
      for (const name of names) {
        const candidate = path.join(base, 'hicolor', size, 'apps', name);
        if (fs.existsSync(candidate)) return candidate;
      }
    }

    for (const name of names) {
      const pixmapCandidate = path.join(base, name);
      if (fs.existsSync(pixmapCandidate)) return pixmapCandidate;
    }
  }

  for (const base of iconDirs) {
    let themes: fs.Dirent[] = [];
    try {
      themes = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const theme of themes) {
      if (!theme.isDirectory()) continue;
      const themeRoot = path.join(base, theme.name);
      for (const size of sizes) {
        for (const name of names) {
          const candidate = path.join(themeRoot, size, 'apps', name);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
      for (const name of names) {
        const scalableCandidate = path.join(themeRoot, 'scalable', 'apps', name);
        if (fs.existsSync(scalableCandidate)) return scalableCandidate;
        const appsCandidate = path.join(themeRoot, 'apps', name);
        if (fs.existsSync(appsCandidate)) return appsCandidate;
      }
    }
  }

  return undefined;
};

const sanitizeDesktopExec = (exec: string) => {
  if (!exec) return '';
  let cleaned = exec.replace(/%%/g, '%');
  cleaned = cleaned.replace(/%[fFuUdDnNickvm]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

const parseDesktopEntry = (content: string) => {
  const entry: Record<string, string> = {};
  let inDesktopEntry = false;
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inDesktopEntry = line.slice(1, -1) === 'Desktop Entry';
      continue;
    }
    if (!inDesktopEntry) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    entry[key] = value;
  }

  return entry;
};

const pickDesktopName = (entry: Record<string, string>) => {
  if (entry.Name) return entry.Name;
  const localized = Object.keys(entry).find((key) => key.startsWith('Name['));
  return localized ? entry[localized] : undefined;
};

const discoverLinuxApps = () => {
  const desktopDirs = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
    '/var/lib/snapd/desktop/applications'
  ];

  const desktopFiles: string[] = [];
  for (const dir of desktopDirs) {
    listFilesRecursive(dir, (file) => file.endsWith('.desktop'), desktopFiles);
  }

  const seen = new Set<string>();
  const results: DiscoveredAppInternal[] = [];

  for (const filePath of desktopFiles) {
    let raw = '';
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const entry = parseDesktopEntry(raw);
    if (!entry || (entry.Type && entry.Type !== 'Application')) continue;
    if (entry.NoDisplay?.toLowerCase() === 'true') continue;
    if (entry.Hidden?.toLowerCase() === 'true') continue;

    const name = pickDesktopName(entry);
    if (!name) continue;

    const target = sanitizeDesktopExec(entry.Exec || '');
    if (!target) continue;

    const iconPath = resolveLinuxIconPath(entry.Icon);

    const idBase = makeId(name, target);
    let id = idBase;
    let suffix = 1;
    while (seen.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);

    results.push({
      id,
      name,
      target,
      iconPath
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
};

const discoverWindowsApps = () => {
  const appData = process.env.APPDATA || '';
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const dirs = [
    path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ];

  const shortcutFiles: string[] = [];
  for (const dir of dirs) {
    listFilesRecursive(
      dir,
      (file) => file.endsWith('.lnk') || file.endsWith('.appref-ms'),
      shortcutFiles
    );
  }

  const seen = new Set<string>();
  const results: DiscoveredAppInternal[] = [];

  for (const filePath of shortcutFiles) {
    const name = path.basename(filePath).replace(/\.(lnk|appref-ms)$/i, '');
    if (!name) continue;
    const target = filePath;
    const idBase = makeId(name, target);
    let id = idBase;
    let suffix = 1;
    while (seen.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    results.push({ id, name, target });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
};

const discoverMacApps = () => {
  const home = os.homedir();
  const appDirs = ['/Applications', '/System/Applications', path.join(home, 'Applications')];
  const results: DiscoveredAppInternal[] = [];
  const seen = new Set<string>();

  for (const dir of appDirs) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.app')) continue;
      const name = entry.name.replace(/\.app$/i, '');
      const target = path.join(dir, entry.name);
      const idBase = makeId(name, target);
      let id = idBase;
      let suffix = 1;
      while (seen.has(id)) {
        id = `${idBase}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);
      results.push({ id, name, target });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
};

export const discoverApps = (_options: DiscoverOptions = {}): DiscoveredAppInternal[] => {
  switch (process.platform) {
    case 'win32':
      return discoverWindowsApps();
    case 'darwin':
      return discoverMacApps();
    default:
      return discoverLinuxApps();
  }
};
