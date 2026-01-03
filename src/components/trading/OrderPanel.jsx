import { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function OrderPanel({ symbol = "BTC-USDT", currentPrice = 0, balance = 0 }) {
  const [orderSide, setOrderSide] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [price, setPrice] = useState(currentPrice);
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState([1]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

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

      if (result.data.success) {
        toast.success(`Order placed successfully`);
        setAmount("");
      } else {
        toast.error(result.data.error || "Failed to place order");
      }
    } catch (error) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = orderType === 'market' 
    ? parseFloat(amount || 0) * currentPrice 
    : parseFloat(amount || 0) * parseFloat(price || 0);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="text-sm font-bold">Place Order</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs value={orderSide} onValueChange={setOrderSide} className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
              Buy / Long
            </TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              Sell / Short
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="market">Market</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Leverage</Label>
              <span className="text-xs font-bold">{leverage[0]}x</span>
            </div>
            <Slider
              value={leverage}
              onValueChange={setLeverage}
              min={1}
              max={125}
              step={1}
              className="py-2"
            />
          </div>

          {orderType === 'limit' && (
            <div>
              <Label className="text-xs">Price (USDT)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="h-9 text-sm"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Amount ({symbol.split('-')[0]})</Label>
              <span className="text-xs text-slate-500">Avbl: {balance.toFixed(2)} USDT</span>
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map(percent => (
              <Button
                key={percent}
                variant="outline"
                size="sm"
                onClick={() => setAmount(((balance * percent) / 100 / currentPrice).toFixed(6))}
                className="h-7 text-xs"
              >
                {percent}%
              </Button>
            ))}
          </div>

          <div className="bg-slate-50 rounded p-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Total</span>
              <span className="font-bold">{total.toFixed(2)} USDT</span>
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            className={`w-full h-10 font-bold ${
              orderSide === 'buy' 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isSubmitting ? 'Placing...' : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${symbol.split('-')[0]}`}
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