import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FixedSizeList as List } from "react-window";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatPrice(p) {
  if (!p || !Number.isFinite(p)) return "--";
  const digits = p < 1 ? 6 : 2;
  return p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCompactNumber(n) {
  if (!n || !Number.isFinite(n)) return "--";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

export default function BinanceTickerPanel({ selectedSymbol, onSelectSymbol, onAfterSelect, height = 640, embedded = false, language = "en" }) {
  const [symbols, setSymbols] = useState(() => binanceFuturesStore.getSymbols());
  const [_tickersVersion, setTickersVersion] = useState(0);
  const [query, setQuery] = useState("");
  const listContainerRef = useRef(null);
  const [listHeight, setListHeight] = useState(() => (typeof height === "number" ? height : 640));

  useEffect(() => {
    const unsubSymbols = binanceFuturesStore.subscribe("symbols", (s) => {
      setSymbols(Array.isArray(s) ? s : []);
    });
    const unsubTickers = binanceFuturesStore.subscribe("tickers", () => {
      // Force render without copying huge structures
      setTickersVersion((v) => v + 1);
    });

    return () => {
      try {
        unsubSymbols?.();
      } catch {}
      try {
        unsubTickers?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;

    const update = () => {
      const h = el.clientHeight;
      if (h && Number.isFinite(h)) setListHeight(h);
    };

    update();

    let ro;
    try {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } catch {
      // ignore
    }

    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      try {
        ro?.disconnect?.();
      } catch {}
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return symbols;
    return symbols.filter((s) => s.includes(q));
  }, [symbols, query]);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      search: isAr ? "ابحث عن الرمز…" : "Search symbol…",
      symbols: isAr ? "رمز" : "symbols",
      contractType: isAr ? "عقد دائم USDT‑M" : "USDT‑M Perpetual",
      tradingPair: isAr ? "زوج التداول" : "Trading Pair",
      lastPrice: isAr ? "آخر سعر" : "Last Price",
      chg24h: isAr ? "تغير 24س" : "24h chg%",
      vol: isAr ? "حجم" : "Vol",
    };
  }, [language]);

  const Row = ({ index, style }) => {
    const symbol = filtered[index];
    const t = binanceFuturesStore.getTicker(symbol);
    const last = t?.lastPrice || 0;
    const chg = t?.priceChangePercent ?? 0;
    const vol = t?.quoteVolume ?? 0;
    const isSelected = symbol === selectedSymbol;

    return (
      <div
        style={style}
        onClick={() => {
          onSelectSymbol?.(symbol);
          onAfterSelect?.();
        }}
        className={`px-3 py-2 cursor-pointer border-b border-slate-800/40 flex items-center justify-between hover:bg-slate-800/40 ${
          isSelected ? "bg-blue-600/10" : ""
        }`}
      >
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-100">{symbol}</span>
          <span className="text-[10px] text-slate-500">{labels.vol} {formatCompactNumber(vol)}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-slate-100">{formatPrice(last)}</div>
          <div className={`text-[11px] font-medium ${chg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {chg >= 0 ? "+" : ""}
            {Number(chg).toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  Row.propTypes = {
    index: PropTypes.number.isRequired,
    style: PropTypes.object.isRequired,
  };

  return (
    <div className={embedded ? "h-full flex flex-col" : "h-full flex flex-col bg-[#0f1320] border-r border-slate-800/50"}>
      <div className={embedded ? "p-3" : "p-3 border-b border-slate-800/50"}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder={labels.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 bg-slate-900/40 border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500/50"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {filtered.length} {labels.symbols}
          </span>
          <span className="hidden sm:inline">{labels.contractType}</span>
        </div>
      </div>

      <div className="px-3 py-2 text-[11px] text-slate-500 border-y border-slate-800/50 flex items-center justify-between">
        <span>{labels.tradingPair}</span>
        <div className="flex items-center gap-10">
          <span>{labels.lastPrice}</span>
          <span>{labels.chg24h}</span>
        </div>
      </div>

      <div ref={listContainerRef} className="flex-1 min-h-0">
        <List
          height={listHeight}
          width="100%"
          itemCount={filtered.length}
          itemSize={60}
          overscanCount={10}
        >
          {Row}
        </List>
      </div>
    </div>
  );
}

BinanceTickerPanel.propTypes = {
  selectedSymbol: PropTypes.string.isRequired,
  onSelectSymbol: PropTypes.func.isRequired,
  onAfterSelect: PropTypes.func,
  height: PropTypes.number,
  embedded: PropTypes.bool,
  language: PropTypes.string,
};
