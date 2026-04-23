import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format, differenceInDays, addDays } from "date-fns";
import { 
  useListBatches, 
  useCreateBatch, 
  useListMedicines, 
  useListSuppliers,
  useCreateMedicine
} from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  AlertCircle, 
  Package, 
  Clock, 
  Filter,
  RefreshCw,
  Loader2,
  Calendar as CalendarIcon
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: batches, isLoading, error, refetch } = useListBatches({ 
    search: search || undefined,
    status: status === "all" ? undefined : (status as any)
  });

  const { data: medicines } = useListMedicines();
  const { data: suppliers } = useListSuppliers();
  const createBatchMutation = useCreateBatch();
  const createMedicineMutation = useCreateMedicine();

  // Form state for new batch
  const [newBatch, setNewBatch] = useState({
    medicineId: "",
    medicineName: "",
    batchNumber: "",
    expiryDate: "",
    qtyReceived: 0,
    buyPriceMinor: 0,
    sellPriceMinor: 0,
    supplierId: "",
  });

  const [isCreatingMedicine, setIsCreatingMedicine] = useState(false);
  const [newMedicineName, setNewMedicineName] = useState("");

  const handleAddBatch = async () => {
    if (!newBatch.medicineName || !newBatch.batchNumber || !newBatch.expiryDate) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      let medicineId = newBatch.medicineId;
      let medicineName = newBatch.medicineName;

      if (isCreatingMedicine && newMedicineName) {
        const med = await createMedicineMutation.mutateAsync({ data: { name: newMedicineName } });
        medicineId = med.id;
        medicineName = med.name;
      }

      await createBatchMutation.mutateAsync({
        data: {
          medicineId: medicineId || null,
          medicineName: medicineName,
          batchNumber: newBatch.batchNumber,
          expiryDate: newBatch.expiryDate,
          qtyReceived: parseInt(newBatch.qtyReceived.toString()),
          buyPriceMinor: Math.round(parseFloat(newBatch.buyPriceMinor.toString()) * 100),
          sellPriceMinor: Math.round(parseFloat(newBatch.sellPriceMinor.toString()) * 100),
          supplierId: newBatch.supplierId || null,
        }
      });
      
      toast.success("Batch added successfully");
      setIsAddDialogOpen(false);
      refetch();
      // Reset form
      setNewBatch({
        medicineId: "",
        medicineName: "",
        batchNumber: "",
        expiryDate: "",
        qtyReceived: 0,
        buyPriceMinor: 0,
        sellPriceMinor: 0,
        supplierId: "",
      });
      setIsCreatingMedicine(false);
      setNewMedicineName("");
    } catch (e) {
      toast.error("Failed to add batch");
    }
  };

  const now = new Date();
  const stats = {
    total: batches?.length || 0,
    expiringSoon: batches?.filter(b => {
      const days = differenceInDays(new Date(b.expiryDate), now);
      return days >= 0 && days <= 30;
    }).length || 0,
    expired: batches?.filter(b => differenceInDays(new Date(b.expiryDate), now) < 0).length || 0,
    lowStock: batches?.filter(b => b.qtyOnHand <= 5).length || 0,
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load inventory</h2>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Inventory</h1>
          <p className="text-muted-foreground">Manage medicine batches and stock levels.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Batch</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Medicine</Label>
                {isCreatingMedicine ? (
                  <div className="flex gap-2">
                    <Input 
                      placeholder="New medicine name" 
                      value={newMedicineName}
                      onChange={(e) => setNewMedicineName(e.target.value)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setIsCreatingMedicine(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select 
                      onValueChange={(val) => {
                        const med = medicines?.find(m => m.id === val);
                        setNewBatch({ ...newBatch, medicineId: val, medicineName: med?.name || "" });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select medicine" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicines?.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button 
                      className="text-xs text-primary hover:underline"
                      onClick={() => setIsCreatingMedicine(true)}
                    >
                      + Create new medicine
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input 
                    value={newBatch.batchNumber}
                    onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input 
                    type="date"
                    value={newBatch.expiryDate}
                    onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number"
                    value={newBatch.qtyReceived}
                    onChange={(e) => setNewBatch({ ...newBatch, qtyReceived: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buy Price (₹)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={newBatch.buyPriceMinor}
                    onChange={(e) => setNewBatch({ ...newBatch, buyPriceMinor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sell Price (₹)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={newBatch.sellPriceMinor}
                    onChange={(e) => setNewBatch({ ...newBatch, sellPriceMinor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select onValueChange={(val) => setNewBatch({ ...newBatch, supplierId: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddBatch} disabled={createBatchMutation.isPending}>
                {createBatchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Batch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Package className="h-5 w-5 text-primary mb-2" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Batches</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Clock className="h-5 w-5 text-orange-500 mb-2" />
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
            <div className="text-xs text-muted-foreground">Near Expiry</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertCircle className="h-5 w-5 text-destructive mb-2" />
            <div className="text-2xl font-bold">{stats.expired}</div>
            <div className="text-xs text-muted-foreground">Expired</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Filter className="h-5 w-5 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{stats.lowStock}</div>
            <div className="text-xs text-muted-foreground">Low Stock</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search medicine or batch..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={status} onValueChange={setStatus} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="low">Low</TabsTrigger>
            <TabsTrigger value="near_expiry">Near Expiry</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Batch No</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : batches?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No medicine batches found.
                  </TableCell>
                </TableRow>
              ) : (
                batches?.map((batch) => {
                  const expiryDate = new Date(batch.expiryDate);
                  const daysToExpiry = differenceInDays(expiryDate, now);
                  
                  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                  let badgeClass = "";
                  
                  if (daysToExpiry < 0) {
                    badgeVariant = "destructive";
                  } else if (daysToExpiry <= 30) {
                    badgeClass = "bg-orange-500 text-white border-none";
                  } else if (batch.qtyOnHand <= 5) {
                    badgeClass = "bg-blue-500 text-white border-none";
                  }

                  return (
                    <TableRow 
                      key={batch.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/medicines/${batch.medicineId}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{batch.medicineName}</div>
                        {batch.genericName && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {batch.genericName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{batch.batchNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {batch.qtyOnHand}
                          {batch.qtyOnHand <= 5 && <AlertCircle className="h-3 w-3 text-orange-500" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{format(expiryDate, "MMM yyyy")}</span>
                          <Badge variant={badgeVariant} className={`text-[10px] w-fit px-1 ${badgeClass}`}>
                            {daysToExpiry < 0 ? "Expired" : `In ${daysToExpiry} days`}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(batch.sellPriceMinor)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
