import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  RefreshCw, Wallet, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle2, Activity, Copy,
  ArrowDownToLine, QrCode, ChevronDown, ChevronUp,
  Info, ExternalLink, ArrowRightLeft
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OKXTransferModal from "./OKXTransferModal";

const CHAIN_NAMES = {
  'USDT-TRC20': 'Tron (TRC20)',
  'USDT-ERC20': 'Ethereum (ERC20)',
  'USDT-Polygon': 'Polygon',
  'USDT-Arbitrum One': 'Arbitrum',
  'USDT-Optimism': 'Optimism',
  'USDT-OKTC': 'OKT Chain',
  'USDT-Avalanche C-Chain': 'Avalanche C',
  'USDT-BNB Smart Chain(BEP20)': 'BSC (BEP20)',
  'USDT-CELO': 'Celo',
  'USDT-TON': 'TON',
  'USDT-Solana': 'Solana',
  'BTC-Bitcoin': 'Bitcoin',
  'BTC-Lightning Network': 'Lightning',
  'ETH-ERC20': 'Ethereum',
  'ETH-Arbitrum One': 'Arbitrum',
  'ETH-Optimism': 'Optimism',
  'ETH-zkSync Era': 'zkSync',
  'ETH-Linea': 'Linea',
  'ETH-Base': 'Base',
};

const CHAIN_FEES = {
  'USDT-TRC20': '~1 USDT',
  'USDT-ERC20': '~15 USDT',
  'USDT-Polygon': '~0.1 USDT',
  'USDT-Arbitrum One': '~0.5 USDT',
  'USDT-BNB Smart Chain(BEP20)': '~0.5 USDT',
  'USDT-Solana': '~1 USDT',
  'BTC-Bitcoin': '~0.0001 BTC',
  'ETH-ERC20': '~0.005 ETH',
};

