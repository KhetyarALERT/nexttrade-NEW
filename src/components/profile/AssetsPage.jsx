import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Search,
  RefreshCw,
  Copy,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Info,
  QrCode
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import CryptoIcon from "@/components/ui/CryptoIcon";
import SpotWalletView from "@/components/profile/SpotWalletView";
import FuturesWalletView from "@/components/profile/FuturesWalletView";

const NETWORK_CONFIG = {
  TRC20: { name: "Tron (TRC20)", fee: "1 USDT", time: "~1 min" },
  ERC20: { name: "Ethereum (ERC20)", fee: "~15 USDT", time: "~5 min" },
  BEP20: { name: "BSC (BEP20)", fee: "~0.5 USDT", time: "~1 min" },
  BTC: { name: "Bitcoin", fee: "~5 USDT", time: "~30 min" },
  SOL: { name: "Solana", fee: "~0.01 SOL", time: "~1 min" },
  XRP: { name: "XRP Ledger", fee: "~0.1 XRP", time: "~5 sec" }
};

export default function AssetsPage({ wallets = [], language = "en", onRefresh, liveAccount, trades = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [activeTab, setActiveTab] = useState("main");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState("USDT");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositData, setDepositData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [addressValid, setAddressValid] = useState(null);
  const [validatingAddress, setValidatingAddress] = useState(false);

  // Fetch available currencies from NOWPayments
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const result = await base44.functions.invoke('wallet', { action: 'getSupportedCurrencies' });
        if (result.data?.success) {
          setAvailableCurrencies(result.data.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch currencies", err);
      }
    };
    fetchCurrencies();
  }, []);

  // Calculate totals
  const calculateTotal = () => {
    return wallets.reduce((sum, w) => {
      if (w.currency === 'USDT' || w.currency === 'USDC') return sum + (w.balance || 0);
      if (w.currency === 'BTC') return sum + (w.balance || 0) * 95000;
      if (w.currency === 'ETH') return sum + (w.balance || 0) * 3400;
      return sum + (w.balance || 0);
    }, 0);
  };

  // Get unique currencies from available list
  const getUniqueCurrencies = () => {
    const unique = [];
    availableCurrencies.forEach(c => {
      if (!unique.find(u => u.currency === c.currency)) {
        unique.push(c);
      }
    });
    return unique;
  };

  // Get networks for currency
  const getNetworksForCurrency = (currency) => {
    return availableCurrencies.filter(c => c.currency === currency);
  };

  // Filter wallets
  const filteredWallets = wallets.filter(w => {
    if (searchTerm && !w.currency.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (hideSmallBalances && (w.balance || 0) < 1) return false;
    return true;
  });

  // Group by currency
  const groupedWallets = filteredWallets.reduce((acc, w) => {
    if (!acc[w.currency]) acc[w.currency] = [];
    acc[w.currency].push(w);
    return acc;
  }, {});

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const validateWithdrawAddress = async () => {
    if (!withdrawAddress || !selectedCurrency || !selectedNetwork) return;
    setValidatingAddress(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'validateAddress',
        address: withdrawAddress,
        currency: selectedCurrency,
        network: selectedNetwork
      });
      setAddressValid(result.data?.data?.valid || false);
    } catch {
      setAddressValid(null);
    } finally {
      setValidatingAddress(false);
    }
  };

  const handleGetDepositAddress = async () => {
    if (!selectedNetwork) {
      toast.error("Please select a network");
      return;
    }
    setLoading(true);
    setDepositData(null);
    
    try {
      let wallet = wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork);
      
      if (!wallet && liveAccount) {
        const createResult = await base44.functions.invoke('wallet', {
          action: 'create',
          tradingAccountId: liveAccount.id,
          currency: selectedCurrency,
          network: selectedNetwork
        });
        if (createResult.data?.success) {
          wallet = createResult.data.data;
          if (onRefresh) onRefresh();
        }
      }
      
      if (!wallet) {
        toast.error("Failed to get wallet");
        return;
      }
      
      const result = await base44.functions.invoke('wallet', {
        action: 'getDepositAddress',
        walletId: wallet.id,
        amount: 100
      });
      
      if (result.data?.success) {
        setDepositData(result.data.data);
      } else {
        toast.error(result.data?.error || "Failed to generate address");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedNetwork || !withdrawAddress || !amount) {
      toast.error("Please fill all fields");
      return;
    }
    
    const wallet = wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork);
    if (!wallet) {
      toast.error("Wallet not found");
      return;
    }
    
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'withdraw',
        walletId: wallet.id,
        amount: parseFloat(amount),
        destinationAddress: withdrawAddress
      });
      
      if (result.data?.success) {
        toast.success(`Withdrawal submitted. Fee: ${result.data.data.fee}`);
        setActiveModal(null);
        resetForm();
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Withdrawal failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setWithdrawAddress("");
    setAddressValid(null);
    setDepositData(null);
    setSelectedNetwork("");
  };

  const formatBalance = (val) => {
    if (!showBalances) return "****";
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatUSD = (val) => {
    if (!showBalances) return "****";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const networks = getNetworksForCurrency(selectedCurrency);

  useEffect(() => {
    if (networks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(networks[0].network);
    }
  }, [selectedCurrency, networks.length]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#1a1a2e] rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-400 text-sm">Total Balance</span>
              <button onClick={() => setShowBalances(!showBalances)} className="text-slate-400 hover:text-white">
                {showBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{formatUSD(calculateTotal())}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setActiveModal('deposit'); resetForm(); }} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
              <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Deposit
            </Button>
            <Button onClick={() => { setActiveModal('withdraw'); resetForm(); }} variant="outline" className="border-slate-600 text-white hover:bg-slate-800 flex-1 sm:flex-none">
              <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Withdraw
            </Button>
            <Button onClick={() => setActiveModal('transfer')} variant="outline" className="border-slate-600 text-white hover:bg-slate-800 flex-1 sm:flex-none">
              <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Transfer
            </Button>
          </div>
        </div>
      </div>

      {/* Wallet Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-[#1a1a2e] p-1 rounded-lg overflow-x-auto">
          <TabsTrigger value="main" className="text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Wallet className="w-4 h-4 mr-1.5" /> Main Wallet
          </TabsTrigger>
          <TabsTrigger value="spot" className="text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Spot
          </TabsTrigger>
          <TabsTrigger value="futures" className="text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Futures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-4">
          <AssetsTable 
            wallets={groupedWallets}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            hideSmallBalances={hideSmallBalances}
            setHideSmallBalances={setHideSmallBalances}
            formatBalance={formatBalance}
            formatUSD={formatUSD}
            onDeposit={(currency) => { setSelectedCurrency(currency); setActiveModal('deposit'); resetForm(); }}
            onWithdraw={(currency) => { setSelectedCurrency(currency); setActiveModal('withdraw'); resetForm(); }}
          />
        </TabsContent>

        <TabsContent value="spot" className="mt-4">
          <SpotWalletView 
            spotBalance={0}
            onDeposit={() => { setActiveModal('deposit'); resetForm(); }}
            onWithdraw={() => { setActiveModal('withdraw'); resetForm(); }}
            showBalances={showBalances}
          />
        </TabsContent>

        <TabsContent value="futures" className="mt-4">
          <FuturesWalletView 
            tradingAccount={liveAccount}
            trades={trades}
            showBalances={showBalances}
            onTransfer={() => setActiveModal('transfer')}
            onRefresh={onRefresh}
          />
        </TabsContent>
      </Tabs>

      {/* Deposit Modal */}
      <Dialog open={activeModal === 'deposit'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md bg-[#1a1a2e] border-slate-700 text-white max-h-[90vh] overflow-y-auto" aria-describedby="deposit-desc">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-blue-500" /> Deposit
            </DialogTitle>
          </DialogHeader>
          <p id="deposit-desc" className="sr-only">Deposit cryptocurrency to your wallet</p>
          
          <div className="space-y-5">
            {/* Step 1: Select Crypto */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                <span className="font-medium">Select crypto</span>
              </div>
              
              <Select value={selectedCurrency} onValueChange={(v) => { setSelectedCurrency(v); setSelectedNetwork(''); setDepositData(null); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {getUniqueCurrencies().map((c) => (
                    <SelectItem key={c.currency} value={c.currency} className="text-white hover:bg-slate-700">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={c.currency} size="sm" />
                        {c.currency}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-2">
                {getUniqueCurrencies().slice(0, 5).map((c) => (
                  <button
                    key={c.currency}
                    onClick={() => { setSelectedCurrency(c.currency); setSelectedNetwork(''); setDepositData(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedCurrency === c.currency ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <CryptoIcon currency={c.currency} size="xs" />
                    {c.currency}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Network */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">2</div>
                <span className="font-medium">Select network</span>
              </div>
              
              <Select value={selectedNetwork} onValueChange={(v) => { setSelectedNetwork(v); setDepositData(null); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {networks.map((n) => (
                    <SelectItem key={n.network} value={n.network} className="text-white hover:bg-slate-700">
                      {NETWORK_CONFIG[n.network]?.name || n.network}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedNetwork && (
                <div className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Ensure you choose the same network on the withdrawal platform.</span>
                </div>
              )}
            </div>

            {/* Step 3: Deposit Info */}
            {selectedNetwork && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">3</div>
                  <span className="font-medium">Deposit info</span>
                </div>
                
                {!depositData && !loading && (
                  <Button onClick={handleGetDepositAddress} className="w-full bg-blue-600 hover:bg-blue-700">
                    Generate Deposit Address
                  </Button>
                )}
                
                {loading && (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                )}
                
                {depositData && (
                  <div className="space-y-4">
                    {depositData.pay_address && (
                      <>
                        <div className="flex justify-center p-4 bg-white rounded-lg">
                          <div className="w-40 h-40 flex items-center justify-center bg-slate-100 rounded-lg">
                            <QrCode className="w-full h-full p-2 text-slate-400" />
                          </div>
                        </div>
                        
                        <div className="p-4 bg-slate-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400 text-sm">Deposit Address</span>
                            <Button variant="ghost" size="sm" onClick={() => handleCopy(depositData.pay_address)} className="text-blue-400 h-auto p-1">
                              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <code className="text-white text-xs break-all block">{depositData.pay_address}</code>
                        </div>
                      </>
                    )}
                    
                    {!depositData.pay_address && depositData.invoice_url && (
                      <a 
                        href={depositData.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Open Payment Page to View Address
                      </a>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2 bg-slate-800 rounded">
                        <span className="text-slate-400 block">Minimum</span>
                        <span className="text-white font-medium">&ge; {depositData.min_deposit || 1} {selectedCurrency}</span>
                      </div>
                      <div className="p-2 bg-slate-800 rounded">
                        <span className="text-slate-400 block">Receiving</span>
                        <span className="text-white font-medium">Fund Account</span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-200">
                        Send only {selectedCurrency} via {NETWORK_CONFIG[selectedNetwork]?.name || selectedNetwork}. Other assets will be lost permanently.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={activeModal === 'withdraw'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md bg-[#1a1a2e] border-slate-700 text-white max-h-[90vh] overflow-y-auto" aria-describedby="withdraw-desc">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ArrowUpFromLine className="w-5 h-5 text-orange-500" /> Withdraw
            </DialogTitle>
          </DialogHeader>
          <p id="withdraw-desc" className="sr-only">Withdraw cryptocurrency from your wallet</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">Coin</label>
              <Select value={selectedCurrency} onValueChange={(v) => { setSelectedCurrency(v); setSelectedNetwork(''); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {getUniqueCurrencies().map((c) => (
                    <SelectItem key={c.currency} value={c.currency} className="text-white hover:bg-slate-700">
                      <div className="flex items-center gap-2">
                        <CryptoIcon currency={c.currency} size="sm" />
                        {c.currency}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">Network</label>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {networks.map((n) => (
                    <SelectItem key={n.network} value={n.network} className="text-white hover:bg-slate-700">
                      {NETWORK_CONFIG[n.network]?.name || n.network}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">Withdrawal address</label>
              <div className="relative">
                <Input
                  value={withdrawAddress}
                  onChange={(e) => { setWithdrawAddress(e.target.value); setAddressValid(null); }}
                  onBlur={validateWithdrawAddress}
                  placeholder="Enter address"
                  className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10 ${
                    addressValid === true ? 'border-emerald-500' : addressValid === false ? 'border-red-500' : ''
                  }`}
                />
                {validatingAddress && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                {!validatingAddress && addressValid === true && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
                {!validatingAddress && addressValid === false && <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
            </div>
            
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">Amount</label>
              <div className="relative">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-16"
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm"
                  onClick={() => {
                    const wallet = wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork);
                    if (wallet) setAmount(String(wallet.balance || 0));
                  }}
                >
                  Max
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Available: {formatBalance(wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork)?.balance || 0)} {selectedCurrency}
              </p>
            </div>

            <Button onClick={handleWithdraw} disabled={loading || !withdrawAddress || !amount || !selectedNetwork} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Withdraw
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={activeModal === 'transfer'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md bg-[#1a1a2e] border-slate-700 text-white" aria-describedby="transfer-desc">
          <DialogHeader>
            <DialogTitle className="text-white">Internal Transfer</DialogTitle>
          </DialogHeader>
          <p id="transfer-desc" className="text-slate-400 text-sm">Transfer between Main, Spot, and Futures wallets (0 fees)</p>
          
          <div className="space-y-4 py-2">
            <div className="p-4 bg-slate-800/50 rounded-lg text-center text-slate-400">
              Coming soon - Transfer between wallet types
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Assets Table Component
function AssetsTable({ wallets, searchTerm, setSearchTerm, hideSmallBalances, setHideSmallBalances, formatBalance, formatUSD, onDeposit, onWithdraw }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search coin"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer whitespace-nowrap">
            <Checkbox checked={hideSmallBalances} onCheckedChange={setHideSmallBalances} className="border-slate-600" />
            Hide small balances
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
              <th className="px-4 py-3 font-medium">Coin</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(wallets).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No assets. Click Deposit to add funds.
                </td>
              </tr>
            ) : (
              Object.entries(wallets).map(([currency, currencyWallets]) => {
                const totalAmount = currencyWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
                const usdValue = currency === 'BTC' ? totalAmount * 95000 : currency === 'ETH' ? totalAmount * 3400 : totalAmount;
                
                return (
                  <tr key={currency} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CryptoIcon currency={currency} size="md" />
                        <div>
                          <div className="text-white font-medium">{currency}</div>
                          <div className="text-slate-500 text-xs">{currencyWallets[0]?.network}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white">{formatBalance(totalAmount)}</div>
                      <div className="text-slate-500 text-xs">{formatUSD(usdValue)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => onDeposit(currency)} className="text-blue-400 hover:text-blue-300 text-sm">
                          Deposit
                        </button>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => onWithdraw(currency)} className="text-blue-400 hover:text-blue-300 text-sm">
                          Withdraw
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

AssetsPage.propTypes = {
  wallets: PropTypes.array,
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  liveAccount: PropTypes.object,
  trades: PropTypes.array
};

AssetsTable.propTypes = {
  wallets: PropTypes.object,
  searchTerm: PropTypes.string,
  setSearchTerm: PropTypes.func,
  hideSmallBalances: PropTypes.bool,
  setHideSmallBalances: PropTypes.func,
  formatBalance: PropTypes.func,
  formatUSD: PropTypes.func,
  onDeposit: PropTypes.func,
  onWithdraw: PropTypes.func
};