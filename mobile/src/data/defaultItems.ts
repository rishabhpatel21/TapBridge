import { LauncherItem } from '../types/launcher';

export const defaultItems: LauncherItem[] = [
  {
    id: 'brave',
    name: 'Brave Browser',
    kind: 'app',
    target: 'brave-browser',
    icon: { set: 'MaterialCommunityIcons', name: 'compass-outline', color: '#ff6b6b' }
  },
  {
    id: 'vscode',
    name: 'VS Code',
    kind: 'app',
    target: 'code',
    icon: { set: 'MaterialCommunityIcons', name: 'microsoft-visual-studio-code', color: '#4aa3ff' }
  },
  {
    id: 'spotify',
    name: 'Spotify',
    kind: 'app',
    target: 'spotify',
    icon: { set: 'MaterialCommunityIcons', name: 'spotify', color: '#2fd566' }
  },
  {
    id: 'youtube',
    name: 'YouTube',
    kind: 'website',
    target: 'https://youtube.com',
    icon: { set: 'Ionicons', name: 'logo-youtube', color: '#ff4e45' }
  },
  {
    id: 'docs',
    name: 'Google Docs',
    kind: 'website',
    target: 'https://docs.google.com',
    icon: { set: 'MaterialCommunityIcons', name: 'file-document-outline', color: '#6f9cff' }
  }
];
