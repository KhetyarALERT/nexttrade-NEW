import PropTypes from "prop-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, X } from "lucide-react";

const translations = {
  en: {
    symbol: "Symbol",
    side: "Side",
    size: "Size",
    entry: "Entry",
    current: "Current",
    pnl: "P&L",
    status: "Status",
    action: "Action",
    close: "Close",
    long: "LONG",
    short: "SHORT",
    open: "Open",
    closed: "Closed",
    noTrades: "No trades found"
  },
  ar: {
    symbol: "الرمز",
    side: "الاتجاه",
    size: "الحجم",
    entry: "الدخول",
    current: "الحالي",
    pnl: "الربح/الخسارة",
    status: "الحالة",
    action: "إجراء",
    close: "إغلاق",
    long: "شراء",
    short: "بيع",
    open: "مفتوح",
    closed: "مغلق",
    noTrades: "لا توجد صفقات"
  }
};

export default function TradesTable({ trades = [], language = "en", onCloseTrade, currentPrices = {} }) {
  const t = translations[language];

  const formatPrice = (price) => {
    if (!price) return "-";
    return price >= 1 ? price.toFixed(2) : price.toFixed(6);
  };

  const formatSize = (v) => {
    if (v === undefined || v === null) return '-';
    const n = Number(v);
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  const calculateUnrealizedPnl = (trade) => {
    if (trade.status !== 'OPEN') return trade.pnl || 0;
    
    const currentPrice = currentPrices[trade.symbol] || trade.entry_price;
    if (trade.side === 'LONG') {
      return (currentPrice - trade.entry_price) * trade.quantity;
    } else {
      return (trade.entry_price - currentPrice) * trade.quantity;
    }
  };

  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        {t.noTrades}
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">{t.symbol}</TableHead>
            <TableHead className="font-semibold">{t.side}</TableHead>
            <TableHead className="hidden sm:table-cell font-semibold">{t.size}</TableHead>
            <TableHead className="hidden md:table-cell font-semibold">{t.entry}</TableHead>
            <TableHead className="hidden md:table-cell font-semibold">{t.current}</TableHead>
            <TableHead className="font-semibold">{t.pnl}</TableHead>
            <TableHead className="hidden sm:table-cell font-semibold">{t.status}</TableHead>
            <TableHead className="font-semibold text-right">{t.action}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const unrealizedPnl = calculateUnrealizedPnl(trade);
            const currentPrice = currentPrices[trade.symbol] || trade.exit_price || trade.entry_price;
            const isProfit = unrealizedPnl >= 0;
            
            return (
              <TableRow key={trade.id} className="hover:bg-slate-50">
                <TableCell className="font-bold">
                  <div className="min-w-0 truncate">{trade.symbol}</div>
                  <div className="mt-1 text-[10px] text-slate-500 md:hidden">
                    <span className="text-slate-400">{t.entry}:</span> ${formatPrice(trade.entry_price)}
                    <span className="mx-2 text-slate-300">•</span>
                    <span className="text-slate-400">{t.current}:</span> ${formatPrice(currentPrice)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={trade.side === 'LONG' ? 'bg-emerald-500' : 'bg-red-500'}>
                    {trade.side === 'LONG' ? (
                      <><TrendingUp className="w-3 h-3 mr-1" /> {t.long}</>
                    ) : (
                      <><TrendingDown className="w-3 h-3 mr-1" /> {t.short}</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{formatSize(trade.quantity)}</TableCell>
                <TableCell className="hidden md:table-cell font-mono">${formatPrice(trade.entry_price)}</TableCell>
                <TableCell className="hidden md:table-cell font-mono">${formatPrice(currentPrice)}</TableCell>
                <TableCell className={`font-bold ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isProfit ? '+' : ''}{unrealizedPnl.toFixed(2)}
                  <span className="text-xs ml-1">
                    ({trade.pnl_percent?.toFixed(1) || ((unrealizedPnl / trade.margin) * 100).toFixed(1)}%)
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={trade.status === 'OPEN' ? 'default' : 'secondary'}>
                    {trade.status === 'OPEN' ? t.open : t.closed}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {trade.status === 'OPEN' && onCloseTrade && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onCloseTrade(trade, currentPrice)}
                      className="h-7"
                    >
                      <X className="w-3 h-3 mr-1" /> {t.close}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

TradesTable.propTypes = {
  trades: PropTypes.array,
  language: PropTypes.string,
  onCloseTrade: PropTypes.func,
  currentPrices: PropTypes.object
};