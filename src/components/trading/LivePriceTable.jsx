import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

export default function LivePriceTable({ language = "en" }) {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: result } = await base44.functions.invoke('fetchMarketPrices', {
        symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'BTCUSD', 'ETHUSD']
      });
      
      if (result.success) {
        setPrices(result.data);
        setLastUpdate(new Date(result.timestamp));
      } else {
        setError(result.error || 'Failed to fetch prices');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchPrices, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => {
    if (!price) return '-';
    return parseFloat(price).toFixed(price < 10 ? 5 : 2);
  };

  const formatChange = (change) => {
    if (!change) return '-';
    const num = parseFloat(change);
    return num > 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
  };

  const formatPercentage = (pct) => {
    if (!pct) return '-';
    const num = parseFloat(pct);
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  if (error) {
    return (
      <Card className="border-0 shadow-2xl">
        <CardContent className="p-8 text-center">
          <div className="text-red-500 mb-4">
            {language === "ar" ? "فشل تحميل الأسعار" : "Failed to load prices"}
          </div>
          <button
            onClick={fetchPrices}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {language === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-2xl bg-white">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {language === "ar" ? "الأسعار المباشرة" : "Live Market Prices"}
              </h3>
              <p className="text-sm text-gray-600">
                {lastUpdate && (
                  language === "ar" 
                    ? `آخر تحديث: ${lastUpdate.toLocaleTimeString('ar')}`
                    : `Last update: ${lastUpdate.toLocaleTimeString()}`
                )}
              </p>
            </div>
          </div>
          
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Price Table */}
        {loading && prices.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">
              {language === "ar" ? "جاري تحميل الأسعار..." : "Loading prices..."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    {language === "ar" ? "الرمز" : "Symbol"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    {language === "ar" ? "السعر" : "Price"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    {language === "ar" ? "التغير" : "Change"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    {language === "ar" ? "النسبة" : "%"}
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {prices.map((item, idx) => {
                    const isPositive = item.change >= 0;
                    return (
                      <motion.tr
                        key={item.symbol}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                              <span className="text-white font-bold text-xs">
                                {item.symbol.substring(0, 3)}
                              </span>
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{item.symbol}</div>
                              {item.name && (
                                <div className="text-xs text-gray-600 truncate max-w-[150px]">
                                  {item.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="font-bold text-gray-900 text-lg">
                            ${formatPrice(item.price)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className={`font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {formatChange(item.change)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className={`flex items-center justify-end gap-1 font-bold ${
                            isPositive ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {isPositive ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            {formatPercentage(item.changesPercentage)}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Note */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            {language === "ar" 
              ? "البيانات المقدمة من Financial Modeling Prep • يتم التحديث كل 10 ثوانٍ"
              : "Data provided by Financial Modeling Prep • Updated every 10 seconds"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}