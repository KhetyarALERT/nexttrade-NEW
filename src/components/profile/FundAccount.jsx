import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Eye,
  EyeOff,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// Currency configurations with proper icons (no emojis)
const CURRENCY_CONFIG = {
  USDT: { name: "Tether", color: "#26A17B", icon: "T" },
  BTC: { name: "Bitcoin", color: "#F7931A", icon: "B" },
  ETH: { name: "Ethereum", color: "#627EEA", icon: "E" },
  BNB: { name: "BNB", color: "#F3BA2F", icon: "B" },
  SOL: { name: "Solana", color: "#9945FF", icon: "S" },
  XRP: { name: "Ripple", color: "#23292F", icon: "X" },
  USDC: { name: "USD Coin", color: "#2775CA", icon: "U" },
  TRX: { name: "Tron", color: "#FF0013", icon: "T" }
};

const NETWORK_CONFIG = {
  TRC20: { name: "Tron (TRC20)", fee: "1 USDT", time: "~1 min" },
  ERC20: { name: "Ethereum (ERC20)", fee: "~15 USDT", time: "~5 min" },
  BEP20: { name: "BNB Smart Chain (BEP20)", fee: "~0.5 USDT", time: "~1 min" },
  BTC: { name: "Bitcoin", fee: "~5 USDT", time: "~30 min" },
  SOL: { name: "Solana", fee: "~0.01 SOL", time: "~1 min" },
  XRP: { name: "XRP Ledger", fee: "~0.1 XRP", time: "~5 sec" }
};

// Sample chart data
const chartData = Array.from({ length: 30 }, (_, i) => ({
  value: 10000 + Math.random() * 2000 - 1000 + i * 50
}));

