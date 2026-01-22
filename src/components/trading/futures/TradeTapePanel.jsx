import { useState, useEffect, useMemo, useRef } from "react";
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

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TradeTapePanel({ symbol, language = "en" }) {
  const [trades, setTrades] = useState([]);
  const [precision, setPrecision] = useState(2);
  const containerRef = useRef(null);
  const prevPriceRef = useRef(0);

  const labels = useMemo(() => ({
    trades: language === "ar" ? "الصفقات" : "Trades",
    price: language === "ar" ? "السعر" : "Price",
    size: language === "ar" ? "الحجم" : "Size",
    time: language === "ar" ? "الوقت" : "Time",
  }), [language]);

  // Generate synthetic trades from price updates
  useEffect(() => {
    const generateTrade = (price) => {
      if (!Number.isFinite(price) || price <= 0) return null;
      
      const prec = price < 1 ? 6 : price < 100 ? 4 : price < 1000 ? 2 : 1;
      setPrecision(prec);
      
      const prevPrice = prevPriceRef.current;
      const side = price >= prevPrice ? "buy" : "sell";
      prevPriceRef.current = price;
      
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        price,
        qty: Math.random() * 5 + 0.1,
        side,
        time: Date.now(),
      };
    };

    const unsub = binanceFuturesStore.subscribe(`price:${symbol}`, (price) => {
      const trade = generateTrade(Number(price));
      if (trade) {
        setTrades(prev => {
          const next = [trade, ...prev].slice(0, 50); // Keep last 50 trades
          return next;
        });
      }
    });

    // Get initial price
    const ticker = binanceFuturesStore.getTicker(symbol);
    if (ticker?.lastPrice) {
      prevPriceRef.current = Number(ticker.lastPrice);
      const prec = ticker.lastPrice < 1 ? 6 : ticker.lastPrice < 100 ? 4 : ticker.lastPrice < 1000 ? 2 : 1;
      setPrecision(prec);
    }

    return () => { try { unsub?.(); } catch {} };
  }, [symbol]);

  return (
    <div className="h-full flex flex-col bg-card/50 rounded-xl border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{labels.trades}</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Live</span>
        </div>
      </div>
      
      {/* Header */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/50">
        <span>{labels.price}</span>
        <span className="text-right">{labels.size}</span>
        <span className="text-right">{labels.time}</span>
      </div>
      
      {/* Trade list */}
      <div ref={containerRef} className="flex-1 overflow-auto scrollbar-thin">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
            {language === "ar" ? "في انتظار الصفقات..." : "Waiting for trades..."}
          </div>
        ) : (
          trades.map((trade) => (
            <div 
              key={trade.id}
              className={`grid grid-cols-3 gap-1 px-3 py-0.5 text-[11px] transition-colors ${
                trade.side === "buy" ? "hover:bg-emerald-500/5" : "hover:bg-rose-500/5"
              }`}
            >
              <span className={`font-mono ${trade.side === "buy" ? "text-emerald-500" : "text-rose-500"}`}>
                {formatPrice(trade.price, precision)}
              </span>
              <span className="text-right text-muted-foreground font-mono">
                {formatQty(trade.qty)}
              </span>
              <span className="text-right text-muted-foreground font-mono text-[10px]">
                {formatTime(trade.time)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

TradeTapePanel.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
};