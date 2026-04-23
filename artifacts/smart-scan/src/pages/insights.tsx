import { useGetStockVelocity, useGetDoctorReferrals } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Stethoscope, Timer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Insights() {
  const { data: velocity, isLoading: vLoading } = useGetStockVelocity();
  const { data: referrals, isLoading: rLoading } = useGetDoctorReferrals();

  const fastMovers = velocity?.fast ?? [];
  const slowMovers = velocity?.slow ?? [];
  const topDoctors = [...(referrals || [])].sort((a, b) => b.revenueMinor - a.revenueMinor).slice(0, 10);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Stock & Sales Insights</h1>
        <p className="text-muted-foreground">Analytics for inventory and doctor referrals (last 30 days).</p>
      </header>

      <Tabs defaultValue="fast" className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-3 md:inline-flex">
          <TabsTrigger value="fast" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Fast Movers
          </TabsTrigger>
          <TabsTrigger value="slow" className="gap-2">
            <TrendingDown className="h-4 w-4" /> Slow Movers
          </TabsTrigger>
          <TabsTrigger value="doctors" className="gap-2">
            <Stethoscope className="h-4 w-4" /> Top Doctors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fast" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Top Fast-Moving Medicines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {vLoading ? (
                  <Skeleton className="h-full w-full rounded-xl" />
                ) : fastMovers.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No sales recorded in the last 30 days.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fastMovers}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={12} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="unitsSold30d" radius={[4, 4, 0, 0]}>
                        {fastMovers.map((_, i) => (
                          <Cell key={i} fill="hsl(var(--primary))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-right">Sold (30d)</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Band</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fastMovers.map((v) => (
                  <TableRow key={v.medicineId}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-right">{v.unitsSold30d}</TableCell>
                    <TableCell className="text-right">{v.qtyOnHand}</TableCell>
                    <TableCell className="text-right">{formatMoney(v.profitMinor30d)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="capitalize">{v.band}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="slow" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Timer className="h-5 w-5 text-orange-500" /> Slow-Moving Inventory
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead className="text-right">Qty on Hand</TableHead>
                    <TableHead className="text-right">Sold (30d)</TableHead>
                    <TableHead className="text-right">Profit (30d)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vLoading ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : slowMovers.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No slow-moving inventory detected.</TableCell></TableRow>
                  ) : (
                    slowMovers.map((v) => (
                      <TableRow key={v.medicineId}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell className="text-right font-bold">{v.qtyOnHand}</TableCell>
                        <TableCell className="text-right">{v.unitsSold30d}</TableCell>
                        <TableCell className="text-right">{formatMoney(v.profitMinor30d)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" /> Top Referring Doctors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead className="text-right">Scripts</TableHead>
                    <TableHead className="text-right">Revenue Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rLoading ? (
                    <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : topDoctors.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground">No referral data found.</TableCell></TableRow>
                  ) : (
                    topDoctors.map((r) => (
                      <TableRow key={r.doctorId}>
                        <TableCell className="font-medium">{r.doctorName}</TableCell>
                        <TableCell className="text-right font-bold">{r.scriptCount}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatMoney(r.revenueMinor)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
