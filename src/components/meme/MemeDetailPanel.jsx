import React, { useState, useEffect } from 'react';
import { formatNumber, formatPrice } from './MemeList';
import { resolveIpfsUrl } from '@/components/utils/ipfs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, ShieldCheck, AlertTriangle, Zap, Loader2, TrendingUp, TrendingDown, X, Info } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import JupiterSwapEmbed from './JupiterSwapEmbed';
import { requestQueue } from '@/components/utils/requestQueue';

export default function MemeDetailPanel({ token, onClose, onTrade }) {
  const [safety, setSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [amountSol, setAmountSol] = useState(0.1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safety Check
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
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 border-l border-slate-700/50">
      <div className="text-center">
        <p className="text-slate-400 text-sm">Select a token to view details</p>
      </div>
    </div>
  );

  const riskLevel = safety?.riskLevel || 'unknown';
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  const getRiskBadgeColor = () => {
    if (riskLevel === 'good') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    if (riskLevel === 'high') return 'bg-red-500/20 text-red-400 border-red-500/50';
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
  };

  const getRiskIcon = () => {
    if (riskLevel === 'good') return <ShieldCheck className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/50 to-slate-950/50 backdrop-blur-md border-l border-slate-700/50 overflow-hidden">
      
      {/* ===== PREMIUM HEADER ===== */}
      <div className="bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 px-4 py-4 shrink-0 shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img 
              src={resolveIpfsUrl(token.image_url)} 
              alt={token.symbol}
              className="w-12 h-12 rounded-xl bg-slate-800 object-cover flex-shrink-0 shadow-lg border border-slate-700/50"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-white truncate">{token.symbol}</h2>
                <Badge className={`text-xs px-2 py-0.5 rounded-full ${token.bonding_curve_status === 'migrated' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'}`}>
                  {token.bonding_curve_status === 'migrated' ? 'Raydium' : 'Pump.fun'}
                </Badge>
              </div>
              <p className="text-sm text-slate-400 truncate">{token.name}</p>
            </div>
          </div>

          {onClose && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0 ml-2">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Price Display */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">Current Price</p>
            <p className="text-2xl font-bold text-emerald-400">{formatPrice(token.price_usd)}</p>
          </div>
          <div className={`text-right px-3 py-2 rounded-lg ${isPositive ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            <p className="text-xs text-slate-500 mb-0.5">24h Change</p>
            <p className={`text-lg font-bold flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {priceChange.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          
          {/* ===== QUICK LINKS ===== */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 text-xs border-slate-700/50 bg-slate-800/50 hover:bg-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300 rounded-lg"
              onClick={() => navigator.clipboard.writeText(token.mint)}
            >
              <Copy className="w-3 h-3 mr-1.5" /> Copy Contract
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 text-xs border-slate-700/50 bg-slate-800/50 hover:bg-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300 rounded-lg"
              asChild
            >
              <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3 h-3 mr-1.5" /> Solscan
              </a>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 text-xs border-slate-700/50 bg-slate-800/50 hover:bg-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300 rounded-lg"
              asChild
            >
              <a href={`https://photon-sol.tinyastro.io/en/lp/${token.mint}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3 h-3 mr-1.5" /> Photon
              </a>
            </Button>
          </div>

          {/* ===== SAFETY CHECK (BEAUTIFUL) ===== */}
          <div className={`rounded-xl border p-4 backdrop-blur-sm transition-all duration-300 ${getRiskBadgeColor()}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getRiskIcon()}
                <div>
                  <p className="text-xs font-semibold text-slate-400">Security Status</p>
                  <p className="font-bold text-sm">
                    {loadingSafety ? 'Scanning...' : (safety?.score || 'N/A')}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-black/30">
                {safety?.rugged ? '🚨 RUGGED' : riskLevel.toUpperCase()}
              </span>
            </div>
            {!loadingSafety && safety?.flags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-current/20">
                {safety.flags.slice(0, 3).map((flag, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-black/30 border border-current/30">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ===== KEY METRICS (BEAUTIFUL GRID) ===== */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3.5 hover:border-slate-600/50 transition-all duration-300">
              <p className="text-xs text-slate-500 font-semibold mb-2">Market Cap</p>
              <p className="text-lg font-bold text-white">{formatNumber(token.market_cap || 0)}</p>
              <p className="text-xs text-slate-600 mt-1">Total Value</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3.5 hover:border-slate-600/50 transition-all duration-300">
              <p className="text-xs text-slate-500 font-semibold mb-2">Liquidity</p>
              <p className="text-lg font-bold text-emerald-400">{formatNumber(token.liquidity || 0)}</p>
              <p className="text-xs text-slate-600 mt-1">Available to Trade</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3.5 hover:border-slate-600/50 transition-all duration-300">
              <p className="text-xs text-slate-500 font-semibold mb-2">5m Volume</p>
              <p className="text-lg font-bold text-white">{formatNumber(token.volume_5m || 0)}</p>
              <p className="text-xs text-slate-600 mt-1">Recent Activity</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3.5 hover:border-slate-600/50 transition-all duration-300">
              <p className="text-xs text-slate-500 font-semibold mb-2">5m Transactions</p>
              <div className="flex gap-2 text-sm font-bold">
                <span className="text-emerald-400">{token.buys_5m || 0} Buys</span>
                <span className="text-slate-600">/</span>
                <span className="text-red-400">{token.sells_5m || 0} Sells</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">Buy/Sell Ratio</p>
            </div>
          </div>

          {/* ===== ADDITIONAL INFO (COMPACT ROWS) ===== */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Token Information</p>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-700/30">
              <span className="text-sm text-slate-400">Holders</span>
              <span className="text-sm font-bold text-white">{token.holders || '--'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/30">
              <span className="text-sm text-slate-400">Supply</span>
              <span className="text-sm font-bold text-white">{formatNumber(token.supply || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/30">
              <span className="text-sm text-slate-400">Created</span>
              <span className="text-sm font-bold text-white">
                {token.created_at ? new Date(token.created_at).toLocaleDateString() : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-400">Status</span>
              <span className={`text-sm font-bold px-2 py-1 rounded-full ${token.bonding_curve_status === 'migrated' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {token.bonding_curve_status === 'migrated' ? '✓ Migrated' : '⏳ Bonding'}
              </span>
            </div>
          </div>

          {/* ===== QUICK TRADE SECTION ===== */}
          <div className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Quick Buy
              </h3>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                LIVE
              </span>
            </div>

            {/* Amount Presets */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[0.1, 0.5, 1.0].map((amt) => (
                <Button 
                  key={amt} 
                  variant="outline"
                  size="sm"
                  className={`h-9 text-xs rounded-lg transition-all duration-300 font-semibold ${amountSol === amt ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 border-emerald-500 text-white shadow-lg' : 'border-slate-700/50 bg-slate-800/50 hover:border-emerald-500/50 hover:text-emerald-400'}`}
                  onClick={() => setAmountSol(amt)}
                  disabled={isSubmitting}
                >
                  {amt} SOL
                </Button>
              ))}
            </div>

            {/* Amount Input + Buy Button */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Input 
                  type="number" 
                  value={amountSol} 
                  onChange={(e) => setAmountSol(parseFloat(e.target.value) || 0)}
                  className="bg-slate-800/50 border-slate-700/50 h-10 text-sm rounded-lg pr-8 focus:border-emerald-500 transition-all duration-300"
                  min={0.01}
                  step={0.1}
                  disabled={isSubmitting}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">SOL</span>
              </div>
              <Button 
                className="h-10 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-lg transition-all duration-300 shadow-lg"
                onClick={handleQuickBuy}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 fill-current" />
                )}
              </Button>
            </div>

            {/* Trade Drawer Trigger */}
            {onTrade && (
              <Button 
                className="w-full h-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold rounded-lg transition-all duration-300 shadow-lg"
                onClick={() => onTrade(token)}
              >
                Open Full Trading Terminal
              </Button>
            )}
          </div>

          {/* ===== JUPITER SWAP ===== */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="text-sm font-bold text-slate-300 bg-slate-900/50 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
              <span className="text-emerald-400">◆</span> Jupiter Swap
            </div>
            <div className="min-h-[320px] bg-slate-900/20">
              <JupiterSwapEmbed 
                open={true} 
                outputMint={token.mint} 
                initialAmount={null}
              />
            </div>
          </div>

          {/* Bottom Padding */}
          <div className="h-4"></div>
        </div>
      </ScrollArea>
    </div>
  );
}
