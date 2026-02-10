import React, { memo } from 'react';
import { resolveIpfsUrl } from '@/components/utils/ipfs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { formatNumber, formatPrice } from '@/components/meme/MemeList';

/** @param {{ token: any, onTrade: Function }} props */
const MemeCard = memo(({ token, onTrade }) => {
  const isBondingCurve = token.bonding_curve_status === 'bonding_curve';
  const riskLevel = token.safety?.riskLevel || 'unknown';
  
  const getRiskColor = (level) => {
    switch(level) {
      case 'good': return 'text-emerald-500 bg-emerald-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'high': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div 
      className="bg-[#111] border border-gray-800 rounded-xl p-4 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => onTrade(token)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={resolveIpfsUrl(token.image_url)} 
              alt={token.symbol}
              className="w-12 h-12 rounded-lg object-cover bg-gray-800"
              loading="lazy"
              onError={(e) => e.target.src = "https://ui-avatars.com/api/?name=" + token.symbol}
            />
            {token.isNew && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-base text-white">{token.symbol}</h3>
              {riskLevel !== 'unknown' && (
                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-0 ${getRiskColor(riskLevel)}`}>
                  {token.safety?.score 
                    ? `Score: ${typeof token.safety.score === 'object' ? (token.safety.score.score || token.safety.score.value || 0) : token.safety.score}` 
                    : riskLevel.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{token.name}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-base font-mono font-medium text-emerald-400">
            {formatPrice(token.price_usd || 0)}
          </div>
          <div className={`text-xs ${token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h?.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-900/50 rounded p-2 text-center border border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Vol 5m</div>
          <div className="text-xs font-mono font-medium text-gray-300">{formatNumber(token.volume_5m || 0)}</div>
        </div>
        <div className="bg-gray-900/50 rounded p-2 text-center border border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">M.Cap</div>
          <div className="text-xs font-mono font-medium text-gray-300">{formatNumber(token.market_cap || 0)}</div>
        </div>
        <div className="bg-gray-900/50 rounded p-2 text-center border border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Age</div>
          <div className="text-xs font-mono font-medium text-gray-300">{token.createdAt ? Math.floor((Date.now() - token.createdAt) / 60000) + 'm' : 'New'}</div>
        </div>
      </div>

      <Button 
        size="sm" 
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9"
        onClick={(e) => {
          e.stopPropagation();
          onTrade(token);
        }}
      >
        Quick Buy
      </Button>
    </div>
  );
});

export default MemeCard;