import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";

function formatNumber(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function stepForPrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return 0.01;
  if (n < 0.01) return 0.000001;
  if (n < 0.1) return 0.00001;
  if (n < 1) return 0.0001;
  if (n < 10) return 0.001;
  if (n < 100) return 0.01;
  if (n < 1000) return 0.1;
  return 1;
}

function stepForAmount(a) {
  const n = Number(a);
  if (!Number.isFinite(n) || n <= 0) return 0.001;
  if (n < 0.01) return 0.0001;
  if (n < 1) return 0.001;
  if (n < 10) return 0.01;
  return 0.1;
}

function wheelAdjust(currentValue, deltaY, step) {
  const curr = parseNum(currentValue);
  const base = Number.isFinite(curr) ? curr : 0;
  const dir = deltaY > 0 ? -1 : 1;
  const next = Math.max(0, base + dir * step);
  return String(next);
}

export default function FuturesTradePanel({ symbol, language = "en" }) {
  const [activeTab, setActiveTab] = useState("trade");
  const [mode, setMode] = useState("cross");
  const [orderType, setOrderType] = useState("limit");
  const [side, setSide] = useState("open");

  const [lastPrice, setLastPrice] = useState(0);

  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");
  const [lastEdited, setLastEdited] = useState("amount");

  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPct, setTpPct] = useState("25");
  const [slPct, setSlPct] = useState("10");

  const baseAsset = useMemo(() => {
    if (!symbol) return "—";
    return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
  }, [symbol]);

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      trade: isAr ? "تداول" : "Trade",
      bots: isAr ? "بوتات" : "Bots",
      cross: isAr ? "مشترك" : "Cross",
      isolated: isAr ? "معزول" : "Isolated",
      demo: isAr ? "واجهة تجريبية (بدون تنفيذ)" : "Demo UI (no trading)",
      open: isAr ? "فتح" : "Open",
      close: isAr ? "إغلاق" : "Close",
      limit: isAr ? "محدد" : "Limit",
      market: isAr ? "سوق" : "Market",
      trigger: isAr ? "تفعيل" : "Trigger",
      mark: isAr ? "مارك" : "Mark",
      avail: isAr ? "المتاح" : "Avail.",
      price: isAr ? "السعر" : "Price",
      amount: isAr ? "الكمية" : "Amount",
      total: isAr ? "الإجمالي" : "Total",
      enter: isAr ? "أدخل" : "Enter",
      estCost: isAr ? "التكلفة التقديرية" : "Est. cost",
      marketHint: isAr ? "أوامر السوق تُنفذ بأفضل سعر متاح." : "Market orders execute at the best available price.",
      triggerHint: isAr ? "أمر التفعيل يضع أمرًا عند الوصول لسعر التفعيل." : "Trigger order places an order once a trigger price is reached.",
      triggerPrice: isAr ? "سعر التفعيل" : "Trigger price",
      tpSl: isAr ? "هدف/وقف" : "TP/SL",
      enabled: isAr ? "مفعل" : "Enabled",
      off: isAr ? "إيقاف" : "Off",
      takeProfitPct: isAr ? "هدف الربح %" : "Take Profit %",
      stopLossPct: isAr ? "وقف الخسارة %" : "Stop Loss %",
      tpPrice: isAr ? "سعر الهدف" : "TP price",
      slPrice: isAr ? "سعر الوقف" : "SL price",
      tpSlHint: isAr ? "يستخدم سعر الأمر الحالي (أو سعر المارك) كمرجع." : "Uses the current order price (or mark price) as a reference.",
      openLong: isAr ? "فتح شراء" : "Open Long",
      openShort: isAr ? "فتح بيع" : "Open Short",
      disabledTitle: isAr ? "التداول غير مفعل بعد" : "Trading not enabled in Step 1",
      note: isAr ? "تمت إضافة واجهة التداول للتخطيط فقط. سيتم تنفيذ الأوامر لاحقًا." : "Trading UI is added for layout only. Order execution will be implemented later.",
      account: isAr ? "الحساب" : "Account",
      balance: isAr ? "الرصيد" : "Balance",
      margin: isAr ? "الهامش" : "Margin",
    };
  }, [language]);

  useEffect(() => {
    const unsubPrice = binanceFuturesStore.subscribe(`price:${symbol}`, (p) => {
      if (p) setLastPrice(Number(p));
    });
    const existing = binanceFuturesStore.getTicker(symbol);
    if (existing?.lastPrice) setLastPrice(Number(existing.lastPrice));
    return () => {
      try {
        unsubPrice?.();
      } catch {}
    };
  }, [symbol]);

  // keep total/amount in sync (UI helper)
  useEffect(() => {
    const p = parseNum(price);
    const a = parseNum(amount);
    const t = parseNum(total);

    if (orderType !== "limit") return;

    if (lastEdited === "total") {
      if (Number.isFinite(p) && p > 0 && Number.isFinite(t)) {
        const nextA = t / p;
        if (Number.isFinite(nextA)) setAmount(String(nextA));
      }
      return;
    }

    if (Number.isFinite(p) && Number.isFinite(a)) {
      const nextT = p * a;
      if (Number.isFinite(nextT)) setTotal(String(nextT));
    }
  }, [price, amount, total, lastEdited, orderType]);

  const refPrice = useMemo(() => {
    const p = parseNum(price);
    if (Number.isFinite(p) && p > 0) return p;
    if (Number.isFinite(lastPrice) && lastPrice > 0) return lastPrice;
    return 0;
  }, [price, lastPrice]);

  const tpPrice = useMemo(() => {
    if (!tpSlEnabled || !refPrice) return null;
    const pct = clamp(parseNum(tpPct), 0, 9999);
    return side === "open" ? refPrice * (1 + pct / 100) : refPrice * (1 - pct / 100);
  }, [tpSlEnabled, refPrice, tpPct, side]);

  const slPrice = useMemo(() => {
    if (!tpSlEnabled || !refPrice) return null;
    const pct = clamp(parseNum(slPct), 0, 9999);
    return side === "open" ? refPrice * (1 - pct / 100) : refPrice * (1 + pct / 100);
  }, [tpSlEnabled, refPrice, slPct, side]);

  return (
    <aside className="h-full w-full bg-[#0f1320] text-slate-200 border-l border-slate-800/60 flex flex-col">
      <div className="p-3 border-b border-slate-800/60">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900/40">
            <TabsTrigger value="trade" className="data-[state=active]:bg-slate-800">{labels.trade}</TabsTrigger>
            <TabsTrigger value="bots" className="data-[state=active]:bg-slate-800">{labels.bots}</TabsTrigger>
          </TabsList>

          <TabsContent value="trade" className="mt-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("cross")}
                className={`px-3 py-1 rounded ${mode === "cross" ? "bg-emerald-500 text-black font-semibold" : "bg-slate-800 text-slate-200"}`}
              >
                {labels.cross}
              </button>
              <button
                type="button"
                onClick={() => setMode("isolated")}
                className={`px-3 py-1 rounded ${mode === "isolated" ? "bg-emerald-500 text-black font-semibold" : "bg-slate-800 text-slate-200"}`}
              >
                {labels.isolated}
              </button>
              <div className="ml-auto text-[11px] text-slate-500">{labels.demo}</div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSide("open")}
                className={`flex-1 py-2 rounded ${side === "open" ? "bg-emerald-600 text-white font-semibold" : "bg-slate-800 text-slate-300"}`}
              >
                {labels.open}
              </button>
              <button
                type="button"
                onClick={() => setSide("close")}
                className={`flex-1 py-2 rounded ${side === "close" ? "bg-slate-700 text-white font-semibold" : "bg-slate-800 text-slate-300"}`}
              >
                {labels.close}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOrderType("limit")}
                className={`px-3 py-1 rounded ${orderType === "limit" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                {labels.limit}
              </button>
              <button
                type="button"
                onClick={() => setOrderType("market")}
                className={`px-3 py-1 rounded ${orderType === "market" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                {labels.market}
              </button>
              <button
                type="button"
                onClick={() => setOrderType("trigger")}
                className={`px-3 py-1 rounded ${orderType === "trigger" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                {labels.trigger}
              </button>

              <div className="ml-auto text-[11px] text-slate-500 font-mono">
                {labels.mark} {lastPrice ? formatNumber(lastPrice, lastPrice < 1 ? 6 : 2) : "—"}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{labels.avail}</span>
                <span className="font-mono">{formatNumber(0)} USDT</span>
              </div>

              {orderType === "limit" ? (
                <>
                  <label className="mt-3 block text-[11px] text-slate-500">{labels.price}</label>
                  <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                    <input
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        setLastEdited("price");
                      }}
                      onWheel={(e) => {
                        e.preventDefault();
                        const step = stepForPrice(parseNum(price) || lastPrice);
                        setPrice((v) => wheelAdjust(v, e.deltaY, step));
                        setLastEdited("price");
                      }}
                      placeholder={lastPrice ? String(lastPrice) : labels.enter}
                      className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                      inputMode="decimal"
                    />
                    <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500">Amount</label>
                      <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                        <input
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setLastEdited("amount");
                          }}
                          onWheel={(e) => {
                            e.preventDefault();
                            const step = stepForAmount(parseNum(amount));
                            setAmount((v) => wheelAdjust(v, e.deltaY, step));
                            setLastEdited("amount");
                          }}
                          placeholder={labels.enter}
                          className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                          inputMode="decimal"
                        />
                        <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{baseAsset}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">Total</label>
                      <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                        <input
                          value={total}
                          onChange={(e) => {
                            setTotal(e.target.value);
                            setLastEdited("total");
                          }}
                          onWheel={(e) => {
                            e.preventDefault();
                            const step = stepForPrice(parseNum(total));
                            setTotal((v) => wheelAdjust(v, e.deltaY, step));
                            setLastEdited("total");
                          }}
                          placeholder="0"
                          className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                          inputMode="decimal"
                        />
                        <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {orderType === "market" ? (
                <>
                  <div className="mt-3 text-[11px] text-slate-500">{labels.marketHint}</div>

                  <label className="mt-3 block text-[11px] text-slate-500">{labels.amount}</label>
                  <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onWheel={(e) => {
                        e.preventDefault();
                        const step = stepForAmount(parseNum(amount));
                        setAmount((v) => wheelAdjust(v, e.deltaY, step));
                      }}
                      placeholder={labels.enter}
                      className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                      inputMode="decimal"
                    />
                    <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{baseAsset}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{labels.estCost}</span>
                    <span className="font-mono">
                      {refPrice && parseNum(amount)
                        ? formatNumber(refPrice * parseNum(amount), 2)
                        : "—"}{" "}
                      USDT
                    </span>
                  </div>
                </>
              ) : null}

              {orderType === "trigger" ? (
                <>
                  <div className="mt-3 text-[11px] text-slate-500">{labels.triggerHint}</div>
                  <label className="mt-3 block text-[11px] text-slate-500">{labels.triggerPrice}</label>
                  <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      onWheel={(e) => {
                        e.preventDefault();
                        const step = stepForPrice(parseNum(price) || lastPrice);
                        setPrice((v) => wheelAdjust(v, e.deltaY, step));
                      }}
                      placeholder={lastPrice ? String(lastPrice) : labels.enter}
                      className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                      inputMode="decimal"
                    />
                    <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                  </div>

                  <label className="mt-3 block text-[11px] text-slate-500">{labels.amount}</label>
                  <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onWheel={(e) => {
                        e.preventDefault();
                        const step = stepForAmount(parseNum(amount));
                        setAmount((v) => wheelAdjust(v, e.deltaY, step));
                      }}
                      placeholder={labels.enter}
                      className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                      inputMode="decimal"
                    />
                    <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{baseAsset}</span>
                  </div>
                </>
              ) : null}

              <div className="mt-4 rounded bg-slate-900/30 border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">{labels.tpSl}</div>
                  <button
                    type="button"
                    onClick={() => setTpSlEnabled((v) => !v)}
                    className={`text-[11px] px-2 py-1 rounded ${tpSlEnabled ? "bg-blue-600/20 text-blue-200" : "bg-slate-800 text-slate-300"}`}
                  >
                    {tpSlEnabled ? labels.enabled : labels.off}
                  </button>
                </div>

                {tpSlEnabled ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] text-slate-500">{labels.takeProfitPct}</div>
                        <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                          <input
                            value={tpPct}
                            onChange={(e) => setTpPct(e.target.value)}
                            onWheel={(e) => {
                              e.preventDefault();
                              setTpPct((v) => wheelAdjust(v, e.deltaY, 1));
                            }}
                            className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                            inputMode="decimal"
                          />
                          <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">%</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {[25, 50, 100].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setTpPct(String(p))}
                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {labels.tpPrice}: {tpPrice ? formatNumber(tpPrice, tpPrice < 1 ? 6 : 2) : "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-500">{labels.stopLossPct}</div>
                        <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                          <input
                            value={slPct}
                            onChange={(e) => setSlPct(e.target.value)}
                            onWheel={(e) => {
                              e.preventDefault();
                              setSlPct((v) => wheelAdjust(v, e.deltaY, 1));
                            }}
                            className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                            inputMode="decimal"
                          />
                          <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">%</span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {[5, 10, 20].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSlPct(String(p))}
                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {labels.slPrice}: {slPrice ? formatNumber(slPrice, slPrice < 1 ? 6 : 2) : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-500">
                      {labels.tpSlHint}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled
                  className="py-3 rounded bg-emerald-600/40 text-white/70 font-semibold cursor-not-allowed"
                  title={labels.disabledTitle}
                >
                  {labels.openLong}
                </button>
                <button
                  type="button"
                  disabled
                  className="py-3 rounded bg-rose-600/40 text-white/70 font-semibold cursor-not-allowed"
                  title={labels.disabledTitle}
                >
                  {labels.openShort}
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                {labels.note}
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
          <div className="text-[11px] uppercase tracking-wider text-slate-500">{labels.account}</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-slate-500">{labels.balance}</div>
              <div className="font-mono text-white">{formatNumber(0)} USDT</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{labels.margin}</div>
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
  language: PropTypes.string,
};
