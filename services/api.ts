import { Site, NewItem, PaginatedResponse, ReviewStatus } from '../types';
import * as storage from './storage';
import * as scanner from './scanner';
import * as utils from './utils';

// Safe UUID generation for browser environment
const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  // Fallback for older environments
  return Math.random().toString(36).substring(2, 10);
};

export const api = {
  getSites: async (): Promise<Site[]> => {
    return await storage.loadSites();
  },

  importSites: async (domains: string[]): Promise<void> => {
    const sites = await storage.loadSites();
    const existingDomains = new Set(sites.map(s => s.domain));
    
    for (const rawDomain of domains) {
        if (!rawDomain) continue;
        const cleanDomain = utils.normalizeDomain(rawDomain);
        
        if (cleanDomain && !existingDomains.has(cleanDomain)) {
          const protocol = utils.getProtocol(cleanDomain);
          const newSite: Site = {
            id: `site_${uuid()}`,
            domain: cleanDomain,
            sitemapUrl: `${protocol}${cleanDomain}/sitemap.xml`,
            status: 'unknown',
            errorMessage: '',
            baselineReady: false,
            baselineAt: null,
            lastScanAt: null,
            seenCount: 0,
            lastNewFound: 0,
            lastResult: null,
            createdAt: new Date().toISOString()
          };
          sites.push(newSite);
          existingDomains.add(cleanDomain);
        }
    }
    await storage.saveSites(sites);
  },

  discover: async (id: string): Promise<Site> => {
    const sites = await storage.loadSites();
    const index = sites.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Site not found');
    
    const site = sites[index];
    const result = await scanner.discoverSitemap(site.domain);
    
    site.sitemapUrl = result.url;
    site.status = result.status;
    site.errorMessage = result.error || '';
    
    await storage.saveSites(sites);
    return site;
  },

  baseline: async (id: string): Promise<Site> => {
    const start = Date.now();
    const sites = await storage.loadSites();
    const index = sites.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Site not found');
    const site = sites[index];

    try {
        const urls = await scanner.fetchSitemapUrls(site.sitemapUrl);
        const seenData = await storage.loadSeen();
        if (!seenData[site.id]) seenData[site.id] = {};

        let addedCount = 0;
        const sampleUrls: string[] = [];

        for (const rawUrl of urls) {
            const url = utils.normalizeUrl(rawUrl);
            const hash = await utils.hashUrl(url); 
            
            if (!seenData[site.id][hash]) {
                seenData[site.id][hash] = url;
                addedCount++;
            }
            if (sampleUrls.length < 5) sampleUrls.push(url);
        }

        await storage.saveSeen(seenData);

        site.baselineReady = true;
        site.baselineAt = new Date().toISOString();
        site.status = 'ok';
        site.errorMessage = '';
        site.seenCount = Object.keys(seenData[site.id]).length;
        
        site.lastResult = {
            outcome: 'success',
            parsedCount: urls.length,
            newOrInsertedCount: addedCount,
            durationMs: Date.now() - start,
            sampleUrls: sampleUrls
        };
        
        await storage.saveSites(sites);
        return site;

    } catch (e: any) {
        site.status = 'failed';
        site.errorMessage = e.message;
        site.lastResult = {
            outcome: 'failure',
            parsedCount: 0,
            newOrInsertedCount: 0,
            durationMs: Date.now() - start,
            error: e.message,
            sampleUrls: []
        };
        await storage.saveSites(sites);
        throw e;
    }
  },

  scan: async (id: string): Promise<{ site: Site; newItems: NewItem[] }> => {
    const start = Date.now();
    const sites = await storage.loadSites();
    const index = sites.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Site not found');
    const site = sites[index];

    if (!site.baselineReady) throw new Error('Baseline not ready');

    try {
        const urls = await scanner.fetchSitemapUrls(site.sitemapUrl);
        const seenData = await storage.loadSeen();
        const siteSeen = seenData[site.id] || {};
        
        const newUrls: string[] = [];
        
        for (const rawUrl of urls) {
            const url = utils.normalizeUrl(rawUrl);
            const hash = await utils.hashUrl(url);
            
            if (!siteSeen[hash]) {
                siteSeen[hash] = url;
                newUrls.push(url);
            }
        }

        const newItemsFound: NewItem[] = [];
        
        for (const url of newUrls) {
            const classification = utils.classifyUrl(url);
            const keyword = utils.extractGameKeyword(url);
            const reviewStatus: ReviewStatus = classification === 'game' ? 'pending' : 'not_game';
            const title = await utils.fetchPageTitle(url);

            newItemsFound.push({
                id: `new_${uuid()}`,
                siteId: site.id,
                domain: site.domain,
                url: url,
                keywordAuto: keyword,
                keywordFinal: keyword,
                reviewStatus: reviewStatus,
                urlType: classification,
                title: title,
                discoveredAt: new Date().toISOString(),
                sourceSitemapUrl: site.sitemapUrl
            });
        }

        if (newItemsFound.length > 0) {
            // Update seen maps locally in memory then save
            for (const item of newItemsFound) {
                 const hash = await utils.hashUrl(item.url);
                 siteSeen[hash] = item.url;
            }
            seenData[site.id] = siteSeen;
            await storage.saveSeen(seenData);
            await storage.appendNewItems(newItemsFound);
        }

        site.lastScanAt = new Date().toISOString();
        site.status = 'ok';
        site.seenCount = Object.keys(siteSeen).length;
        site.lastNewFound = newItemsFound.length;

        site.lastResult = {
            outcome: 'success',
            parsedCount: urls.length,
            newOrInsertedCount: newItemsFound.length,
            durationMs: Date.now() - start,
            sampleUrls: newItemsFound.slice(0, 5).map(i => i.url)
        };

        await storage.saveSites(sites);
        return { site, newItems: newItemsFound };

    } catch (e: any) {
        site.status = 'failed';
        site.errorMessage = e.message;
        site.lastResult = {
            outcome: 'failure',
            parsedCount: 0,
            newOrInsertedCount: 0,
            durationMs: Date.now() - start,
            error: e.message,
            sampleUrls: []
        };
        await storage.saveSites(sites);
        throw e;
    }
  },

  getFeed: async (): Promise<NewItem[]> => {
    return await storage.loadNewItems();
  },

  getSiteSeen: async (id: string, page = 1, limit = 50): Promise<PaginatedResponse<string>> => {
    const res = await storage.getSiteSeenUrls(id, limit, (page - 1) * limit);
    return { ...res, page, limit };
  },

  getSiteNew: async (id: string, page = 1, limit = 50): Promise<PaginatedResponse<NewItem>> => {
    const res = await storage.getSiteNewItems(id, limit, (page - 1) * limit);
    return { ...res, page, limit };
  },

  updateNewItem: async (id: string, data: { keywordFinal?: string, reviewStatus?: ReviewStatus }): Promise<NewItem> => {
    const updated = await storage.updateNewItem(id, data);
    if (!updated) throw new Error('Item not found');
    return updated;
  }
};