export default function OKXLiveAccountCard({ language = "en", onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Deposit section state
  const [depositExpanded, setDepositExpanded] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState({});
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');
  const [selectedChain, setSelectedChain] = useState('');
  const [copied, setCopied] = useState(false);
  const [depositHistory, setDepositHistory] = useState([]);
  
  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const t = {
    en: {
      title: "Live Trading Account",
      subtitle: "OKX Futures Account",
      noAccount: "No live account assigned",
      noAccountDesc: "Contact support to get a live trading account assigned to you.",
      balance: "Balance",
      equity: "Total Equity",
      tradingBalance: "Trading",
      fundingBalance: "Funding",
      positions: "Open Positions",
      noPositions: "No open positions",
      tradeNow: "Trade Now",
      refresh: "Refresh",
      active: "Active",
      lastSync: "Last sync",
      leverage: "Leverage",
      unrealizedPnl: "Unrealized P&L",
      transfer: "Transfer",
      depositFunds: "Deposit Funds",
      selectCurrency: "Select Currency",
      selectNetwork: "Select Network",
      depositAddress: "Deposit Address",
      copyAddress: "Copy Address",
      minDeposit: "Min. Deposit",
      networkWarning: "Only send {ccy} via {chain}. Deposits from wrong networks will be lost permanently.",
      recentDeposits: "Recent Deposits",
      noDeposits: "No recent deposits",
      pending: "Pending",
      credited: "Credited",
      complete: "Complete",
      supportContact: "Need help? Contact support"
    },
    ar: {
      title: "حساب التداول المباشر",
      subtitle: "حساب OKX للعقود الآجلة",
      noAccount: "لا يوجد حساب مباشر",
      noAccountDesc: "تواصل مع الدعم للحصول على حساب تداول مباشر.",
      balance: "الرصيد",
      equity: "إجمالي الحقوق",
      tradingBalance: "التداول",
      fundingBalance: "التمويل",
      positions: "المراكز المفتوحة",
      noPositions: "لا توجد مراكز مفتوحة",
      tradeNow: "تداول الآن",
      refresh: "تحديث",
      active: "نشط",
      lastSync: "آخر مزامنة",
      leverage: "الرافعة",
      unrealizedPnl: "الربح غير المحقق",
      transfer: "تحويل",
      depositFunds: "إيداع الأموال",
      selectCurrency: "اختر العملة",
      selectNetwork: "اختر الشبكة",
      depositAddress: "عنوان الإيداع",
      copyAddress: "نسخ العنوان",
      minDeposit: "الحد الأدنى",
      networkWarning: "أرسل {ccy} عبر {chain} فقط. الإيداعات من شبكات خاطئة ستفقد نهائياً.",
      recentDeposits: "الإيداعات الأخيرة",
      noDeposits: "لا توجد إيداعات حديثة",
      pending: "معلق",
      credited: "مسجل",
      complete: "مكتمل",
      supportContact: "تحتاج مساعدة؟ تواصل مع الدعم"
    }
  }[language] || {};

  const loadAccount = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' });
      
      if (res.data?.ok && res.data.data?.hasAccount) {
        setAccountData(res.data.data);
        
        // Load positions
        const posRes = await base44.functions.invoke('okxUserAccount', { action: 'getPositions' });
        if (posRes.data?.ok) {
          setPositions(posRes.data.data || []);
        }
      } else {
        setAccountData(null);
      }
    } catch (err) {
      console.error('[OKXLiveAccountCard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAccount();
    setRefreshing(false);
    toast.success(language === 'ar' ? 'تم التحديث' : 'Refreshed');
    if (onRefresh) onRefresh();
  };

  const loadDepositAddresses = async (ccy) => {
    setLoadingAddresses(true);
    try {
      const res = await base44.functions.invoke('okxUserAccount', { 
        action: 'getDepositAddress',
        ccy 
      });
      
      if (res.data?.ok && res.data.data) {
        setDepositAddresses(prev => ({
          ...prev,
          [ccy]: res.data.data
        }));
        
        // Auto-select first chain if not selected
        if (res.data.data.length > 0 && !selectedChain) {
          // Prefer TRC20 for USDT
          const trc20 = res.data.data.find(a => a.chain.includes('TRC20'));
          setSelectedChain(trc20?.chain || res.data.data[0].chain);
        }
      }
    } catch (err) {
      console.error('[OKXLiveAccountCard] Load addresses error:', err);
      toast.error(language === 'ar' ? 'فشل تحميل العناوين' : 'Failed to load addresses');
    } finally {
      setLoadingAddresses(false);
    }
  };

  const loadDepositHistory = async () => {
    try {
      const res = await base44.functions.invoke('okxUserAccount', { 
        action: 'getDepositHistory',
        limit: 5
      });
      
      if (res.data?.ok) {
        setDepositHistory(res.data.data || []);
      }
    } catch (err) {
      console.error('[OKXLiveAccountCard] Load history error:', err);
    }
  };

  useEffect(() => {
    if (depositExpanded && accountData?.hasAccount) {
      if (!depositAddresses[selectedCurrency]) {
        loadDepositAddresses(selectedCurrency);
      }
      loadDepositHistory();
    }
  }, [depositExpanded, selectedCurrency, accountData?.hasAccount]);

  const handleCurrencyChange = (ccy) => {
    setSelectedCurrency(ccy);
    setSelectedChain('');
    if (!depositAddresses[ccy]) {
      loadDepositAddresses(ccy);
    } else {
      // Select default chain for this currency
      const addresses = depositAddresses[ccy];
      if (addresses?.length > 0) {
        const trc20 = addresses.find(a => a.chain.includes('TRC20'));
        setSelectedChain(trc20?.chain || addresses[0].chain);
      }
    }
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(language === 'ar' ? 'تم النسخ!' : 'Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUsdt = (val) => {
    if (val === null || val === undefined) return '0.00';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalUpl = positions.reduce((sum, p) => sum + (p.upl || 0), 0);

  const currentAddresses = depositAddresses[selectedCurrency] || [];
  const selectedAddress = currentAddresses.find(a => a.chain === selectedChain);
  const chainDisplayName = CHAIN_NAMES[selectedChain] || selectedChain?.split('-').pop() || selectedChain;

  if (loading) {
    return (
      <Card className="border-border shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 p-5">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!accountData?.hasAccount) {
    return (
      <Card className="border-border shadow-lg rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{t.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t.noAccount}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.noAccountDesc}</p>
            <a 
              href="mailto:support@nexttrade.exchange" 
              className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="h-3 w-3" />
              {t.supportContact}
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{t.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{accountData.accountLabel || accountData.externalAccountId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t.active}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">{t.equity}</p>
            <p className="text-2xl font-bold text-foreground">
              ${formatUsdt(accountData.balances?.totalEquity || accountData.balances?.totalUsdt)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{t.unrealizedPnl}</p>
            <p className={`text-2xl font-bold ${totalUpl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalUpl >= 0 ? '+' : ''}{formatUsdt(totalUpl)}
            </p>
          </div>
        </div>

        {/* Detailed Balances */}
        <div className="rounded-xl bg-muted/20 border border-border/50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.tradingBalance}</span>
            <span className="font-mono font-medium">${formatUsdt(accountData.balances?.tradingUsdt)} USDT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t.fundingBalance}</span>
            <span className="font-mono font-medium">${formatUsdt(accountData.balances?.fundingUsdt)} USDT</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-border/50">
            <span className="text-muted-foreground">{t.leverage}</span>
            <span className="font-medium">{accountData.defaultLeverage || 5}x</span>
          </div>
        </div>

        {/* Action Buttons: Transfer & Deposit */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => setTransferModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border-border hover:bg-muted"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {t.transfer}
          </Button>
          <Button
            variant="outline"
            onClick={() => setDepositExpanded(!depositExpanded)}
            className="flex items-center justify-center gap-2 rounded-xl border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600"
          >
            <ArrowDownToLine className="h-4 w-4" />
            {t.depositFunds}
          </Button>
        </div>

        {/* Deposit Section - Collapsible */}
        {depositExpanded && (
        <div className="rounded-xl border border-blue-500/30 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-foreground">{t.depositFunds}</span>
            </div>
            <button onClick={() => setDepositExpanded(false)}>
              <ChevronUp className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          
          {depositExpanded && (
            <div className="p-4 space-y-4 bg-card/50">
              {/* Currency Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t.selectCurrency}</label>
                <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">USDT (Tether)</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="BTC">BTC (Bitcoin)</SelectItem>
                    <SelectItem value="ETH">ETH (Ethereum)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Network Selection */}
              {currentAddresses.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t.selectNetwork}</label>
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentAddresses.map((addr) => (
                        <SelectItem key={addr.chain} value={addr.chain}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{CHAIN_NAMES[addr.chain] || addr.chain.split('-').pop()}</span>
                            {CHAIN_FEES[addr.chain] && (
                              <span className="text-xs text-muted-foreground">Fee: {CHAIN_FEES[addr.chain]}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Loading State */}
              {loadingAddresses && (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}

              {/* Deposit Address Display */}
              {selectedAddress && !loadingAddresses && (
                <div className="space-y-3">
                  {/* QR Code Placeholder */}
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <div className="w-32 h-32 flex items-center justify-center bg-slate-100 rounded-lg">
                      <QrCode className="w-full h-full p-3 text-slate-400" />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="rounded-lg bg-muted/30 border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{t.depositAddress}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(selectedAddress.address)}
                        className="h-7 px-2"
                      >
                        {copied ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span className="ml-1 text-xs">{t.copyAddress}</span>
                      </Button>
                    </div>
                    <code className="text-sm font-mono text-foreground break-all block">
                      {selectedAddress.address}
                    </code>
                    
                    {selectedAddress.tag && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Memo/Tag</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopy(selectedAddress.tag)}
                            className="h-6 px-2"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-sm font-mono text-foreground">{selectedAddress.tag}</code>
                      </div>
                    )}
                  </div>

                  {/* Min Deposit */}
                  {selectedAddress.minDeposit && (
                    <div className="flex items-center justify-between text-sm px-1">
                      <span className="text-muted-foreground">{t.minDeposit}</span>
                      <span className="font-mono font-medium">{selectedAddress.minDeposit} {selectedCurrency}</span>
                    </div>
                  )}

                  {/* Warning */}
                  <div className="flex items-start gap-2 p-3 bg-amber-100/40 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t.networkWarning
                        .replace('{ccy}', selectedCurrency)
                        .replace('{chain}', chainDisplayName)}
                    </p>
                  </div>
                </div>
              )}

              {/* Recent Deposits */}
              {depositHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <h4 className="text-sm font-semibold text-foreground">{t.recentDeposits}</h4>
                  <div className="space-y-2">
                    {depositHistory.map((dep, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{dep.amount} {dep.ccy}</span>
                          <span className="text-xs text-muted-foreground ml-2">{dep.chain}</span>
                        </div>
                        <Badge variant="outline" className={`text-xs ${
                          dep.state === '2' ? 'text-emerald-600 border-emerald-300' :
                          dep.state === '1' ? 'text-blue-600 border-blue-300' :
                          'text-amber-600 border-amber-300'
                        }`}>
                          {dep.stateLabel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Positions */}
        {positions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              {t.positions} ({positions.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-auto">
              {positions.slice(0, 3).map((pos, idx) => (
                <div key={idx} className="rounded-lg bg-muted/30 border border-border/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{pos.instId}</span>
                      <Badge className={`text-xs ${pos.posSide === 'long' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                        {pos.posSide === 'long' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {pos.posSide?.toUpperCase()}
                      </Badge>
                    </div>
                    <span className={`text-sm font-mono font-medium ${pos.upl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {pos.upl >= 0 ? '+' : ''}{formatUsdt(pos.upl)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Size: {pos.size}</span>
                    <span>Entry: ${formatUsdt(pos.avgPx)}</span>
                    <span>{pos.lever}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl">
            <Link to={createPageUrl("Futures")}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {t.tradeNow}
            </Link>
          </Button>
        </div>

        {/* Last Sync */}
        {accountData.lastSync && (
          <p className="text-xs text-muted-foreground text-center">
            {t.lastSync}: {new Date(accountData.lastSync).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
          </p>
        )}
      </CardContent>
      
      {/* Transfer Modal */}
      <OKXTransferModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        language={language}
        onSuccess={() => {
          loadAccount();
          if (onRefresh) onRefresh();
        }}
      />
    </Card>
  );
}

OKXLiveAccountCard.propTypes = {
  language: PropTypes.string,
  onRefresh: PropTypes.func
};