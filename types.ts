export interface ScanSummary {
  outcome: 'success' | 'failure';
  parsedCount: number;
  newOrInsertedCount: number; // For baseline: inserted. For scan: new found.
  durationMs: number;
  error?: string;
  sampleUrls: string[]; // First 5 URLs found/added
}

export interface Site {
  id: string;
  domain: string;
  sitemapUrl: string;
  status: 'unknown' | 'ok' | 'failed' | 'unsupported';
  errorMessage: string;
  
  // State
  baselineReady: boolean;
  baselineAt: string | null;
  lastScanAt: string | null;
  
  // Stats
  seenCount: number;
  lastNewFound: number; // Count of new items found in last scan
  
  // Observability
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
  
  // Review Data
  keywordAuto: string;
  keywordFinal: string;
  reviewStatus: ReviewStatus;
  urlType: UrlType;
  title?: string;
  confidence?: number;

  discoveredAt: string;
  sourceSitemapUrl: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
