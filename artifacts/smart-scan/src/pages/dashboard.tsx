import { useGetDashboardSummary, useGetProfitTrend } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, IndianRupee, PackageOpen, Activity, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading, error: summaryError, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: trend, isLoading: isTrendLoading } = useGetProfitTrend({ days: 7 });

  if (summaryError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load dashboard</h2>
        <p className="text-muted-foreground mb-4">There was a problem communicating with the server.</p>
        <button onClick={() => refetchSummary()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Today's Overview</h1>
        <p className="text-muted-foreground">Here is what's happening at Sunrise Pharmacy.</p>
      </header>

      {/* Main Profit KPI */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary text-primary-foreground p-6 rounded-2xl shadow-md overflow-hidden relative"
      >
        <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4">
          <IndianRupee className="h-48 w-48" />
        </div>
        <div className="relative z-10">
          <h2 className="text-primary-foreground/80 font-medium mb-1">Today's Profit</h2>
          {isSummaryLoading ? (
            <Skeleton className="h-12 w-48 bg-primary-foreground/20" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-bold tracking-tight">
                {formatMoney(summary?.profitTodayMinor, summary?.currency)}
              </span>
              <span className="text-primary-foreground/80 text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                Profit
              </span>
            </div>
          )}
          
          <div className="mt-6 flex flex-wrap gap-6 border-t border-primary-foreground/10 pt-4">
            <div>
              <div className="text-primary-foreground/60 text-sm mb-1">Sales</div>
              {isSummaryLoading ? (
                <Skeleton className="h-6 w-24 bg-primary-foreground/20" />
              ) : (
                <div className="font-semibold text-lg">{formatMoney(summary?.salesTodayMinor, summary?.currency)}</div>
              )}
            </div>
            <div>
              <div className="text-primary-foreground/60 text-sm mb-1">Cost</div>
              {isSummaryLoading ? (
                <Skeleton className="h-6 w-24 bg-primary-foreground/20" />
              ) : (
                <div className="font-semibold text-lg">{formatMoney(summary?.costTodayMinor, summary?.currency)}</div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Trend Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-4 md:p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" /> 7-Day Profit Trend
            </h3>
            <div className="h-[200px] w-full">
              {isTrendLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Skeleton className="w-full h-full rounded-xl" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <Tooltip 
                      formatter={(value: number) => formatMoney(value, summary?.currency)}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { weekday: 'short' })} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      dy={10}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profitMinor" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/50">
            <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
              <PackageOpen className="h-6 w-6 text-orange-500 mb-2" />
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{summary?.lowStockCount || 0}</div>
              )}
              <div className="text-xs font-medium text-orange-600 dark:text-orange-500">Low Stock</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50">
            <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
              <AlertCircle className="h-6 w-6 text-amber-500 mb-2" />
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{summary?.nearExpiryCount || 0}</div>
              )}
              <div className="text-xs font-medium text-amber-600 dark:text-amber-500">Near Expiry</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50">
            <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
              <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{summary?.expiredCount || 0}</div>
              )}
              <div className="text-xs font-medium text-red-600 dark:text-red-500">Expired</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
              <IndianRupee className="h-6 w-6 text-muted-foreground mb-2" />
              {isSummaryLoading ? (
                <Skeleton className="h-8 w-20 mb-1" />
              ) : (
                <div className="text-xl font-bold text-foreground">
                  {formatMoney(summary?.udhariOutstandingMinor, summary?.currency)}
                </div>
              )}
              <div className="text-xs font-medium text-muted-foreground">Udhari Due</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
