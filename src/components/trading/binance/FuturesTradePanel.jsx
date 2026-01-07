import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { binanceFuturesStore } from "@/components/trading/binance/binanceFuturesStore";
import { base44 } from "@/api/base44Client";

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

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getReferencePrice(orderType, priceValue, lastPrice) {
  if (orderType === "market") {
    return Number.isFinite(Number(lastPrice)) && Number(lastPrice) > 0 ? Number(lastPrice) : NaN;
  }
  // "price" is used as Limit price or Trigger price depending on mode.
  const pRaw = parseNum(priceValue);
  if (Number.isFinite(pRaw) && pRaw > 0) return pRaw;
  return Number.isFinite(Number(lastPrice)) && Number(lastPrice) > 0 ? Number(lastPrice) : NaN;
}

export default function FuturesTradePanel({
  symbol,
  language = "en",
  liveAccount = null,
  demoAccount = null,
  onTradesChanged,
  onAccountsChanged,
}) {
  const [activeTab, setActiveTab] = useState("trade");
  const [mode, setMode] = useState("cross");
  const [orderType, setOrderType] = useState("limit");
  const [side, setSide] = useState("open");

  const [lastPrice, setLastPrice] = useState(0);

  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");
  const [lastEdited, setLastEdited] = useState("amount");

  const [amountPct, setAmountPct] = useState(0);

  const [tpSlLongEnabled, setTpSlLongEnabled] = useState(true);
  const [tpSlShortEnabled, setTpSlShortEnabled] = useState(false);

  const [longTpTrigger, setLongTpTrigger] = useState("");
  const [longTpRatio, setLongTpRatio] = useState("");
  const [longSlTrigger, setLongSlTrigger] = useState("");
  const [longSlRatio, setLongSlRatio] = useState("");

  const [shortTpTrigger, setShortTpTrigger] = useState("");
  const [shortTpRatio, setShortTpRatio] = useState("");
  const [shortSlTrigger, setShortSlTrigger] = useState("");
  const [shortSlRatio, setShortSlRatio] = useState("");

  const [tpSlAdvancedOpen, setTpSlAdvancedOpen] = useState(false);

  const [botsBusy, setBotsBusy] = useState(false);
  const [botsError, setBotsError] = useState("");

  const [longTpTargets, setLongTpTargets] = useState(() => [{ id: uid(), closePct: "25", price: "" }]);
  const [longSlTargets, setLongSlTargets] = useState(() => [{ id: uid(), closePct: "100", price: "" }]);
  const [shortTpTargets, setShortTpTargets] = useState(() => [{ id: uid(), closePct: "25", price: "" }]);
  const [shortSlTargets, setShortSlTargets] = useState(() => [{ id: uid(), closePct: "100", price: "" }]);

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
      longTpSl: isAr ? "هدف/وقف شراء" : "Long TP/SL",
      shortTpSl: isAr ? "هدف/وقف بيع" : "Short TP/SL",
      advanced: isAr ? "متقدم" : "Advanced",
      tpTrigger: isAr ? "تفعيل الهدف" : "TP Trigger",
      tpRatio: isAr ? "نسبة الهدف" : "TP Ratio",
      slTrigger: isAr ? "تفعيل الوقف" : "SL Trigger",
      slRatio: isAr ? "نسبة الوقف" : "SL Ratio",
      percent: isAr ? "%" : "%",
      openLong: isAr ? "فتح شراء" : "Open Long",
      openShort: isAr ? "فتح بيع" : "Open Short",
      disabledTitle: isAr ? "التداول غير مفعل بعد" : "Trading not enabled in Step 1",
      note: isAr ? "تمت إضافة واجهة التداول للتخطيط فقط. سيتم تنفيذ الأوامر لاحقًا." : "Trading UI is added for layout only. Order execution will be implemented later.",
      account: isAr ? "الحساب" : "Account",
      balance: isAr ? "الرصيد" : "Balance",
      margin: isAr ? "الهامش" : "Margin",
      amountSliderHint: isAr ? "شريط النسبة للكمية (سيعمل بالكامل عند ربط الرصيد)." : "Amount % slider (fully works once balance is wired).",
      botsPlaceholder: isAr ? "لوحة البوتات (قريبًا)." : "Bots panel placeholder.",
      demoTrade: isAr ? "تداول تجريبي" : "Demo trade",
      demoOpenLong: isAr ? "فتح شراء (تجريبي)" : "Open Long (demo)",
      demoOpenShort: isAr ? "فتح بيع (تجريبي)" : "Open Short (demo)",
      demoClose: isAr ? "إغلاق (تجريبي)" : "Close (demo)",
      partialTp: isAr ? "جني ربح جزئي" : "Partial Take Profit",
      partialSl: isAr ? "وقف خسارة جزئي" : "Partial Stop Loss",
      closePct: isAr ? "نسبة الإغلاق" : "Close %",
      closePrice: isAr ? "سعر الإغلاق" : "Close price",
      addTarget: isAr ? "إضافة هدف" : "Add target",
      remove: isAr ? "حذف" : "Remove",
    };
  }, [language]);

  const getAccountSnapshot = (demoMode) => {
    const account = demoMode ? (demoAccount || liveAccount) : (liveAccount || demoAccount);
    if (!account) {
      return { balance: 0, equity: 0, marginUsed: 0, availableMargin: 0, hasAccount: false };
    }

    const balance = Number(account.demo_balance ?? account.balance ?? 0);
    const equity = Number(account.equity ?? balance ?? 0);
    const marginUsed = Number(account.margin_used ?? 0);
    const availableMargin = Number.isFinite(equity) && Number.isFinite(marginUsed) ? Math.max(0, equity - marginUsed) : 0;
    return {
      balance: Number.isFinite(balance) ? balance : 0,
      equity: Number.isFinite(equity) ? equity : 0,
      marginUsed: Number.isFinite(marginUsed) ? marginUsed : 0,
      availableMargin,
      hasAccount: true,
    };
  };

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
  // - Limit: price input is the reference price
  // - Market: mark/last price is the reference price
  // - Trigger: trigger price is the reference price (fallback to mark)
  useEffect(() => {
    const p = getReferencePrice(orderType, price, lastPrice);
    const a = parseNum(amount);
    const t = parseNum(total);

    // If user edits total => recompute amount.
    if (lastEdited === "total") {
      if (Number.isFinite(p) && p > 0 && Number.isFinite(t)) {
        const nextA = t / p;
        if (Number.isFinite(nextA)) setAmount(String(nextA));
      }
      return;
    }

    // If user edits amount => recompute total.
    if (Number.isFinite(p) && p > 0 && Number.isFinite(a)) {
      const nextT = p * a;
      if (Number.isFinite(nextT)) setTotal(String(nextT));
    }
  }, [price, amount, total, lastEdited, orderType, lastPrice]);

  const refPrice = useMemo(() => {
    if (orderType === "market") {
      return Number.isFinite(lastPrice) && lastPrice > 0 ? lastPrice : 0;
    }

    const p = parseNum(price);
    if (Number.isFinite(p) && p > 0) return p;
    if (Number.isFinite(lastPrice) && lastPrice > 0) return lastPrice;
    return 0;
  }, [price, lastPrice, orderType]);

  const doDemoOpen = async (demoSide) => {
    setBotsError("");
    setBotsBusy(true);

    try {
      const tradingAccountId = demoAccount?.id || liveAccount?.id;
      if (!tradingAccountId) {
        setBotsError(language === "ar" ? "لا يوجد حساب متاح" : "No trading account available");
        return;
      }

      const qty = parseNum(amount);
      const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const entryPrice = refPrice || lastPrice;
      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        setBotsError(language === "ar" ? "سعر غير صالح" : "Invalid price");
        return;
      }

      const sideKey = demoSide === "short" ? "SHORT" : "LONG";
      const leverage = Number(demoAccount?.default_leverage ?? liveAccount?.default_leverage ?? 10);

      const tpRaw = sideKey === "LONG" ? parseNum(longTpTrigger) : parseNum(shortTpTrigger);
      const slRaw = sideKey === "LONG" ? parseNum(longSlTrigger) : parseNum(shortSlTrigger);

      const takeProfit = Number.isFinite(tpRaw) && tpRaw > 0 ? tpRaw : null;
      const stopLoss = Number.isFinite(slRaw) && slRaw > 0 ? slRaw : null;

      const res = await base44.functions.invoke("tradingAccount", {
        action: "openTrade",
        tradingAccountId,
        symbol,
        side: sideKey,
        quantity,
        leverage: Number.isFinite(leverage) && leverage > 0 ? leverage : 10,
        entryPrice,
        orderType: "MARKET",
        takeProfit,
        stopLoss,
      });

      if (!res?.data?.success) {
        setBotsError(res?.data?.error || (language === "ar" ? "فشل فتح الصفقة" : "Failed to open trade"));
        return;
      }

      await onTradesChanged?.();
      await onAccountsChanged?.();
    } catch {
      setBotsError(language === "ar" ? "فشل فتح الصفقة" : "Failed to open trade");
    } finally {
      setBotsBusy(false);
    }
  };

  const doDemoClose = async () => {
    setBotsError("");
    setBotsBusy(true);

    try {
      const tradingAccountId = demoAccount?.id || liveAccount?.id;
      if (!tradingAccountId) {
        setBotsError(language === "ar" ? "لا يوجد حساب متاح" : "No trading account available");
        return;
      }

      const exitPrice = refPrice || lastPrice;
      if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
        setBotsError(language === "ar" ? "سعر غير صالح" : "Invalid price");
        return;
      }

      const listRes = await base44.functions.invoke("tradingAccount", {
        action: "getTrades",
        tradingAccountId,
        status: "OPEN",
        limit: 50,
      });

      const list = listRes?.data?.data || [];
      const open = list.find((t) => String(t?.symbol || "").toUpperCase() === String(symbol || "").toUpperCase() && t?.status === "OPEN");
      if (!open?.id) {
        setBotsError(language === "ar" ? "لا يوجد مركز مفتوح" : "No open position to close");
        return;
      }

      const closeRes = await base44.functions.invoke("tradingAccount", {
        action: "closeTrade",
        tradeId: open.id,
        exitPrice,
        reason: "bots_demo",
      });

      if (!closeRes?.data?.success) {
        setBotsError(closeRes?.data?.error || (language === "ar" ? "فشل إغلاق الصفقة" : "Failed to close trade"));
        return;
      }

      await onTradesChanged?.();
      await onAccountsChanged?.();
    } catch {
      setBotsError(language === "ar" ? "فشل إغلاق الصفقة" : "Failed to close trade");
    } finally {
      setBotsBusy(false);
    }
  };

  const renderOrderForm = (opts = {}) => {
    const demoMode = Boolean(opts.demoMode);
    const accountSnap = getAccountSnapshot(demoMode);

    return (
      <>
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
          <div className="ml-auto text-[11px] text-slate-500">{demoMode ? labels.demoTrade : labels.demo}</div>
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
            <span className="font-mono">{accountSnap.hasAccount ? formatNumber(accountSnap.availableMargin, 2) : "—"} USDT</span>
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
                  <label className="block text-[11px] text-slate-500">{labels.amount}</label>
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

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{amountPct}%</span>
                      <span className="text-[10px] text-slate-600">{labels.amountSliderHint}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={amountPct}
                      onChange={(e) => setAmountPct(Number(e.target.value))}
                      className="mt-2 w-full accent-emerald-500"
                    />
                    <div className="mt-2 flex justify-between gap-1">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAmountPct(p)}
                          className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500">{labels.total}</label>
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

              <label className="mt-3 block text-[11px] text-slate-500">{labels.total}</label>
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

              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{amountPct}%</span>
                  <span className="text-[10px] text-slate-600">{labels.amountSliderHint}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={amountPct}
                  onChange={(e) => setAmountPct(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-500"
                />
                <div className="mt-2 flex justify-between gap-1">
                  {[0, 25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmountPct(p)}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
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

              <label className="mt-3 block text-[11px] text-slate-500">{labels.total}</label>
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

              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{amountPct}%</span>
                  <span className="text-[10px] text-slate-600">{labels.amountSliderHint}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={amountPct}
                  onChange={(e) => setAmountPct(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-500"
                />
                <div className="mt-2 flex justify-between gap-1">
                  {[0, 25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmountPct(p)}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="mt-4 rounded bg-slate-900/30 border border-slate-800 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{labels.tpSl}</div>
              <button
                type="button"
                onClick={() => setTpSlAdvancedOpen((v) => !v)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                {labels.advanced}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tpSlLongEnabled}
                  onChange={(e) => setTpSlLongEnabled(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-slate-200">{labels.longTpSl}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tpSlShortEnabled}
                  onChange={(e) => setTpSlShortEnabled(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-slate-200">{labels.shortTpSl}</span>
              </label>
            </div>

            {tpSlLongEnabled ? (
              <div className="mt-3 rounded bg-slate-950/20 border border-slate-800/70 p-3">
                <div className="text-[11px] text-slate-400 mb-2">{labels.longTpSl}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500">{labels.tpTrigger}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={longTpTrigger}
                        onChange={(e) => setLongTpTrigger(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          const step = stepForPrice(parseNum(longTpTrigger) || lastPrice);
                          setLongTpTrigger((v) => wheelAdjust(v, e.deltaY, step));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500">{labels.tpRatio}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={longTpRatio}
                        onChange={(e) => setLongTpRatio(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          setLongTpRatio((v) => wheelAdjust(v, e.deltaY, 1));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{labels.percent}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500">{labels.slTrigger}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={longSlTrigger}
                        onChange={(e) => setLongSlTrigger(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          const step = stepForPrice(parseNum(longSlTrigger) || lastPrice);
                          setLongSlTrigger((v) => wheelAdjust(v, e.deltaY, step));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500">{labels.slRatio}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={longSlRatio}
                        onChange={(e) => setLongSlRatio(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          setLongSlRatio((v) => wheelAdjust(v, e.deltaY, 1));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{labels.percent}</span>
                    </div>
                  </div>
                </div>

                {tpSlAdvancedOpen ? (
                  <div className="mt-3">
                    <div className="text-[11px] text-slate-400 mb-2">{labels.partialTp}</div>
                    <div className="space-y-2">
                      {longTpTargets.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.closePct}
                              onChange={(e) =>
                                setLongTpTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, closePct: e.target.value } : r)))
                              }
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">%</span>
                          </div>
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.price}
                              onChange={(e) =>
                                setLongTpTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, price: e.target.value } : r)))
                              }
                              onWheel={(e) => {
                                e.preventDefault();
                                const step = stepForPrice(parseNum(row.price) || lastPrice);
                                setLongTpTargets((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, price: wheelAdjust(r.price, e.deltaY, step) } : r)),
                                );
                              }}
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLongTpTargets((prev) => prev.filter((r) => r.id !== row.id))}
                            className="px-2 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                            disabled={longTpTargets.length <= 1}
                            title={labels.remove}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setLongTpTargets((prev) => [...prev, { id: uid(), closePct: "25", price: "" }])}
                        className="px-3 py-2 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 text-[11px]"
                      >
                        {labels.addTarget}
                      </button>
                    </div>

                    <div className="mt-4 text-[11px] text-slate-400 mb-2">{labels.partialSl}</div>
                    <div className="space-y-2">
                      {longSlTargets.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.closePct}
                              onChange={(e) =>
                                setLongSlTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, closePct: e.target.value } : r)))
                              }
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">%</span>
                          </div>
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.price}
                              onChange={(e) =>
                                setLongSlTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, price: e.target.value } : r)))
                              }
                              onWheel={(e) => {
                                e.preventDefault();
                                const step = stepForPrice(parseNum(row.price) || lastPrice);
                                setLongSlTargets((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, price: wheelAdjust(r.price, e.deltaY, step) } : r)),
                                );
                              }}
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLongSlTargets((prev) => prev.filter((r) => r.id !== row.id))}
                            className="px-2 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                            disabled={longSlTargets.length <= 1}
                            title={labels.remove}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setLongSlTargets((prev) => [...prev, { id: uid(), closePct: "100", price: "" }])}
                        className="px-3 py-2 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 text-[11px]"
                      >
                        {labels.addTarget}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tpSlShortEnabled ? (
              <div className="mt-3 rounded bg-slate-950/20 border border-slate-800/70 p-3">
                <div className="text-[11px] text-slate-400 mb-2">{labels.shortTpSl}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500">{labels.tpTrigger}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={shortTpTrigger}
                        onChange={(e) => setShortTpTrigger(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          const step = stepForPrice(parseNum(shortTpTrigger) || lastPrice);
                          setShortTpTrigger((v) => wheelAdjust(v, e.deltaY, step));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500">{labels.tpRatio}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={shortTpRatio}
                        onChange={(e) => setShortTpRatio(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          setShortTpRatio((v) => wheelAdjust(v, e.deltaY, 1));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{labels.percent}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500">{labels.slTrigger}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={shortSlTrigger}
                        onChange={(e) => setShortSlTrigger(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          const step = stepForPrice(parseNum(shortSlTrigger) || lastPrice);
                          setShortSlTrigger((v) => wheelAdjust(v, e.deltaY, step));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500">{labels.slRatio}</div>
                    <div className="mt-1 flex items-center gap-2 rounded bg-slate-900/40 border border-slate-800 px-2 py-2">
                      <input
                        value={shortSlRatio}
                        onChange={(e) => setShortSlRatio(e.target.value)}
                        onWheel={(e) => {
                          e.preventDefault();
                          setShortSlRatio((v) => wheelAdjust(v, e.deltaY, 1));
                        }}
                        placeholder={labels.enter}
                        className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                        inputMode="decimal"
                      />
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">{labels.percent}</span>
                    </div>
                  </div>
                </div>

                {tpSlAdvancedOpen ? (
                  <div className="mt-3">
                    <div className="text-[11px] text-slate-400 mb-2">{labels.partialTp}</div>
                    <div className="space-y-2">
                      {shortTpTargets.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.closePct}
                              onChange={(e) =>
                                setShortTpTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, closePct: e.target.value } : r)))
                              }
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">%</span>
                          </div>
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.price}
                              onChange={(e) =>
                                setShortTpTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, price: e.target.value } : r)))
                              }
                              onWheel={(e) => {
                                e.preventDefault();
                                const step = stepForPrice(parseNum(row.price) || lastPrice);
                                setShortTpTargets((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, price: wheelAdjust(r.price, e.deltaY, step) } : r)),
                                );
                              }}
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShortTpTargets((prev) => prev.filter((r) => r.id !== row.id))}
                            className="px-2 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                            disabled={shortTpTargets.length <= 1}
                            title={labels.remove}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShortTpTargets((prev) => [...prev, { id: uid(), closePct: "25", price: "" }])}
                        className="px-3 py-2 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 text-[11px]"
                      >
                        {labels.addTarget}
                      </button>
                    </div>

                    <div className="mt-4 text-[11px] text-slate-400 mb-2">{labels.partialSl}</div>
                    <div className="space-y-2">
                      {shortSlTargets.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.closePct}
                              onChange={(e) =>
                                setShortSlTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, closePct: e.target.value } : r)))
                              }
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">%</span>
                          </div>
                          <div className="rounded bg-slate-900/40 border border-slate-800 px-2 py-2 flex items-center gap-2">
                            <input
                              value={row.price}
                              onChange={(e) =>
                                setShortSlTargets((prev) => prev.map((r) => (r.id === row.id ? { ...r, price: e.target.value } : r)))
                              }
                              onWheel={(e) => {
                                e.preventDefault();
                                const step = stepForPrice(parseNum(row.price) || lastPrice);
                                setShortSlTargets((prev) =>
                                  prev.map((r) => (r.id === row.id ? { ...r, price: wheelAdjust(r.price, e.deltaY, step) } : r)),
                                );
                              }}
                              placeholder={labels.enter}
                              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-slate-600"
                              inputMode="decimal"
                            />
                            <span className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">USDT</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShortSlTargets((prev) => prev.filter((r) => r.id !== row.id))}
                            className="px-2 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                            disabled={shortSlTargets.length <= 1}
                            title={labels.remove}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShortSlTargets((prev) => [...prev, { id: uid(), closePct: "100", price: "" }])}
                        className="px-3 py-2 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 text-[11px]"
                      >
                        {labels.addTarget}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!demoMode || botsBusy}
              onClick={() => doDemoOpen("long")}
              className={`py-3 rounded font-semibold ${demoMode ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-emerald-600/40 text-white/70 cursor-not-allowed"}`}
              title={demoMode ? undefined : labels.disabledTitle}
            >
              {demoMode ? (botsBusy ? "..." : labels.demoOpenLong) : labels.openLong}
            </button>
            <button
              type="button"
              disabled={!demoMode || botsBusy}
              onClick={() => doDemoOpen("short")}
              className={`py-3 rounded font-semibold ${demoMode ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-rose-600/40 text-white/70 cursor-not-allowed"}`}
              title={demoMode ? undefined : labels.disabledTitle}
            >
              {demoMode ? (botsBusy ? "..." : labels.demoOpenShort) : labels.openShort}
            </button>
          </div>

          {demoMode ? (
            <button
              type="button"
              onClick={doDemoClose}
              disabled={botsBusy}
              className={`mt-2 w-full py-2 rounded text-sm ${botsBusy ? "bg-slate-800/60 text-slate-400 cursor-not-allowed" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
            >
              {botsBusy ? "..." : labels.demoClose}
            </button>
          ) : null}

          {demoMode && botsError ? (
            <div className="mt-2 text-[11px] text-rose-300">
              {botsError}
            </div>
          ) : null}

          <p className="mt-3 text-[11px] text-slate-500">{labels.note}</p>
        </div>
      </>
    );
  };

  return (
    <aside className="h-full w-full bg-[#0f1320] text-slate-200 border-l border-slate-800/60 flex flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="p-3 border-b border-slate-800/60 shrink-0">
          <TabsList className="bg-slate-900/40">
            <TabsTrigger value="trade" className="data-[state=active]:bg-slate-800">{labels.trade}</TabsTrigger>
            <TabsTrigger value="bots" className="data-[state=active]:bg-slate-800">{labels.bots}</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <TabsContent value="trade" className="mt-0">
            {renderOrderForm({ demoMode: false })}
          </TabsContent>

          <TabsContent value="bots" className="mt-0">
            {renderOrderForm({ demoMode: true })}
          </TabsContent>

          <div className="mt-4 rounded bg-slate-900/30 border border-slate-800 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">{labels.account}</div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[11px] text-slate-500">{labels.balance}</div>
                <div className="font-mono text-white">
                  {(() => {
                    const snap = getAccountSnapshot(activeTab === "bots");
                    return snap.hasAccount ? `${formatNumber(snap.balance, 2)} USDT` : "—";
                  })()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">{labels.margin}</div>
                <div className="font-mono text-white">
                  {(() => {
                    const snap = getAccountSnapshot(activeTab === "bots");
                    return snap.hasAccount ? `${formatNumber(snap.marginUsed, 2)} USDT` : "—";
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </aside>
  );

}

FuturesTradePanel.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
  liveAccount: PropTypes.object,
  demoAccount: PropTypes.object,
  onTradesChanged: PropTypes.func,
  onAccountsChanged: PropTypes.func,
};
