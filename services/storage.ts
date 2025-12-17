import { Site, NewItem, ScanSummary, ReviewStatus } from '../types';

declare var chrome: any;

// Storage keys
const KEY_SITES = 'sites';
const KEY_SEEN = 'seen_urls';
const KEY_NEW_ITEMS = 'new_items';

// Helper to simulate atomic writes/reads with Chrome Storage
const get = async <T>(key: string, defaultValue: T): Promise<T> => {
  return new Promise((resolve) => {
    // Check if chrome.storage is available (it won't be in standard dev mode outside extension)
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.warn('Chrome Storage not available, using localStorage fallback');
        const item = localStorage.getItem(key);
        return resolve(item ? JSON.parse(item) : defaultValue);
    }
    
    chrome.storage.local.get([key], (result: any) => {
      resolve(result[key] || defaultValue);
    });
  });
};

const set = async (key: string, value: any): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        localStorage.setItem(key, JSON.stringify(value));
        return resolve();
    }
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
};

// --- Sites ---
export const loadSites = async (): Promise<Site[]> => {
  return get<Site[]>(KEY_SITES, []);
};

export const saveSites = async (sites: Site[]) => {
  await set(KEY_SITES, sites);
};

// --- Seen URLs ---
export const loadSeen = async (): Promise<Record<string, Record<string, string>>> => {
  return get(KEY_SEEN, {});
};

export const saveSeen = async (seen: Record<string, Record<string, string>>) => {
  await set(KEY_SEEN, seen);
};

export const getSiteSeenUrls = async (siteId: string, limit: number, offset: number) => {
  const allSeen = await loadSeen();
  const siteSeenMap = allSeen[siteId] || {};
  const urls = Object.values(siteSeenMap);
  
  return {
    data: urls.slice(offset, offset + limit),
    total: urls.length
  };
};

// --- New Items ---
export const loadNewItems = async (): Promise<NewItem[]> => {
  const items = await get<NewItem[]>(KEY_NEW_ITEMS, []);
  // Migration logic handled on read if necessary, but simple pass-through is fine for now
  return items;
};

export const saveNewItems = async (items: NewItem[]) => {
  await set(KEY_NEW_ITEMS, items);
};

export const getSiteNewItems = async (siteId: string, limit: number, offset: number) => {
  const allItems = await loadNewItems();
  const siteItems = allItems
    .filter(i => i.siteId === siteId)
    .sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());

  return {
    data: siteItems.slice(offset, offset + limit),
    total: siteItems.length
  };
};

export const appendNewItems = async (items: NewItem[]) => {
  const current = await loadNewItems();
  // We need to implement hashUrl async if we use it for dedupe, 
  // but here we already have IDs or can rely on url string checks.
  // Using a simple unique set based on siteId + url
  
  const existingKeys = new Set(current.map(i => `${i.siteId}|${i.url}`));
  const toAdd = items.filter(i => !existingKeys.has(`${i.siteId}|${i.url}`));

  if (toAdd.length > 0) {
    await saveNewItems([...current, ...toAdd]);
  }
};

export const updateNewItem = async (id: string, updates: Partial<NewItem>) => {
  const items = await loadNewItems();
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    await saveNewItems(items);
    return items[index];
  }
  return null;
};