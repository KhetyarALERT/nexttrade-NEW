import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import BinanceTickerPanel from "@/components/trading/binance/BinanceTickerPanel";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatPrice(p, detailed = false) {
  if (!p || !Number.isFinite(p)) return "--";
  if (detailed && p < 1) return p.toFixed(8);
  const digits = p < 1 ? 4 : 2;
  return p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCompactPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(2);
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(p);
}

export default function BinanceSymbolSelector({ selectedSymbol, onSelectSymbol, language = "en", compact = false }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ticker, setTicker] = useState(null);
  const [price, setPrice] = useState(0);
  const [premium, setPremium] = useState(null);

  const displaySymbol = useMemo(() => {
    if (!selectedSymbol) return "BTC-USDT";
    return String(selectedSymbol).replace("-SWAP", "").replace(/-/g, "/");
  }, [selectedSymbol]);

  useEffect(() => {
    const unsub1 = binanceFuturesStore.subscribe(`ticker:${selectedSymbol}`, (t) => setTicker(t || null));
    const unsub2 = binanceFuturesStore.subscribe(`price:${selectedSymbol}`, (p) => setPrice(Number(p) || 0));
    const unsub3 = binanceFuturesStore.subscribe(`premium:${selectedSymbol}`, (pr) => setPremium(pr || null));
    
    const existingTicker = binanceFuturesStore.getTicker(selectedSymbol);
    if (existingTicker) setTicker(existingTicker);
    
    const existingPremium = binanceFuturesStore.getPremiumIndex?.(selectedSymbol);
    if (existingPremium) setPremium(existingPremium);

    binanceFuturesStore.subscribeToTicker(selectedSymbol);

    return () => {
      try { unsub1?.(); } catch {}
      try { unsub2?.(); } catch {}
      try { unsub3?.(); } catch {}
    };
  }, [selectedSymbol]);

  const displayPrice = price || ticker?.lastPrice || ticker?.price || premium?.markPrice || 0;
  const change = ticker?.priceChangePercent ?? ticker?.change ?? 0;
  const isUp = change >= 0;

  // Compact mobile version
  if (compact) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-muted transition-colors"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">{displaySymbol}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono">${formatCompactPrice(displayPrice)}</span>
              <span className={`flex items-center gap-0.5 ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          </div>
        </button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden p-0">
            <BinanceTickerPanel onSelectSymbol={(sym) => { onSelectSymbol(sym); setDialogOpen(false); }} language={language} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Desktop version
  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors w-full"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">{displaySymbol}</h2>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="text-base sm:text-lg font-mono font-semibold text-foreground tabular-nums">
              ${formatPrice(displayPrice, false)}
            </span>
            <span className={`flex items-center gap-1 text-sm font-medium ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </span>
          </div>
        </div>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <BinanceTickerPanel onSelectSymbol={(sym) => { onSelectSymbol(sym); setDialogOpen(false); }} language={language} />
        </DialogContent>
      </Dialog>
    </>
  );
}

BinanceSymbolSelector.propTypes = {
  selectedSymbol: PropTypes.string.isRequired,
  onSelectSymbol: PropTypes.func.isRequired,
  language: PropTypes.string,
  compact: PropTypes.bool,
};