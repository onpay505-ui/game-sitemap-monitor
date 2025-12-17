import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { Site, NewItem, ReviewStatus } from './types';
import { 
  Plus, RefreshCw, AlertCircle, CheckCircle, Clock, 
  ExternalLink, XCircle, FileText, 
  Activity, ChevronLeft, ChevronRight, X, Copy, Edit2, Check, Ban, EyeOff,
  LayoutDashboard, List, Globe
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// --- Types & Constants ---

type Tab = 'dashboard' | 'sites' | 'import';

// --- Components ---

function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 z-50 animate-fade-in ${type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-700'}`}>
      {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100"><X size={16} /></button>
    </div>
  );
}

function StatusBadge({ status, baselineReady }: { status: string, baselineReady: boolean }) {
  if (status === 'unknown') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">Unknown</span>;
  if (status === 'failed') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 uppercase">Failed</span>;
  if (status === 'unsupported') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 uppercase">Unsupported</span>;
  
  if (status === 'ok') {
    return baselineReady 
      ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase flex items-center gap-1"><Activity size={10}/> Monitoring</span>
      : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 uppercase">Setup Needed</span>;
  }
  return null;
}

function SiteDetailModal({ site, onClose }: { site: Site, onClose: () => void }) {
  const [tab, setTab] = useState<'seen' | 'new'>('seen');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<string[] | NewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPage(1);
  }, [tab, site.id]);

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      if (tab === 'seen') {
        const res = await api.getSiteSeen(site.id, p);
        setData(res.data);
        setTotal(res.total);
      } else {
        const res = await api.getSiteNew(site.id, p);
        setData(res.data);
        setTotal(res.total);
      }
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-100">
        <div className="p-5 border-b flex justify-between items-start bg-gray-50/50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{site.domain}</h2>
            <p className="text-xs text-gray-500 font-mono mt-1">{site.sitemapUrl}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-3 divide-x border-b bg-white">
           <div className="p-4 text-center">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Seen</span>
              <div className="font-bold text-2xl text-gray-800 mt-1">{site.seenCount}</div>
           </div>
           <div className="p-4 text-center">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Baseline</span>
              <div className="font-medium text-sm text-gray-700 mt-2">{site.baselineAt ? new Date(site.baselineAt).toLocaleDateString() : 'N/A'}</div>
           </div>
           <div className="p-4 text-center">
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Last Scan</span>
              <div className="font-medium text-sm text-gray-700 mt-2">{site.lastScanAt ? formatDistanceToNow(new Date(site.lastScanAt), { addSuffix: true }) : 'Never'}</div>
           </div>
        </div>

        <div className="flex border-b px-4 gap-6">
            <button 
              onClick={() => setTab('seen')} 
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'seen' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Seen URLs
            </button>
            <button 
              onClick={() => setTab('new')} 
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              New Items History
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-[300px] bg-gray-50/30">
          {loading ? (
             <div className="flex justify-center items-center h-full text-gray-400"><RefreshCw className="animate-spin mr-2"/> Loading...</div>
          ) : (
             <div className="space-y-2">
                {data.length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">No records found.</div>}
                {tab === 'seen' && (data as string[]).map((url, i) => (
                  <div key={i} className="text-xs font-mono bg-white p-2.5 rounded border border-gray-100 text-gray-600 truncate hover:border-indigo-100 transition-colors">{url}</div>
                ))}
                {tab === 'new' && (data as NewItem[]).map((item) => (
                   <div key={item.id} className="text-sm bg-white p-3 rounded border border-gray-100 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between mb-1">
                         <span className="font-bold text-gray-800">{item.keywordFinal}</span>
                         <span className="text-[10px] text-gray-400">{new Date(item.discoveredAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate font-mono">{item.url}</div>
                   </div>
                ))}
             </div>
          )}
        </div>

        <div className="p-3 border-t flex justify-between items-center bg-gray-50 rounded-b-xl">
           <button disabled={page <= 1} onClick={() => loadPage(page - 1)} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 text-gray-600"><ChevronLeft size={18}/></button>
           <span className="text-xs text-gray-500 font-medium">Page {page} of {Math.ceil(total / 50) || 1}</span>
           <button disabled={page * 50 >= total} onClick={() => loadPage(page + 1)} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 text-gray-600"><ChevronRight size={18}/></button>
        </div>
      </div>
    </div>
  );
}

function FeedItemCard({ item, onUpdate }: { item: NewItem, onUpdate: (id: string, updates: Partial<NewItem>) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [keyword, setKeyword] = useState(item.keywordFinal);

  const handleSaveKeyword = () => {
    if (keyword !== item.keywordFinal) {
      onUpdate(item.id, { keywordFinal: keyword });
    }
    setIsEditing(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(item.url);
  };

  const statusColors = {
    pending: 'border-l-indigo-500',
    confirmed: 'border-l-green-500',
    not_game: 'border-l-gray-300 opacity-60',
    ignored: 'border-l-yellow-500 opacity-60'
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-3 border border-gray-100 border-l-4 ${statusColors[item.reviewStatus]} group hover:shadow-md transition-all duration-200`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {item.domain}
          </span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            {formatDistanceToNow(new Date(item.discoveredAt), { addSuffix: true })}
          </span>
        </div>
        
        {item.reviewStatus === 'pending' ? (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onUpdate(item.id, { reviewStatus: 'confirmed' })} title="Confirm" className="p-1 rounded-md hover:bg-green-100 text-green-600"><Check size={14} /></button>
              <button onClick={() => onUpdate(item.id, { reviewStatus: 'not_game' })} title="Not a Game" className="p-1 rounded-md hover:bg-gray-100 text-gray-500"><Ban size={14} /></button>
              <button onClick={() => onUpdate(item.id, { reviewStatus: 'ignored' })} title="Ignore" className="p-1 rounded-md hover:bg-yellow-100 text-yellow-600"><EyeOff size={14} /></button>
          </div>
        ) : (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${item.reviewStatus === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {item.reviewStatus.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="mb-2">
        {item.title && <div className="text-xs text-gray-400 italic mb-0.5 line-clamp-1">{item.title}</div>}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input 
                autoFocus
                className="border rounded px-2 py-0.5 text-sm font-bold text-gray-800 w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onBlur={handleSaveKeyword}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKeyword()}
              />
              <button onClick={handleSaveKeyword} className="text-green-600 p-1"><Check size={16}/></button>
            </div>
          ) : (
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 group/edit cursor-pointer" onClick={() => setIsEditing(true)}>
              {item.keywordFinal}
              <Edit2 size={10} className="text-gray-300 opacity-0 group-hover/edit:opacity-100" />
            </h3>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-50 p-1.5 rounded text-[10px] text-gray-500 border border-gray-100">
         <div className="flex-1 truncate font-mono mr-2" title={item.url}>{item.url}</div>
         <div className="flex gap-1.5 shrink-0">
           <button onClick={copyToClipboard} className="hover:text-indigo-600" title="Copy"><Copy size={12}/></button>
           <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600" title="Open"><ExternalLink size={12}/></a>
         </div>
      </div>
    </div>
  );
}

// --- Main App ---

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sites, setSites] = useState<Site[]>([]);
  const [feed, setFeed] = useState<NewItem[]>([]);
  const [importText, setImportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [feedFilter, setFeedFilter] = useState<'pending' | 'confirmed' | 'all'>('pending');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, f] = await Promise.all([api.getSites(), api.getFeed()]);
      setSites(s);
      setFeed(f);
      if (selectedSite) {
        const updated = s.find(x => x.id === selectedSite.id);
        if (updated) setSelectedSite(updated);
      }
    } catch (e: any) {
      console.error(e);
      setError(`Storage Access Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setLoading(true);
    try {
      const domains = importText.split('\n').filter((l: string) => l.trim().length > 0);
      await api.importSites(domains);
      setImportText('');
      setActiveTab('sites');
      await loadData();
      setToast({ msg: 'Import successful', type: 'success' });
    } catch (e: any) {
      setError(`Import Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionName: string, action: () => Promise<any>) => {
    setLoading(true);
    try {
      await action();
      await loadData();
      setToast({ msg: `${actionName} successful`, type: 'success' });
    } catch (e: any) {
      setToast({ msg: `${actionName} failed: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<NewItem>) => {
    setFeed((prev: NewItem[]) => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    try {
      await api.updateNewItem(id, updates);
      // If confirmed, maybe show toast
    } catch (e) {
      console.error("Failed to update item", e);
      loadData();
    }
  };

  const filteredFeed = feed.filter((item: NewItem) => {
    if (feedFilter === 'all') return true;
    return item.reviewStatus === feedFilter;
  });

  const pendingCount = feed.filter(i => i.reviewStatus === 'pending').length;

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden text-slate-800 font-sans text-sm">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
          <Activity className="text-indigo-400 w-6 h-6 flex-shrink-0" />
          <span className="ml-3 font-bold text-lg hidden md:block tracking-tight text-slate-100">Sitemap<span className="text-indigo-400">Mon</span></span>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-2">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full flex items-center p-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Dashboard"
          >
            <LayoutDashboard size={20} className="flex-shrink-0" />
            <span className="ml-3 font-medium hidden md:block">Feed</span>
            {pendingCount > 0 && <span className="ml-auto bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden md:block">{pendingCount}</span>}
            {pendingCount > 0 && <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full md:hidden"></div>}
          </button>
          
          <button 
            onClick={() => setActiveTab('sites')} 
            className={`w-full flex items-center p-3 rounded-lg transition-all ${activeTab === 'sites' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Sites"
          >
            <Globe size={20} className="flex-shrink-0" />
            <span className="ml-3 font-medium hidden md:block">Sites</span>
          </button>

          <button 
            onClick={() => setActiveTab('import')} 
            className={`w-full flex items-center p-3 rounded-lg transition-all ${activeTab === 'import' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Import"
          >
            <Plus size={20} className="flex-shrink-0" />
            <span className="ml-3 font-medium hidden md:block">Import</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center md:text-left">
          <span className="hidden md:inline">v1.0 MVP</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-800 capitalize">{activeTab}</h1>
          <button 
            onClick={loadData} 
            disabled={loading}
            className={`p-2 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all ${loading ? 'animate-spin text-indigo-600' : ''}`}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
          {error && (
            <div className="bg-red-50 border border-red-200 p-4 mb-6 rounded-lg flex justify-between items-center text-red-700">
              <div className="flex gap-3 items-center">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </div>
              <button onClick={() => setError(null)}><XCircle size={18} className="opacity-60 hover:opacity-100" /></button>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">Bulk Import Domains</h2>
                <textarea
                  className="w-full h-48 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm bg-gray-50 mb-4"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="poki.com&#10;crazygames.com&#10;https://www.coolmathgames.com/"
                />
                <button 
                  onClick={handleImport} 
                  disabled={loading || !importText.trim()} 
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-sm"
                >
                  {loading ? 'Processing...' : 'Import Sites'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sites' && (
            <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
              {sites.length === 0 && (
                 <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                    No sites yet. Go to Import tab.
                 </div>
              )}
              {sites.map(site => (
                <div key={site.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${site.status === 'ok' ? 'bg-green-500' : site.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                       <h3 className="font-bold text-gray-900">{site.domain}</h3>
                       <StatusBadge status={site.status} baselineReady={site.baselineReady} />
                    </div>
                    <button onClick={() => setSelectedSite(site)} className="text-gray-400 hover:text-indigo-600"><FileText size={18}/></button>
                  </div>
                  
                  <div className="text-xs text-gray-500 font-mono mb-4 truncate bg-gray-50 p-1.5 rounded">{site.sitemapUrl}</div>
                  {site.errorMessage && <div className="text-xs text-red-600 mb-3 bg-red-50 p-2 rounded">{site.errorMessage}</div>}

                  <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-gray-400 uppercase text-[10px] font-bold">Seen</div>
                      <div className="font-bold text-gray-700 text-sm">{site.seenCount}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-gray-400 uppercase text-[10px] font-bold">Last</div>
                      <div className="font-bold text-gray-700 text-sm">{site.lastResult?.newOrInsertedCount || 0}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-gray-400 uppercase text-[10px] font-bold">Time</div>
                      <div className="font-bold text-gray-700 text-sm">{site.lastResult?.durationMs || 0}ms</div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t pt-3 mt-auto">
                    {site.status === 'unknown' ? (
                       <button onClick={() => handleAction('Discover', () => api.discover(site.id))} className="flex-1 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100">Discover</button>
                    ) : (
                       <>
                         {!site.baselineReady && site.status === 'ok' && (
                           <button onClick={() => handleAction('Baseline', () => api.baseline(site.id))} className="flex-1 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded hover:bg-green-100">Set Baseline</button>
                         )}
                         {site.baselineReady && (
                           <button onClick={() => handleAction('Scan', () => api.scan(site.id))} className="flex-1 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100">Scan Now</button>
                         )}
                         {(site.status === 'failed' || site.status === 'unsupported') && (
                           <button onClick={() => handleAction('Retry', () => api.discover(site.id))} className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded hover:bg-gray-200">Retry</button>
                         )}
                       </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'dashboard' && (
             <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-1 mb-4 bg-white p-1 rounded-lg shadow-sm border border-gray-100 w-fit">
                   {(['pending', 'confirmed', 'all'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setFeedFilter(filter)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${feedFilter === filter ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {filter}
                      </button>
                   ))}
                </div>

                {filteredFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                      <List size={24} className="text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-medium">No items found in this view</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFeed.map(item => (
                       <FeedItemCard key={item.id} item={item} onUpdate={handleUpdateItem} />
                    ))}
                  </div>
                )}
             </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedSite && <SiteDetailModal site={selectedSite} onClose={() => setSelectedSite(null)} />}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Global Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-[60]">
          <div className="bg-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-100 animate-bounce-slight">
            <RefreshCw className="animate-spin text-indigo-600" />
            <span className="font-medium text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;