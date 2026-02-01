import React, { useState, useEffect } from 'react';
import { formatNumber, formatPrice } from './MemeList';
import { resolveIpfsUrl } from '@/components/utils/ipfs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, ExternalLink, ShieldCheck, AlertTriangle, Zap, Loader2, TrendingUp, TrendingDown, X, Globe, MessageCircle, Users, Clock, Droplet, BarChart3 } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import JupiterSwapEmbed from './JupiterSwapEmbed';
import { requestQueue } from '@/components/utils/requestQueue';

export default function MemeDetailPanel({ token, onClose, onTrade }) {
  const [safety, setSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [amountSol, setAmountSol] = useState(0.1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, chart, swap

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
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
      <p className="text-slate-500 text-sm">Select a token to view details</p>
    </div>
  );

  const riskLevel = safety?.riskLevel || 'unknown';
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  const getRiskColor = () => {
    if (riskLevel === 'good') return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    if (riskLevel === 'high') return 'bg-red-500/15 border-red-500/40 text-red-300';
    return 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-l border-slate-700/50 overflow-hidden">
      
      {/* ===== HEADER ===== */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 px-4 py-4 shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg border border-slate-700/50">
              {token.symbol.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{token.symbol}</h2>
              <p className="text-xs text-slate-400 truncate">{token.name}</p>
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
            <p className="text-xs text-slate-500 mb-1">Price</p>
            <p className="text-2xl font-bold text-emerald-400">{formatPrice(token.price_usd)}</p>
          </div>
          <div className={`px-3 py-2 rounded-lg ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            <p className="text-xs text-slate-400 mb-0.5">24h</p>
            <p className={`text-lg font-bold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {priceChange.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* ===== TAB NAVIGATION ===== */}
      <div className="flex items-center gap-0 bg-slate-900/50 border-b border-slate-700/50 px-4">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-300 ${activeTab === 'overview' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-300 ${activeTab === 'chart' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Chart
        </button>
        <button
          onClick={() => setActiveTab('swap')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-300 ${activeTab === 'swap' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Swap
        </button>
      </div>

      {/* ===== CONTENT AREA ===== */}
      <ScrollArea className="flex-1">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button 
                className="flex-1 h-10 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold rounded-lg transition-all duration-300 shadow-lg"
                onClick={handleQuickBuy}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2 fill-current" />}
                Buy Now
              </Button>
              <Button 
                className="flex-1 h-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold rounded-lg transition-all duration-300 shadow-lg"
                onClick={() => setActiveTab('swap')}
              >
                Swap
              </Button>
            </div>

            {/* Amount Input for Quick Buy */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-2 font-semibold">Quick Buy Amount</p>
              <div className="flex gap-2 mb-3">
                {[0.1, 0.5, 1.0].map((amt) => (
                  <button 
                    key={amt}
                    onClick={() => setAmountSol(amt)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${amountSol === amt ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type="number" 
                    value={amountSol} 
                    onChange={(e) => setAmountSol(parseFloat(e.target.value) || 0)}
                    className="bg-slate-700/50 border-slate-600 h-9 text-sm rounded-lg pr-8"
                    min={0.01}
                    step={0.1}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">SOL</span>
                </div>
              </div>
            </div>

            {/* Safety Status */}
            <div className={`rounded-lg border p-3 ${getRiskColor()}`}>
              <div className="flex items-center gap-2 mb-2">
                {riskLevel === 'good' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <p className="text-xs font-bold">Security Status</p>
              </div>
              <p className="text-sm font-bold">
                {loadingSafety ? 'Scanning...' : (safety?.score || 'N/A')} - {riskLevel.toUpperCase()}
              </p>
              {!loadingSafety && safety?.flags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-current/20">
                  {safety.flags.slice(0, 2).map((flag, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-black/30">
                      {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">Market Cap</p>
                <p className="text-lg font-bold text-white">{formatNumber(token.market_cap || 0)}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">Liquidity</p>
                <p className="text-lg font-bold text-emerald-400">{formatNumber(token.liquidity || 0)}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">5m Volume</p>
                <p className="text-lg font-bold text-white">{formatNumber(token.volume_5m || 0)}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">5m Txs</p>
                <p className="text-sm font-bold"><span className="text-emerald-400">{token.buys_5m || 0}B</span> / <span className="text-red-400">{token.sells_5m || 0}S</span></p>
              </div>
            </div>

            {/* Token Info */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Token Information</p>
              
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
                <span className="text-sm font-bold text-white">{token.created_at ? new Date(token.created_at).toLocaleDateString() : '--'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-400">Status</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${token.bonding_curve_status === 'migrated' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {token.bonding_curve_status === 'migrated' ? 'Migrated' : 'Bonding'}
                </span>
              </div>
            </div>

            {/* Copy Contract */}
            <Button 
              variant="outline" 
              className="w-full border-slate-700/50 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300"
              onClick={() => navigator.clipboard.writeText(token.mint)}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy Contract Address
            </Button>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="p-4">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm mb-3">Chart integration coming soon</p>
              <p className="text-xs text-slate-600">Real-time price charts will be displayed here</p>
            </div>
          </div>
        )}

        {activeTab === 'swap' && (
          <div className="p-4">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="text-sm font-bold text-slate-300 bg-slate-900/50 px-4 py-3 border-b border-slate-700/50">
                Jupiter Swap
              </div>
              <div className="min-h-[400px] bg-slate-900/20">
                <JupiterSwapEmbed 
                  open={true} 
                  outputMint={token.mint} 
                  initialAmount={null}
                />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
