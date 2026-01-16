import { useState, useEffect } from 'react';
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
import { useWalletConnect } from '@/lib/web3/WalletConnectProvider';
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Detect mobile/PWA environment
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Deep link URLs for mobile wallets
const getPhantomDeepLink = () => {
  const currentUrl = encodeURIComponent(window.location.href);
  if (isMobile()) {
    // Universal link that works on both iOS and Android
    return `https://phantom.app/ul/browse/${currentUrl}`;
  }
  return null;
};

const getSolflareDeepLink = () => {
  const currentUrl = encodeURIComponent(window.location.href);
  if (isMobile()) {
    return `https://solflare.com/ul/v1/browse/${currentUrl}`;
  }
  return null;
};

export function WalletButton({ language = 'en', className = '' }) {
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
  const { enabled: walletConnectEnabled, initError: walletConnectError } = useWalletConnect();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(isMobile());
  }, []);

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
    openInApp: 'افتح في التطبيق',
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
    openInApp: 'Open in App',
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

  // Handle Phantom connection with mobile deep link support
  const handleConnectPhantom = async () => {
    setShowConnectDialog(false);
    
    // Check if Phantom is available as extension/provider
    const phantomAvailable = window.solana && window.solana.isPhantom;
    
    if (phantomAvailable) {
      // Extension available - connect directly
      try {
        await connectWallet('solana', 'phantom');
      } catch (err) {
        toast.error(err.message || 'Failed to connect');
      }
    } else if (isMobileDevice) {
      // Mobile without extension - use deep link
      const deepLink = getPhantomDeepLink();
      if (deepLink) {
        window.location.href = deepLink;
      } else {
        window.open('https://phantom.app/', '_blank');
      }
    } else {
      // Desktop without extension - open download page
      window.open('https://phantom.app/', '_blank');
    }
  };

  // Handle Solflare connection with mobile deep link support
  const handleConnectSolflare = async () => {
    setShowConnectDialog(false);
    
    const solflareAvailable = Boolean(window.solflare && /** @type {any} */ (window.solflare).isSolflare);
    
    if (solflareAvailable) {
      try {
        await connectWallet('solana', 'solflare');
      } catch (err) {
        toast.error(err.message || 'Failed to connect');
      }
    } else if (isMobileDevice) {
      const deepLink = getSolflareDeepLink();
      if (deepLink) {
        window.location.href = deepLink;
      } else {
        window.open('https://solflare.com/', '_blank');
      }
    } else {
      window.open('https://solflare.com/', '_blank');
    }
  };

  const handleConnectMetaMask = async () => {
    setShowConnectDialog(false);
    try {
      if (!window.ethereum) {
        if (isMobileDevice) {
          // MetaMask mobile deep link
          const dappUrl = window.location.href.replace(/^https?:\/\//, '');
          window.location.href = `https://metamask.app.link/dapp/${dappUrl}`;
        } else {
          window.open('https://metamask.io/download/', '_blank');
        }
        return;
      }
      await connectWallet('ethereum', 'metamask');
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
      if (!walletConnectEnabled || walletConnectError) {
        toast.warning(language === 'ar' ? 'WalletConnect غير متاح؛ استخدم Phantom أو Solflare' : 'WalletConnect unavailable; use Phantom/Solflare');
        return;
      }
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
        if (isMobileDevice) {
          window.location.href = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(window.location.href)}`;
        } else {
          window.open('https://www.coinbase.com/wallet', '_blank');
        }
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
        if (isMobileDevice) {
          window.location.href = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(window.location.href)}`;
        } else {
          window.open('https://trustwallet.com/', '_blank');
        }
        return;
      }
      await connectWallet('ethereum', 'trust');
    } catch (err) {
      toast.error(err.message || 'Failed to connect');
    }
  };

  const getCurrencySymbol = () => {
    if (walletType === 'solana') return 'SOL';
    if (walletType === 'tron') return 'TRX';
    return 'ETH';
  };

  // Wallet option component for cleaner rendering
  const WalletOption = ({ onClick, icon, name, desc, showMobileHint = false }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/50 transition-all hover:border-foreground/20 group w-full"
    >
      <div className="w-11 h-11 rounded-xl bg-background flex items-center justify-center flex-shrink-0 shadow-sm border border-border/30 overflow-hidden">
        <img 
          src={icon} 
          alt={name}
          className="w-7 h-7 object-contain"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>
      <div className="flex-1 text-left">
        <div className="font-semibold text-foreground group-hover:text-foreground/90">{name}</div>
        <div className="text-xs text-muted-foreground">
          {showMobileHint && isMobileDevice ? t.openInApp : desc}
        </div>
      </div>
      <ChevronDown className="h-4 w-4 text-muted-foreground/50 -rotate-90" />
    </button>
  );

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowConnectDialog(true)}
          disabled={isConnecting}
          variant="outline"
          className={`border-border/60 bg-background hover:bg-muted/50 text-foreground font-medium shadow-sm hover:shadow transition-all ${className}`}
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
          <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4">
              <DialogTitle className="text-xl font-bold">{t.selectWallet}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {t.selectWalletDesc}
              </DialogDescription>
            </DialogHeader>
            
            <div className="px-6 pb-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {/* Solana Wallets - Priority */}
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 mt-2">Solana</div>
              
              <WalletOption
                onClick={handleConnectPhantom}
                icon="/wallets/phantom.svg"
                name={t.phantom}
                desc={t.phantomDesc}
                showMobileHint
              />

              <WalletOption
                onClick={handleConnectSolflare}
                icon="/wallets/solflare.svg"
                name={t.solflare}
                desc={t.solflareDesc}
                showMobileHint
              />

              {/* Ethereum Wallets */}
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 mt-4">Ethereum</div>

              <WalletOption
                onClick={handleConnectMetaMask}
                icon="/wallets/metamask.svg"
                name={t.metamask}
                desc={t.metamaskDesc}
                showMobileHint
              />

              {walletConnectEnabled && !walletConnectError && (
                <WalletOption
                  onClick={handleConnectWalletConnect}
                  icon="/wallets/walletconnect.svg"
                  name={t.walletConnect}
                  desc={t.walletConnectDesc}
                />
              )}

              <WalletOption
                onClick={handleConnectCoinbase}
                icon="/wallets/coinbase.svg"
                name={t.coinbase}
                desc={t.coinbaseDesc}
                showMobileHint
              />

              <WalletOption
                onClick={handleConnectTrust}
                icon="/wallets/trust.svg"
                name={t.trustWallet}
                desc={t.trustWalletDesc}
                showMobileHint
              />

              {/* Tron */}
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 mt-4">Tron</div>

              <WalletOption
                onClick={handleConnectTronLink}
                icon="/wallets/tronlink.svg"
                name={t.tronlink}
                desc={t.tronlinkDesc}
              />
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
        <Button 
          variant="outline" 
          className={`gap-2 font-medium border-border/60 hover:border-foreground/20 hover:bg-muted/50 bg-background shadow-sm ${className}`}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="hidden sm:inline font-mono text-sm">{formatAddress(account)}</span>
          <Badge variant="secondary" className="hidden md:inline-flex text-xs bg-muted">
            {formatBalance(balance)} {getCurrencySymbol()}
          </Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-muted-foreground">{t.connectedTo}</span>
          <Badge variant="outline" className="text-xs font-medium">
            {networkName || getNetworkName(chainId)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.balance}</span>
            <span className="text-sm font-mono font-semibold">{formatBalance(balance)} {getCurrencySymbol()}</span>
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
        <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t.disconnect}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

WalletButton.propTypes = {
  language: PropTypes.oneOf(['en', 'ar']),
  className: PropTypes.string
};

// Default export for compatibility
export default WalletButton;
