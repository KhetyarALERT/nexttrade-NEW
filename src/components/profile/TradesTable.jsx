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
    openedAt: "Opened",
    closedAt: "Closed",
    updatedAt: "Updated",
    liq: "Liq",
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
    openedAt: "فتح",
    closedAt: "إغلاق",
    updatedAt: "تحديث",
    liq: "تصفية",
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

  const fmtTime = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    if (!price) return "-";
    return price >= 1 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
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
      <div className="text-center py-16 text-muted-foreground/60">
        <div className="mb-2 flex justify-center">
          <Activity className="h-8 w-8 opacity-20" />
        </div>
        <p className="text-sm font-medium">{t.noTrades}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/40">
            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.symbol}</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.side}</TableHead>
            <TableHead className="hidden lg:table-cell text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.openedAt}</TableHead>
            <TableHead className="hidden sm:table-cell text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.size}</TableHead>
            <TableHead className="hidden md:table-cell text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.entry}</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.pnl}</TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.action}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const unrealizedPnl = calculateUnrealizedPnl(trade);
            const currentPrice = currentPrices[trade.symbol] || trade.exit_price || trade.entry_price;
            const isProfit = unrealizedPnl >= 0;
            
            return (
              <TableRow key={trade.id} className="border-border/40 hover:bg-muted/30 transition-colors duration-200">
                <TableCell className="font-bold py-4">
                  <div className="flex flex-col">
                    <span>{trade.symbol}</span>
                    <span className="text-[10px] font-medium text-muted-foreground lg:hidden">{fmtTime(trade.opened_at ?? trade.created_at)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`border-none px-2 py-0.5 text-[10px] font-bold ${trade.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {trade.side === 'LONG' ? t.long : t.short}
                  </Badge>
                </TableCell>

                <TableCell className="hidden lg:table-cell text-xs font-medium text-muted-foreground">{fmtTime(trade.opened_at ?? trade.created_at)}</TableCell>
                <TableCell className="hidden sm:table-cell font-mono text-sm">{formatSize(trade.quantity)}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-sm">${formatPrice(trade.entry_price)}</TableCell>
                <TableCell className={`font-bold font-mono ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                  <div className="flex flex-col">
                    <span>{isProfit ? '+' : ''}{unrealizedPnl.toFixed(2)}</span>
                    <span className="text-[10px] opacity-80">
                      ({trade.pnl_percent?.toFixed(1) || ((unrealizedPnl / (trade.margin || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {trade.status === 'OPEN' && onCloseTrade ? (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onCloseTrade(trade, currentPrice)}
                      className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-bold border-border/40">
                      {trade.status === 'OPEN' ? t.open : t.closed}
                    </Badge>
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
