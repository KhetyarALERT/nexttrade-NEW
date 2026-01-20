/**
 * MobileTradeView - Tab-based mobile layout for futures trading
 * Optimized for small screens with Chart/Trade/Positions tabs
 */

import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Wallet, TrendingUp, List } from "lucide-react";
import AccountBalanceBar from "./AccountBalanceBar";
import PositionsList from "./PositionsList";

export default function MobileTradeView({
  account,
  positions = [],
  orders = [],
  markPrices = {},
  totalUnrealizedPnl = 0,
  language = "en",
  onRefresh,
  isRefreshing = false,
  onClosePosition,
  closingPositionId,
  // Slot components
  chartComponent,
  tradePanelComponent,
  activityComponent,
}) {
  const [activeTab, setActiveTab] = useState("chart");
  const isAr = language === "ar";

  const labels = useMemo(() => ({
    chart: isAr ? "الرسم" : "Chart",
    trade: isAr ? "تداول" : "Trade",
    positions: isAr ? "المراكز" : "Positions",
    activity: isAr ? "النشاط" : "Activity",
  }), [isAr]);

  const positionCount = positions.length;
  const orderCount = orders.length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Compact Balance Bar - Always visible */}
      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <AccountBalanceBar
          account={account}
          totalUnrealizedPnl={totalUnrealizedPnl}
          language={language}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          compact
        />
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-2 mt-2 bg-muted/50 h-10 p-1 rounded-xl shrink-0">
          <TabsTrigger 
            value="chart" 
            className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {labels.chart}
          </TabsTrigger>
          <TabsTrigger 
            value="trade" 
            className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs gap-1.5"
          >
            <Wallet className="h-3.5 w-3.5" />
            {labels.trade}
          </TabsTrigger>
          <TabsTrigger 
            value="positions" 
            className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs gap-1.5"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {labels.positions}
            {positionCount > 0 && (
              <span className="ml-0.5 bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {positionCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="activity" 
            className="flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg text-xs gap-1.5"
          >
            <List className="h-3.5 w-3.5" />
            {labels.activity}
            {orderCount > 0 && (
              <span className="ml-0.5 bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {orderCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Chart Tab */}
        <TabsContent value="chart" className="flex-1 m-0 mt-2 overflow-hidden">
          <div className="h-full px-2 pb-2">
            {chartComponent}
          </div>
        </TabsContent>

        {/* Trade Tab */}
        <TabsContent value="trade" className="flex-1 m-0 mt-2 overflow-auto">
          <div className="px-2 pb-2">
            {tradePanelComponent}
          </div>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="flex-1 m-0 mt-2 overflow-auto">
          <div className="pb-2">
            <PositionsList
              positions={positions}
              markPrices={markPrices}
              language={language}
              onClosePosition={onClosePosition}
              closingPositionId={closingPositionId}
            />
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="flex-1 m-0 mt-2 overflow-auto">
          <div className="pb-2">
            {activityComponent}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

MobileTradeView.propTypes = {
  account: PropTypes.object,
  positions: PropTypes.array,
  orders: PropTypes.array,
  markPrices: PropTypes.object,
  totalUnrealizedPnl: PropTypes.number,
  language: PropTypes.string,
  onRefresh: PropTypes.func,
  isRefreshing: PropTypes.bool,
  onClosePosition: PropTypes.func,
  closingPositionId: PropTypes.string,
  chartComponent: PropTypes.node,
  tradePanelComponent: PropTypes.node,
  activityComponent: PropTypes.node,
};