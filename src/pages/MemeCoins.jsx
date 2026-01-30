import React, { useState, useEffect } from 'react';
import { useMemeData, MemeDataProvider } from '@/components/meme/MemeDataContext';
import MemeList from '@/components/meme/MemeList';
import MemeCard from '@/components/meme/MemeCard';
import TradeDrawer from '@/components/meme/TradeDrawer';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MemeCoinsContent = () => {
  const { tokens, loading, connectionStatus } = useMemeData();
  const [search, setSearch] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    checkMobile();
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredTokens = tokens.filter(t => 
    t.symbol.toLowerCase().includes(search.toLowerCase()) || 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0f172a]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
                Meme Scout
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  {connectionStatus === 'connected' ? (
                    <><Wifi className="w-3 h-3 text-green-500" /> Live Feed</>
                  ) : (
                    <><WifiOff className="w-3 h-3 text-red-500" /> Connecting...</>
                  )}
                </span>
                <span>•</span>
                <span>{tokens.length} Active Tokens</span>
              </div>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search ticker..." 
                className="pl-9 bg-gray-900 border-gray-700 focus:border-emerald-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
            <div className="text-gray-400">Loading trending memes...</div>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {filteredTokens.map(token => (
                <MemeCard 
                  key={token.mint} 
                  token={token} 
                  onTrade={setSelectedToken} 
                />
              ))}
            </div>

            {/* Desktop List */}
            <div className="hidden md:block">
              <MemeList 
                tokens={filteredTokens} 
                height={600} 
                onTrade={setSelectedToken} 
              />
            </div>
          </>
        )}
      </div>

      {/* Trade Drawer */}
      <TradeDrawer 
        open={!!selectedToken} 
        onOpenChange={(open) => !open && setSelectedToken(null)}
        token={selectedToken}
      />
    </div>
  );
};

export default function MemeCoins() {
  return (
    <MemeDataProvider>
      <MemeCoinsContent />
    </MemeDataProvider>
  );
}