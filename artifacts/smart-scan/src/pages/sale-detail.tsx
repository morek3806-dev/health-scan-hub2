import { useParams, Link } from "wouter";
import { useGetSale } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft, User, Stethoscope, ReceiptText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: sale, isLoading, error } = useGetSale(id as string);

  if (isLoading) return <div className="p-8"><Skeleton className="h-[600px] w-full" /></div>;
  if (error || !sale) return <div className="p-8 text-center text-destructive">Failed to load invoice</div>;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/sales">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Sales
          </Button>
        </Link>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Print Invoice
        </Button>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <ReceiptText className="h-6 w-6" />
                <CardTitle className="text-2xl font-bold">Sunrise Pharmacy</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">Digital Prescription Invoice</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">INVOICE #{sale.invoiceNo}</div>
              <div className="text-sm text-muted-foreground">{format(new Date(sale.soldAt), "dd MMMM yyyy, hh:mm a")}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Customer</Label>
                {sale.customerId ? (
                  <Link href={`/customers/${sale.customerId}`}>
                    <div className="flex items-center gap-2 hover:text-primary cursor-pointer transition-colors">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{sale.customerName}</span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Walk-in Customer</span>
                  </div>
                )}
              </div>
              {sale.prescriptionNo && (
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Prescription No</Label>
                  <div className="font-medium">{sale.prescriptionNo}</div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Doctor</Label>
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  <span className="font-medium">{sale.doctorName || "N/A"}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Payment Method</Label>
                <div>
                  <Badge className="capitalize">{sale.paymentMethod}</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.lines.map((line: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-medium">{line.medicineName}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{line.batchNumber}</TableCell>
                    <TableCell className="text-center">{line.qty}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.sellPriceMinor)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(line.sellPriceMinor * line.qty)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="w-full md:w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(sale.subtotalMinor)}</span>
              </div>
              {sale.discountMinor > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Discount</span>
                  <span>-{formatMoney(sale.discountMinor)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-3 text-primary">
                <span>Total Amount</span>
                <span>{formatMoney(sale.totalMinor)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">Paid Amount</span>
                <span>{formatMoney(sale.paidMinor)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-center text-xs text-muted-foreground border-t pt-6 hidden print:block">
            Thank you for your business! This is a computer generated invoice.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`text-xs font-semibold ${className}`}>{children}</div>;
}
