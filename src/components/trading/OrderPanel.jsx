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
import { Wallet, Loader2 } from "lucide-react";

const log = (action, data) => {
  console.log(`[${new Date().toISOString()}] [ORDER] ${action}:`, data);
};

export default function OrderPanel({ symbol = "BTC-USDT", currentPrice = 0, balance = 0 }) {
  const [orderSide, setOrderSide] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [price, setPrice] = useState(currentPrice);
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState([10]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentPrice > 0 && orderType === 'limit') {
      setPrice(currentPrice);
    }
  }, [currentPrice, orderType]);

  const handlePlaceOrder = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    log('ORDER_SUBMIT', { symbol, side: orderSide, type: orderType, amount, price, leverage: leverage[0] });
    setIsSubmitting(true);
    
    try {
      const result = await base44.functions.invoke('bingxRest', {
        action: 'futures.placeOrder',
        params: {
          symbol: symbol,
          side: orderSide.toUpperCase(),
          type: orderType === 'market' ? 'MARKET' : 'LIMIT',
          quantity: parseFloat(amount),
          price: orderType === 'limit' ? parseFloat(price) : undefined,
          leverage: leverage[0]
        }
      });

      if (result.data?.success) {
        log('ORDER_SUCCESS', result.data);
        toast.success(`Order placed successfully`);
        setAmount("");
      } else {
        log('ORDER_FAILED', result.data);
        toast.error(result.data?.error || "Failed to place order");
      }
    } catch (error) {
      log('ORDER_ERROR', { error: error.message });
      toast.error(error.message || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = orderType === 'market' 
    ? parseFloat(amount || 0) * currentPrice 
    : parseFloat(amount || 0) * parseFloat(price || 0);

  return (
    <Card className="bg-[#1E222D] border-[#2B2B43]">
      <CardHeader className="border-b border-[#2B2B43] pb-3 px-4">
        <CardTitle className="text-sm font-bold text-white">Place Order</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs value={orderSide} onValueChange={setOrderSide} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-[#131722] p-1">
            <TabsTrigger 
              value="buy" 
              className="data-[state=active]:bg-[#26A69A] data-[state=active]:text-white text-gray-400"
            >
              Buy / Long
            </TabsTrigger>
            <TabsTrigger 
              value="sell" 
              className="data-[state=active]:bg-[#EF5350] data-[state=active]:text-white text-gray-400"
            >
              Sell / Short
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-400">Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="h-9 text-sm bg-[#131722] border-[#2B2B43] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1E222D] border-[#2B2B43]">
                <SelectItem value="limit" className="text-white">Limit</SelectItem>
                <SelectItem value="market" className="text-white">Market</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-400">Leverage</Label>
              <span className="text-xs font-bold text-white bg-[#2962FF] px-2 py-0.5 rounded">{leverage[0]}x</span>
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
              <span>125x</span>
            </div>
          </div>

          {orderType === 'limit' && (
            <div>
              <Label className="text-xs text-gray-400">Price (USDT)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="h-9 text-sm bg-[#131722] border-[#2B2B43] text-white"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-gray-400">Amount ({symbol.split('-')[0]})</Label>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Wallet className="w-3 h-3" />
                <span>{balance.toFixed(2)} USDT</span>
              </div>
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-sm bg-[#131722] border-[#2B2B43] text-white"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map(percent => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                onClick={() => setAmount(((balance * percent) / 100 / currentPrice).toFixed(6))}
                className="h-7 text-xs bg-[#131722] border-[#2B2B43] text-gray-400 hover:text-white hover:bg-[#2B2B43]"
              >
                {percent}%
              </Button>
            ))}
          </div>

          <div className="bg-[#131722] rounded p-3 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Cost</span>
              <span className="font-bold text-white">{total.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max</span>
              <span className="text-gray-300">{(balance * leverage[0] / currentPrice).toFixed(6)} {symbol.split('-')[0]}</span>
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={isSubmitting || !amount}
            className={`w-full h-11 font-bold text-white ${
              orderSide === 'buy' 
                ? 'bg-[#26A69A] hover:bg-[#26A69A]/90' 
                : 'bg-[#EF5350] hover:bg-[#EF5350]/90'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `${orderSide === 'buy' ? 'Buy/Long' : 'Sell/Short'} ${symbol.split('-')[0]}`
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
  balance: PropTypes.number
};