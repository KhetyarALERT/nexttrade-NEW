import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Activity, AlertCircle } from 'lucide-react';
import { resolveIpfsUrl } from '@/components/utils/ipfs';
import { Badge } from '@/components/ui/badge';

export const formatNumber = (num) => {
  if (!num) return '-';
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

export const formatPrice = (price) => {
  if (!price) return '-';
  if (price < 0.000001) return `$${price.toExponential(4)}`;
  if (price < 0.01) return `$${price.toFixed(8)}`;
  return `$${price.toFixed(4)}`;
};

const Row = memo(({ data, index, style }) => {
  const token = data[index];
  const isPositive = token.priceChange24h >= 0;

  return (
    <div style={style} className="flex items-center hover:bg-white/5 transition-colors border-b border-gray-800/50 px-4 cursor-pointer" onClick={() => data.onTrade(token)}>
      {/* Token */}
      <div className="flex-1 flex items-center gap-3 min-w-[200px]">
        <img 
          src={resolveIpfsUrl(token.image_url)} 
          alt={token.symbol} 
          className="w-10 h-10 rounded-lg bg-gray-800 object-cover"
          loading="lazy"
          onError={(e) => e.target.src = "https://ui-avatars.com/api/?name=" + token.symbol}
        />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-white">{token.symbol}</span>
            {token.bonding_curve_status === 'migrated' ? (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-auto text-purple-400 border-purple-500/30 bg-purple-500/10">RAY</Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-auto text-emerald-400 border-emerald-500/30 bg-emerald-500/10">PUMP</Badge>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate max-w-[120px]">{token.name}</div>
        </div>
      </div>

      {/* Price */}
      <div className="w-[120px] text-right font-mono text-sm text-white hidden sm:block">
        {formatPrice(token.price_usd)}
      </div>

      {/* 24h Change */}
      <div className={`w-[80px] text-right text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'} hidden sm:block`}>
        {isPositive ? '+' : ''}{token.priceChange24h?.toFixed(1)}%
      </div>

      {/* Volume */}
      <div className="w-[100px] text-right font-mono text-sm text-gray-300 hidden md:block">
        {formatNumber(token.volume_5m)}
      </div>

      {/* Age */}
      <div className="w-[80px] text-right font-mono text-xs text-gray-400 hidden lg:block">
        {token.createdAt ? Math.floor((Date.now() - token.createdAt) / 60000) + 'm' : 'New'}
      </div>

      {/* Action */}
      <div className="w-[80px] text-right pl-2">
        <Button 
          size="sm" 
          className="h-7 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-600/50"
          onClick={(e) => {
            e.stopPropagation();
            data.onTrade(token);
          }}
        >
          Trade
        </Button>
      </div>
    </div>
  );
});

export default function MemeList({ tokens, height = 600, onTrade }) {
  const itemData = React.useMemo(() => {
    const data = [...tokens];
    data.onTrade = onTrade;
    return data;
  }, [tokens, onTrade]);

  return (
    <div className="w-full border border-gray-800 rounded-xl overflow-hidden bg-[#0f172a]/50 backdrop-blur-sm flex flex-col h-full">
      <div className="flex items-center px-4 h-10 border-b border-gray-800 bg-gray-900/50 text-xs font-medium text-gray-500 uppercase tracking-wider shrink-0">
        <div className="flex-1 min-w-[200px]">Token</div>
        <div className="w-[120px] text-right hidden sm:block">Price</div>
        <div className="w-[80px] text-right hidden sm:block">24h %</div>
        <div className="w-[100px] text-right hidden md:block">5m Vol</div>
        <div className="w-[80px] text-right hidden lg:block">Age</div>
        <div className="w-[80px] text-right">Action</div>
      </div>
      
      <div className="flex-1">
        <List
          height={height}
          itemCount={tokens.length}
          itemSize={64}
          width="100%"
          itemData={itemData}
        >
          {Row}
        </List>
      </div>
    </div>
  );
}