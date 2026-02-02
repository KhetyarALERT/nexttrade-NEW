import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from "@/api/base44Client";

// =============================================================================
// MEME DATA CONTEXT - Dual-source: DexScreener (migrated) + Pump.fun (bonding)
// =============================================================================

const MemeDataContext = createContext(null);

export const useMemeData = () => useContext(MemeDataContext);

// Cache with TTL
const dataCache = {
  migrated: { data: [], timestamp: 0, loading: false },
  pumpfun: { data: [], timestamp: 0, loading: false }
};
const CACHE_TTL = 15000; // 15 seconds

export const MemeDataProvider = ({ children }) => {
  // State for each tab
  const [migratedTokens, setMigratedTokens] = useState([]);
  const [pumpfunTokens, setPumpfunTokens] = useState([]);
  const [loadingMigrated, setLoadingMigrated] = useState(true);
  const [loadingPumpfun, setLoadingPumpfun] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastRefresh, setLastRefresh] = useState({ migrated: null, pumpfun: null });
  const [diagnostics, setDiagnostics] = useState({ migrated: null, pumpfun: null });
  
  // Active tab tracking for smart refresh
  const [activeTab, setActiveTab] = useState('migrated');
  
  // Refs
  const wsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const visibilityRef = useRef(true);
  const mountedRef = useRef(true);

  // =========================================================================
  // FETCH MIGRATED TOKENS (DexScreener)
  // =========================================================================
  const fetchMigratedTokens = useCallback(async (force = false) => {
    // Check cache
    if (!force && dataCache.migrated.data.length > 0 && 
        Date.now() - dataCache.migrated.timestamp < CACHE_TTL) {
      console.log('[MIGRATED] Using cached data:', dataCache.migrated.data.length, 'tokens');
      setMigratedTokens(dataCache.migrated.data);
      setLoadingMigrated(false);
      return;
    }

    // Prevent duplicate requests
    if (dataCache.migrated.loading) {
      console.log('[MIGRATED] Request already in progress');
      return;
    }

    dataCache.migrated.loading = true;
    setLoadingMigrated(true);

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
        
        console.log(`[MIGRATED] Received ${tokens.length} tokens in ${elapsed}ms`);
        
        // Update diagnostics
        setDiagnostics(prev => ({
          ...prev,
          migrated: {
            count: tokens.length,
            fetchTime: elapsed,
            newest: tokens[0]?.createdAt ? new Date(tokens[0].createdAt).toISOString() : null,
            oldest: tokens[tokens.length-1]?.createdAt ? new Date(tokens[tokens.length-1].createdAt).toISOString() : null,
            source: res.data.meta?.source || 'unknown',
            cacheHit: res.data.meta?.cacheHit || false
          }
        }));

        // Update cache
        dataCache.migrated.data = tokens;
        dataCache.migrated.timestamp = Date.now();
        
        setMigratedTokens(tokens);
        setLastRefresh(prev => ({ ...prev, migrated: Date.now() }));
        setConnectionStatus('connected');
      } else {
        console.error('[MIGRATED] Invalid response:', res.data);
      }
    } catch (e) {
      console.error('[MIGRATED] Fetch error:', e);
      setConnectionStatus('error');
    } finally {
      dataCache.migrated.loading = false;
      if (mountedRef.current) {
        setLoadingMigrated(false);
      }
    }
  }, []);

  // =========================================================================
  // FETCH PUMP.FUN TOKENS (Bonding Curve)
  // =========================================================================
  const fetchPumpfunTokens = useCallback(async (force = false) => {
    // Check cache
    if (!force && dataCache.pumpfun.data.length > 0 && 
        Date.now() - dataCache.pumpfun.timestamp < CACHE_TTL) {
      console.log('[PUMPFUN] Using cached data:', dataCache.pumpfun.data.length, 'tokens');
      setPumpfunTokens(dataCache.pumpfun.data);
      setLoadingPumpfun(false);
      return;
    }

    // Prevent duplicate requests
    if (dataCache.pumpfun.loading) {
      console.log('[PUMPFUN] Request already in progress');
      return;
    }

    dataCache.pumpfun.loading = true;
    setLoadingPumpfun(true);

    try {
      console.log('[PUMPFUN] Fetching from API...');
      const startTime = Date.now();
      
      const res = await base44.functions.invoke('memeTokens', { 
        action: 'getPumpFun',
        limit: 100 
      });

      if (!mountedRef.current) return;

      if (res.data?.ok && Array.isArray(res.data.data)) {
        const tokens = res.data.data;
        const elapsed = Date.now() - startTime;
        
        console.log(`[PUMPFUN] Received ${tokens.length} tokens in ${elapsed}ms`);
        
        // Update diagnostics
        setDiagnostics(prev => ({
          ...prev,
          pumpfun: {
            count: tokens.length,
            fetchTime: elapsed,
            newest: tokens[0]?.createdAt ? new Date(tokens[0].createdAt).toISOString() : null,
            oldest: tokens[tokens.length-1]?.createdAt ? new Date(tokens[tokens.length-1].createdAt).toISOString() : null,
            source: res.data.meta?.source || 'unknown',
            cacheHit: res.data.meta?.cacheHit || false
          }
        }));

        // Update cache
        dataCache.pumpfun.data = tokens;
        dataCache.pumpfun.timestamp = Date.now();
        
        setPumpfunTokens(tokens);
        setLastRefresh(prev => ({ ...prev, pumpfun: Date.now() }));
      } else {
        console.error('[PUMPFUN] Invalid response:', res.data);
      }
    } catch (e) {
      console.error('[PUMPFUN] Fetch error:', e);
    } finally {
      dataCache.pumpfun.loading = false;
      if (mountedRef.current) {
        setLoadingPumpfun(false);
      }
    }
  }, []);

  // =========================================================================
  // REFRESH FUNCTIONS
  // =========================================================================
  const refreshMigrated = useCallback(() => fetchMigratedTokens(true), [fetchMigratedTokens]);
  const refreshPumpfun = useCallback(() => fetchPumpfunTokens(true), [fetchPumpfunTokens]);
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMigratedTokens(true), fetchPumpfunTokens(true)]);
  }, [fetchMigratedTokens, fetchPumpfunTokens]);

  // =========================================================================
  // VISIBILITY-AWARE POLLING
  // =========================================================================
  useEffect(() => {
    const handleVisibility = () => {
      visibilityRef.current = document.visibilityState === 'visible';
      if (visibilityRef.current) {
        // Refresh data when tab becomes visible
        if (activeTab === 'migrated') {
          fetchMigratedTokens();
        } else {
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

    // Polling interval - refresh active tab every 30s
    refreshTimerRef.current = setInterval(() => {
      if (!visibilityRef.current) return;
      
      if (activeTab === 'migrated') {
        fetchMigratedTokens();
      } else {
        fetchPumpfunTokens();
      }
    }, 30000);

    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchMigratedTokens, fetchPumpfunTokens, activeTab]);

  // =========================================================================
  // COMBINED TOKENS (for backwards compatibility)
  // =========================================================================
  const tokens = activeTab === 'migrated' ? migratedTokens : pumpfunTokens;
  const loading = activeTab === 'migrated' ? loadingMigrated : loadingPumpfun;

  return (
    <MemeDataContext.Provider value={{ 
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
      setActiveTab,
      
      // Refresh functions
      refreshMigrated,
      refreshPumpfun,
      refreshAll,
      refreshTokens: activeTab === 'migrated' ? refreshMigrated : refreshPumpfun,
      
      // Diagnostics
      lastRefresh,
      diagnostics
    }}>
      {children}
    </MemeDataContext.Provider>
  );
};