import crypto from 'crypto';
import axios from 'axios';

export const normalizeDomain = (input: string): string => {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/\/$/, '');
  return domain;
};

export const getProtocol = (domain: string): string => {
  const isLocal =
    domain.startsWith("localhost") ||
    domain.startsWith("127.0.0.1") ||
    domain.startsWith("0.0.0.0") ||
    domain.includes("localhost:") ||
    // IP address pattern (with optional port)
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(domain);

  return isLocal ? 'http://' : 'https://';
};

export const normalizeUrl = (url: string): string => {
  let clean = url.trim();
  // Remove anchor
  const anchorIdx = clean.indexOf('#');
  if (anchorIdx !== -1) clean = clean.substring(0, anchorIdx);
  // Remove trailing slash
  if (clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean;
};

export const hashUrl = (url: string): string => {
  return crypto.createHash('sha1').update(url).digest('hex');
};

export const extractGameKeyword = (url: string): string => {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);
    if (pathParts.length === 0) return '';
    
    let slug = pathParts[pathParts.length - 1];
    slug = slug.replace(/[-_]/g, ' ');
    return slug.trim().toLowerCase();
  } catch (e) {
    return '';
  }
};

export type UrlType = 'game' | 'tag' | 'category' | 'home' | 'unknown';

export const classifyUrl = (url: string): UrlType => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    if (path === '/' || path === '') return 'home';
    if (path.startsWith('/c/') || path.includes('/category/')) return 'category';
    if (path.startsWith('/t/') || path.includes('/tag/')) return 'tag';
    
    // Default to game for deep links that don't match above
    return 'game';
  } catch (e) {
    return 'unknown';
  }
};

export const fetchPageTitle = async (url: string): Promise<string | undefined> => {
  try {
    const res = await axios.get(url, { 
      timeout: 3000, 
      headers: { 'User-Agent': 'GameSitemapMonitor/1.0' },
      maxContentLength: 500 * 1024 // Limit to 500kb
    });
    
    const html = res.data;
    if (typeof html !== 'string') return undefined;

    // Try og:title first
    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']/i);
    if (ogMatch && ogMatch[1]) return ogMatch[1];

    // Try title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) return titleMatch[1];

    return undefined;
  } catch (e) {
    return undefined;
  }
};