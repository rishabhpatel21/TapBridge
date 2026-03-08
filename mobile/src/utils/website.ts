import { IconSpec } from '../types/launcher';

export const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    // ignore
  }
  try {
    return new URL(`https://${trimmed}`);
  } catch {
    return null;
  }
};

export const getWebsiteFaviconUri = (target: string) => {
  const url = normalizeUrl(target);
  if (!url) return null;
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.href)}&sz=128`;
};

export const buildWebsiteIcon = (target: string): IconSpec | null => {
  const favicon = getWebsiteFaviconUri(target);
  if (!favicon) return null;
  return { type: 'image', uri: favicon, auto: true };
};
