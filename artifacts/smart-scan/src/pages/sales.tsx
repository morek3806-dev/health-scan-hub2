import { useState } from "react";
import { useLocation } from "wouter";
import { format, subDays } from "date-fns";
import { useListSales } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, TrendingUp, IndianRupee, Search, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Sales() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [, setLocation] = useLocation();

  const { data: sales, isLoading } = useListSales({ from, to });

  const stats = {
    count: sales?.length || 0,
    revenue: sales?.reduce((acc, s) => acc + s.totalMinor, 0) || 0,
    profit: sales?.reduce((acc, s) => acc + (s.profitMinor || 0), 0) || 0,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Sales History</h1>
        <p className="text-muted-foreground">View and manage your past transactions.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium">Total Sales</div>
              <div className="text-2xl font-bold">{stats.count}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium">Revenue</div>
              <div className="text-2xl font-bold">{formatMoney(stats.revenue)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium">Est. Profit</div>
              <div className="text-2xl font-bold">{formatMoney(stats.profit)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
          <div className="grid gap-2 w-full md:w-auto">
            <label className="text-xs font-bold uppercase text-muted-foreground">From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="date" 
                className="pl-9" 
                value={from} 
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 w-full md:w-auto">
            <label className="text-xs font-bold uppercase text-muted-foreground">To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="date" 
                className="pl-9" 
                value={to} 
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No sales found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                sales?.map((sale) => (
                  <TableRow 
                    key={sale.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/sales/${sale.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{sale.invoiceNo}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(sale.soldAt), "dd MMM, hh:mm a")}
                    </TableCell>
                    <TableCell>{sale.customerName || "Walk-in"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {sale.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatMoney(sale.totalMinor)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