export default function FundAccount({ wallets = [], language = "en", onRefresh, liveAccount }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'deposit' | 'withdraw' | 'transfer'
  const [selectedCurrency, setSelectedCurrency] = useState("USDT");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositData, setDepositData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");

  // Calculate totals
  const totalBalance = wallets.reduce((sum, w) => {
    // Simplified - in production would use real exchange rates
    if (w.currency === 'USDT' || w.currency === 'USDC') return sum + (w.balance || 0);
    if (w.currency === 'BTC') return sum + (w.balance || 0) * 95000;
    if (w.currency === 'ETH') return sum + (w.balance || 0) * 3400;
    return sum + (w.balance || 0);
  }, 0);

  const todayPnL = 234.56; // Sample

  // Get available networks for selected currency
  const getNetworksForCurrency = (currency) => {
    const networks = [];
    wallets.forEach(w => {
      if (w.currency === currency && !networks.includes(w.network)) {
        networks.push(w.network);
      }
    });
    if (networks.length === 0) {
      // Default networks per currency
      if (currency === 'USDT') return ['TRC20', 'ERC20', 'BEP20'];
      if (currency === 'BTC') return ['BTC'];
      if (currency === 'ETH') return ['ERC20'];
      if (currency === 'BNB') return ['BEP20'];
      if (currency === 'SOL') return ['SOL'];
      if (currency === 'XRP') return ['XRP'];
    }
    return networks;
  };

  // Filter wallets
  const filteredWallets = wallets.filter(w => {
    if (searchTerm && !w.currency.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (hideSmallBalances && (w.balance || 0) < 1) return false;
    return true;
  });

  // Group wallets by currency
  const groupedWallets = filteredWallets.reduce((acc, w) => {
    if (!acc[w.currency]) acc[w.currency] = [];
    acc[w.currency].push(w);
    return acc;
  }, {});

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGetDepositAddress = async () => {
    if (!selectedNetwork) {
      toast.error("Please select a network");
      return;
    }
    
    setLoading(true);
    setDepositData(null);
    
    try {
      // Find or create wallet for this currency/network
      let wallet = wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork);
      
      if (!wallet && liveAccount) {
        // Create wallet first
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

  const [addressValid, setAddressValid] = useState(null);
  const [validatingAddress, setValidatingAddress] = useState(false);

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
        setAmount("");
        setWithdrawAddress("");
        setAddressValid(null);
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

  const handleTransfer = async () => {
    if (!transferFrom || !transferTo || !amount) {
      toast.error("Please fill all fields");
      return;
    }
    
    setLoading(true);
    try {
      const result = await base44.functions.invoke('wallet', {
        action: 'transfer',
        fromWalletId: transferFrom,
        toWalletId: transferTo,
        amount: parseFloat(amount)
      });
      
      if (result.data?.success) {
        toast.success("Transfer completed");
        setActiveModal(null);
        setAmount("");
        if (onRefresh) onRefresh();
      } else {
        toast.error(result.data?.error || "Transfer failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
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

  const availableNetworks = getNetworksForCurrency(selectedCurrency);

  useEffect(() => {
    if (availableNetworks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(availableNetworks[0]);
    }
  }, [selectedCurrency, availableNetworks]);

  return (
    <div className="space-y-6">
      {/* Header with Total Assets */}
      <div className="bg-[#1a1a2e] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-400 text-sm">Total Assets</span>
              <button onClick={() => setShowBalances(!showBalances)} className="text-slate-400 hover:text-white">
                {showBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatUSD(totalBalance)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-400 text-sm">Today's PnL</span>
              <span className={`text-sm font-medium ${todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {todayPnL >= 0 ? '+' : ''}{formatUSD(todayPnL)}
              </span>
            </div>
          </div>
          <div className="w-48 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={() => { setActiveModal('deposit'); setDepositData(null); }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Deposit
          </Button>
          <Button 
            onClick={() => setActiveModal('withdraw')}
            variant="outline" 
            className="border-slate-600 text-white hover:bg-slate-800"
          >
            Withdraw
          </Button>
          <Button 
            onClick={() => setActiveModal('transfer')}
            variant="outline" 
            className="border-slate-600 text-white hover:bg-slate-800"
          >
            Transfer
          </Button>
          <Button 
            variant="outline" 
            className="border-slate-600 text-white hover:bg-slate-800"
            disabled
          >
            Convert
          </Button>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-[#1a1a2e] rounded-xl">
        {/* Table Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-white font-medium border-b-2 border-blue-500 pb-2">Crypto</button>
              <button className="text-slate-400 hover:text-white pb-2">Fiat</button>
              <button className="text-slate-400 hover:text-white pb-2">Account</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-48 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <Checkbox 
                  checked={hideSmallBalances}
                  onCheckedChange={setHideSmallBalances}
                  className="border-slate-600"
                />
                Hide assets &lt; 1 USD
              </label>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="px-4 py-3 font-medium">Crypto</th>
                <th className="px-4 py-3 font-medium">Amount | Value</th>
                <th className="px-4 py-3 font-medium">Today's PnL</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedWallets).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    No assets found. Click "Deposit" to add funds.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedWallets).map(([currency, currencyWallets]) => {
                  const totalAmount = currencyWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
                  const config = CURRENCY_CONFIG[currency] || { name: currency, color: "#888", icon: currency[0] };
                  
                  return (
                    <tr key={currency} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: config.color }}
                          >
                            {config.icon}
                          </div>
                          <div>
                            <div className="text-white font-medium">{currency}</div>
                            <div className="text-slate-500 text-xs">{config.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-white">{formatBalance(totalAmount)}</div>
                        <div className="text-slate-500 text-xs">
                          {formatUSD(currency === 'BTC' ? totalAmount * 95000 : 
                                    currency === 'ETH' ? totalAmount * 3400 : totalAmount)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-emerald-400">+0.00%</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setSelectedCurrency(currency); setActiveModal('deposit'); setDepositData(null); }}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Deposit
                          </button>
                          <span className="text-slate-600">|</span>
                          <button 
                            onClick={() => { setSelectedCurrency(currency); setActiveModal('withdraw'); }}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Withdraw
                          </button>
                          <span className="text-slate-600">|</span>
                          <button className="text-slate-400 hover:text-slate-300 text-sm">
                            <ChevronDown className="w-4 h-4" />
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

      {/* Deposit Modal */}
      <Dialog open={activeModal === 'deposit'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-lg bg-[#1a1a2e] border-slate-700 text-white" aria-describedby="deposit-description">
          <DialogHeader>
            <DialogTitle className="text-white">Deposit Crypto</DialogTitle>
          </DialogHeader>
          <p id="deposit-description" className="sr-only">Select cryptocurrency and network to generate a deposit address</p>
          
          <div className="space-y-6 py-4">
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
                  {Object.entries(CURRENCY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key} className="text-white hover:bg-slate-700">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: config.color }}
                        >
                          {config.icon}
                        </div>
                        {key}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Quick select */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(CURRENCY_CONFIG).slice(0, 5).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => { setSelectedCurrency(key); setSelectedNetwork(''); setDepositData(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedCurrency === key 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div 
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon}
                    </div>
                    {key}
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
                  {availableNetworks.map((network) => {
                    const netConfig = NETWORK_CONFIG[network] || { name: network };
                    return (
                      <SelectItem key={network} value={network} className="text-white hover:bg-slate-700">
                        <div className="flex items-center justify-between w-full">
                          <span>{netConfig.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Step 3: Deposit Address */}
            {selectedNetwork && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">3</div>
                  <span className="font-medium">Deposit address</span>
                </div>
                
                {!depositData && !loading && (
                  <Button 
                    onClick={handleGetDepositAddress}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
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
                      <div className="p-4 bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-400 text-sm">Address</span>
                          <button 
                            onClick={() => handleCopy(depositData.pay_address)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <code className="text-white text-sm break-all block">{depositData.pay_address}</code>
                      </div>
                    )}
                    
                    {depositData.invoice_url && (
                      <a 
                        href={depositData.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Payment Page
                      </a>
                    )}
                    
                    <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-200">
                        <p>Send only {selectedCurrency} to this address via {selectedNetwork} network.</p>
                        <p className="mt-1">Sending other assets may result in permanent loss.</p>
                      </div>
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
        <DialogContent className="sm:max-w-lg bg-[#1a1a2e] border-slate-700 text-white" aria-describedby="withdraw-description">
          <DialogHeader>
            <DialogTitle className="text-white">Withdraw Crypto</DialogTitle>
          </DialogHeader>
          <p id="withdraw-description" className="sr-only">Enter withdrawal address, select network and amount to withdraw cryptocurrency</p>
          
          <div className="space-y-6 py-4">
            {/* Select Crypto */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                <span className="font-medium">Select crypto</span>
              </div>
              
              <Select value={selectedCurrency} onValueChange={(v) => { setSelectedCurrency(v); setSelectedNetwork(''); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {Object.entries(CURRENCY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key} className="text-white hover:bg-slate-700">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: config.color }}
                        >
                          {config.icon}
                        </div>
                        {key}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Withdrawal Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">2</div>
                <div className="flex items-center gap-4">
                  <span className="font-medium border-b-2 border-blue-500 pb-1">On-chain Withdrawal</span>
                  <span className="text-slate-400 pb-1">Internal Transfer <Badge className="ml-1 bg-emerald-600 text-[10px]">0 Fees</Badge></span>
                </div>
              </div>
              
              <div className="space-y-3">
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
                    {validatingAddress && (
                      <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                    )}
                    {!validatingAddress && addressValid === true && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    )}
                    {!validatingAddress && addressValid === false && (
                      <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {addressValid === false && (
                    <p className="text-xs text-red-400 mt-1">Invalid address for this network</p>
                  )}
                </div>
                
                <div>
                  <label className="text-slate-400 text-sm mb-1.5 block">Network</label>
                  <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {availableNetworks.map((network) => {
                        const netConfig = NETWORK_CONFIG[network] || { name: network };
                        return (
                          <SelectItem key={network} value={network} className="text-white hover:bg-slate-700">
                            {netConfig.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm hover:text-blue-300"
                      onClick={() => {
                        const wallet = wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork);
                        if (wallet) setAmount(String(wallet.balance || 0));
                      }}
                    >
                      Max
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Available: {formatBalance(
                      wallets.find(w => w.currency === selectedCurrency && w.network === selectedNetwork)?.balance || 0
                    )} {selectedCurrency}
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleWithdraw}
              disabled={loading || !withdrawAddress || !amount || !selectedNetwork}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Withdraw
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={activeModal === 'transfer'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-lg bg-[#1a1a2e] border-slate-700 text-white" aria-describedby="transfer-description">
          <DialogHeader>
            <DialogTitle className="text-white">Internal Transfer</DialogTitle>
          </DialogHeader>
          <p id="transfer-description" className="sr-only">Transfer funds between your wallets with zero fees</p>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">From</label>
              <Select value={transferFrom} onValueChange={setTransferFrom}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select source wallet" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-white hover:bg-slate-700">
                      {w.currency} ({w.network}) - {formatBalance(w.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-center">
              <ArrowLeftRight className="w-5 h-5 text-slate-400 rotate-90" />
            </div>
            
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">To</label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select destination wallet" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {wallets.filter(w => w.id !== transferFrom).map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-white hover:bg-slate-700">
                      {w.currency} ({w.network}) - {formatBalance(w.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            
            <Button 
              onClick={handleTransfer}
              disabled={loading || !transferFrom || !transferTo || !amount}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

FundAccount.propTypes = {
  wallets: PropTypes.array,
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  liveAccount: PropTypes.object
};