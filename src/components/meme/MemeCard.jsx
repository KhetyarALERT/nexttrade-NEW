import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Droplets, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const formatNumber = (num) => {
  if (!num) return '-';
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatPrice = (price) => {
  if (!price) return '-';
  if (price < 0.000001) return `$${price.toExponential(4)}`;
  if (price < 0.01) return `$${price.toFixed(8)}`;
  return `$${price.toFixed(4)}`;
};

const MemeCard = memo(({ token, onTrade }) => {
  const isPositive = token.priceChange24h >= 0;
  
  return (
    <div className="bg-[#1e293b]/50 border border-gray-800 rounded-xl p-4 flex flex-col gap-4 active:scale-[0.98] transition-transform">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={token.image_url || `https://ui-avatars.com/api/?name=${token.symbol}&background=random`} 
            alt={token.symbol} 
            className="w-10 h-10 rounded-full bg-gray-800 object-cover"
            loading="lazy"
          />
          <div>
            <div className="font-bold text-white">{token.symbol}</div>
            <div className="text-xs text-gray-400 max-w-[100px] truncate">{token.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-medium text-white">{formatPrice(token.price_usd)}</div>
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 h-5 ${isPositive ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-red-400 border-red-500/20 bg-red-500/10'}`}
          >
            {isPositive ? '+' : ''}{token.priceChange24h?.toFixed(2)}%
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 bg-[#0f172a]/50 p-2 rounded-lg">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase opacity-70">Vol 24h</span>
          <span className="font-mono text-white">{formatNumber(token.volume_sol_24h * 180)}</span> {/* Approx SOL price */}
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] uppercase opacity-70">Liquidity</span>
          <span className="font-mono text-white">
            {token.bonding_curve_status === 'bonding_curve' ? 'Bonding' : formatNumber(token.liquidity)}
          </span>
        </div>
      </div>

      <Button 
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20 shadow-lg"
        onClick={() => onTrade(token)}
      >
        Trade
      </Button>
    </div>
  );
});

export default MemeCard;