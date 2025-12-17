import express from 'express';
import cors from 'cors';
import * as storage from './storage';
import * as utils from './utils';
import * as scanner from './scanner';
import crypto from 'crypto';

const app = express();
const PORT = 3001;

app.use(cors() as any);
app.use(express.json() as any);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize data
storage.ensureDataFilesExist();

// --- API ROUTES ---

// 1. Get Sites
app.get('/api/sites', (req, res) => {
  const sites = storage.loadSites();
  res.json(sites);
});

// 2. Import Sites
app.post('/api/sites/import', (req, res) => {
  const { domains } = req.body as { domains: string[] };
  if (!domains || !Array.isArray(domains)) return res.status(400).send('Invalid domains');

  console.log(`Importing ${domains.length} domains...`);

  const sites = storage.loadSites();
  const existingDomains = new Set(sites.map(s => s.domain));
  let count = 0;

  domains.forEach(rawDomain => {
    if (!rawDomain) return;
    const cleanDomain = utils.normalizeDomain(rawDomain);
    
    if (cleanDomain && !existingDomains.has(cleanDomain)) {
      const protocol = utils.getProtocol(cleanDomain);
      const newSite: storage.Site = {
        id: `site_${crypto.randomUUID().slice(0, 8)}`,
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
      count++;
    }
  });

  storage.saveSites(sites);
  res.json({ imported: count });
});

// 3. Discover
app.post('/api/sites/:id/discover', async (req, res) => {
  const sites = storage.loadSites();
  const siteIndex = sites.findIndex(s => s.id === req.params.id);
  if (siteIndex === -1) return res.status(404).send('Site not found');

  const site = sites[siteIndex];
  
  const result = await scanner.discoverSitemap(site.domain);
  
  site.sitemapUrl = result.url;
  site.status = result.status;
  site.errorMessage = result.error || '';
  
  storage.saveSites(sites);
  res.json(site);
});

// 4. Baseline
app.post('/api/sites/:id/baseline', async (req, res) => {
  const start = Date.now();
  const sites = storage.loadSites();
  const siteIndex = sites.findIndex(s => s.id === req.params.id);
  if (siteIndex === -1) return res.status(404).send('Site not found');
  const site = sites[siteIndex];

  try {
    const urls = await scanner.fetchSitemapUrls(site.sitemapUrl);
    
    const seenData = storage.loadSeen();
    if (!seenData[site.id]) seenData[site.id] = {};

    let addedCount = 0;
    const sampleUrls: string[] = [];

    urls.forEach(rawUrl => {
      const url = utils.normalizeUrl(rawUrl);
      const hash = utils.hashUrl(url);
      
      if (!seenData[site.id][hash]) {
        seenData[site.id][hash] = url;
        addedCount++;
      }
      if (sampleUrls.length < 5) sampleUrls.push(url);
    });

    storage.saveSeen(seenData);

    // Update Site Stats
    site.baselineReady = true;
    site.baselineAt = new Date().toISOString();
    site.status = 'ok';
    site.errorMessage = '';
    site.seenCount = Object.keys(seenData[site.id]).length;
    
    // Update Result Summary
    site.lastResult = {
      outcome: 'success',
      parsedCount: urls.length,
      newOrInsertedCount: addedCount,
      durationMs: Date.now() - start,
      sampleUrls: sampleUrls
    };
    
    storage.saveSites(sites);
    res.json(site);

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
    storage.saveSites(sites);
    res.status(500).json(site);
  }
});

// 5. Scan (Diff)
app.post('/api/sites/:id/scan', async (req, res) => {
  const start = Date.now();
  const sites = storage.loadSites();
  const siteIndex = sites.findIndex(s => s.id === req.params.id);
  if (siteIndex === -1) return res.status(404).send('Site not found');
  const site = sites[siteIndex];

  if (!site.baselineReady) return res.status(400).send('Baseline not ready');

  try {
    const urls = await scanner.fetchSitemapUrls(site.sitemapUrl);
    const seenData = storage.loadSeen();
    const siteSeen = seenData[site.id] || {}; 
    
    const newUrls: string[] = [];

    urls.forEach(rawUrl => {
      const url = utils.normalizeUrl(rawUrl);
      const hash = utils.hashUrl(url);

      if (!siteSeen[hash]) {
        siteSeen[hash] = url; 
        newUrls.push(url);
      }
    });

    const newItemsFound: storage.NewItem[] = [];
    
    // Process new URLs (concurrently with limit could be better, but Promise.all is ok for MVP)
    // We fetch titles only for new items
    const processedItems = await Promise.all(newUrls.map(async (url) => {
      const classification = utils.classifyUrl(url);
      const keyword = utils.extractGameKeyword(url);
      
      // Auto-mark non-games
      const reviewStatus: storage.ReviewStatus = classification === 'game' ? 'pending' : 'not_game';
      
      // Fetch title (optional)
      const title = await utils.fetchPageTitle(url);

      return {
        id: `new_${crypto.randomUUID()}`,
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
      } as storage.NewItem;
    }));

    newItemsFound.push(...processedItems);

    if (newItemsFound.length > 0) {
      storage.saveSeen(seenData);
      storage.appendNewItems(newItemsFound);
    }

    // Update Site Stats
    site.lastScanAt = new Date().toISOString();
    site.status = 'ok';
    site.seenCount = Object.keys(siteSeen).length;
    site.lastNewFound = newItemsFound.length;

    // Update Result Summary
    site.lastResult = {
      outcome: 'success',
      parsedCount: urls.length,
      newOrInsertedCount: newItemsFound.length,
      durationMs: Date.now() - start,
      sampleUrls: newItemsFound.slice(0, 5).map(i => i.url)
    };

    storage.saveSites(sites);

    res.json({ site, newItems: newItemsFound });

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
    storage.saveSites(sites);
    res.status(500).json({ site, error: e.message });
  }
});

// 6. Get Feed (with optional filtering, though MVP just dumps all)
app.get('/api/feed', (req, res) => {
  const items = storage.loadNewItems();
  // Default sort: pending first, then by date
  items.sort((a, b) => {
    if (a.reviewStatus === 'pending' && b.reviewStatus !== 'pending') return -1;
    if (a.reviewStatus !== 'pending' && b.reviewStatus === 'pending') return 1;
    return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
  });
  res.json(items);
});

// 7. Get Site Seen URLs (Paginated)
app.get('/api/sites/:id/seen', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  
  const result = storage.getSiteSeenUrls(req.params.id, limit, offset);
  res.json({ ...result, page, limit });
});

// 8. Get Site New Items (Paginated)
app.get('/api/sites/:id/new', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const result = storage.getSiteNewItems(req.params.id, limit, offset);
  res.json({ ...result, page, limit });
});

// 9. Update New Item
app.patch('/api/new-items/:id', (req, res) => {
  const { keywordFinal, reviewStatus } = req.body;
  const updated = storage.updateNewItem(req.params.id, { keywordFinal, reviewStatus });
  
  if (updated) {
    res.json(updated);
  } else {
    res.status(404).send('Item not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});