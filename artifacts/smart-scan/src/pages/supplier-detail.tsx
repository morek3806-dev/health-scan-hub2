import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetSupplier, 
  usePayPurchaseOrder, 
  useCreatePurchaseOrder,
  useListMedicines
} from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Phone, 
  MapPin, 
  CreditCard, 
  Plus, 
  History, 
  FileText, 
  IndianRupee,
  Loader2,
  Trash2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: supplier, isLoading, refetch } = useGetSupplier(id as string);
  const { data: medicines } = useListMedicines();
  
  const payMutation = usePayPurchaseOrder(id as string);
  const createPOMutation = useCreatePurchaseOrder();

  const [paymentPO, setPaymentPO] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: "upi" as "cash" | "upi" | "bank" | "cheque",
    reference: "",
  });

  const [isPODialogOpen, setIsPODialogOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    invoiceNumber: "",
    invoiceDate: format(new Date(), "yyyy-MM-dd"),
    lines: [{ medicineId: "", medicineName: "", batchNumber: "", expiryDate: "", qty: 1, buyPrice: 0, sellPrice: 0 }]
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-[500px] w-full" /></div>;
  if (!supplier) return <div className="p-8 text-center text-destructive">Supplier not found</div>;

  const handlePay = async () => {
    if (!paymentPO) return;
    try {
      await payMutation.mutateAsync({
        id: paymentPO.id,
        data: {
          amountMinor: Math.round(paymentForm.amount * 100),
          method: paymentForm.method,
          reference: paymentForm.reference || undefined
        }
      });
      toast.success("Payment recorded");
      setPaymentPO(null);
      refetch();
    } catch (e) {
      toast.error("Failed to record payment");
    }
  };

  const addPOLine = () => {
    setPoForm({
      ...poForm,
      lines: [...poForm.lines, { medicineId: "", medicineName: "", batchNumber: "", expiryDate: "", qty: 1, buyPrice: 0, sellPrice: 0 }]
    });
  };

  const removePOLine = (idx: number) => {
    setPoForm({
      ...poForm,
      lines: poForm.lines.filter((_, i) => i !== idx)
    });
  };

  const handleCreatePO = async () => {
    try {
      await createPOMutation.mutateAsync({
        data: {
          supplierId: id as string,
          invoiceNumber: poForm.invoiceNumber,
          invoiceDate: poForm.invoiceDate,
          lines: poForm.lines.map(l => ({
            medicineId: l.medicineId || null,
            medicineName: l.medicineName,
            batchNumber: l.batchNumber,
            expiryDate: l.expiryDate,
            qty: l.qty,
            buyPriceMinor: Math.round(l.buyPrice * 100),
            sellPriceMinor: Math.round(l.sellPrice * 100)
          }))
        }
      });
      toast.success("Purchase recorded");
      setIsPODialogOpen(false);
      refetch();
    } catch (e) {
      toast.error("Failed to record purchase");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {supplier.contactPhone || "N/A"}</div>
              <div className="flex items-center gap-1"><FileText className="h-3 w-3" /> GSTIN: {supplier.gstin || "N/A"}</div>
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {supplier.address || "No address"}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Dialog open={isPODialogOpen} onOpenChange={setIsPODialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Record Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Purchase Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input value={poForm.invoiceNumber} onChange={e => setPoForm({...poForm, invoiceNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Date</Label>
                    <Input type="date" value={poForm.invoiceDate} onChange={e => setPoForm({...poForm, invoiceDate: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Items</Label>
                  {poForm.lines.map((line, idx) => (
                    <Card key={idx} className="p-3 border-dashed">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-12 md:col-span-4">
                           <Select onValueChange={(val) => {
                              const med = medicines?.find(m => m.id === val);
                              const newLines = [...poForm.lines];
                              newLines[idx] = { ...newLines[idx], medicineId: val, medicineName: med?.name || "" };
                              setPoForm({ ...poForm, lines: newLines });
                           }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Medicine" />
                            </SelectTrigger>
                            <SelectContent>
                              {medicines?.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                           </Select>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <Input placeholder="Batch" value={line.batchNumber} onChange={e => {
                            const newLines = [...poForm.lines];
                            newLines[idx].batchNumber = e.target.value;
                            setPoForm({ ...poForm, lines: newLines });
                          }} />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <Input type="date" value={line.expiryDate} onChange={e => {
                            const newLines = [...poForm.lines];
                            newLines[idx].expiryDate = e.target.value;
                            setPoForm({ ...poForm, lines: newLines });
                          }} />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                          <Input type="number" placeholder="Qty" value={line.qty} onChange={e => {
                            const newLines = [...poForm.lines];
                            newLines[idx].qty = parseInt(e.target.value) || 0;
                            setPoForm({ ...poForm, lines: newLines });
                          }} />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                          <Input type="number" placeholder="Buy" value={line.buyPrice} onChange={e => {
                            const newLines = [...poForm.lines];
                            newLines[idx].buyPrice = parseFloat(e.target.value) || 0;
                            setPoForm({ ...poForm, lines: newLines });
                          }} />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                          <Input type="number" placeholder="Sell" value={line.sellPrice} onChange={e => {
                            const newLines = [...poForm.lines];
                            newLines[idx].sellPrice = parseFloat(e.target.value) || 0;
                            setPoForm({ ...poForm, lines: newLines });
                          }} />
                        </div>
                        <div className="col-span-12 md:col-span-1 flex justify-end">
                           <Button variant="ghost" size="icon" onClick={() => removePOLine(idx)} disabled={poForm.lines.length === 1}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button variant="outline" size="sm" onClick={addPOLine} className="w-full border-dashed">
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPODialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreatePO} disabled={createPOMutation.isPending}>
                  {createPOMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Purchase
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-6 text-center">
            <div className="text-sm font-bold uppercase text-muted-foreground mb-1">Total Outstanding</div>
            <div className="text-4xl font-bold text-destructive">{formatMoney(supplier.outstandingMinor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-sm font-bold uppercase text-muted-foreground mb-1">Total Purchased</div>
            <div className="text-4xl font-bold text-primary">{formatMoney(supplier.totalPurchasedMinor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-sm font-bold uppercase text-muted-foreground mb-1">Credit Period</div>
            <div className="text-4xl font-bold">{supplier.creditDays} Days</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-3 md:inline-flex">
          <TabsTrigger value="pending">Pending Invoices</TabsTrigger>
          <TabsTrigger value="all">All Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.invoices?.filter(inv => inv.status !== "paid").length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No pending invoices.</TableCell>
                  </TableRow>
                ) : (
                  supplier.invoices?.filter(inv => inv.status !== "paid").map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(inv.invoiceDate), "dd MMM yyyy")}</TableCell>
                      <TableCell>{inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : "N/A"}</TableCell>
                      <TableCell>{formatMoney(inv.totalMinor)}</TableCell>
                      <TableCell>{formatMoney(inv.paidMinor)}</TableCell>
                      <TableCell className="font-bold text-destructive">{formatMoney(inv.totalMinor - inv.paidMinor)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="gap-2" onClick={() => {
                          setPaymentPO(inv);
                          setPaymentForm({ ...paymentForm, amount: (inv.totalMinor - inv.paidMinor) / 100 });
                        }}>
                          <IndianRupee className="h-3 w-3" /> Record Payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        
        <TabsContent value="all" className="mt-6">
           <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.invoices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No invoices found.</TableCell>
                  </TableRow>
                ) : (
                  supplier.invoices?.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(inv.invoiceDate), "dd MMM yyyy")}</TableCell>
                      <TableCell>{formatMoney(inv.totalMinor)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "outline" : "destructive"}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         {inv.status !== "paid" && (
                           <Button variant="ghost" size="sm" onClick={() => {
                            setPaymentPO(inv);
                            setPaymentForm({ ...paymentForm, amount: (inv.totalMinor - inv.paidMinor) / 100 });
                           }}>Pay</Button>
                         )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <div className="text-center py-12 bg-muted/50 rounded-xl border border-dashed">
             <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
             <p className="text-muted-foreground">Payment ledger is managed at invoice level.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={!!paymentPO} onOpenChange={() => setPaymentPO(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Record Payment for {paymentPO?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input 
                type="number" 
                value={paymentForm.amount} 
                onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentForm.method} onValueChange={(val: any) => setPaymentForm({...paymentForm, method: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference (Optional)</Label>
              <Input 
                placeholder="Transaction ID / Check No" 
                value={paymentForm.reference}
                onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentPO(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={payMutation.isPending}>
               {payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
