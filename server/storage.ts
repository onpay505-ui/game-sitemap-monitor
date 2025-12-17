import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Types definition for backend usage (Synced with types.ts)
export interface ScanSummary {
  outcome: 'success' | 'failure';
  parsedCount: number;
  newOrInsertedCount: number;
  durationMs: number;
  error?: string;
  sampleUrls: string[];
}

export interface Site {
  id: string;
  domain: string;
  sitemapUrl: string;
  status: 'unknown' | 'ok' | 'failed' | 'unsupported';
  errorMessage: string;
  baselineReady: boolean;
  baselineAt: string | null;
  lastScanAt: string | null;
  seenCount: number;
  lastNewFound: number;
  lastResult: ScanSummary | null;
  createdAt: string;
}

export type ReviewStatus = 'pending' | 'confirmed' | 'ignored' | 'not_game';
export type UrlType = 'game' | 'tag' | 'category' | 'home' | 'unknown';

export interface NewItem {
  id: string;
  siteId: string;
  domain: string;
  url: string;
  keywordAuto: string;
  keywordFinal: string;
  reviewStatus: ReviewStatus;
  urlType: UrlType;
  title?: string;
  confidence?: number;
  discoveredAt: string;
  sourceSitemapUrl: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const SEEN_FILE = path.join(DATA_DIR, 'seen_urls.json');
const NEW_ITEMS_FILE = path.join(DATA_DIR, 'new_items.json');

// Ensure data directory and files exist
export const ensureDataFilesExist = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(SITES_FILE)) fs.writeFileSync(SITES_FILE, '[]');
  if (!fs.existsSync(SEEN_FILE)) fs.writeFileSync(SEEN_FILE, '{}');
  if (!fs.existsSync(NEW_ITEMS_FILE)) fs.writeFileSync(NEW_ITEMS_FILE, '[]');
};

// Atomic write helper
const atomicWrite = (filePath: string, data: any) => {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
};

// --- Sites ---
export const loadSites = (): Site[] => {
  return JSON.parse(fs.readFileSync(SITES_FILE, 'utf-8'));
};

export const saveSites = (sites: Site[]) => {
  atomicWrite(SITES_FILE, sites);
};

// --- Seen URLs ---
// Structure: { "site_id": { "hash1": "url1", "hash2": "url2" } }
export const loadSeen = (): Record<string, Record<string, string>> => {
  return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
};

export const saveSeen = (seen: Record<string, Record<string, string>>) => {
  atomicWrite(SEEN_FILE, seen);
};

export const getSiteSeenUrls = (siteId: string, limit: number, offset: number) => {
  const allSeen = loadSeen();
  const siteSeenMap = allSeen[siteId] || {};
  const urls = Object.values(siteSeenMap);
  
  return {
    data: urls.slice(offset, offset + limit),
    total: urls.length
  };
};

// --- New Items ---
export const loadNewItems = (): NewItem[] => {
  try {
    const data = JSON.parse(fs.readFileSync(NEW_ITEMS_FILE, 'utf-8'));
    // Migration: Map old gameKeyword to keywordAuto/keywordFinal if missing
    return data.map((item: any) => ({
      ...item,
      keywordAuto: item.keywordAuto || item.gameKeyword || '',
      keywordFinal: item.keywordFinal || item.gameKeyword || '',
      reviewStatus: item.reviewStatus || 'pending',
      urlType: item.urlType || 'game'
    }));
  } catch (e) {
    return [];
  }
};

export const getSiteNewItems = (siteId: string, limit: number, offset: number) => {
  const allItems = loadNewItems();
  // Filter by site and sort by discoveredAt desc
  const siteItems = allItems
    .filter(i => i.siteId === siteId)
    .sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());

  return {
    data: siteItems.slice(offset, offset + limit),
    total: siteItems.length
  };
};

export const appendNewItems = (items: NewItem[]) => {
  const current = loadNewItems();
  
  // Deduplicate
  const existingSet = new Set(current.map(i => `${i.siteId}_${crypto.createHash('sha1').update(i.url).digest('hex')}`));
  
  const toAdd = items.filter(i => {
    const key = `${i.siteId}_${crypto.createHash('sha1').update(i.url).digest('hex')}`;
    return !existingSet.has(key);
  });

  if (toAdd.length > 0) {
    atomicWrite(NEW_ITEMS_FILE, [...current, ...toAdd]);
  }
};

export const updateNewItem = (id: string, updates: Partial<NewItem>) => {
  const items = loadNewItems();
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    atomicWrite(NEW_ITEMS_FILE, items);
    return items[index];
  }
  return null;
};
