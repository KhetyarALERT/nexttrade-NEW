import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function TPSLDialog({ 
  open, 
  onOpenChange, 
  position, 
  currentPrice = 0,
  onSuccess 
}) {
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPercent, setTpPercent] = useState("");
  const [slPercent, setSlPercent] = useState("");
  const [saving, setSaving] = useState(false);

  // Initialize from position data
  useEffect(() => {
    if (position) {
      if (position.take_profit) {
        setTpEnabled(true);
        setTpPrice(position.take_profit.toString());
      } else {
        setTpEnabled(false);
        setTpPrice("");
      }
      if (position.stop_loss) {
        setSlEnabled(true);
        setSlPrice(position.stop_loss.toString());
      } else {
        setSlEnabled(false);
        setSlPrice("");
      }
    }
  }, [position]);

  // Calculate percent when price changes
  useEffect(() => {
    if (tpPrice && position?.entry_price) {
      const pct = ((parseFloat(tpPrice) - position.entry_price) / position.entry_price) * 100;
      setTpPercent(pct.toFixed(2));
    }
  }, [tpPrice, position?.entry_price]);

  useEffect(() => {
    if (slPrice && position?.entry_price) {
      const pct = ((parseFloat(slPrice) - position.entry_price) / position.entry_price) * 100;
      setSlPercent(pct.toFixed(2));
    }
  }, [slPrice, position?.entry_price]);

  // Calculate price from percent
  const handleTpPercentChange = (val) => {
    setTpPercent(val);
    if (val && position?.entry_price) {
      const price = position.entry_price * (1 + parseFloat(val) / 100);
      setTpPrice(price.toFixed(position.entry_price < 1 ? 6 : 2));
    }
  };

  const handleSlPercentChange = (val) => {
    setSlPercent(val);
    if (val && position?.entry_price) {
      const price = position.entry_price * (1 + parseFloat(val) / 100);
      setSlPrice(price.toFixed(position.entry_price < 1 ? 6 : 2));
    }
  };

  const calculateEstPnL = (targetPrice, _isTP) => {
    if (!targetPrice || !position) return 0;
    const price = parseFloat(targetPrice);
    if (position.side === 'LONG') {
      return (price - position.entry_price) * position.quantity;
    } else {
      return (position.entry_price - price) * position.quantity;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await base44.functions.invoke('tradingAccount', {
        action: 'updateTrade',
        tradeId: position.id,
        takeProfit: tpEnabled && tpPrice ? parseFloat(tpPrice) : null,
        stopLoss: slEnabled && slPrice ? parseFloat(slPrice) : null
      });

      if (result.data?.success) {
        toast.success("TP/SL updated successfully");
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.data?.error || "Failed to update TP/SL");
      }
    } catch {
      toast.error("Failed to update TP/SL");
    } finally {
      setSaving(false);
    }
  };

  if (!position) return null;

  const tpPnL = calculateEstPnL(tpPrice, true);
  const slPnL = calculateEstPnL(slPrice, false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-background text-foreground border-border">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            Position TP/SL
            <Info className="w-4 h-4 text-muted-foreground" />
          </DialogTitle>
        </DialogHeader>

        {/* Position Info */}
        <div className="p-4 bg-card border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-bold text-foreground">{position.symbol}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${position.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {position.side} {position.leverage}x
            </span>
            <span className="text-xs text-muted-foreground">Position Voucher</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground mb-1">Entry Price</p>
              <p className="text-foreground font-mono font-medium">{position.entry_price?.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Last Price</p>
              <p className="text-foreground font-mono font-medium">{currentPrice?.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Est. Liq. Price</p>
              <p className="text-amber-400 font-mono font-medium">{position.liquidation_price?.toFixed(4) || '--'}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Take Profit Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="tp-enabled" 
                  checked={tpEnabled} 
                  onCheckedChange={setTpEnabled}
                  className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <Label htmlFor="tp-enabled" className="text-sm font-medium cursor-pointer">Take Profit</Label>
              </div>
              <span className="text-xs text-muted-foreground">Last ▼</span>
            </div>
            
            {tpEnabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      value={tpPrice}
                      onChange={(e) => setTpPrice(e.target.value)}
                      placeholder="TP Trigger"
                      className="h-10 pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USDT</span>
                  </div>
                  <div className="relative flex items-center">
                    <Link2 className="absolute left-[-12px] w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={tpPercent}
                      onChange={(e) => handleTpPercentChange(e.target.value)}
                      placeholder="TP Ratio"
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  When the <span className="text-foreground">Last Price</span> reaches {tpPrice || '--'}, it will trigger <span className="text-emerald-400">TP Market Order</span> and the estimated PnL will be <span className={tpPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>{tpPnL >= 0 ? '+' : ''}{tpPnL.toFixed(2)} USDT</span>
                </p>
              </>
            )}
          </div>

          {/* Stop Loss Section */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="sl-enabled" 
                  checked={slEnabled} 
                  onCheckedChange={setSlEnabled}
                  className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                />
                <Label htmlFor="sl-enabled" className="text-sm font-medium cursor-pointer">Stop Loss</Label>
              </div>
              <span className="text-xs text-muted-foreground">Last ▼</span>
            </div>
            
            {slEnabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      value={slPrice}
                      onChange={(e) => setSlPrice(e.target.value)}
                      placeholder="SL Trigger"
                      className="h-10 pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USDT</span>
                  </div>
                  <div className="relative flex items-center">
                    <Link2 className="absolute left-[-12px] w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={slPercent}
                      onChange={(e) => handleSlPercentChange(e.target.value)}
                      placeholder="SL Ratio"
                      className="h-10 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  When the <span className="text-foreground">Last Price</span> reaches {slPrice || '--'}, it will trigger <span className="text-red-400">SL Market Order</span> and the estimated PnL will be <span className={slPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>{slPnL >= 0 ? '+' : ''}{slPnL.toFixed(2)} USDT</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1 h-10"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10"
          >
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

TPSLDialog.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  position: PropTypes.object,
  currentPrice: PropTypes.number,
  onSuccess: PropTypes.func
};