import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function EmptyState({ title, subtitle }) {
  return (
    <div className="p-6 text-center">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
};

export default function FuturesActivityTabs({ symbol, language }) {
  const [tab, setTab] = useState("positions");

  const labels = useMemo(() => {
    const isAr = language === "ar";
    return {
      tabs: {
        positions: isAr ? "المراكز" : "Positions",
        openOrders: isAr ? "الأوامر المفتوحة" : "Open Orders",
        orderHistory: isAr ? "سجل الأوامر" : "Order History",
        tradeHistory: isAr ? "سجل التداول" : "Trade History",
        positionHistory: isAr ? "سجل المراكز" : "Position History",
        transactions: isAr ? "المعاملات" : "Transactions",
      },
      empty: {
        noPositionsTitle: isAr ? "لا توجد مراكز مفتوحة" : "No open positions",
        noPositionsSubtitle: isAr
          ? `ستظهر مراكز ${symbol} هنا عند تفعيل التداول.`
          : `Positions for ${symbol} will appear here once trading is enabled.`,
        noOpenOrdersTitle: isAr ? "لا توجد أوامر مفتوحة" : "No open orders",
        noOpenOrdersSubtitle: isAr ? "ستظهر الأوامر المفتوحة هنا." : "Open orders will appear here.",
        noOrderHistoryTitle: isAr ? "لا يوجد سجل أوامر" : "No order history",
        noOrderHistorySubtitle: isAr ? "ستظهر أوامرك المكتملة/الملغاة هنا." : "Your filled/canceled orders will appear here.",
        noTradesTitle: isAr ? "لا توجد صفقات بعد" : "No trades yet",
        noTradesSubtitle: isAr ? "ستظهر الصفقات المنفذة هنا." : "Executed trades will appear here.",
        noPositionHistoryTitle: isAr ? "لا يوجد سجل مراكز" : "No position history",
        noPositionHistorySubtitle: isAr ? "ستظهر المراكز المغلقة هنا." : "Closed positions will appear here.",
        noTransactionsTitle: isAr ? "لا توجد معاملات" : "No transactions",
        noTransactionsSubtitle: isAr ? "ستظهر الإيداعات/السحوبات/الرسوم والتمويل هنا." : "Deposits, withdrawals, fees, and funding will appear here.",
      },
      positions: {
        futures: isAr ? "العقود" : "Futures",
        positionValue: isAr ? "المركز/القيمة" : "Position/Value",
        unrealized: isAr ? "الربح غير المحقق(%)" : "Unrealized PnL(%)",
        realized: isAr ? "الربح المحقق" : "Realized PnL",
        breakeven: isAr ? "سعر التعادل" : "Breakeven price",
        entry: isAr ? "سعر الدخول" : "Entry Price",
        mark: isAr ? "سعر المارك" : "Mark Price",
        liq: isAr ? "سعر التصفية" : "Est. Liq. Price",
        risk: isAr ? "المخاطرة" : "Risk",
        margin: isAr ? "الهامش" : "Margin",
        tpSl: isAr ? "وقف/هدف" : "Position TP/SL",
      },
      common: {
        time: isAr ? "الوقت" : "Time",
        symbol: isAr ? "الرمز" : "Symbol",
        type: isAr ? "النوع" : "Type",
        side: isAr ? "الجانب" : "Side",
        status: isAr ? "الحالة" : "Status",
        price: isAr ? "السعر" : "Price",
        qty: isAr ? "الكمية" : "Qty",
        action: isAr ? "الإجراء" : "Action",
        pnl: isAr ? "الربح" : "PnL",
        amount: isAr ? "المبلغ" : "Amount",
        asset: isAr ? "الأصل" : "Asset",
      },
    };
  }, [language, symbol]);

  return (
    <div className="bg-[#0f1320] border-t border-slate-800/60">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="p-2 border-b border-slate-800/60 overflow-x-auto">
          <TabsList className="bg-slate-900/40 h-9">
            <TabsTrigger value="positions" className="data-[state=active]:bg-slate-800">{labels.tabs.positions}</TabsTrigger>
            <TabsTrigger value="openOrders" className="data-[state=active]:bg-slate-800">{labels.tabs.openOrders}</TabsTrigger>
            <TabsTrigger value="orderHistory" className="data-[state=active]:bg-slate-800">{labels.tabs.orderHistory}</TabsTrigger>
            <TabsTrigger value="tradeHistory" className="data-[state=active]:bg-slate-800">{labels.tabs.tradeHistory}</TabsTrigger>
            <TabsTrigger value="positionHistory" className="data-[state=active]:bg-slate-800">{labels.tabs.positionHistory}</TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-slate-800">{labels.tabs.transactions}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="positions" className="m-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-500">{labels.positions.futures}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.positionValue}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.unrealized}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.realized}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.breakeven}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.entry}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.mark}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.liq}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.risk}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.margin}</TableHead>
                  <TableHead className="text-slate-500">{labels.positions.tpSl}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={11} className="p-0">
                    <EmptyState title={labels.empty.noPositionsTitle} subtitle={labels.empty.noPositionsSubtitle} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="openOrders" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.type}</TableHead>
                <TableHead className="text-slate-500">{labels.common.side}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.price}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.qty}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState title={labels.empty.noOpenOrdersTitle} subtitle={labels.empty.noOpenOrdersSubtitle} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="orderHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.type}</TableHead>
                <TableHead className="text-slate-500">{labels.common.status}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.qty}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState title={labels.empty.noOrderHistoryTitle} subtitle={labels.empty.noOrderHistorySubtitle} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tradeHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.side}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.price}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.qty}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState title={labels.empty.noTradesTitle} subtitle={labels.empty.noTradesSubtitle} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="positionHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.symbol}</TableHead>
                <TableHead className="text-slate-500">{labels.common.action}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.pnl}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState title={labels.empty.noPositionHistoryTitle} subtitle={labels.empty.noPositionHistorySubtitle} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="transactions" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">{labels.common.time}</TableHead>
                <TableHead className="text-slate-500">{labels.common.type}</TableHead>
                <TableHead className="text-slate-500 text-right">{labels.common.amount}</TableHead>
                <TableHead className="text-slate-500">{labels.common.asset}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState title={labels.empty.noTransactionsTitle} subtitle={labels.empty.noTransactionsSubtitle} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

FuturesActivityTabs.propTypes = {
  symbol: PropTypes.string.isRequired,
  language: PropTypes.string,
};
