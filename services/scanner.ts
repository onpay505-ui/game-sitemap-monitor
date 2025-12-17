import { XMLParser } from 'fast-xml-parser';
import * as utils from './utils';

const parser = new XMLParser();

// Helper to decide whether to use proxy or direct fetch
// On Vercel (production), we MUST use the proxy for external URLs to bypass CORS.
const fetchWithProxy = async (targetUrl: string): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> => {
  const isLocalhostTarget = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
  
  // If we are monitoring localhost, we have to try direct fetch (will fail on Vercel deployment, works locally)
  // If it's an external URL, we use the /api/proxy endpoint.
  
  let fetchUrl = targetUrl;
  
  // Check if we are running in a browser environment that needs proxying
  // Simplistic check: if /api/proxy exists relative to current root, use it.
  if (!isLocalhostTarget) {
     // Use the Vercel serverless function created in api/proxy.ts
     fetchUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  }

  try {
    const res = await fetch(fetchUrl);
    return {
      ok: res.ok,
      status: res.status,
      text: () => res.text()
    };
  } catch (e) {
    // If proxy fails or direct fetch fails
    throw e;
  }
};

export const discoverSitemap = async (domain: string): Promise<{ url: string; error?: string; status: 'ok' | 'failed' | 'unsupported' }> => {
  const protocol = utils.getProtocol(domain);
  const robotsUrl = `${protocol}${domain}/robots.txt`;
  const defaultSitemapUrl = `${protocol}${domain}/sitemap.xml`;

  let targetSitemapUrl = defaultSitemapUrl;

  // 1. Try Robots.txt
  try {
    const res = await fetchWithProxy(robotsUrl);
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim().toLowerCase().startsWith('sitemap:')) {
          let foundUrl = line.split(/:(.+)/)[1].trim();
          if (foundUrl) {
            if (!foundUrl.match(/^https?:\/\//i)) {
               if (!foundUrl.startsWith('/')) foundUrl = '/' + foundUrl;
               targetSitemapUrl = `${protocol}${domain}${foundUrl}`;
            } else {
               targetSitemapUrl = foundUrl;
            }
            break;
          }
        }
      }
    }
  } catch (e) {
    // Ignore robots.txt errors
  }

  // 2. Validate Sitemap
  try {
    const sitemapRes = await fetchWithProxy(targetSitemapUrl);
    
    if (!sitemapRes.ok) {
      return { url: targetSitemapUrl, status: 'failed', error: `HTTP ${sitemapRes.status}` };
    }

    const text = await sitemapRes.text();
    // fast-xml-parser works in browser
    const xmlData = parser.parse(text);

    if (xmlData.urlset) {
      return { url: targetSitemapUrl, status: 'ok' };
    } else if (xmlData.sitemapindex) {
      return { url: targetSitemapUrl, status: 'unsupported', error: 'Type: sitemapindex' };
    } else {
      return { url: targetSitemapUrl, status: 'unsupported', error: 'Unknown XML structure' };
    }

  } catch (e: any) {
    return { url: targetSitemapUrl, status: 'failed', error: e.message || 'Network error' };
  }
};

export const fetchSitemapUrls = async (sitemapUrl: string): Promise<string[]> => {
  const res = await fetchWithProxy(sitemapUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const text = await res.text();
  const xmlData = parser.parse(text);
  
  if (!xmlData.urlset) {
    throw new Error('Not a urlset sitemap');
  }

  let urls: string[] = [];
  const urlEntry = xmlData.urlset.url;

  if (Array.isArray(urlEntry)) {
    urls = urlEntry.map((u: any) => u.loc).filter(Boolean);
  } else if (urlEntry && urlEntry.loc) {
    urls = [urlEntry.loc];
  }

  return urls;
};