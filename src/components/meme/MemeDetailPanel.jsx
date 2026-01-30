import React, { useState, useEffect } from 'react';
import { formatNumber, formatPrice } from './MemeList';
import { resolveIpfsUrl } from '@/components/utils/ipfs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, ShieldCheck, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import JupiterSwapEmbed from './JupiterSwapEmbed';

export default function MemeDetailPanel({ token, onClose }) {
  const [safety, setSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [buyAmount, setBuyAmount] = useState(null); // Triggers swap input

  useEffect(() => {
    if (!token) return;
    
    // Fetch safety info
    const getSafety = async () => {
      setLoadingSafety(true);
      try {
        // In a real app, this calls the backend function. 
        // For now simulating or calling if configured
        const res = await base44.functions.invoke('tokenSafety', { mint: token.mint });
        if (res.data) setSafety(res.data);
      } catch (e) {
        console.error("Safety check failed", e);
      } finally {
        setLoadingSafety(false);
      }
    };
    
    getSafety();
    setBuyAmount(null);
  }, [token?.mint]);

  if (!token) return (
    <div className="h-full flex items-center justify-center text-gray-500 border-l border-gray-800 bg-[#0f172a]/50">
      <div className="text-center">
        <div className="mb-2">Select a token to view details</div>
        <div className="text-xs">Click on any row in the list</div>
      </div>
    </div>
  );

  const riskLevel = safety?.riskLevel || 'unknown';
  const riskColor = riskLevel === 'good' ? 'text-emerald-500' : riskLevel === 'high' ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="h-full flex flex-col border-l border-gray-800 bg-[#0f172a] overflow-hidden">
      {/* 1. Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <img 
              src={resolveIpfsUrl(token.image_url)} 
              alt={token.symbol}
              className="w-14 h-14 rounded-xl bg-gray-800 object-cover"
            />
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {token.symbol}
                <Badge variant="outline" className="text-[10px] h-5">{token.bonding_curve_status === 'migrated' ? 'RAY' : 'PUMP'}</Badge>
              </h2>
              <div className="text-sm text-gray-400">{token.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-emerald-400">{formatPrice(token.price_usd)}</div>
            <div className={`text-sm ${token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h?.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => navigator.clipboard.writeText(token.mint)}>
            <Copy className="w-3 h-3" /> {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
            <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3 h-3" /> Solscan
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
            <a href={`https://photon-sol.tinyastro.io/en/lp/${token.mint}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3 h-3" /> Photon
            </a>
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* 2. Safety Box */}
          <div className={`rounded-xl border p-3 ${riskLevel === 'good' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium">
                {riskLevel === 'good' ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                <span className={riskColor}>RugCheck: {loadingSafety ? 'Scanning...' : (safety?.score || 'N/A')}</span>
              </div>
              <span className="text-xs text-gray-500">{safety?.rugged ? 'RUGGED' : riskLevel.toUpperCase()}</span>
            </div>
            {!loadingSafety && safety?.flags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {safety.flags.slice(0, 3).map((flag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300 border border-gray-700">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 3. Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">Market Cap</div>
              <div className="font-mono font-medium">{formatNumber(token.market_cap || 0)}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">Liquidity</div>
              <div className="font-mono font-medium">{formatNumber(token.liquidity || 0)}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">5m Volume</div>
              <div className="font-mono font-medium">{formatNumber(token.volume_5m || 0)}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">TXs (5m)</div>
              <div className="font-mono font-medium text-xs flex gap-2">
                <span className="text-emerald-400">{token.buys_5m || 0} Buys</span>
                <span className="text-rose-400">{token.sells_5m || 0} Sells</span>
              </div>
            </div>
          </div>

          {/* 4. Action Box (Quick Buy) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Quick Actions</h3>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] text-emerald-500 font-medium">FAST MODE</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[0.1, 0.5, 1.0].map((amt) => (
                <Button 
                  key={amt} 
                  variant="outline" 
                  className={`h-10 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500 ${buyAmount === amt ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : ''}`}
                  onClick={() => setBuyAmount(amt)}
                >
                  {amt} SOL
                </Button>
              ))}
            </div>

            {/* Jupiter Embed - Always rendered but updated via props */}
            <div className="min-h-[400px]">
               <JupiterSwapEmbed 
                 open={true} 
                 outputMint={token.mint} 
                 initialAmount={buyAmount} // We'll add this prop to embed
               />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}