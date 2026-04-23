import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetCustomer, useAddUdhariEntry } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Phone, 
  MapPin, 
  CreditCard, 
  Plus, 
  History, 
  FileText, 
  IndianRupee,
  Loader2,
  ArrowRightLeft
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading, refetch } = useGetCustomer(id as string);
  const addUdhariMutation = useAddUdhariEntry(id as string);

  const [udhariForm, setUdhariForm] = useState({
    amount: 0,
    note: "",
    isPayment: false,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) return <div className="p-8"><Skeleton className="h-[500px] w-full" /></div>;
  if (!customer) return <div className="p-8 text-center text-destructive">Customer not found</div>;

  const handleUdhari = async () => {
    try {
      const amountMinor = Math.round(udhariForm.amount * 100);
      await addUdhariMutation.mutateAsync({
        data: {
          amountMinor: udhariForm.isPayment ? -amountMinor : amountMinor,
          note: udhariForm.note || undefined
        }
      });
      toast.success(udhariForm.isPayment ? "Payment recorded" : "Udhari added");
      setIsDialogOpen(false);
      setUdhariForm({ amount: 0, note: "", isPayment: false });
      refetch();
    } catch (e) {
      toast.error("Failed to update ledger");
    }
  };

  const balancePct = customer.udhariLimitMinor > 0 
    ? Math.min(100, (customer.balanceMinor / customer.udhariLimitMinor) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone || "N/A"}</div>
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {customer.address || "No address"}</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Record Payment / Udhari
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Update Customer Ledger</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex p-1 bg-muted rounded-lg">
                  <button 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${!udhariForm.isPayment ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setUdhariForm({...udhariForm, isPayment: false})}
                  >
                    Add Udhari
                  </button>
                  <button 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${udhariForm.isPayment ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setUdhariForm({...udhariForm, isPayment: true})}
                  >
                    Receive Payment
                  </button>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₹)</Label>
                  <Input 
                    type="number" 
                    value={udhariForm.amount} 
                    onChange={e => setUdhariForm({...udhariForm, amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note (Optional)</Label>
                  <Input 
                    placeholder="Reference, reason, etc." 
                    value={udhariForm.note}
                    onChange={e => setUdhariForm({...udhariForm, note: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUdhari} disabled={addUdhariMutation.isPending}>
                   {addUdhariMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   {udhariForm.isPayment ? "Record Payment" : "Add to Udhari"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link href="/pos">
             <Button variant="outline" className="gap-2">
               <Plus className="h-4 w-4" /> New Sale
             </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className={customer.balanceMinor > 0 ? "border-destructive/20 bg-destructive/5" : ""}>
          <CardContent className="p-6">
            <div className="text-sm font-bold uppercase text-muted-foreground mb-4">Udhari Status</div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div className="text-3xl font-bold">{formatMoney(customer.balanceMinor)}</div>
                <div className="text-sm text-muted-foreground">Limit: {formatMoney(customer.udhariLimitMinor)}</div>
              </div>
              {customer.udhariLimitMinor > 0 && (
                <div className="space-y-1.5">
                  <Progress value={balancePct} className="h-2" />
                  <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Usage</span>
                    <span>{balancePct.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-bold flex items-center gap-2">
               <FileText className="h-4 w-4" /> Patient Notes
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-sm">{customer.notes || "No patient notes recorded."}</p>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-flex">
          <TabsTrigger value="ledger">Udhari Ledger</TabsTrigger>
          <TabsTrigger value="history">Purchase History</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit (+)</TableHead>
                  <TableHead className="text-right">Credit (-)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.entries?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No ledger entries found.</TableCell>
                  </TableRow>
                ) : (
                  customer.entries?.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">{format(new Date(entry.enteredAt), "dd MMM yyyy, hh:mm a")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.note || (entry.saleId ? "Pharmacy Sale" : "Manual Adjustment")}</div>
                        {entry.saleId && <Link href={`/sales/${entry.saleId}`} className="text-xs text-primary hover:underline">View Invoice</Link>}
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {entry.amountMinor > 0 ? formatMoney(entry.amountMinor) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {entry.amountMinor < 0 ? formatMoney(Math.abs(entry.amountMinor)) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="mt-6">
          <div className="text-center py-12 bg-muted/50 rounded-xl border border-dashed">
             <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
             <p className="text-muted-foreground">Historical sales will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
