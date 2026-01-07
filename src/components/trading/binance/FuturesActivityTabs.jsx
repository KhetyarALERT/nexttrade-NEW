import { useState } from "react";
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

export default function FuturesActivityTabs({ symbol }) {
  const [tab, setTab] = useState("positions");

  return (
    <div className="bg-[#0f1320] border-t border-slate-800/60">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="p-2 border-b border-slate-800/60 overflow-x-auto">
          <TabsList className="bg-slate-900/40 h-9">
            <TabsTrigger value="positions" className="data-[state=active]:bg-slate-800">Positions</TabsTrigger>
            <TabsTrigger value="openOrders" className="data-[state=active]:bg-slate-800">Open Orders</TabsTrigger>
            <TabsTrigger value="orderHistory" className="data-[state=active]:bg-slate-800">Order History</TabsTrigger>
            <TabsTrigger value="tradeHistory" className="data-[state=active]:bg-slate-800">Trade History</TabsTrigger>
            <TabsTrigger value="positionHistory" className="data-[state=active]:bg-slate-800">Position History</TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-slate-800">Transactions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="positions" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Symbol</TableHead>
                <TableHead className="text-slate-500">Side</TableHead>
                <TableHead className="text-slate-500 text-right">Size</TableHead>
                <TableHead className="text-slate-500 text-right">Entry</TableHead>
                <TableHead className="text-slate-500 text-right">PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    title="No open positions"
                    subtitle={`Positions for ${symbol} will appear here once trading is enabled.`}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="openOrders" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Symbol</TableHead>
                <TableHead className="text-slate-500">Type</TableHead>
                <TableHead className="text-slate-500">Side</TableHead>
                <TableHead className="text-slate-500 text-right">Price</TableHead>
                <TableHead className="text-slate-500 text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState title="No open orders" subtitle="Open orders will appear here." />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="orderHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Time</TableHead>
                <TableHead className="text-slate-500">Symbol</TableHead>
                <TableHead className="text-slate-500">Type</TableHead>
                <TableHead className="text-slate-500">Status</TableHead>
                <TableHead className="text-slate-500 text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState title="No order history" subtitle="Your filled/canceled orders will appear here." />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tradeHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Time</TableHead>
                <TableHead className="text-slate-500">Symbol</TableHead>
                <TableHead className="text-slate-500">Side</TableHead>
                <TableHead className="text-slate-500 text-right">Price</TableHead>
                <TableHead className="text-slate-500 text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState title="No trades yet" subtitle="Executed trades will appear here." />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="positionHistory" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Time</TableHead>
                <TableHead className="text-slate-500">Symbol</TableHead>
                <TableHead className="text-slate-500">Action</TableHead>
                <TableHead className="text-slate-500 text-right">PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState title="No position history" subtitle="Closed positions will appear here." />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="transactions" className="m-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-500">Time</TableHead>
                <TableHead className="text-slate-500">Type</TableHead>
                <TableHead className="text-slate-500 text-right">Amount</TableHead>
                <TableHead className="text-slate-500">Asset</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState title="No transactions" subtitle="Deposits, withdrawals, fees, and funding will appear here." />
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
};
