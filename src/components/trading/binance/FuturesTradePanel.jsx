import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function formatNumber(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function FuturesTradePanel({ symbol }) {
  const [activeTab, setActiveTab] = useState("trade");
  const [mode, setMode] = useState("cross");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState("open");

  const baseAsset = useMemo(() => {
    if (!symbol) return "—";
    return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
  }, [symbol]);

  return (
    <aside className="h-full w-full bg-[#0f1320] text-slate-200 border-l border-slate-800/60 flex flex-col">
      <div className="p-3 border-b border-slate-800/60">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900/40">
            <TabsTrigger value="trade" className="data-[state=active]:bg-slate-800">Trade</TabsTrigger>
            <TabsTrigger value="bots" className="data-[state=active]:bg-slate-800">Bots</TabsTrigger>
          </TabsList>

          <TabsContent value="trade" className="mt-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("cross")}
                className={`px-3 py-1 rounded ${mode === "cross" ? "bg-emerald-500 text-black font-semibold" : "bg-slate-800 text-slate-200"}`}
              >
                Cross
              </button>
              <button
                type="button"
                onClick={() => setMode("isolated")}
                className={`px-3 py-1 rounded ${mode === "isolated" ? "bg-emerald-500 text-black font-semibold" : "bg-slate-800 text-slate-200"}`}
              >
                Isolated
              </button>
              <div className="ml-auto text-[11px] text-slate-500">Demo UI (no trading)</div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSide("open")}
                className={`flex-1 py-2 rounded ${side === "open" ? "bg-emerald-600 text-white font-semibold" : "bg-slate-800 text-slate-300"}`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setSide("close")}
                className={`flex-1 py-2 rounded ${side === "close" ? "bg-slate-700 text-white font-semibold" : "bg-slate-800 text-slate-300"}`}
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOrderType("limit")}
                className={`px-3 py-1 rounded ${orderType === "limit" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                Limit
              </button>
              <button
                type="button"
                onClick={() => setOrderType("market")}
                className={`px-3 py-1 rounded ${orderType === "market" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                Market
              </button>
              <button
                type="button"
                onClick={() => setOrderType("trigger")}
                className={`px-3 py-1 rounded ${orderType === "trigger" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                Trigger
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Avail.</span>
                <span className="font-mono">{formatNumber(0)} USDT</span>
              </div>

              <label className="mt-2 block text-[11px] text-slate-500">Amount</label>
              <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter"
                  className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                  inputMode="decimal"
                />
                <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{baseAsset}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled
                  className="py-3 rounded bg-emerald-600/40 text-white/70 font-semibold cursor-not-allowed"
                  title="Trading not enabled in Step 1"
                >
                  Open Long
                </button>
                <button
                  type="button"
                  disabled
                  className="py-3 rounded bg-rose-600/40 text-white/70 font-semibold cursor-not-allowed"
                  title="Trading not enabled in Step 1"
                >
                  Open Short
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Trading UI is added for layout only. Order execution will be implemented later.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="bots" className="mt-3">
            <div className="p-3 rounded bg-slate-900/40 border border-slate-800 text-sm text-slate-300">
              Bots panel placeholder.
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex-1 p-3 overflow-auto">
        <div className="rounded bg-slate-900/30 border border-slate-800 p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Account</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-slate-500">Balance</div>
              <div className="font-mono text-white">{formatNumber(0)} USDT</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Margin</div>
              <div className="font-mono text-white">{formatNumber(0)} USDT</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

FuturesTradePanel.propTypes = {
  symbol: PropTypes.string.isRequired,
};
