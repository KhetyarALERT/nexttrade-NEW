import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, Copy, AlertTriangle } from 'lucide-react';
import { resolveIpfsUrl } from '@/utils/ipfs';
import { formatNumber, formatPrice } from './MemeList';
import JupiterSwapEmbed from './JupiterSwapEmbed';
import { Badge } from '@/components/ui/badge';
import { useMediaQuery } from '@/components/hooks/useMediaQuery';

// This is the Mobile Bottom Sheet implementation
export default function TradeDrawer({ open, onOpenChange, token }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activeTab, setActiveTab] = useState("trade");
  const [buyAmount, setBuyAmount] = useState(null);

  if (!token) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#0a0a0a] border-t border-gray-800 h-[85vh] flex flex-col">
        {/* Header Section */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-800">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <img 
                src={resolveIpfsUrl(token.image_url)} 
                alt={token.symbol}
                className="w-12 h-12 rounded-xl bg-gray-800 object-cover"
              />
              <div>
                <DrawerTitle className="text-xl font-bold flex items-center gap-2">
                  {token.symbol}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    {token.bonding_curve_status === 'migrated' ? 'RAY' : 'PUMP'}
                  </span>
                </DrawerTitle>
                <DrawerDescription className="text-xs text-gray-400 line-clamp-1">
                  {token.name}
                </DrawerDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-emerald-400">{formatPrice(token.price_usd)}</div>
              <div className={`text-xs ${token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h?.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500">Mkt Cap</div>
              <div className="font-mono text-sm font-medium">{formatNumber(token.market_cap)}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500">Volume</div>
              <div className="font-mono text-sm font-medium">{formatNumber(token.volume_5m)}</div>
            </div>
            <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500">TXs (5m)</div>
              <div className="font-mono text-sm font-medium text-emerald-400">{token.tx_count || 0}</div>
            </div>
          </div>
        </div>

        {/* Tabs & Content */}
        <div className="flex-1 overflow-y-auto bg-[#0f172a]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <div className="px-4 pt-2">
              <TabsList className="w-full grid grid-cols-2 bg-gray-900">
                <TabsTrigger value="trade">Trade</TabsTrigger>
                <TabsTrigger value="chart">Chart</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="trade" className="flex-1 p-4 pt-2">
              {/* Quick Actions */}
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-500" /> Quick Amount
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0.1, 0.5, 1.0, 2.0].map((amt) => (
                    <Button 
                      key={amt} 
                      variant="outline" 
                      size="sm"
                      className={`text-xs h-8 border-gray-700 hover:border-emerald-500 ${buyAmount === amt ? 'bg-emerald-500/20 border-emerald-500' : ''}`}
                      onClick={() => setBuyAmount(amt)}
                    >
                      {amt}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Swap Embed */}
              <div className="h-[450px] w-full rounded-xl overflow-hidden border border-gray-800">
                <JupiterSwapEmbed 
                  open={true} 
                  outputMint={token.mint} 
                  initialAmount={buyAmount}
                />
              </div>
            </TabsContent>

            <TabsContent value="chart" className="flex-1 h-full p-0">
              <iframe
                src={`https://birdeye.so/tv-widget/${token.mint}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=Europe%2FBerlin&chartLeftToolbar=show&theme=dark`}
                className="w-full h-full border-0 bg-[#0f172a]"
                title="Chart"
              />
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Icon helper
function Zap({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  );
}