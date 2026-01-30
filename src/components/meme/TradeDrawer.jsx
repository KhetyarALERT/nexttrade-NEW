import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'; // Verify component exists
import { Sheet, SheetContent } from '@/components/ui/sheet'; // Use Sheet for Desktop, Drawer for Mobile
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, Twitter, Globe, Info } from 'lucide-react';
import JupiterSwapEmbed from '@/components/meme/JupiterSwapEmbed';
import { useMediaQuery } from '@/components/hooks/useMediaQuery';

const TradeDrawer = ({ open, onOpenChange, token }) => {
  const [activeTab, setActiveTab] = useState('swap');
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;

  // Content for the trade modal
  const Content = (
    <div className="h-full flex flex-col bg-[#0f172a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#0f172a]">
        <div className="flex items-center gap-3">
          {token?.image_url && (
            <img src={token.image_url} alt={token.symbol} className="w-8 h-8 rounded-full" />
          )}
          <div>
            <h3 className="font-bold text-lg leading-none">{token?.symbol}</h3>
            <span className="text-xs text-gray-400">{token?.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
           {/* Socials */}
           {token?.twitter && <a href={token.twitter} target="_blank" className="p-2 hover:bg-white/5 rounded-full"><Twitter className="w-4 h-4 text-gray-400" /></a>}
           {token?.website && <a href={token.website} target="_blank" className="p-2 hover:bg-white/5 rounded-full"><Globe className="w-4 h-4 text-gray-400" /></a>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2">
          <TabsList className="w-full bg-gray-900/50 p-1 grid grid-cols-3">
            <TabsTrigger value="swap">Swap</TabsTrigger>
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <TabsContent value="swap" className="mt-0 h-full">
             <div className="h-full min-h-[500px]">
                <JupiterSwapEmbed 
                  open={open && activeTab === 'swap'} 
                  outputMint={token?.mint} 
                />
             </div>
          </TabsContent>

          <TabsContent value="chart" className="mt-0 h-full">
            {activeTab === 'chart' && (
              <div className="w-full h-[500px] rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
                <iframe 
                   src={`https://birdeye.so/tv-widget/${token?.mint}?chain=solana&viewMode=pair&chartLeftToolbar=show&theme=dark`} 
                   className="w-full h-full border-0"
                   title="Chart"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-0 h-full">
            <div className="space-y-4">
               <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                  <div className="text-sm text-gray-400">Market Cap</div>
                  <div className="text-xl font-mono font-bold">${token?.market_cap ? (token.market_cap/1e6).toFixed(2) + 'M' : '-'}</div>
               </div>
               <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                  <div className="text-sm text-gray-400">Mint Address</div>
                  <div className="text-xs font-mono text-gray-300 break-all mt-1 bg-black/30 p-2 rounded select-all">
                    {token?.mint}
                  </div>
               </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[450px] sm:w-[500px] p-0 border-l border-gray-800 bg-[#0f172a]">
          {Content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] bg-[#0f172a] border-t border-gray-800">
        {Content}
      </DrawerContent>
    </Drawer>
  );
};

export default TradeDrawer;