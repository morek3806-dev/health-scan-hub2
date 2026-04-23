import { useParams } from "wouter";
import { useGetMedicine, useListBatches, useGetStockVelocity } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, ShieldAlert, BarChart3, Pill, Database, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MedicineDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: medicine, isLoading: medLoading } = useGetMedicine(id as string);
  const { data: batches, isLoading: batchesLoading } = useListBatches({ medicineId: id } as any);
  // Velocity hook might need params
  const { data: velocity } = useGetStockVelocity();

  if (medLoading) return <div className="p-8 space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!medicine) return <div className="p-8 text-center text-destructive">Medicine not found</div>;

  const totalQty = batches?.reduce((acc, b) => acc + b.qtyOnHand, 0) || 0;
  const medVelocity = (velocity as any)?.rows?.find((v: any) => v.medicineId === id);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Pill className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{medicine.name}</h1>
          </div>
          <p className="text-lg text-muted-foreground">{medicine.genericName || "No generic name"}</p>
        </div>
        <div className="flex gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 py-2 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Stock</div>
              <div className="text-2xl font-bold text-primary">{totalQty}</div>
            </CardContent>
          </Card>
          {medicine.reorderLevel && (
            <Card className={totalQty <= medicine.reorderLevel ? "bg-destructive/5 border-destructive/20" : ""}>
              <CardContent className="p-4 py-2 text-center">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Reorder Level</div>
                <div className="text-2xl font-bold">{medicine.reorderLevel}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Database className="h-4 w-4" /> Technical Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Strength</Label>
              <div className="font-medium">{medicine.strength || "N/A"}</div>
            </div>
            <div>
              <Label>Form</Label>
              <div className="font-medium">{medicine.form || "N/A"}</div>
            </div>
            <div>
              <Label>HSN Code</Label>
              <div className="font-medium">{medicine.hsnCode || "N/A"}</div>
            </div>
            <div>
              <Label>GST %</Label>
              <div className="font-medium">{medicine.gstPct}%</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Stock Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sold (30d)</span>
              <span className="font-bold">{medVelocity?.soldQty || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg / Day</span>
              <span className="font-bold">{medVelocity?.avgPerDay?.toFixed(1) || 0}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Days Remaining</span>
                <Badge variant={medVelocity?.daysOfStock < 7 ? "destructive" : "secondary"}>
                  {medVelocity?.daysOfStock || "∞"} days
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5" /> Batches in Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch Number</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Sell Price</TableHead>
                <TableHead>Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : batches?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No batches found.
                  </TableCell>
                </TableRow>
              ) : (
                batches?.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>{format(new Date(batch.expiryDate), "MMM yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={batch.qtyOnHand <= 5 ? "destructive" : "outline"}>
                        {batch.qtyOnHand}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(batch.buyPriceMinor)}</TableCell>
                    <TableCell className="font-bold text-primary">{formatMoney(batch.sellPriceMinor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{batch.supplierName || "N/A"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{children}</div>;
}
