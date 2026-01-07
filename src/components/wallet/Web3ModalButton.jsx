import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect, useBalance, useEnsName } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wallet, Copy, ExternalLink, LogOut, Check } from 'lucide-react';
import { useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';

/**
 * Web3Modal Wallet Button
 * 
 * This button works everywhere:
 * - Desktop: Opens Web3Modal with injected wallets (MetaMask, etc.)
 * - Mobile: Opens Web3Modal with WalletConnect QR/deep links
 * - PWA: Uses deep links to open wallet apps
 * 
 * Features:
 * - Auto-reconnect on page load
 * - Shows balance when connected
 * - Clean disconnect
 * - Copy address
 * - View on explorer
 */
export function Web3ModalButton({ language = 'en' }) {
  const { open } = useWeb3Modal();
  const { address, isConnected, connector, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const [copied, setCopied] = useState(false);

  const t = language === 'ar' ? {
    connect: 'ربط المحفظة',
    disconnect: 'قطع الاتصال',
    connected: 'متصل',
    balance: 'الرصيد',
    copyAddress: 'نسخ العنوان',
    viewExplorer: 'عرض في المتصفح',
    copied: 'تم النسخ!',
    network: 'الشبكة',
  } : {
    connect: 'Connect Wallet',
    disconnect: 'Disconnect',
    connected: 'Connected',
    balance: 'Balance',
    copyAddress: 'Copy Address',
    viewExplorer: 'View on Explorer',
    copied: 'Copied!',
    network: 'Network',
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const formatBalance = (bal) => {
    if (!bal) return '0.00';
    const value = parseFloat(bal.formatted);
    if (value < 0.0001) return '< 0.0001';
    if (value < 1) return value.toFixed(4);
    if (value < 1000) return value.toFixed(2);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy address');
    }
  };

  const getExplorerUrl = () => {
    if (!address || !chain) return '#';
    const explorers = {
      1: `https://etherscan.io/address/${address}`,
      137: `https://polygonscan.com/address/${address}`,
      42161: `https://arbiscan.io/address/${address}`,
      10: `https://optimistic.etherscan.io/address/${address}`,
      8453: `https://basescan.org/address/${address}`,
      56: `https://bscscan.com/address/${address}`,
    };
    return explorers[chain.id] || `${chain.blockExplorers?.default?.url}/address/${address}` || '#';
  };

  const handleDisconnect = () => {
    console.log('🔌 Disconnecting wallet...');
    disconnect();
    toast.success('Wallet disconnected');
  };

  // Not connected - show connect button
  if (!isConnected) {
    return (
      <Button
        onClick={() => {
          console.log('🔗 Opening Web3Modal...');
          open();
        }}
        variant="outline"
        size="sm"
        className="rounded-xl border-2 border-blue-500/50 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {t.connect}
      </Button>
    );
  }

  // Connected - show dropdown with info
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-2 border-green-500/50 bg-green-500/10 hover:bg-green-500/20 transition-all"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline font-mono text-xs">
              {ensName || formatAddress(address)}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* Wallet Info */}
        <div className="p-3 space-y-2">
          <div className="text-xs text-muted-foreground">{t.connected}</div>
          
          {/* Address */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Address:</span>
            <span className="font-mono text-xs">{formatAddress(address)}</span>
          </div>

          {/* Network */}
          {chain && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t.network}:</span>
              <span className="text-xs font-medium">{chain.name}</span>
            </div>
          )}

          {/* Balance */}
          {balance && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t.balance}:</span>
              <span className="text-xs font-semibold text-primary">
                {formatBalance(balance)} {balance.symbol}
              </span>
            </div>
          )}

          {/* Connector */}
          {connector && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Wallet:</span>
              <span className="text-xs capitalize">{connector.name}</span>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Copy Address */}
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? (
            <Check className="w-4 h-4 mr-2 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 mr-2" />
          )}
          {t.copyAddress}
        </DropdownMenuItem>

        {/* View on Explorer */}
        <DropdownMenuItem asChild>
          <a
            href={getExplorerUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t.viewExplorer}
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Disconnect */}
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="text-rose-600 focus:text-rose-700"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t.disconnect}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

Web3ModalButton.propTypes = {
  language: PropTypes.string,
};
