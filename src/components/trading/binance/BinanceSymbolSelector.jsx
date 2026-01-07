import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import BinanceTickerPanel from "@/components/trading/binance/BinanceTickerPanel";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function BinanceSymbolSelector({ selectedSymbol, onSelectSymbol, height }) {
  const [open, setOpen] = useState(false);
  const [lastPrice, setLastPrice] = useState(0);
  const [changePct, setChangePct] = useState(0);
  const [markPrice, setMarkPrice] = useState(0);
  const [indexPrice, setIndexPrice] = useState(0);

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

    // Selected symbol mark/index polling
    binanceFuturesStore.startPremiumPolling?.(selectedSymbol, 5000);

    return () => {
      try {
        unsubTicker?.();
      } catch {}
      try {
        unsubPrice?.();
      } catch {}
      try {
        unsubPremium?.();
      } catch {}
    };
  }, [selectedSymbol]);

  const changeClass = useMemo(() => (changePct >= 0 ? "text-emerald-400" : "text-rose-400"), [changePct]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/40 transition-colors min-w-0"
        aria-label="Select symbol"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-bold truncate">{selectedSymbol}</span>
            <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
          </div>
          <div className="text-[11px] text-slate-500">USDT‑M Perpetual</div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-white font-mono font-semibold">{formatPrice(lastPrice)}</div>
            <div className={`text-[11px] font-medium ${changeClass}`}>{changePct >= 0 ? "+" : ""}{Number(changePct).toFixed(2)}%</div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-right">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Mark</div>
              <div className="text-[12px] font-mono text-slate-200">{formatPrice(markPrice)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Index</div>
              <div className="text-[12px] font-mono text-slate-200">{formatPrice(indexPrice)}</div>
            </div>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0f1320] border-slate-800 text-white max-w-3xl p-0 overflow-hidden">
          <BinanceTickerPanel
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => onSelectSymbol(s)}
            onAfterSelect={() => setOpen(false)}
            height={height}
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
};
