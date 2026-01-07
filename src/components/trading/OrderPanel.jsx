import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Wallet, Loader2, Info } from "lucide-react";

export default function OrderPanel({ 
  symbol = "BTC-USDT", 
  currentPrice = 0, 
  balance = 0, 
  tradingAccountId,
  onOrderSuccess,
  language: _language = "en",
}) {
  const [orderSide, setOrderSide] = useState("buy");
  const [orderType, setOrderType] = useState("market"); // market, limit, stop, trailing, oco
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState(""); // For Stop / OCO
  const [stopLimitPrice, setStopLimitPrice] = useState(""); // For OCO Stop Limit
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState("usdt");
  const [leverage, setLeverage] = useState([10]);
  
  // Advanced fields
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [trailingPercent, setTrailingPercent] = useState("");
  const [trailingActivation, setTrailingActivation] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Backend uses percentage values (e.g. 0.05 = 0.05%). Keep UI estimate aligned.
  const ESTIMATED_TAKER_FEE_RATE = 0.0005; // 0.05%

  const baseAsset = symbol.split('-')[0];

  // Reset fields on symbol change
  useEffect(() => {
    setPrice("");
    setAmount("");
    setStopPrice("");
    setStopLimitPrice("");
    setTakeProfit("");
    setStopLoss("");
    setTrailingPercent("");
    setTrailingActivation("");
  }, [symbol]);

  // Set initial price for limit orders
  useEffect(() => {
    if (currentPrice > 0 && (orderType === 'limit' || orderType === 'oco') && !price) {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType]);

  const pricePrecision = currentPrice < 1 ? 6 : 2;
  const applySL = (pct) => {
    if (!currentPrice) return;
    const cp = currentPrice;
    const isLong = orderSide === 'buy';
    const sl = isLong ? cp * (1 - pct/100) : cp * (1 + pct/100);
    setStopLoss(sl.toFixed(pricePrecision));
  };
  const applyTP = (pct) => {
    if (!currentPrice) return;
    const cp = currentPrice;
    const isLong = orderSide === 'buy';
    const tp = isLong ? cp * (1 + pct/100) : cp * (1 - pct/100);
    setTakeProfit(tp.toFixed(pricePrecision));
  };

  const handlePlaceOrder = async () => {
    const amountValue = parseFloat(amount);
    if (!amount || amountValue <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (currentPrice <= 0) {
      toast.error("Waiting for price data...");
      return;
    }

    if (!tradingAccountId) {
      toast.error("No trading account found. Please refresh the page.");
      return;
    }

    // Validate inputs based on order type
    if (orderType === 'limit' && !price) {
      toast.error("Please enter limit price");
      return;
    }
    if (orderType === 'stop' && !stopPrice) {
      toast.error("Please enter stop price");
      return;
    }
    if (orderType === 'trailing' && !trailingPercent) {
      toast.error("Please enter trailing percent");
      return;
    }
    if (orderType === 'oco') {
      if (!price) { toast.error("Please enter limit price"); return; }
      if (!stopPrice) { toast.error("Please enter stop price"); return; }
      if (!stopLimitPrice) { toast.error("Please enter stop limit price"); return; }
    }

    // Effective price used for sizing and validation
    const effectivePrice = (orderType === 'market' || orderType === 'trailing')
      ? currentPrice
      : parseFloat(price || stopPrice);

    // Calculate quantity.
    // - USDT mode: treat amount as *margin/cost* (collateral). Notional = cost * leverage.
    // - Crypto mode: treat amount as quantity.
    let quantity;
    let notional;
    let marginRequired;
    if (amountType === 'usdt') {
      marginRequired = amountValue;
      notional = marginRequired * leverage[0];
      quantity = notional / effectivePrice;
    } else {
      quantity = amountValue;
      notional = quantity * effectivePrice;
      marginRequired = notional / leverage[0];
    }

    const estFee = notional * ESTIMATED_TAKER_FEE_RATE;
    const totalRequired = marginRequired + estFee;
    if (totalRequired > balance) {
      toast.error(
        `Insufficient balance. Need $${totalRequired.toFixed(2)} (margin $${marginRequired.toFixed(2)} + fee $${estFee.toFixed(2)}), have $${balance.toFixed(2)}`
      );
      return;
    }

    setIsSubmitting(true);
    
    try {
      const payload = {
        action: 'openTrade',
        tradingAccountId: tradingAccountId,
        symbol: symbol,
        side: orderSide === 'buy' ? 'LONG' : 'SHORT',
        quantity: quantity,
        entryPrice: effectivePrice,
        leverage: leverage[0],
        orderType: orderType.toUpperCase(),
        limitPrice: (orderType === 'limit' || orderType === 'oco') ? parseFloat(price) : null,
        stopPrice: (orderType === 'stop') ? parseFloat(stopPrice) : null,
        oco_stop_price: orderType === 'oco' ? parseFloat(stopPrice) : null,
        oco_limit_price: orderType === 'oco' ? parseFloat(stopLimitPrice) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        trailingStopPercent: trailingPercent ? parseFloat(trailingPercent) : null,
        trailingStopActivation: trailingActivation ? parseFloat(trailingActivation) : null,
        isOCO: orderType === 'oco'
      };

      const result = await base44.functions.invoke('tradingAccount', payload);

      if (result.data?.success) {
        const trade = result.data.data;
        toast.success(
          `${orderSide === 'buy' ? 'Long' : 'Short'} ${symbol} order placed`,
          { description: `Type: ${orderType.toUpperCase()} | Margin: $${trade.margin?.toFixed(2) || marginRequired.toFixed(2)} | Notional: $${notional.toFixed(2)}` }
        );
        setAmount("");
        if (onOrderSuccess) onOrderSuccess();
      } else {
        toast.error(result.data?.error || "Failed to place order");
      }
    } catch (error) {
      console.error('Order error:', error);
      toast.error(error.message || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate display values
  const effectivePrice = (orderType === 'market' || orderType === 'trailing') 
    ? currentPrice 
    : parseFloat(String(price || stopPrice || currentPrice));
    
  const amountValue = parseFloat(amount) || 0;
  
  let quantityPreview = 0;
  let notionalPreview = 0;
  let marginRequired = 0;
  if (amountType === 'usdt') {
    marginRequired = amountValue;
    notionalPreview = marginRequired * leverage[0];
    quantityPreview = effectivePrice > 0 ? notionalPreview / effectivePrice : 0;
  } else {
    quantityPreview = amountValue;
    notionalPreview = quantityPreview * effectivePrice;
    marginRequired = leverage[0] > 0 ? notionalPreview / leverage[0] : 0;
  }
  const estFeePreview = notionalPreview * ESTIMATED_TAKER_FEE_RATE;
  const totalRequiredPreview = marginRequired + estFeePreview;

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] text-slate-300">
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Place Order</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
            <Wallet className="h-3 w-3" />
            <span>${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <Tabs value={orderSide} onValueChange={setOrderSide} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 p-1 h-11 rounded-xl">
            <TabsTrigger 
              value="buy" 
              className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-slate-400 text-xs font-bold rounded-lg transition-all"
            >
              BUY / LONG
            </TabsTrigger>
            <TabsTrigger 
              value="sell" 
              className="data-[state=active]:bg-rose-500 data-[state=active]:text-white text-slate-400 text-xs font-bold rounded-lg transition-all"
            >
              SELL / SHORT
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="w-[120px] h-8 bg-slate-800/50 border-slate-700 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-slate-700 text-slate-300">
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="stop">Stop</SelectItem>
                <SelectItem value="trailing">Trailing</SelectItem>
                <SelectItem value="oco">OCO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType !== 'market' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  {orderType === 'limit' ? 'Limit Price' : 'Trigger Price'}
                </Label>
                <span className="text-[10px] text-blue-400 cursor-pointer hover:underline" onClick={() => setPrice(currentPrice.toString())}>Last: {currentPrice.toFixed(2)}</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  value={orderType === 'limit' ? price : stopPrice}
                  onChange={(e) => orderType === 'limit' ? setPrice(e.target.value) : setStopPrice(e.target.value)}
                  className="h-10 bg-slate-900/50 border-slate-700 text-white text-sm rounded-xl focus:ring-blue-500/50 pr-12"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">USDT</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                {amountType === 'usdt' ? 'Cost (Margin)' : 'Size'}
              </Label>
              <div className="flex bg-slate-800/50 rounded-lg p-0.5">
                <button 
                  onClick={() => setAmountType('usdt')}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${amountType === 'usdt' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                >
                  USDT
                </button>
                <button 
                  onClick={() => setAmountType('crypto')}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${amountType === 'crypto' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                >
                  {baseAsset}
                </button>
              </div>
            </div>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 bg-slate-900/50 border-slate-700 text-white text-sm rounded-xl focus:ring-blue-500/50 pr-12"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 uppercase">{amountType === 'usdt' ? 'USDT' : baseAsset}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Leverage</Label>
              <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">{leverage[0]}x</span>
            </div>
            <Slider
              value={leverage}
              onValueChange={setLeverage}
              max={125}
              min={1}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-[9px] text-slate-600 font-bold">
              <span>1x</span>
              <span>25x</span>
              <span>50x</span>
              <span>75x</span>
              <span>100x</span>
              <span>125x</span>
            </div>
          </div>
        </div>

        {/* Quick SL / TP presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Quick SL</Label>
            <div className="flex gap-1">
              {[0.5,1,1.5,2].map(p => (
                <Button key={p} size="sm" className="h-7 px-2 text-[10px] bg-rose-600/80 hover:bg-rose-600 text-white" onClick={() => applySL(p)}>{p}%</Button>
              ))}
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] border-slate-700" onClick={() => {
                const v = parseFloat(prompt('Enter SL %')); if (!isNaN(v) && v>0) applySL(v);
              }}>Custom</Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Quick TP</Label>
            <div className="flex gap-1">
              {[1,2,4].map(p => (
                <Button key={p} size="sm" className="h-7 px-2 text-[10px] bg-emerald-600/80 hover:bg-emerald-600 text-white" onClick={() => applyTP(p)}>{p}%</Button>
              ))}
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] border-slate-700" onClick={() => {
                const v = parseFloat(prompt('Enter TP %')); if (!isNaN(v) && v>0) applyTP(v);
              }}>Custom</Button>
            </div>
          </div>
          {(takeProfit || stopLoss) && (
            <div className="text-[10px] text-slate-400">
              {stopLoss && <span>SL: {Number(stopLoss).toFixed(pricePrecision)} </span>}
              {takeProfit && <span className="ml-2">TP: {Number(takeProfit).toFixed(pricePrecision)}</span>}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800/50 space-y-3">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Position Value</span>
            <span className="text-slate-300 font-bold font-mono">${notionalPreview.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Margin Required</span>
            <span className="text-white font-bold font-mono">${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Est. Fee</span>
            <span className="text-slate-300 font-bold font-mono">${estFeePreview.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Total Required</span>
            <span className="text-white font-bold font-mono">${totalRequiredPreview.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Max Size</span>
            <span className="text-slate-300 font-bold font-mono">{(balance * leverage[0] / (effectivePrice || 1)).toFixed(4)} {baseAsset}</span>
          </div>
        </div>

        <Button 
          onClick={handlePlaceOrder}
          disabled={isSubmitting || !amount}
          className={`w-full h-12 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] ${
            orderSide === 'buy' 
              ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' 
              : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `${orderSide === 'buy' ? 'OPEN LONG' : 'OPEN SHORT'}`
          )}
        </Button>

        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex gap-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Trading futures involves significant risk. Ensure you have adequate margin to avoid liquidation.
          </p>
        </div>
      </div>
    </div>
  );
}

OrderPanel.propTypes = {
  symbol: PropTypes.string,
  currentPrice: PropTypes.number,
  balance: PropTypes.number,
  tradingAccountId: PropTypes.string,
  onOrderSuccess: PropTypes.func
};