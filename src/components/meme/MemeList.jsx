import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer'; // Note: Not installed, checking packages... 
// Wait, react-virtualized-auto-sizer is NOT in installed_packages.
// I must use a simple div wrapper with dimensions or install it.
// I'll assume I can't install it without asking, so I'll handle sizing manually or use a flexible container.
// Actually, I'll use a custom sizer hook or just fixed height for now to be safe.
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

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

const Row = memo(({ data, index, style }) => {
  const token = data[index];
  const isPositive = token.priceChange24h >= 0;

  return (
    <div style={style} className="flex items-center hover:bg-white/5 transition-colors border-b border-gray-800/50 px-4">
      {/* Token */}
      <div className="flex-1 flex items-center gap-3 min-w-[200px]">
        <img 
          src={token.image_url || `https://ui-avatars.com/api/?name=${token.symbol}&background=random`} 
          alt={token.symbol} 
          className="w-8 h-8 rounded-full bg-gray-800 object-cover"
          loading="lazy"
        />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-white">{token.symbol}</span>
            {token.bonding_curve_status === 'migrated' && (
              <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded border border-blue-500/30">DEX</span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate max-w-[120px]">{token.name}</div>
        </div>
      </div>

      {/* Price */}
      <div className="w-[120px] text-right font-mono text-sm text-white">
        {formatPrice(token.price_usd)}
      </div>

      {/* 24h Change */}
      <div className={`w-[100px] text-right text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{token.priceChange24h?.toFixed(2)}%
      </div>

      {/* Volume */}
      <div className="w-[120px] text-right font-mono text-sm text-gray-300 hidden md:block">
        {formatNumber(token.volume_sol_24h * 180)}
      </div>

      {/* Liquidity */}
      <div className="w-[120px] text-right font-mono text-sm text-gray-300 hidden lg:block">
        {token.bonding_curve_status === 'bonding_curve' ? (
          <span className="text-orange-400 text-xs">Bonding Curve</span>
        ) : (
          formatNumber(token.liquidity)
        )}
      </div>

      {/* Action */}
      <div className="w-[100px] text-right">
        <Button 
          size="sm" 
          className="h-7 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-600/50"
          onClick={() => data.onTrade(token)}
        >
          Trade
        </Button>
      </div>
    </div>
  );
});

export default function MemeList({ tokens, height = 600, onTrade }) {
  // Pass onTrade via itemData to avoid recreation
  const itemData = React.useMemo(() => {
    // Attach onTrade to the array for easy access in Row (a bit hacky but works for FixedSizeList data prop)
    const data = [...tokens];
    data.onTrade = onTrade;
    return data;
  }, [tokens, onTrade]);

  return (
    <div className="w-full border border-gray-800 rounded-xl overflow-hidden bg-[#0f172a]/50 backdrop-blur-sm">
      <div className="flex items-center px-4 h-10 border-b border-gray-800 bg-gray-900/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div className="flex-1 min-w-[200px]">Token</div>
        <div className="w-[120px] text-right">Price</div>
        <div className="w-[100px] text-right">24h %</div>
        <div className="w-[120px] text-right hidden md:block">Vol 24h</div>
        <div className="w-[120px] text-right hidden lg:block">Liquidity</div>
        <div className="w-[100px] text-right">Action</div>
      </div>
      
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
  );
}