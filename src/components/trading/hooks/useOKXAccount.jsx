/**
 * useOKXAccount - Production-grade hook for OKX account state
 * Single source of truth for balance, positions, orders, and PnL
 * Efficient polling with smart caching and real-time WebSocket integration
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

const POLL_INTERVAL = 120000; // 2 MINUTES for account data (avoid 429)
const POSITIONS_POLL_INTERVAL = 90000; // 90 seconds for positions - reduced to prevent 429

export function useOKXAccount({ enabled = true, symbol = null } = {}) {
  // Account state
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Refs for polling control
  const pollTimeoutRef = useRef(null);
  const positionsPollTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  // Fetch account data (gated to prevent 429 spam)
  const fetchAccount = useCallback(async () => {
    if (!enabled || inFlightRef.current || !mountedRef.current) return;
    
    inFlightRef.current = true;
    
    try {
      const { gated } = await import("@/components/utils/apiGate");
      const res = await gated("okxUserAccount:getMyAccount", () => base44.functions.invoke("okxUserAccount", {
        action: "getMyAccount"
      }), { minIntervalMs: 15000 });

      if (!mountedRef.current) return;

      if (res?.data?.ok && res.data.data?.hasAccount) {
        const d = res.data.data;
        setAccount({
          id: d.accountId,
          externalAccountId: d.externalAccountId,
          label: d.accountLabel,
          status: d.status,
          provider: "OKX",
          // Balances
          balance: d.balances?.totalEquity || 0,
          tradingBalance: d.balances?.tradingUsdt || 0,
          fundingBalance: d.balances?.fundingUsdt || 0,
          availableBalance: d.balances?.availableBalance || 0,
          marginUsed: d.balances?.marginUsed || 0,
          unrealizedPnl: d.balances?.unrealizedPnl || 0,
          equity: d.balances?.totalEquity || 0,
          // Settings
          defaultLeverage: d.defaultLeverage || 10,
          marginMode: d.marginMode || "cross",
          positionCount: d.positionCount || 0,
        });
        setLastSync(d.lastSync || new Date().toISOString());
        setError(null);
      } else {
        setAccount(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || "Failed to fetch account");
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  // Fetch positions (gated)
  const fetchPositions = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    
    try {
      const { gated } = await import("@/components/utils/apiGate");
      const res = await gated("okxUserAccount:getPositions", () => base44.functions.invoke("okxUserAccount", {
        action: "getPositions"
      }), { minIntervalMs: 10000 });

      if (!mountedRef.current) return;

      if (res?.data?.ok && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map(p => ({
          id: `okx_${p.instId}_${p.posSide}`,
          instId: p.instId,
          symbol: p.instId,
          posSide: p.posSide,
          side: String(p.posSide || "").toUpperCase() === "SHORT" ? "SHORT" : 
                (p.size < 0 ? "SHORT" : "LONG"),
          size: Math.abs(Number(p.size || 0)),
          quantity: Math.abs(Number(p.size || 0)),
          entry_price: Number(p.avgPx || 0),
          avgPx: Number(p.avgPx || 0),
          markPx: Number(p.markPx || 0),
          mark_price: Number(p.markPx || 0),
          unrealized_pnl: Number(p.upl || 0),
          upl: Number(p.upl || 0),
          uplRatio: Number(p.uplRatio || 0),
          margin: Number(p.margin || 0),
          leverage: Number(p.lever || 0),
          liqPx: Number(p.liqPx || 0),
          liquidation_price: Number(p.liqPx || 0),
          mgnMode: p.mgnMode,
          status: "OPEN",
        }));
        setPositions(mapped);
      }
    } catch {}
  }, [enabled]);

  // Fetch orders (gated)
  const fetchOrders = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    
    try {
      const { gated } = await import("@/components/utils/apiGate");
      const res = await gated("okxUserAccount:getOrders", () => base44.functions.invoke("okxUserAccount", {
        action: "getOrders"
      }), { minIntervalMs: 15000 });

      if (!mountedRef.current) return;

      if (res?.data?.ok && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map(o => ({
          id: o.ordId,
          ordId: o.ordId,
          instId: o.instId,
          symbol: o.instId,
          side: String(o.side || "").toUpperCase(),
          posSide: o.posSide,
          ordType: o.ordType,
          order_type: String(o.ordType || "").toUpperCase(),
          sz: Number(o.sz || 0),
          quantity: Number(o.sz || 0),
          px: Number(o.px || 0),
          price: Number(o.px || 0),
          entry_price: Number(o.px || 0),
          state: o.state,
          status: "PENDING",
          lever: Number(o.lever || 0),
          leverage: Number(o.lever || 0),
          cTime: o.cTime,
          created_at: o.cTime,
        }));
        setOrders(mapped);
      }
    } catch {}
  }, [enabled]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchAccount(),
      fetchPositions(),
      fetchOrders(),
    ]);
  }, [fetchAccount, fetchPositions, fetchOrders]);

  // Start polling - REDUCED FREQUENCY to prevent 429 errors
  const startPolling = useCallback(() => {
    // Initial fetch only once
    refresh();

    // Account polling (slower - every 60s)
    const pollAccount = async () => {
      if (!mountedRef.current || !enabled) return;
      if (!document.hidden) { // Smart Polling: Only if visible
        await fetchAccount();
      }
      if (mountedRef.current && enabled) {
        pollTimeoutRef.current = setTimeout(pollAccount, POLL_INTERVAL);
      }
    };

    // Positions polling - combined with orders (every 45s)
    const pollPositions = async () => {
      if (!mountedRef.current || !enabled) return;
      if (!document.hidden) { // Smart Polling: Only if visible
        // Batch these together in sequence to avoid parallel 429
        await fetchPositions();
        // Small delay between calls
        await new Promise(r => setTimeout(r, 500));
        await fetchOrders();
      }
      if (mountedRef.current && enabled) {
        positionsPollTimeoutRef.current = setTimeout(pollPositions, POSITIONS_POLL_INTERVAL);
      }
    };

    // Start polling loops after longer initial delay to stagger
    pollTimeoutRef.current = setTimeout(pollAccount, POLL_INTERVAL);
    positionsPollTimeoutRef.current = setTimeout(pollPositions, POSITIONS_POLL_INTERVAL + 5000);
  }, [enabled, fetchAccount, fetchPositions, fetchOrders, refresh]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (positionsPollTimeoutRef.current) {
      clearTimeout(positionsPollTimeoutRef.current);
      positionsPollTimeoutRef.current = null;
    }
  }, []);

  // Effect: Start/stop polling based on enabled state
  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled) {
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // Effect: Update position mark prices from WebSocket
  useEffect(() => {
    if (!positions.length) return;

    const unsubscribers = [];

    positions.forEach(pos => {
      const unsub = binanceFuturesStore.subscribe(`price:${pos.instId}`, (price) => {
        if (!mountedRef.current || !Number.isFinite(price)) return;
        
        setPositions(prev => prev.map(p => {
          if (p.instId !== pos.instId) return p;
          
          const entry = Number(p.entry_price || p.avgPx || 0);
          const size = Number(p.size || p.quantity || 0);
          const side = p.side;
          
          // Calculate unrealized PnL
          let upl = 0;
          if (Number.isFinite(entry) && entry > 0 && Number.isFinite(size)) {
            upl = side === "SHORT" 
              ? (entry - price) * size 
              : (price - entry) * size;
          }
          
          return {
            ...p,
            markPx: price,
            mark_price: price,
            unrealized_pnl: upl,
            upl,
          };
        }));
      });
      
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => {
        try { unsub?.(); } catch {}
      });
    };
  }, [positions.map(p => p.instId).join(",")]);

  // Computed: trades list combining positions and orders
  const trades = [...positions, ...orders];

  // Computed: total unrealized PnL
  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + (Number(p.unrealized_pnl || p.upl || 0)),
    0
  );

  return {
    // Account data
    account,
    hasAccount: Boolean(account?.id),
    
    // Positions & Orders
    positions,
    orders,
    trades,
    
    // Computed
    totalUnrealizedPnl,
    
    // State
    loading,
    error,
    lastSync,
    
    // Actions
    refresh,
    refreshAccount: fetchAccount,
    refreshPositions: fetchPositions,
    refreshOrders: fetchOrders,
  };
}

export default useOKXAccount;