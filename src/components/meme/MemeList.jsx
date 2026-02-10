import React, { memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Button } from '@/components/ui/button';
import { resolveIpfsUrl } from '@/components/utils/ipfs';

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

// Enhanced Row Component for Photon-like density
const Row = memo((/** @type {any} */ { data, index, style }) => {
  const token = data[index];
  const isPositive = token.priceChange24h >= 0;

  return (
    <div style={style} className="flex items-center hover:bg-white/5 transition-colors border-b border-gray-800/30 px-3 cursor-pointer group" onClick={() => data.onTrade(token)}>
      {/* Token */}
      <div className="flex-1 flex items-center gap-3 min-w-[180px]">
        <img 
          src={resolveIpfsUrl(token.image_url)} 
          alt={token.symbol} 
          className="w-8 h-8 rounded-md bg-gray-800 object-cover"
          loading="lazy"
          onError={(e) => { /** @type {HTMLImageElement} */ (e.target).src = "https://ui-avatars.com/api/?name=" + token.symbol; }}
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors">{token.symbol}</span>
            {token.bonding_curve_status === 'migrated' ? (
              <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">RAY</span>
            ) : (
              <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUMP</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 truncate max-w-[100px]">{token.name || "Unknown"}</div>
        </div>
      </div>

      {/* Price */}
      <div className="w-[100px] text-right font-mono text-xs text-white hidden sm:block">
        {formatPrice(token.price_usd)}
      </div>

      {/* 24h Change */}
      <div className={`w-[70px] text-right text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'} hidden sm:block`}>
        {isPositive ? '+' : ''}{token.priceChange24h?.toFixed(1)}%
      </div>

      {/* Volume */}
      <div className="w-[90px] text-right font-mono text-xs text-gray-400 hidden md:block">
        {formatNumber(token.volume_5m)}
      </div>

      {/* Age */}
      <div className="w-[70px] text-right font-mono text-xs text-gray-500 hidden lg:block">
        {token.createdAt ? Math.floor((Date.now() - token.createdAt) / 60000) + 'm' : 'New'}
      </div>

      {/* Action */}
      <div className="w-[70px] text-right pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          size="sm" 
          className="h-6 text-[10px] bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-600/50 px-2"
          onClick={(e) => {
            e.stopPropagation();
            data.onTrade(token);
          }}
        >
          Buy
        </Button>
      </div>
    </div>
  );
});

export default function MemeList({ tokens, height = 600, onTrade }) {
  const itemData = React.useMemo(() => {
    const data = /** @type {any} */ ([...tokens]);
    data.onTrade = onTrade;
    return data;
  }, [tokens, onTrade]);

  return (
    <div className="w-full border border-gray-800 rounded-xl overflow-hidden bg-[#0f172a] flex flex-col h-full shadow-xl shadow-black/20">
      {/* Sticky Header */}
      <div className="flex items-center px-3 h-8 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider shrink-0 z-10">
        <div className="flex-1 min-w-[180px]">Token / Source</div>
        <div className="w-[100px] text-right hidden sm:block">Price</div>
        <div className="w-[70px] text-right hidden sm:block">24h %</div>
        <div className="w-[90px] text-right hidden md:block">5m Vol</div>
        <div className="w-[70px] text-right hidden lg:block">Age</div>
        <div className="w-[70px] text-right"></div>
      </div>
      
      <div className="flex-1 bg-[#0f172a]">
        <List
          height={height}
          itemCount={tokens.length}
          itemSize={48} // Denser rows
          width="100%"
          itemData={itemData}
          className="scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
        >
          {Row}
        </List>
      </div>
    </div>
  );
}