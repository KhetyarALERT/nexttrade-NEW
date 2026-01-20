import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BinanceTickerPanel from "@/components/trading/binance/BinanceTickerPanel";
import { okxFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { formatOkxSymbolDisplay } from "@/lib/market/okxSymbols";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCompactPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  if (p >= 10000) return `$${(p/1000).toFixed(1)}K`;
  if (p >= 1000) return `$${p.toFixed(0)}`;
  if (p < 1) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(2)}`;
}

export default function BinanceSymbolSelector({ selectedSymbol, onSelectSymbol, height: _height, language = "en" }) {
  const [open, setOpen] = useState(false);
  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [markPrice, setMarkPrice] = useState(0);
  const [indexPrice, setIndexPrice] = useState(0);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      contractType: isAr ? "عقد دائم" : "Perpetual",
      mark: isAr ? "مارك" : "Mark",
      index: isAr ? "مؤشر" : "Index",
      selectMarketTitle: isAr ? "اختر السوق" : "Select market",
      selectMarketDesc: isAr ? "اختر رمزًا دائمًا USDT‑M لعرض الشارت." : "Select a USDT-M perpetual symbol to view its live chart and stats.",
      tap: isAr ? "اضغط للتغيير" : "Tap to change"
    };
  }, [language]);

  useEffect(() => {
    const unsubTicker = binanceFuturesStore.subscribe(`ticker:${selectedSymbol}`, (t) => {
      if (!t) return;
      if (t.lastPrice) setLastPrice(t.lastPrice);
      if (t.priceChangePercent !== undefined) setChangePct(t.priceChangePercent);
    });
    const unsubPrice = binanceFuturesStore.subscribe(`price:${selectedSymbol}`, (p) => {
      if (p) setLastPrice(Number(p));
    });
    const unsubPremium = binanceFuturesStore.subscribe(`premium:${selectedSymbol}`, (p) => {
      if (!p) return;
      if (p.markPrice !== undefined) setMarkPrice(Number(p.markPrice));
      if (p.indexPrice !== undefined) setIndexPrice(Number(p.indexPrice));
    });

    const existing = binanceFuturesStore.getTicker(selectedSymbol);
    if (existing?.lastPrice) setLastPrice(existing.lastPrice);
    if (existing?.priceChangePercent !== undefined) setChangePct(existing.priceChangePercent);

    const prem = binanceFuturesStore.getPremiumIndex?.(selectedSymbol);
    if (prem?.markPrice) setMarkPrice(prem.markPrice);
    if (prem?.indexPrice) setIndexPrice(prem.indexPrice);

    binanceFuturesStore.startPremiumPolling?.(selectedSymbol, 5000);

    return () => {
      try { unsubTicker?.(); } catch {}
      try { unsubPrice?.(); } catch {}
      try { unsubPremium?.(); } catch {}
    };
  }, [selectedSymbol]);

  const isPositive = changePct >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-xl hover:bg-slate-800/50 active:bg-slate-800/70 transition-all min-w-0 touch-manipulation"
        aria-label="Select symbol"
      >
        {/* Symbol Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold text-base sm:text-lg truncate">{formatOkxSymbolDisplay(selectedSymbol)}</span>
            <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
          </div>
          <div className="text-[10px] text-slate-500 hidden sm:block">{labels.contractType}</div>
        </div>

        {/* Price & Change - Mobile Optimized */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Main Price */}
          <div className="text-right">
            <div className="text-foreground font-mono font-bold text-sm sm:text-base">{formatCompactPrice(lastPrice)}</div>
            <div className={`flex items-center justify-end gap-1 text-[11px] font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
              <TrendIcon className="h-3 w-3" />
              <span>{isPositive ? "+" : ""}{Number(changePct).toFixed(2)}%</span>
            </div>
          </div>

          {/* Mark & Index - Desktop Only */}
          <div className="hidden md:flex items-center gap-4 text-right border-l border-slate-800 pl-4">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{labels.mark}</div>
              <div className="text-[11px] font-mono text-foreground">{formatPrice(markPrice)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{labels.index}</div>
              <div className="text-[11px] font-mono text-foreground">{formatPrice(indexPrice)}</div>
            </div>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-background border-border text-foreground p-0 overflow-hidden w-[min(920px,calc(100vw-1rem))] max-w-[920px] h-[min(85vh,720px)] rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{labels.selectMarketTitle}</DialogTitle>
            <DialogDescription>{labels.selectMarketDesc}</DialogDescription>
          </DialogHeader>
          <BinanceTickerPanel
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => onSelectSymbol(s)}
            onAfterSelect={() => setOpen(false)}
            language={language}
            embedded
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

BinanceSymbolSelector.propTypes = {
  selectedSymbol: PropTypes.string.isRequired,
  onSelectSymbol: PropTypes.func.isRequired,
  height: PropTypes.number,
  language: PropTypes.string,
};