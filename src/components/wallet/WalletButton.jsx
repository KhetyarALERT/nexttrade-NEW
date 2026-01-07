import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/web3/WalletContext';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function WalletButton({ language = 'en' }) {
  const {
    account,
    chainId,
    balance,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    formatAddress,
    formatBalance,
    isConnected,
    walletType,
    networkName
  } = useWallet();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = language === 'ar' ? {
    connect: 'ربط المحفظة',
    disconnect: 'قطع الاتصال',
    connecting: 'جاري الاتصال...',
    connectedTo: 'متصل بـ',
    balance: 'الرصيد',
    copyAddress: 'نسخ العنوان',
    viewExplorer: 'عرض في المتصفح',
    selectWallet: 'اختر المحفظة',
    selectWalletDesc: 'اختر المحفظة المفضلة للاتصال',
    metamask: 'MetaMask',
    metamaskDesc: 'محفظة إيثيريوم الأكثر شعبية',
    phantom: 'Phantom',
    phantomDesc: 'محفظة سولانا',
    solflare: 'Solflare',
    solflareDesc: 'محفظة سولانا',
    tronlink: 'TronLink',
    tronlinkDesc: 'محفظة ترون',
    walletConnect: 'WalletConnect',
    walletConnectDesc: 'ربط عبر رمز QR',
    coinbase: 'Coinbase Wallet',
    coinbaseDesc: 'تطبيق Coinbase',
    trustWallet: 'Trust Wallet',
    trustWalletDesc: 'محفظة الهاتف المحمول',
    copied: 'تم النسخ!',
    network: 'الشبكة',
    ethereum: 'إيثيريوم',
    polygon: 'بوليجون',
    bsc: 'BSC',
    solana: 'سولانا',
    tron: 'ترون',
    unknown: 'غير معروف'
  } : {
    connect: 'Connect Wallet',
    disconnect: 'Disconnect',
    connecting: 'Connecting...',
    connectedTo: 'Connected to',
    balance: 'Balance',
    copyAddress: 'Copy Address',
    viewExplorer: 'View on Explorer',
    selectWallet: 'Select Wallet',
    selectWalletDesc: 'Choose your preferred wallet to connect',
    metamask: 'MetaMask',
    metamaskDesc: 'Ethereum wallet',
    phantom: 'Phantom',
    phantomDesc: 'Solana wallet',
    solflare: 'Solflare',
    solflareDesc: 'Solana wallet',
    tronlink: 'TronLink',
    tronlinkDesc: 'Tron wallet',
    walletConnect: 'WalletConnect',
    walletConnectDesc: 'Connect via QR code',
    coinbase: 'Coinbase Wallet',
    coinbaseDesc: 'Coinbase app',
    trustWallet: 'Trust Wallet',
    trustWalletDesc: 'Mobile wallet',
    copied: 'Copied!',
    network: 'Network',
    ethereum: 'Ethereum',
    polygon: 'Polygon',
    bsc: 'BSC',
    solana: 'Solana',
    tron: 'Tron',
    unknown: 'Unknown'
  };

  const getNetworkName = (id) => {
    switch (id) {
      case 1: return t.ethereum;
      case 137: return t.polygon;
      case 56: return t.bsc;
      default: return `${t.unknown} (${id})`;
    }
  };

  const getExplorerUrl = (addr) => {
    if (walletType === 'solana') {
      return `https://solscan.io/address/${addr}`;
    } else if (walletType === 'tron') {
      return `https://tronscan.org/#/address/${addr}`;
    } else {
      // Ethereum-based
      switch (chainId) {
        case 1: return `https://etherscan.io/address/${addr}`;
        case 137: return `https://polygonscan.com/address/${addr}`;
        case 56: return `https://bscscan.com/address/${addr}`;
        default: return null;
      }
    }
  };

  const handleCopy = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectMetaMask = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.ethereum) {
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
      await connectWallet('ethereum', 'metamask');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleConnectPhantom = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.solana || !window.solana.isPhantom) {
        window.open('https://phantom.app/', '_blank');
        return;
      }
      await connectWallet('solana', 'phantom');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleConnectSolflare = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.solflare) {
        window.open('https://solflare.com/', '_blank');
        return;
      }
      await connectWallet('solana', 'solflare');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleConnectTronLink = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.tronWeb) {
        window.open('https://www.tronlink.org/', '_blank');
        return;
      }
      await connectWallet('tron', 'tronlink');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleConnectWalletConnect = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.ethereum) {
        toast.info('Please install a Web3 wallet first');
        return;
      }
      await connectWallet('ethereum', 'walletconnect');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleConnectCoinbase = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.ethereum) {
        window.open('https://www.coinbase.com/wallet', '_blank');
        return;
      }
      await connectWallet('ethereum', 'coinbase');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const handleConnectTrust = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.ethereum) {
        window.open('https://trustwallet.com/', '_blank');
        return;
      }
      await connectWallet('ethereum', 'trust');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  // Get currency symbol based on wallet type
  const getCurrencySymbol = () => {
    if (walletType === 'solana') return 'SOL';
    if (walletType === 'tron') return 'TRX';
    return 'ETH';
  };

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowConnectDialog(true)}
          disabled={isConnecting}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.connecting}
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              {t.connect}
            </>
          )}
        </Button>

        <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{t.selectWallet}</DialogTitle>
              <DialogDescription>{t.selectWalletDesc}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {/* MetaMask */}
              <button
                onClick={handleConnectMetaMask}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-lg p-2">
                  <img 
                    src="/wallets/metamask.svg" 
                    alt="MetaMask"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.metamask}</div>
                  <div className="text-xs text-muted-foreground">{t.metamaskDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>

              {/* Phantom */}
              <button
                onClick={handleConnectPhantom}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src="/wallets/phantom.svg" 
                    alt="Phantom"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.phantom}</div>
                  <div className="text-xs text-muted-foreground">{t.phantomDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>

              {/* Solflare */}
              <button
                onClick={handleConnectSolflare}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src="/wallets/solflare.svg" 
                    alt="Solflare"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.solflare}</div>
                  <div className="text-xs text-muted-foreground">{t.solflareDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>

              {/* TronLink */}
              <button
                onClick={handleConnectTronLink}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src="/wallets/tronlink.svg" 
                    alt="TronLink"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.tronlink}</div>
                  <div className="text-xs text-muted-foreground">{t.tronlinkDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>

              {/* WalletConnect */}
              <button
                onClick={handleConnectWalletConnect}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src="/wallets/walletconnect.svg" 
                    alt="WalletConnect"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.walletConnect}</div>
                  <div className="text-xs text-muted-foreground">{t.walletConnectDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>

              {/* Coinbase Wallet */}
              <button
                onClick={handleConnectCoinbase}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src="/wallets/coinbase.svg" 
                    alt="Coinbase"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.coinbase}</div>
                  <div className="text-xs text-muted-foreground">{t.coinbaseDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>

              {/* Trust Wallet */}
              <button
                onClick={handleConnectTrust}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-all hover:border-primary group"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                  <img 
                    src="/wallets/trust.svg" 
                    alt="Trust Wallet"
                    width={32}
                    height={32}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-foreground group-hover:text-primary">{t.trustWallet}</div>
                  <div className="text-xs text-muted-foreground">{t.trustWalletDesc}</div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {error && (
          <div className="text-xs text-destructive mt-1">{error}</div>
        )}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 font-semibold border-primary/20 hover:border-primary hover:bg-primary/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline font-mono">{formatAddress(account)}</span>
          <Badge variant="secondary" className="hidden md:inline-flex">
            {formatBalance(balance)} {getCurrencySymbol()}
          </Badge>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t.connectedTo}</span>
          <Badge variant="outline" className="text-xs">
            {networkName || getNetworkName(chainId)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.balance}</span>
            <span className="text-sm font-mono font-bold">{formatBalance(balance)} {getCurrencySymbol()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Address</span>
            <span className="text-sm font-mono">{formatAddress(account)}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
          {t.copyAddress}
        </DropdownMenuItem>
        {getExplorerUrl(account) && (
          <DropdownMenuItem asChild>
            <a
              href={getExplorerUrl(account)}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t.viewExplorer}
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t.disconnect}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

WalletButton.propTypes = {
  language: PropTypes.oneOf(['en', 'ar'])
};
