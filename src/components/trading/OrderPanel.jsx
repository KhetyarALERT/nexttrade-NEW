import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Wallet, Loader2, RefreshCw } from "lucide-react";

export default function OrderPanel({ 
  symbol = "BTC-USDT", 
  currentPrice = 0, 
  balance = 0, 
  tradingAccountId,
  onOrderSuccess 
}) {
  const [orderSide, setOrderSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState("usdt");
  const [leverage, setLeverage] = useState([10]);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseAsset = symbol.split('-')[0];

  useEffect(() => {
    if (currentPrice > 0 && orderType === 'limit' && !price) {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType, price]);

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

    // Calculate quantity based on amount type
    let quantity;
    const effectivePrice = orderType === 'market' ? currentPrice : parseFloat(price);
    
    if (amountType === 'usdt') {
      quantity = amountValue / effectivePrice;
    } else {
      quantity = amountValue;
    }

    const margin = (quantity * effectivePrice) / leverage[0];
    if (margin > balance) {
      toast.error(`Insufficient balance. Need $${margin.toFixed(2)} margin, have $${balance.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'openTrade',
        tradingAccountId: tradingAccountId,
        symbol: symbol,
        side: orderSide === 'buy' ? 'LONG' : 'SHORT',
        quantity: quantity,
        entryPrice: effectivePrice,
        leverage: leverage[0],
        orderType: orderType.toUpperCase(),
        limitPrice: orderType === 'limit' ? parseFloat(price) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null
      });

      if (result.data?.success) {
        const trade = result.data.data;
        toast.success(
          `${orderSide === 'buy' ? 'Long' : 'Short'} ${symbol} opened at $${trade.entry_price?.toFixed(2) || effectivePrice.toFixed(2)}`,
          { description: `Margin: $${trade.margin?.toFixed(2) || margin.toFixed(2)} | Leverage: ${leverage[0]}x` }
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
  const effectivePrice = orderType === 'market' ? currentPrice : (parseFloat(price) || currentPrice);
  const amountValue = parseFloat(amount) || 0;
  
  let cryptoAmount, usdtAmount;
  if (amountType === 'usdt') {
    usdtAmount = amountValue;
    cryptoAmount = effectivePrice > 0 ? amountValue / effectivePrice : 0;
  } else {
    cryptoAmount = amountValue;
    usdtAmount = amountValue * effectivePrice;
  }

  const marginRequired = usdtAmount / leverage[0];
  const maxUSDT = balance * leverage[0];
  const maxCrypto = effectivePrice > 0 ? maxUSDT / effectivePrice : 0;

  return (
    <Card className="bg-[#1E222D] border-0 rounded-none h-full">
      <CardHeader className="border-b border-[#2B2B43] pb-3 px-4">
        <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
          Place Order
          <span className="text-xs font-normal text-gray-400">{symbol}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs value={orderSide} onValueChange={setOrderSide} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-[#131722] p-1 h-10">
            <TabsTrigger 
              value="buy" 
              className="data-[state=active]:bg-[#26A69A] data-[state=active]:text-white text-gray-400 text-sm font-medium"
            >
              Buy / Long
            </TabsTrigger>
            <TabsTrigger 
              value="sell" 
              className="data-[state=active]:bg-[#EF5350] data-[state=active]:text-white text-gray-400 text-sm font-medium"
            >
              Sell / Short
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-400 uppercase">Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="h-9 text-sm bg-[#131722] border-[#2B2B43] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1E222D] border-[#2B2B43]">
                <SelectItem value="market" className="text-white">Market</SelectItem>
                <SelectItem value="limit" className="text-white">Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-400 uppercase">Leverage</Label>
              <span className="text-xs font-bold text-white bg-[#2962FF] px-2 py-1 rounded">{leverage[0]}x</span>
            </div>
            <Slider
              value={leverage}
              onValueChange={setLeverage}
              min={1}
              max={125}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>1x</span>
              <span>25x</span>
              <span>50x</span>
              <span>75x</span>
              <span>125x</span>
            </div>
          </div>

          {orderType === 'limit' && (
            <div>
              <Label className="text-xs text-gray-400 uppercase">Price (USDT)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currentPrice.toFixed(2)}
                className="h-9 text-sm bg-[#131722] border-[#2B2B43] text-white mt-1"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-gray-400 uppercase">Amount</Label>
              <Select value={amountType} onValueChange={setAmountType}>
                <SelectTrigger className="h-7 w-24 text-xs bg-[#131722] border-[#2B2B43] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1E222D] border-[#2B2B43]">
                  <SelectItem value="usdt" className="text-white">USDT</SelectItem>
                  <SelectItem value="crypto" className="text-white">{baseAsset}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-sm bg-[#131722] border-[#2B2B43] text-white"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Wallet className="w-3 h-3" />
                <span>{balance.toFixed(2)} USDT</span>
              </div>
              <span className="text-xs text-gray-500">
                ≈ {amountType === 'usdt' ? `${cryptoAmount.toFixed(6)} ${baseAsset}` : `${usdtAmount.toFixed(2)} USDT`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map(percent => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                onClick={() => {
                  const val = amountType === 'usdt' 
                    ? (maxUSDT * percent / 100).toFixed(2)
                    : (maxCrypto * percent / 100).toFixed(6);
                  setAmount(val);
                }}
                className="h-7 text-xs bg-[#131722] border-[#2B2B43] text-gray-400 hover:text-white hover:bg-[#2B2B43]"
              >
                {percent}%
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-400 uppercase">Take Profit</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs bg-[#131722] border-[#2B2B43] text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400 uppercase">Stop Loss</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs bg-[#131722] border-[#2B2B43] text-white mt-1"
              />
            </div>
          </div>

          <div className="bg-[#131722] rounded-lg p-3 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Position Size</span>
              <span className="text-white font-mono">{cryptoAmount.toFixed(6)} {baseAsset}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Value</span>
              <span className="text-white font-mono">{usdtAmount.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Margin Required</span>
              <span className="text-white font-mono">{marginRequired.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Position</span>
              <span className="text-gray-300 font-mono">{maxCrypto.toFixed(4)} {baseAsset}</span>
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={isSubmitting || !amount || currentPrice <= 0 || !tradingAccountId}
            className={`w-full h-11 font-bold text-white text-sm ${
              orderSide === 'buy' 
                ? 'bg-[#26A69A] hover:bg-[#26A69A]/90' 
                : 'bg-[#EF5350] hover:bg-[#EF5350]/90'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : currentPrice <= 0 ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading Price...</>
            ) : !tradingAccountId ? (
              "Loading Account..."
            ) : (
              `${orderSide === 'buy' ? 'Buy/Long' : 'Sell/Short'} ${baseAsset}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

OrderPanel.propTypes = {
  symbol: PropTypes.string,
  currentPrice: PropTypes.number,
  balance: PropTypes.number,
  tradingAccountId: PropTypes.string,
  onOrderSuccess: PropTypes.func
};