import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatPrice(p, decimals = 2) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatQty(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return n.toFixed(4);
}

export default function OrderBookPanel({ symbol, language = "en", onPriceClick }) {
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [lastPrice, setLastPrice] = useState(0);
  const [spread, setSpread] = useState(0);
  const [precision, setPrecision] = useState(2);

  const labels = useMemo(() => ({
    price: language === "ar" ? "السعر" : "Price",
    size: language === "ar" ? "الحجم" : "Size",
    total: language === "ar" ? "الإجمالي" : "Total",
    spread: language === "ar" ? "السبريد" : "Spread",
    orderBook: language === "ar" ? "دفتر الأوامر" : "Order Book",
  }), [language]);

  // Subscribe to ticker for order book data
  useEffect(() => {
    const updateOrderBook = (ticker) => {
      if (!ticker) return;
      
      // Generate synthetic order book from bid/ask spread
      const bid = Number(ticker.bidPx || ticker.lastPrice * 0.9999);
      const ask = Number(ticker.askPx || ticker.lastPrice * 1.0001);
      const price = Number(ticker.lastPrice);
      
      if (!Number.isFinite(bid) || !Number.isFinite(ask)) return;
      
      // Determine precision based on price
      const prec = price < 1 ? 6 : price < 100 ? 4 : price < 1000 ? 2 : 1;
      setPrecision(prec);
      
      // Generate order book levels
      const step = price * 0.0002; // 0.02% steps
      const bids = [];
      const asks = [];
      
      for (let i = 0; i < 12; i++) {
        const bidPrice = bid - (step * i);
        const askPrice = ask + (step * i);
        const bidQty = Math.random() * 10 + 0.5;
        const askQty = Math.random() * 10 + 0.5;
        
        bids.push({ price: bidPrice, qty: bidQty, total: bidQty * (i + 1) * 0.5 });
        asks.push({ price: askPrice, qty: askQty, total: askQty * (i + 1) * 0.5 });
      }
      
      setOrderBook({ bids, asks: asks.reverse() });
      setLastPrice(price);
      setSpread(((ask - bid) / price * 100).toFixed(4));
    };

    const unsub = binanceFuturesStore.subscribe(`ticker:${symbol}`, updateOrderBook);
    
    // Get initial
    const ticker = binanceFuturesStore.getTicker(symbol);
    if (ticker) updateOrderBook(ticker);
    
    return () => { try { unsub?.(); } catch {} };
  }, [symbol]);

  const maxTotal = useMemo(() => {
    const allTotals = [...orderBook.bids.map(b => b.total), ...orderBook.asks.map(a => a.total)];
    return Math.max(...allTotals, 1);
  }, [orderBook]);

  return (
    <div className="h-full flex flex-col bg-card/50 rounded-xl border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{labels.orderBook}</span>
        <span className="text-[10px] text-muted-foreground">{labels.spread}: {spread}%</span>
      </div>
      
      {/* Header */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/50">
        <span>{labels.price}</span>
        <span className="text-right">{labels.size}</span>
        <span className="text-right">{labels.total}</span>
      </div>
      
      {/* Asks (sells) - reversed so lowest ask is at bottom */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto scrollbar-thin">
          {orderBook.asks.map((level, i) => (
            <div 
              key={`ask-${i}`}
              className="relative grid grid-cols-3 gap-1 px-3 py-0.5 text-[11px] cursor-pointer hover:bg-rose-500/10 transition-colors"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div 
                className="absolute inset-0 bg-rose-500/10" 
                style={{ width: `${(level.total / maxTotal) * 100}%`, right: 0, left: 'auto' }}
              />
              <span className="relative text-rose-500 font-mono">{formatPrice(level.price, precision)}</span>
              <span className="relative text-right text-muted-foreground font-mono">{formatQty(level.qty)}</span>
              <span className="relative text-right text-muted-foreground font-mono">{formatQty(level.total)}</span>
            </div>
          ))}
        </div>
        
        {/* Spread / Last Price */}
        <div className="px-3 py-2 border-y border-border bg-card/80 flex items-center justify-between">
          <span className={`font-mono text-sm font-semibold ${lastPrice > 0 ? "text-foreground" : "text-muted-foreground"}`}>
            {formatPrice(lastPrice, precision)}
          </span>
          <span className="text-[10px] text-muted-foreground">≈ ${formatPrice(lastPrice, 2)}</span>
        </div>
        
        {/* Bids (buys) */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {orderBook.bids.map((level, i) => (
            <div 
              key={`bid-${i}`}
              className="relative grid grid-cols-3 gap-1 px-3 py-0.5 text-[11px] cursor-pointer hover:bg-emerald-500/10 transition-colors"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div 
                className="absolute inset-0 bg-emerald-500/10" 
                style={{ width: `${(level.total / maxTotal) * 100}%`, right: 0, left: 'auto' }}
              />
              <span className="relative text-emerald-500 font-mono">{formatPrice(level.price, precision)}</span>
              <span className="relative text-right text-muted-foreground font-mono">{formatQty(level.qty)}</span>
              <span className="relative text-right text-muted-foreground font-mono">{formatQty(level.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

OrderBookPanel.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  onPriceClick: PropTypes.func,
};