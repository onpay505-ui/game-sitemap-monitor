import { XMLParser } from 'fast-xml-parser';
import * as utils from './utils';

const parser = new XMLParser();

// For Chrome Extensions with host_permissions, we can fetch directly.
const fetchDirect = async (url: string) => {
  const res = await fetch(url);
  return {
    ok: res.ok,
    status: res.status,
    text: () => res.text()
  };
};

export const discoverSitemap = async (domain: string): Promise<{ url: string; error?: string; status: 'ok' | 'failed' | 'unsupported' }> => {
  const protocol = utils.getProtocol(domain);
  const robotsUrl = `${protocol}${domain}/robots.txt`;
  const defaultSitemapUrl = `${protocol}${domain}/sitemap.xml`;

  let targetSitemapUrl = defaultSitemapUrl;

  // 1. Try Robots.txt
  try {
    const res = await fetchDirect(robotsUrl);
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
    const sitemapRes = await fetchDirect(targetSitemapUrl);
    
    if (!sitemapRes.ok) {
      return { url: targetSitemapUrl, status: 'failed', error: `HTTP ${sitemapRes.status}` };
    }

    const text = await sitemapRes.text();
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
  const res = await fetchDirect(sitemapUrl);
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