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
  Info, ExternalLink, ArrowRightLeft, Shield, Clock, Rocket
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OKXTransferModal from "./OKXTransferModal";
import LiveAccountRequestForm from "./LiveAccountRequestForm";
import TradingAccountStepper from "./TradingAccountStepper";

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

export default function OKXLiveAccountCard({ language = "en", onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const [depositExpanded, setDepositExpanded] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState({});
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');
  const [selectedChain, setSelectedChain] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [existingRequest, setExistingRequest] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);

  const t = {
    en: {
      title: "Trading Account",
      subtitle: "Trade with your funds",
      noAccount: "No trading account assigned",
      noAccountDesc: "Request a trading account to start trading.",
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
      supportContact: "Need help? Contact support",
      requestLiveAccount: "Request Trading Account",
      requestLiveAccountDesc: "Complete the form to get a trading account",
      verifyFirst: "Verify Your Identity First",
      verifyFirstDesc: "You must verify your identity before requesting a trading account",
      requestPending: "Your Request is Under Review",
      requestPendingDesc: "We'll notify you when your request is processed",
      startTrading: "Start Trading",
      reapply: "Re-apply"
    },
    ar: {
      title: "حساب تداول",
      subtitle: "تداول بأموالك",
      noAccount: "لا يوجد حساب تداول",
      noAccountDesc: "اطلب حساب تداول لبدء التداول.",
      balance: "الرصيد",
      equity: "إجمالي الرصيد",
      tradingBalance: "التداول",
      fundingBalance: "التمويل",
      positions: "المراكز المفتوحة",
      noPositions: "لا توجد مراكز مفتوحة",
      tradeNow: "ابدأ التداول",
      refresh: "تحديث",
      active: "نشط",
      lastSync: "آخر تحديث",
      leverage: "الرافعة المالية",
      unrealizedPnl: "الأرباح غير المحققة",
      transfer: "تحويل",
      depositFunds: "إيداع أموال",
      selectCurrency: "اختر العملة",
      selectNetwork: "اختر الشبكة",
      depositAddress: "عنوان الإيداع",
      copyAddress: "نسخ العنوان",
      minDeposit: "الحد الأدنى للإيداع",
      networkWarning: "أرسل {ccy} عبر شبكة {chain} فقط. الإيداعات من شبكات خاطئة ستُفقد نهائياً.",
      recentDeposits: "الإيداعات الأخيرة",
      noDeposits: "لا توجد إيداعات حديثة",
      pending: "قيد الانتظار",
      credited: "تم الإيداع",
      complete: "مكتمل",
      supportContact: "تحتاج مساعدة؟ تواصل مع الدعم",
      requestLiveAccount: "طلب حساب تداول",
      requestLiveAccountDesc: "أكمل النموذج للحصول على حساب تداول",
      verifyFirst: "تحقق من هويتك أولاً",
      verifyFirstDesc: "يجب التحقق من هويتك قبل طلب حساب تداول",
      requestPending: "طلبك قيد المراجعة",
      requestPendingDesc: "سنُعلمك عند معالجة طلبك",
      startTrading: "ابدأ التداول",
      reapply: "إعادة التقديم"
    }
  }[language] || {};

  const loadAccount = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const res = await base44.functions.invoke('okxUserAccount', { action: 'getMyAccount' }).catch(() => ({ data: { ok: false } }));
      
      if (res.data?.ok && res.data.data?.hasAccount) {
        setAccountData(res.data.data);
        const posRes = await base44.functions.invoke('okxUserAccount', { action: 'getPositions' }).catch(() => ({ data: { ok: false } }));
        if (posRes.data?.ok) setPositions(posRes.data.data || []);
      } else {
        const liveAccounts = await base44.entities.TradingAccount.filter({ user_id: user.id, is_demo: false }, '-created_date', 1);
        if (liveAccounts?.length > 0) {
          const account = liveAccounts[0];
          setAccountData({
            hasAccount: true,
            accountLabel: account.nickname || 'Trading Account',
            externalAccountId: account.account_id,
            balances: {
              totalEquity: account.equity || account.balance || 0,
              totalUsdt: account.balance || 0,
              tradingUsdt: 0,
              fundingUsdt: account.balance || 0,
              perCcy: {}
            },
            defaultLeverage: account.default_leverage || 5,
            lastSync: account.updated_date,
            _source: 'internal'
          });
        } else {
          setAccountData(null);
        }
      }
    } catch (err) {
      console.error('[OKXLiveAccountCard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const loadRequestStatus = useCallback(async () => {
    setLoadingRequest(true);
    try {
      const user = await base44.auth.me();
      const requests = await base44.entities.LiveAccountRequest.filter({ user_id: user.id }, '-created_date', 1);
      if (requests && requests.length > 0) setExistingRequest(requests[0]);
      const uvRes = await base44.functions.invoke("verificationService", { action: "getStatus" });
      const uvData = uvRes.data?.ok && uvRes.data.data?.exists ? uvRes.data.data : null;
      setIsVerified(uvData?.status === 'verified');
    } catch (err) {
      console.error('[OKXLiveAccountCard] Load request status error:', err);
    } finally {
      setLoadingRequest(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
    loadRequestStatus();
    const unsubVerification = base44.entities.VerificationRequest.subscribe(() => loadRequestStatus());
    const unsubLiveRequest = base44.entities.LiveAccountRequest.subscribe(() => loadRequestStatus());
    return () => {
      unsubVerification();
      unsubLiveRequest();
    };
  }, [loadAccount, loadRequestStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAccount();
    onRefresh?.();
    setRefreshing(false);
    toast.success(language === 'ar' ? 'تم التحديث' : 'Account refreshed');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(language === 'ar' ? 'تم النسخ' : 'Address copied');
  };

  if (loading || loadingRequest) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!accountData) {
    return (
      <Card className="border-border/40 bg-card/30 overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 rounded-2xl bg-muted/30">
              <Rocket className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">{t.noAccount}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t.noAccountDesc}</p>
            </div>
            
            <div className="w-full max-w-md">
              <TradingAccountStepper 
                language={language} 
                isVerified={isVerified} 
                existingRequest={existingRequest} 
              />
            </div>

            {!isVerified ? (
              <Button asChild className="rounded-xl px-8 h-11">
                <Link to={createPageUrl("Profile", { tab: "security", openVerification: "true" })}>
                  <Shield className="h-4 w-4 mr-2" />
                  {t.verifyFirst}
                </Link>
              </Button>
            ) : existingRequest?.status === 'pending' || existingRequest?.status === 'under_review' ? (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center gap-3">
                <Clock className="h-5 w-5 animate-pulse" />
                <span className="text-sm font-bold">{t.requestPending}</span>
              </div>
            ) : (
              <Button onClick={() => setRequestFormOpen(true)} className="rounded-xl px-8 h-11">
                <Rocket className="h-4 w-4 mr-2" />
                {t.requestLiveAccount}
              </Button>
            )}
          </div>
        </CardContent>
        <LiveAccountRequestForm 
          open={requestFormOpen} 
          onOpenChange={setRequestFormOpen} 
          language={language} 
          onSuccess={loadRequestStatus} 
        />
      </Card>
    );
  }

  const balances = accountData.balances || {};

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/30 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{accountData.accountLabel || t.title}</CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] font-bold border-none bg-emerald-500/10 text-emerald-500">
                    {t.active}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">ID: {accountData.externalAccountId?.slice(0, 8)}...</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8 p-0 rounded-lg">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.equity}</p>
              <p className="text-2xl font-bold font-mono">${(balances.totalEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.fundingBalance}</p>
              <p className="text-2xl font-bold font-mono">${(balances.fundingUsdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.tradingBalance}</p>
              <p className="text-2xl font-bold font-mono">${(balances.tradingUsdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t border-border/40 p-4 gap-3">
          <Button onClick={() => setTransferModalOpen(true)} variant="outline" className="flex-1 rounded-lg h-10 font-bold border-border/40">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            {t.transfer}
          </Button>
          <Button asChild className="flex-1 rounded-lg h-10 font-bold">
            <Link to={createPageUrl("Futures")}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {t.tradeNow}
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Positions Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t.positions}
        </h3>
        {positions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {positions.map((pos, i) => (
              <Card key={i} className="border-border/40 bg-card/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{pos.symbol}</span>
                      <Badge variant="outline" className={`text-[10px] border-none ${pos.side === 'long' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {pos.side?.toUpperCase()} {pos.lever}x
                      </Badge>
                    </div>
                    <span className={`font-mono font-bold ${Number(pos.upl) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {Number(pos.upl) >= 0 ? '+' : ''}{Number(pos.upl).toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="text-foreground font-mono">{pos.sz}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entry:</span>
                      <span className="text-foreground font-mono">${Number(pos.avgPx).toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border/40 bg-transparent">
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">{t.noPositions}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <OKXTransferModal 
        open={transferModalOpen} 
        onOpenChange={setTransferModalOpen} 
        language={language} 
        onSuccess={loadAccount} 
      />
    </div>
  );
}

OKXLiveAccountCard.propTypes = {
  language: PropTypes.string,
  onRefresh: PropTypes.func
};
