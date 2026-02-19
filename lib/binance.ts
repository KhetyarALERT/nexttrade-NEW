"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TickerData, OrderBookEntry, CandleData } from "@/lib/types";

const BINANCE_WS_BASE = "wss://fstream.binance.com/ws";
const BINANCE_REST_BASE = "https://fapi.binance.com";

export function useBinanceTicker(symbols: string[]) {
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (symbols.length === 0) return;

    const streams = symbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join("/");
    const ws = new WebSocket(
      `${BINANCE_WS_BASE}/${streams}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.s) {
        setTickers((prev) => ({
          ...prev,
          [data.s]: {
            symbol: data.s,
            price: parseFloat(data.c),
            priceChange: parseFloat(data.p),
            priceChangePercent: parseFloat(data.P),
            high: parseFloat(data.h),
            low: parseFloat(data.l),
            volume: parseFloat(data.v),
            quoteVolume: parseFloat(data.q),
          },
        }));
      }
    };

    return () => {
      ws.close();
    };
  }, [symbols]);

  return tickers;
}

export function useBinanceOrderBook(symbol: string, depth = 10) {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const ws = new WebSocket(
      `${BINANCE_WS_BASE}/${symbol.toLowerCase()}@depth${depth}@500ms`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.b) {
        setBids(
          data.b.map(([price, qty]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(qty),
          }))
        );
      }
      if (data.a) {
        setAsks(
          data.a.map(([price, qty]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(qty),
          }))
        );
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol, depth]);

  return { bids, asks };
}

export function useBinanceKlines(
  symbol: string,
  interval: string = "1m"
) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch historical data
  const fetchHistory = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${BINANCE_REST_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const parsed: CandleData[] = data.map(
          (k: (string | number)[]) => ({
            time: (k[0] as number) / 1000,
            open: parseFloat(k[1] as string),
            high: parseFloat(k[2] as string),
            low: parseFloat(k[3] as string),
            close: parseFloat(k[4] as string),
            volume: parseFloat(k[5] as string),
          })
        );
        setCandles(parsed);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [symbol, interval]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Subscribe to live updates
  useEffect(() => {
    if (!symbol) return;

    const ws = new WebSocket(
      `${BINANCE_WS_BASE}/${symbol.toLowerCase()}@kline_${interval}`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.k) {
        const k = data.k;
        const candle: CandleData = {
          time: k.t / 1000,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };

        setCandles((prev) => {
          if (prev.length === 0) return [candle];
          const last = prev[prev.length - 1];
          if (last.time === candle.time) {
            return [...prev.slice(0, -1), candle];
          }
          return [...prev, candle];
        });
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol, interval]);

  return { candles, loading };
}

export const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "LINKUSDT",
];

export const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];
