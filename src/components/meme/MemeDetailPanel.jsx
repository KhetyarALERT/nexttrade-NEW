import React, { useState, useEffect, useRef } from 'react';
import { formatNumber, formatPrice } from './MemeList';
import { resolveIpfsUrl } from '@/components/utils/ipfs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, ShieldCheck, AlertTriangle, XCircle, Zap, Loader2, TrendingUp, TrendingDown, X } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import JupiterSwapEmbed from './JupiterSwapEmbed';
import { requestQueue } from '@/components/utils/requestQueue';

export default function MemeDetailPanel({ token, onClose, onTrade }) {
  const [safety, setSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [amountSol, setAmountSol] = useState(0.1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safety Check with Dedupe + Cache + Debounce
  useEffect(() => {
    if (!token?.mint) return;
    
    const mint = token.mint;
    const cacheKey = `tokenSafety:${mint}`;
    let mounted = true;

    const timer = setTimeout(() => {
      const getSafety = async () => {
        setLoadingSafety(true);
        try {
          const data = await requestQueue.fetch(cacheKey, async () => {
            console.count("tokenSafety call");
            const res = await base44.functions.invoke('tokenSafety', { mint });
            return res.data;
          }, { ttl: 60000 });

          if (mounted && data) setSafety(data);
        } catch (e) {
          console.error("Safety check failed", e);
        } finally {
          if (mounted) setLoadingSafety(false);
        }
      };
      getSafety();
    }, 200);
    
    return () => { 
      mounted = false; 
      clearTimeout(timer);
    };
  }, [token?.mint]);

  // Handle Quick Buy
  const handleQuickBuy = async () => {
    if (!token?.mint || !amountSol) return;
    setIsSubmitting(true);
    try {
      console.log(`Quick Buy: ${amountSol} SOL for ${token.symbol}`);
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return (
    <div className="h-full flex items-center justify-center text-gray-500 bg-[#0f172a] border-l border-gray-800">
      <div className="text-center text-xs">
        <p>Select a token to view details</p>
      </div>
    </div>
  );

  const riskLevel = safety?.riskLevel || 'unknown';
  const riskColor = riskLevel === 'good' ? 'text-emerald-500' : riskLevel === 'high' ? 'text-red-500' : 'text-yellow-500';
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="h-full flex flex-col bg-[#0f172a] border-l border-gray-800 overflow-hidden">
      
      {/* ===== COMPACT HEADER ===== */}
      <div className="bg-[#0a0a0a] border-b border-gray-800 px-3 py-2 flex items-center justify-between shrink-0 h-12">
        <div className="flex items-center gap-2 min-w-0">
          <img 
            src={resolveIpfsUrl(token.image_url)} 
            alt={token.symbol}
            className="w-8 h-8 rounded-lg bg-gray-800 object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              {token.symbol}
              <span className="ml-1 text-xs text-gray-500">
                {token.bonding_curve_status === 'migrated' ? 'RAY' : 'PUMP'}
              </span>
            </h2>
            <p className="text-xs text-gray-500 truncate">{token.name}</p>
          </div>
        </div>
        
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-emerald-400">{formatPrice(token.price_usd)}</div>
          <div className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="ml-2 text-gray-500 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          
          {/* ===== QUICK LINKS ===== */}
          <div className="flex gap-1.5">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-xs border-gray-700 hover:border-emerald-500 hover:text-emerald-400"
              onClick={() => navigator.clipboard.writeText(token.mint)}
            >
              <Copy className="w-2.5 h-2.5 mr-1" /> Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-xs border-gray-700 hover:border-emerald-500 hover:text-emerald-400"
              asChild
            >
              <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-2.5 h-2.5 mr-1" /> Scan
              </a>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-xs border-gray-700 hover:border-emerald-500 hover:text-emerald-400"
              asChild
            >
              <a href={`https://photon-sol.tinyastro.io/en/lp/${token.mint}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-2.5 h-2.5 mr-1" /> Photon
              </a>
            </Button>
          </div>

          {/* ===== SAFETY CHECK (COMPACT) ===== */}
          <div className={`rounded border p-2 text-xs ${riskLevel === 'good' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                {riskLevel === 'good' ? (
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                )}
                <span className={`font-semibold ${riskColor}`}>
                  {loadingSafety ? 'Scanning...' : (safety?.score || 'N/A')}
                </span>
              </div>
              <span className={`text-xs font-bold ${riskColor}`}>
                {safety?.rugged ? 'RUGGED' : riskLevel.toUpperCase()}
              </span>
            </div>
            {!loadingSafety && safety?.flags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {safety.flags.slice(0, 2).map((flag, i) => (
                  <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-black/50 text-gray-400 border border-gray-700">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ===== STATS GRID (COMPACT 2x2) ===== */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
              <div className="text-xs text-gray-600 mb-0.5">Market Cap</div>
              <div className="font-mono text-sm font-bold text-white">{formatNumber(token.market_cap || 0)}</div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
              <div className="text-xs text-gray-600 mb-0.5">Liquidity</div>
              <div className="font-mono text-sm font-bold text-white">{formatNumber(token.liquidity || 0)}</div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
              <div className="text-xs text-gray-600 mb-0.5">5m Volume</div>
              <div className="font-mono text-sm font-bold text-white">{formatNumber(token.volume_5m || 0)}</div>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded p-2">
              <div className="text-xs text-gray-600 mb-0.5">5m Txs</div>
              <div className="flex gap-1 text-xs font-bold">
                <span className="text-emerald-400">{token.buys_5m || 0}B</span>
                <span className="text-red-400">{token.sells_5m || 0}S</span>
              </div>
            </div>
          </div>

          {/* ===== EXTENDED STATS (COMPACT ROWS) ===== */}
          <div className="space-y-1 text-xs border border-gray-800 rounded p-2 bg-gray-900/20">
            <div className="flex justify-between">
              <span className="text-gray-600">Holders:</span>
              <span className="text-white font-semibold">{token.holders || '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Supply:</span>
              <span className="text-white font-semibold">{formatNumber(token.supply || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="text-white font-semibold">
                {token.created_at ? new Date(token.created_at).toLocaleDateString() : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold ${token.bonding_curve_status === 'migrated' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {token.bonding_curve_status === 'migrated' ? 'Migrated' : 'Bonding'}
              </span>
            </div>
          </div>

          {/* ===== QUICK TRADE SECTION ===== */}
          <div className="border border-gray-800 rounded p-2 bg-gray-900/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white">Quick Buy</h3>
              <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                LIVE
              </span>
            </div>

            {/* Amount Presets */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[0.1, 0.5, 1.0].map((amt) => (
                <Button 
                  key={amt} 
                  variant="outline"
                  size="sm"
                  className={`h-6 text-xs border-gray-700 ${amountSol === amt ? 'bg-emerald-600 border-emerald-500 text-white' : 'hover:border-emerald-500 hover:text-emerald-400'}`}
                  onClick={() => setAmountSol(amt)}
                  disabled={isSubmitting}
                >
                  {amt}
                </Button>
              ))}
            </div>

            {/* Amount Input + Buy Button */}
            <div className="flex gap-1 mb-2">
              <div className="relative flex-1">
                <Input 
                  type="number" 
                  value={amountSol} 
                  onChange={(e) => setAmountSol(parseFloat(e.target.value) || 0)}
                  className="bg-gray-900 border-gray-700 h-7 text-xs pr-6"
                  min={0.01}
                  step={0.1}
                  disabled={isSubmitting}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">SOL</span>
              </div>
              <Button 
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                onClick={handleQuickBuy}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3 fill-current" />
                )}
              </Button>
            </div>

            {/* Trade Drawer Trigger */}
            {onTrade && (
              <Button 
                className="w-full h-7 bg-cyan-600 hover:bg-cyan-700 text-xs font-bold text-white"
                onClick={() => onTrade(token)}
              >
                Open Full Trading
              </Button>
            )}
          </div>

          {/* ===== JUPITER EMBED ===== */}
          <div className="border border-gray-800 rounded overflow-hidden">
            <div className="text-xs font-bold text-gray-400 bg-gray-900/50 px-2 py-1.5 border-b border-gray-800">
              Jupiter Swap
            </div>
            <div className="min-h-[300px] bg-gray-900/20">
              <JupiterSwapEmbed 
                open={true} 
                outputMint={token.mint} 
                initialAmount={null}
              />
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}