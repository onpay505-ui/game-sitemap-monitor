// Browser-compatible utils

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
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(domain);

  return isLocal ? 'http://' : 'https://';
};

export const normalizeUrl = (url: string): string => {
  let clean = url.trim();
  const anchorIdx = clean.indexOf('#');
  if (anchorIdx !== -1) clean = clean.substring(0, anchorIdx);
  if (clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean;
};

// Simple JS SHA-1 implementation to replace Node crypto for synchronous usage if needed,
// or we can use async crypto.subtle. For MVP, async is fine in the new flow.
export const hashUrl = async (url: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    return 'game';
  } catch (e) {
    return 'unknown';
  }
};

export const fetchPageTitle = async (url: string): Promise<string | undefined> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'GameSitemapMonitor/1.0' }
    });
    clearTimeout(id);
    
    if (!res.ok) return undefined;
    
    // Only read the first 500kb to save bandwidth
    const reader = res.body?.getReader();
    if (!reader) return undefined;
    
    let html = '';
    let receivedLength = 0;
    while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
        receivedLength += value.length;
        if (receivedLength > 500 * 1024) break; 
    }

    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']/i);
    if (ogMatch && ogMatch[1]) return ogMatch[1];

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) return titleMatch[1];

    return undefined;
  } catch (e) {
    return undefined;
  }
};