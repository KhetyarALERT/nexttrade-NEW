import { useState, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getOkxBaseAsset } from "@/lib/market/okxSymbols";

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

export default function MobileFuturesTradePanel({
  symbol,
  lastPrice = 0,
  language = "en",
  liveAccount = null,
  demoAccount = null,
  onTradesChanged,
  onAccountsChanged,
}) {
  const [mode, setMode] = useState("cross");
  const [orderType, setOrderType] = useState("market");
  const [leverage, setLeverage] = useState(10);
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);

  const baseAsset = useMemo(() => getOkxBaseAsset(symbol), [symbol]);

  const t = useMemo(() => {
    const isAr = language === "ar";
    return {
      cross: isAr ? "مشترك" : "Cross",
      isolated: isAr ? "معزول" : "Isolated",
      market: isAr ? "سوق" : "Market",
      limit: isAr ? "محدد" : "Limit",
      leverage: isAr ? "الرافعة" : "Leverage",
      margin: isAr ? "الهامش" : "Margin",
      available: isAr ? "المتاح" : "Available",
      long: isAr ? "شراء" : "Long",
      short: isAr ? "بيع" : "Short",
      enterAmount: isAr ? "أدخل المبلغ" : "Enter amount",
      usdt: "USDT",
    };
  }, [language]);

  const balance = useMemo(() => {
    const acc = liveAccount || demoAccount;
    if (!acc) return 0;
    return Number(acc.demo_balance ?? acc.balance ?? acc.equity ?? 0);
  }, [liveAccount, demoAccount]);

  const costNum = parseNum(cost);
  const positionValue = Number.isFinite(costNum) ? costNum * leverage : 0;
  const quantity = lastPrice > 0 && positionValue > 0 ? positionValue / lastPrice : 0;

  const submitTrade = async (side) => {
    if (!Number.isFinite(costNum) || costNum <= 0) {
      toast.error(language === "ar" ? "أدخل مبلغ صالح" : "Enter valid amount");
      return;
    }

    const tradingAccountId = liveAccount?.id || demoAccount?.id;
    if (!tradingAccountId) {
      toast.error(language === "ar" ? "لا يوجد حساب" : "No account");
      return;
    }

    setBusy(true);
    try {
      const isLive = Boolean(liveAccount?.id);
      
      if (isLive) {
        const okxSide = side === "SHORT" ? "sell" : "buy";
        const res = await base44.functions.invoke("okxTrading", {
          action: "placeOrder",
          accountId: tradingAccountId,
          instId: symbol,
          side: okxSide,
          orderType: orderType === "limit" ? "limit" : "market",
          size: quantity,
          price: orderType === "limit" ? lastPrice : null,
          reduceOnly: false,
          leverage,
        });

        if (!res?.data?.ok) {
          throw new Error(res?.data?.error?.message || "Failed");
        }
      } else {
        const res = await base44.functions.invoke("tradingAccount", {
          action: "openTrade",
          tradingAccountId,
          symbol,
          side,
          quantity,
          leverage,
          entryPrice: lastPrice,
          orderType: orderType === "market" ? "MARKET" : "LIMIT",
        });

        if (!res?.data?.success) {
          throw new Error(res?.data?.error || "Failed");
        }
      }

      toast.success(language === "ar" ? "تم فتح الصفقة" : "Trade opened");
      setCost("");
      await onTradesChanged?.();
      await onAccountsChanged?.();
    } catch (err) {
      toast.error(err?.message || (language === "ar" ? "فشل" : "Failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        {["cross", "isolated"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === m 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t[m]}
          </button>
        ))}
      </div>

      {/* Order Type */}
      <div className="flex gap-2">
        {["market", "limit"].map((ot) => (
          <button
            key={ot}
            onClick={() => setOrderType(ot)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              orderType === ot 
                ? "bg-secondary text-secondary-foreground" 
                : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {t[ot]}
          </button>
        ))}
      </div>

      {/* Balance Display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t.available}</span>
        <span className="font-mono font-medium">{formatNumber(balance, 2)} {t.usdt}</span>
      </div>

      {/* Leverage Slider */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">{t.leverage}</span>
          <span className="text-lg font-bold text-primary">{leverage}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full accent-primary h-2 rounded-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>1×</span>
          <span>25×</span>
          <span>50×</span>
          <span>75×</span>
          <span>100×</span>
        </div>
      </div>

      {/* Margin Input */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <label className="text-sm text-muted-foreground mb-2 block">{t.margin}</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder={t.enterAmount}
            className="flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground"
          />
          <span className="text-sm font-medium text-muted-foreground px-3 py-1.5 bg-muted rounded-lg">{t.usdt}</span>
        </div>
        
        {/* Quick Percentage Buttons */}
        <div className="flex gap-2 mt-3">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setCost(String((balance * pct / 100).toFixed(2)))}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Position Summary */}
      {Number.isFinite(costNum) && costNum > 0 && (
        <div className="bg-muted/30 rounded-xl p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position Value</span>
            <span className="font-mono">${formatNumber(positionValue, 2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size</span>
            <span className="font-mono">{formatNumber(quantity, 6)} {baseAsset}</span>
          </div>
        </div>
      )}

      {/* Trade Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => submitTrade("LONG")}
          disabled={busy}
          className="py-4 rounded-xl font-bold text-base bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
        >
          {busy ? "..." : t.long}
        </button>
        <button
          onClick={() => submitTrade("SHORT")}
          disabled={busy}
          className="py-4 rounded-xl font-bold text-base bg-rose-600 text-white hover:bg-rose-500 active:scale-[0.98] transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
        >
          {busy ? "..." : t.short}
        </button>
      </div>
    </div>
  );
}

MobileFuturesTradePanel.propTypes = {
  symbol: PropTypes.string.isRequired,
  lastPrice: PropTypes.number,
  language: PropTypes.string,
  liveAccount: PropTypes.object,
  demoAccount: PropTypes.object,
  onTradesChanged: PropTypes.func,
  onAccountsChanged: PropTypes.func,
};