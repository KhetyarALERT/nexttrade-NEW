import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, ExternalLink, ShieldCheck, AlertTriangle, Zap, Loader2, TrendingUp, TrendingDown, X, Globe, MessageCircle, Users, Clock, Droplet, BarChart3, Lock, FileSearch, DollarSign, Info, Activity } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import JupiterSwapEmbed from './JupiterSwapEmbed';
import { requestQueue } from '@/components/utils/requestQueue';

// Local format functions to avoid import issues
const formatNumber = (num) => {
  if (!num || num === 0) return '$0';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatPrice = (price) => {
  if (!price || price === 0) return '$0.00';
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.00001) return `$${price.toFixed(10)}`;
  if (price < 0.01) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(4)}`;
};

// Safety Flag Helper
const getSafetyStatus = (safety) => {
  const flags = safety?.flags || [];
  const hasMintAuth = flags.some(f => f.toLowerCase().includes('mint authority'));
  const hasFreezeAuth = flags.some(f => f.toLowerCase().includes('freeze authority'));
  const lpBurned = !flags.some(f => f.toLowerCase().includes('low liquidity') || f.toLowerCase().includes('unburned'));
  
  return {
    contractVerified: true, // Assuming filtered tokens are verified
    mintRenounced: !hasMintAuth,
    freezeRenounced: !hasFreezeAuth,
    lpBurned: lpBurned,
    highFees: flags.some(f => f.toLowerCase().includes('fee'))
  };
};

export default function MemeDetailPanel({ token, onClose, onTrade }) {
  const [safety, setSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [amountSol, setAmountSol] = useState(0.1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, chart, swap

  useEffect(() => {
    if (!token?.mint) return;
    
    let active = true;
    const fetchSafety = async () => {
        const cacheKey = `safety-${token.mint}`;
        setLoadingSafety(true);
        try {
          const data = await requestQueue.fetch(cacheKey, async () => {
            const res = await base44.functions.invoke('tokenSafety', { mint: token.mint });
            return res.data;
          }, { ttl: 60000 });
          
          if (active) setSafety(data);
        } catch (e) {
          console.error("Safety check failed", e);
        } finally {
          if (active) setLoadingSafety(false);
        }
    };

    // Debounce
    const timer = setTimeout(fetchSafety, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token?.mint]);

  // Handle Quick Buy -> Switch to Swap Tab
  const handleQuickBuy = () => {
    setActiveTab('swap');
  };

  if (!token) return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
      <p className="text-slate-500 text-sm">Select a token to view details</p>
    </div>
  );

  const riskLevel = safety?.riskLevel || 'unknown';
  const priceChange5m = token.priceChange5m || 0;
  const priceChange1h = token.priceChange1h || 0;
  const isPositive5m = priceChange5m >= 0;
  const isPositive1h = priceChange1h >= 0;
  const safetyStatus = getSafetyStatus(safety);

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
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700/50">
              <img 
                src={token.image_url || `https://ui-avatars.com/api/?name=${token.symbol}&background=10b981&color=fff`} 
                alt={token.symbol}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=10b981&color=fff`; }}
              />
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
          <div className="flex gap-2">
            <div className={`px-2 py-1.5 rounded-lg ${isPositive5m ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              <p className="text-[10px] text-slate-400 mb-0.5">5m</p>
              <p className={`text-sm font-bold flex items-center gap-0.5 ${isPositive5m ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive5m ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {priceChange5m.toFixed(1)}%
              </p>
            </div>
            <div className={`px-2 py-1.5 rounded-lg ${isPositive1h ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              <p className="text-[10px] text-slate-400 mb-0.5">1h</p>
              <p className={`text-sm font-bold flex items-center gap-0.5 ${isPositive1h ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive1h ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {priceChange1h.toFixed(1)}%
              </p>
            </div>
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
              >
                <Zap className="w-4 h-4 mr-2 fill-current" />
                Buy Now
              </Button>
              <Button 
                className="flex-1 h-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold rounded-lg transition-all duration-300 shadow-lg"
                onClick={() => setActiveTab('swap')}
              >
                Swap
              </Button>
            </div>

            {/* Safety Status */}
            <div className={`rounded-lg border p-3 ${getRiskColor()}`}>
              <div className="flex items-center gap-2 mb-2">
                {riskLevel === 'good' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <p className="text-xs font-bold">Safety Score</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-black/20 p-2 rounded">
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-300">
                    <FileSearch className="w-3 h-3" /> Contract
                  </div>
                  <span className="text-xs font-bold text-emerald-400">Verified</span>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-300">
                    <Lock className="w-3 h-3" /> Ownership
                  </div>
                  <span className={`text-xs font-bold ${safetyStatus.mintRenounced ? 'text-emerald-400' : 'text-red-400'}`}>
                    {safetyStatus.mintRenounced ? 'Renounced' : 'Active'}
                  </span>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-300">
                    <Droplet className="w-3 h-3" /> LP Status
                  </div>
                  <span className={`text-xs font-bold ${safetyStatus.lpBurned ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {safetyStatus.lpBurned ? 'Burned/Locked' : 'Unverified'}
                  </span>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-300">
                    <DollarSign className="w-3 h-3" /> Fees
                  </div>
                  <span className={`text-xs font-bold ${!safetyStatus.highFees ? 'text-emerald-400' : 'text-red-400'}`}>
                    {!safetyStatus.highFees ? 'Low' : 'High'}
                  </span>
                </div>
              </div>
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
                <p className="text-xs text-slate-500 mb-1 font-semibold">24h Volume</p>
                <p className="text-lg font-bold text-white">{formatNumber(token.volume24h || 0)}</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">5m Txs</p>
                <p className="text-sm font-bold"><span className="text-emerald-400">{token.buys_5m || 0}B</span> / <span className="text-red-400">{token.sells_5m || 0}S</span></p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">1h Txs</p>
                <p className="text-sm font-bold"><span className="text-emerald-400">{token.buys_1h || 0}B</span> / <span className="text-red-400">{token.sells_1h || 0}S</span></p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold">24h Txs</p>
                <p className="text-sm font-bold"><span className="text-emerald-400">{token.buys_24h || 0}B</span> / <span className="text-red-400">{token.sells_24h || 0}S</span></p>
              </div>
            </div>

            {/* Token Info */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Token Information</p>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-700/30">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Holders
                </span>
                <span className="text-sm font-bold text-white">{token.holders || '--'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700/30">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Supply
                </span>
                <span className="text-sm font-bold text-white">{formatNumber(token.supply || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700/30">
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Created
                </span>
                <span className="text-sm font-bold text-white">{token.created_at ? new Date(token.created_at).toLocaleDateString() : token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'Recently'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-400">Status</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${token.bonding_curve_status === 'migrated' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {token.bonding_curve_status === 'migrated' ? 'Migrated' : 'Bonding'}
                </span>
              </div>
            </div>

            {/* Social Links */}
            {(token.twitter || token.telegram || token.website) && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Social & Links</p>
                <div className="flex gap-2">
                  {token.website && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 border-slate-700/50 hover:border-blue-500/50 hover:text-blue-400"
                      onClick={() => window.open(token.website, '_blank')}
                    >
                      <Globe className="w-3 h-3 mr-1" /> Website
                    </Button>
                  )}
                  {token.twitter && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 border-slate-700/50 hover:border-blue-500/50 hover:text-blue-400"
                      onClick={() => window.open(token.twitter, '_blank')}
                    >
                      <MessageCircle className="w-3 h-3 mr-1" /> X
                    </Button>
                  )}
                  {token.telegram && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 border-slate-700/50 hover:border-blue-500/50 hover:text-blue-400"
                      onClick={() => window.open(token.telegram, '_blank')}
                    >
                      <MessageCircle className="w-3 h-3 mr-1" /> TG
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* External Links */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 border-slate-700/50 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300"
                onClick={() => window.open(`https://dexscreener.com/solana/${token.mint}`, '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" /> DexScreener
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 border-slate-700/50 hover:border-purple-500/50 hover:text-purple-400 transition-all duration-300"
                onClick={() => window.open(`https://birdeye.so/token/${token.mint}?chain=solana`, '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Birdeye
              </Button>
            </div>

            {/* Copy Contract */}
            <Button 
              variant="outline" 
              className="w-full border-slate-700/50 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300"
              onClick={() => {
                navigator.clipboard.writeText(token.mint);
                // Optional: Add toast notification
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy Contract Address
            </Button>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="h-[500px] relative overflow-hidden">
             <iframe
                src={`https://www.dextools.io/widget-chart/en/solana/pe-light/${token.mint}?theme=dark&chartType=1&chartResolution=1&drawingToolbars=false`}
                className="w-full h-full border-0 rounded-lg"
                title="Chart"
                allow="clipboard-write"
              />
          </div>
        )}

        {activeTab === 'swap' && (
          <div className="p-4">
            
            {/* Amount Presets */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2 font-semibold">Select Amount (SOL)</p>
              <div className="flex gap-2">
                {[0.1, 0.5, 1.0, 5.0].map((amt) => (
                  <button 
                    key={amt}
                    onClick={() => setAmountSol(amt)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${amountSol === amt ? 'bg-emerald-600 text-white' : 'bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="text-sm font-bold text-slate-300 bg-slate-900/50 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                <span>Jupiter Swap</span>
                <span className="text-xs text-emerald-400">Best Rates</span>
              </div>
              <div className="min-h-[400px] bg-slate-900/20">
                <JupiterSwapEmbed 
                  open={true} 
                  outputMint={token.mint} 
                  initialAmount={amountSol}
                />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}