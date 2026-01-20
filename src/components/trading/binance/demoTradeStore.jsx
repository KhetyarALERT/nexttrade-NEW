function toNumber(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSymbol(sym) {
  return String(sym || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class DemoTradeStore {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();

    /**
     * For now: single open position per symbol to avoid label overlap.
     * @type {Map<string, {
     *  id: string,
     *  symbol: string,
     *  side: "long"|"short",
     *  qty: number,
     *  entryPrice: number,
     *  tpPrice?: number,
     *  slPrice?: number,
     *  openedAt: number,
     * }>} */
    this.positionsBySymbol = new Map();
  }

  subscribe(event, cb) {
    if (!this.subscribers.has(event)) this.subscribers.set(event, new Set());
    this.subscribers.get(event).add(cb);
    return () => {
      try {
        this.subscribers.get(event)?.delete(cb);
      } catch {}
    };
  }

  emit(event, payload) {
    const subs = this.subscribers.get(event);
    if (!subs || subs.size === 0) return;
    subs.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        // ignore
      }
    });
  }

  getPosition(symbol) {
    const sym = normalizeSymbol(symbol);
    return this.positionsBySymbol.get(sym) || null;
  }

  openPosition({ symbol, side, qty, entryPrice, tpPrice, slPrice }) {
    const sym = normalizeSymbol(symbol);
    const normalizedSide = /** @type {"long"|"short"} */ (side === "short" ? "short" : "long");
    const position = {
      id: uid(),
      symbol: sym,
      side: normalizedSide,
      qty: Math.max(0, toNumber(qty)),
      entryPrice: Math.max(0, toNumber(entryPrice)),
      tpPrice: tpPrice ? Math.max(0, toNumber(tpPrice)) : undefined,
      slPrice: slPrice ? Math.max(0, toNumber(slPrice)) : undefined,
      openedAt: Date.now(),
    };

    this.positionsBySymbol.set(sym, position);
    this.emit("positions", this.positionsBySymbol);
    this.emit(`position:${sym}`, position);
    return position;
  }

  updatePosition(symbol, patch) {
    const sym = normalizeSymbol(symbol);
    const prev = this.positionsBySymbol.get(sym);
    if (!prev) return null;
    const next = {
      ...prev,
      ...patch,
      symbol: sym,
      side: patch?.side ? (patch.side === "short" ? "short" : "long") : prev.side,
    };
    this.positionsBySymbol.set(sym, next);
    this.emit("positions", this.positionsBySymbol);
    this.emit(`position:${sym}`, next);
    return next;
  }

  closePosition(symbol) {
    const sym = normalizeSymbol(symbol);
    const prev = this.positionsBySymbol.get(sym);
    if (!prev) return null;
    this.positionsBySymbol.delete(sym);
    this.emit("positions", this.positionsBySymbol);
    this.emit(`position:${sym}`, null);
    return prev;
  }
}

export const demoTradeStore = new DemoTradeStore();
