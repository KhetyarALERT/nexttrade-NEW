import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { base44 } from "@/api/base44Client";

// =============================================================================
// MEME DATA CONTEXT - Dual-source: DexScreener (migrated) + Pump.fun (bonding)
// =============================================================================

const MemeDataContext = createContext(null);

export const useMemeData = () => useContext(MemeDataContext);

// Global cache (outside component to persist across re-renders)
const globalCache = {
  migrated: { data: [], timestamp: 0 },
  pumpfun: { data: [], timestamp: 0 }
};
const CACHE_TTL = 20000; // 20 seconds

// Request deduplication
const pendingRequests = {
  migrated: null,
  pumpfun: null
};

export const MemeDataProvider = ({ children }) => {
  // State for each tab - using stable references
  const [migratedTokens, setMigratedTokens] = useState(() => globalCache.migrated.data);
  const [pumpfunTokens, setPumpfunTokens] = useState(() => globalCache.pumpfun.data);
  const [loadingMigrated, setLoadingMigrated] = useState(globalCache.migrated.data.length === 0);
  const [loadingPumpfun, setLoadingPumpfun] = useState(globalCache.pumpfun.data.length === 0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastRefresh, setLastRefresh] = useState({ migrated: null, pumpfun: null });
  const [diagnostics, setDiagnostics] = useState({ migrated: null, pumpfun: null });
  
  // Active tab tracking for smart refresh
  const [activeTab, setActiveTab] = useState('migrated');
  
  // Refs
  const refreshTimerRef = useRef(null);
  const visibilityRef = useRef(true);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  // =========================================================================
  // FETCH MIGRATED TOKENS (DexScreener)
  // =========================================================================
  const fetchMigratedTokens = useCallback(async (force = false) => {
    // Check cache first for instant UI
    const cacheValid = globalCache.migrated.data.length > 0 && 
                       Date.now() - globalCache.migrated.timestamp < CACHE_TTL;
    
    if (!force && cacheValid) {
      console.log('[MIGRATED] Using cached data:', globalCache.migrated.data.length, 'tokens');
      if (migratedTokens.length === 0) {
        setMigratedTokens([...globalCache.migrated.data]);
      }
      setLoadingMigrated(false);
      setConnectionStatus('connected');
      return;
    }

    // Single-flight: return existing promise if one is in progress
    if (pendingRequests.migrated) {
      console.log('[MIGRATED] Request already in progress, waiting...');
      return pendingRequests.migrated;
    }

    // Only show loading if we have no data to display
    if (globalCache.migrated.data.length === 0) {
      setLoadingMigrated(true);
    }

    const fetchPromise = (async () => {
      try {
        console.log('[MIGRATED] Fetching from API...');
        const startTime = Date.now();
        
        const res = await base44.functions.invoke('memeTokens', { 
          action: 'getMigrated',
          limit: 200 
        });

        if (!mountedRef.current) return;

        if (res.data?.ok && Array.isArray(res.data.data)) {
          const tokens = res.data.data;
          const elapsed = Date.now() - startTime;
          
          // Dedupe by mint
          const seen = new Set();
          const uniqueTokens = tokens.filter(t => {
            if (seen.has(t.mint)) return false;
            seen.add(t.mint);
            return true;
          });
          
          console.log(`[MIGRATED] Received ${uniqueTokens.length} unique tokens in ${elapsed}ms`);
          
          // Validation log
          if (uniqueTokens.length > 0) {
            const newest = uniqueTokens[0];
            const oldest = uniqueTokens[uniqueTokens.length - 1];
            const newestAge = formatAge(newest?.createdAt);
            const oldestAge = formatAge(oldest?.createdAt);
            console.log(`Migrated: fetched ${tokens.length}, unique ${uniqueTokens.length}, newest=${newestAge}, oldest=${oldestAge}`);
          }
          
          // Update diagnostics
          setDiagnostics(prev => ({
            ...prev,
            migrated: {
              count: uniqueTokens.length,
              fetchTime: elapsed,
              newest: uniqueTokens[0]?.createdAt ? new Date(uniqueTokens[0].createdAt).toISOString() : null,
              oldest: uniqueTokens[uniqueTokens.length-1]?.createdAt ? new Date(uniqueTokens[uniqueTokens.length-1].createdAt).toISOString() : null,
              source: res.data.meta?.source || 'unknown'
            }
          }));

          // Update global cache
          globalCache.migrated.data = uniqueTokens;
          globalCache.migrated.timestamp = Date.now();
          
          // Update state with NEW array reference
          setMigratedTokens([...uniqueTokens]);
          setLastRefresh(prev => ({ ...prev, migrated: Date.now() }));
          setConnectionStatus('connected');
        } else {
          console.error('[MIGRATED] Invalid response:', res.data);
        }
      } catch (e) {
        console.error('[MIGRATED] Fetch error:', e);
        if (globalCache.migrated.data.length === 0) {
          setConnectionStatus('error');
        }
      } finally {
        pendingRequests.migrated = null;
        if (mountedRef.current) {
          setLoadingMigrated(false);
        }
      }
    })();

    pendingRequests.migrated = fetchPromise;
    return fetchPromise;
  }, [migratedTokens.length]);

  // =========================================================================
  // FETCH PUMP.FUN TOKENS (Bonding Curve)
  // =========================================================================
  const fetchPumpfunTokens = useCallback(async (force = false) => {
    // Check cache first for instant UI
    const cacheValid = globalCache.pumpfun.data.length > 0 && 
                       Date.now() - globalCache.pumpfun.timestamp < CACHE_TTL;
    
    if (!force && cacheValid) {
      console.log('[PUMPFUN] Using cached data:', globalCache.pumpfun.data.length, 'tokens');
      if (pumpfunTokens.length === 0) {
        setPumpfunTokens([...globalCache.pumpfun.data]);
      }
      setLoadingPumpfun(false);
      return;
    }

    // Single-flight: return existing promise if one is in progress
    if (pendingRequests.pumpfun) {
      console.log('[PUMPFUN] Request already in progress, waiting...');
      return pendingRequests.pumpfun;
    }

    // Only show loading if we have no data to display
    if (globalCache.pumpfun.data.length === 0) {
      setLoadingPumpfun(true);
    }

    const fetchPromise = (async () => {
      try {
        console.log('[PUMPFUN] Fetching from API...');
        const startTime = Date.now();
        
        const res = await base44.functions.invoke('memeTokens', { 
          action: 'getPumpFun',
          limit: 200 
        });

        if (!mountedRef.current) return;

        if (res.data?.ok && Array.isArray(res.data.data)) {
          const tokens = res.data.data;
          const elapsed = Date.now() - startTime;
          
          // Dedupe by mint
          const seen = new Set();
          const uniqueTokens = tokens.filter(t => {
            if (seen.has(t.mint)) return false;
            seen.add(t.mint);
            return true;
          });
          
          console.log(`[PUMPFUN] Received ${uniqueTokens.length} unique tokens in ${elapsed}ms`);
          
          // Validation log
          if (uniqueTokens.length > 0) {
            const newest = uniqueTokens[0];
            const oldest = uniqueTokens[uniqueTokens.length - 1];
            const newestAge = formatAge(newest?.createdAt);
            const oldestAge = formatAge(oldest?.createdAt);
            console.log(`PumpFun: fetched ${tokens.length}, unique ${uniqueTokens.length}, newest=${newestAge}, oldest=${oldestAge}`);
          }
          
          // Update diagnostics
          setDiagnostics(prev => ({
            ...prev,
            pumpfun: {
              count: uniqueTokens.length,
              fetchTime: elapsed,
              newest: uniqueTokens[0]?.createdAt ? new Date(uniqueTokens[0].createdAt).toISOString() : null,
              oldest: uniqueTokens[uniqueTokens.length-1]?.createdAt ? new Date(uniqueTokens[uniqueTokens.length-1].createdAt).toISOString() : null,
              source: res.data.meta?.source || 'unknown'
            }
          }));

          // Update global cache
          globalCache.pumpfun.data = uniqueTokens;
          globalCache.pumpfun.timestamp = Date.now();
          
          // Update state with NEW array reference
          setPumpfunTokens([...uniqueTokens]);
          setLastRefresh(prev => ({ ...prev, pumpfun: Date.now() }));
        } else {
          console.error('[PUMPFUN] Invalid response:', res.data);
        }
      } catch (e) {
        console.error('[PUMPFUN] Fetch error:', e);
      } finally {
        pendingRequests.pumpfun = null;
        if (mountedRef.current) {
          setLoadingPumpfun(false);
        }
      }
    })();

    pendingRequests.pumpfun = fetchPromise;
    return fetchPromise;
  }, [pumpfunTokens.length]);

  // =========================================================================
  // REFRESH FUNCTIONS
  // =========================================================================
  const refreshMigrated = useCallback(() => fetchMigratedTokens(true), [fetchMigratedTokens]);
  const refreshPumpfun = useCallback(() => fetchPumpfunTokens(true), [fetchPumpfunTokens]);
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMigratedTokens(true), fetchPumpfunTokens(true)]);
  }, [fetchMigratedTokens, fetchPumpfunTokens]);

  // =========================================================================
  // TAB CHANGE HANDLER - Instant switch with background refresh
  // =========================================================================
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    
    // Instantly show cached data if available
    if (newTab === 'migrated' && globalCache.migrated.data.length > 0) {
      setMigratedTokens([...globalCache.migrated.data]);
      setLoadingMigrated(false);
      // Background refresh if stale
      if (Date.now() - globalCache.migrated.timestamp > CACHE_TTL) {
        fetchMigratedTokens();
      }
    } else if (newTab === 'pumpfun' && globalCache.pumpfun.data.length > 0) {
      setPumpfunTokens([...globalCache.pumpfun.data]);
      setLoadingPumpfun(false);
      // Background refresh if stale
      if (Date.now() - globalCache.pumpfun.timestamp > CACHE_TTL) {
        fetchPumpfunTokens();
      }
    } else {
      // No cache, need to fetch
      if (newTab === 'migrated') {
        fetchMigratedTokens();
      } else {
        fetchPumpfunTokens();
      }
    }
  }, [fetchMigratedTokens, fetchPumpfunTokens]);

  // =========================================================================
  // VISIBILITY-AWARE POLLING
  // =========================================================================
  useEffect(() => {
    const handleVisibility = () => {
      visibilityRef.current = document.visibilityState === 'visible';
      if (visibilityRef.current) {
        // Refresh active tab data when page becomes visible (if stale)
        if (activeTab === 'migrated' && Date.now() - globalCache.migrated.timestamp > CACHE_TTL) {
          fetchMigratedTokens();
        } else if (activeTab === 'pumpfun' && Date.now() - globalCache.pumpfun.timestamp > CACHE_TTL) {
          fetchPumpfunTokens();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeTab, fetchMigratedTokens, fetchPumpfunTokens]);

  // =========================================================================
  // INITIAL LOAD + POLLING
  // =========================================================================
  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch of both sources
    fetchMigratedTokens();
    fetchPumpfunTokens();

    // Polling interval - refresh active tab every 25s (only when visible)
    refreshTimerRef.current = setInterval(() => {
      if (!visibilityRef.current) return;
      
      if (activeTab === 'migrated') {
        fetchMigratedTokens();
      } else {
        fetchPumpfunTokens();
      }
    }, 25000);

    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);  // Only run on mount

  // =========================================================================
  // MEMOIZED VALUES
  // =========================================================================
  const tokens = useMemo(() => {
    return activeTab === 'migrated' ? migratedTokens : pumpfunTokens;
  }, [activeTab, migratedTokens, pumpfunTokens]);
  
  const loading = activeTab === 'migrated' ? loadingMigrated : loadingPumpfun;

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // Current tab data
    tokens, 
    loading, 
    connectionStatus,
    
    // Tab-specific data
    migratedTokens,
    pumpfunTokens,
    loadingMigrated,
    loadingPumpfun,
    
    // Tab control
    activeTab,
    setActiveTab: handleTabChange,
    
    // Refresh functions
    refreshMigrated,
    refreshPumpfun,
    refreshAll,
    refreshTokens: activeTab === 'migrated' ? refreshMigrated : refreshPumpfun,
    
    // Diagnostics
    lastRefresh,
    diagnostics
  }), [
    tokens, loading, connectionStatus,
    migratedTokens, pumpfunTokens, loadingMigrated, loadingPumpfun,
    activeTab, handleTabChange,
    refreshMigrated, refreshPumpfun, refreshAll,
    lastRefresh, diagnostics
  ]);

  return (
    <MemeDataContext.Provider value={contextValue}>
      {children}
    </MemeDataContext.Provider>
  );
};

// Helper function for age formatting in logs
function formatAge(timestamp) {
  if (!timestamp) return 'unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}