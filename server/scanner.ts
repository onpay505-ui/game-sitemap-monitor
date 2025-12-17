import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as utils from './utils';

const parser = new XMLParser();

export const discoverSitemap = async (domain: string): Promise<{ url: string; error?: string; status: 'ok' | 'failed' | 'unsupported' }> => {
  const protocol = utils.getProtocol(domain);
  const robotsUrl = `${protocol}${domain}/robots.txt`;
  const defaultSitemapUrl = `${protocol}${domain}/sitemap.xml`;

  let targetSitemapUrl = defaultSitemapUrl;

  // 1. Try Robots.txt
  try {
    const robotsRes = await axios.get(robotsUrl, { timeout: 5000, validateStatus: () => true });
    if (robotsRes.status === 200) {
      const lines = robotsRes.data.toString().split('\n');
      for (const line of lines) {
        if (line.trim().toLowerCase().startsWith('sitemap:')) {
          let foundUrl = line.split(/:(.+)/)[1].trim();
          if (foundUrl) {
            // Fix: Handle relative URLs in robots.txt (e.g., "Sitemap: /sitemap.xml")
            if (!foundUrl.match(/^https?:\/\//i)) {
               // Ensure it starts with / if it doesn't
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
    // Ignore robots.txt errors, proceed to default
  }

  // 2. Validate Sitemap
  try {
    const sitemapRes = await axios.get(targetSitemapUrl, { timeout: 10000 });
    
    if (sitemapRes.status !== 200) {
      return { url: targetSitemapUrl, status: 'failed', error: `HTTP ${sitemapRes.status}` };
    }

    const xmlData = parser.parse(sitemapRes.data);

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
  const res = await axios.get(sitemapUrl, { timeout: 15000 });
  const xmlData = parser.parse(res.data);
  
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