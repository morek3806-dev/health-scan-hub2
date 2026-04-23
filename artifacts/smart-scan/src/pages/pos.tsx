import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { 
  useListMedicines, 
  useListBatches, 
  useListCustomers, 
  useListDoctors, 
  useCreateSale 
} from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/card-border"; // Wait, button is in ui/button
import { Button as UIButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ShoppingCart, Plus, Minus, Trash2, User, Stethoscope, CreditCard, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface CartItem {
  batchId: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  qty: number;
  sellPriceMinor: number;
  buyPriceMinor: number;
  stock: number;
}

export default function POS() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [prescriptionNo, setPrescriptionNo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "udhari">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const { data: medicines, isLoading: medicinesLoading } = useListMedicines({ search: search || undefined });
  const { data: customers } = useListCustomers();
  const { data: doctors } = useListDoctors();
  const createSaleMutation = useCreateSale();

  const [selectedMedForBatch, setSelectedMedForBatch] = useState<any>(null);
  const { data: batches } = useListBatches({ medicineId: selectedMedForBatch?.id } as any);

  const availableBatches = useMemo(() => {
    return batches?.filter(b => b.qtyOnHand > 0) || [];
  }, [batches]);

  const addToCart = (medicine: any, batch: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.batchId === batch.id);
      if (existing) {
        if (existing.qty >= batch.qtyOnHand) {
          toast.error("Not enough stock");
          return prev;
        }
        return prev.map(item => 
          item.batchId === batch.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, {
        batchId: batch.id,
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchNumber: batch.batchNumber,
        qty: 1,
        sellPriceMinor: batch.sellPriceMinor,
        buyPriceMinor: batch.buyPriceMinor,
        stock: batch.qtyOnHand
      }];
    });
    setSelectedMedForBatch(null);
    toast.success("Added to cart");
  };

  const updateQty = (batchId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.batchId === batchId) {
        const newQty = Math.max(0, item.qty + delta);
        if (newQty > item.stock) {
          toast.error("Not enough stock");
          return item;
        }
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sellPriceMinor * item.qty), 0);
  const total = Math.max(0, subtotal - (discount * 100));

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (paymentMethod === "udhari" && !customerId) {
      toast.error("Customer required for Udhari");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: customerId || undefined,
        doctorId: doctorId || undefined,
        prescriptionNo: prescriptionNo || undefined,
        paymentMethod: paymentMethod as any,
        discountMinor: Math.round(discount * 100),
        lines: cart.map(item => ({
          batchId: item.batchId,
          medicineId: item.medicineId,
          qty: item.qty,
          sellPriceMinor: item.sellPriceMinor
        }))
      };

      const sale = await createSaleMutation.mutateAsync({ data: payload });
      toast.success(`Sale completed: ${sale.invoiceNo}`);
      setCart([]);
      setDiscount(0);
      setLocation(`/sales/${sale.id}`);
    } catch (e) {
      toast.error("Failed to complete sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen overflow-hidden bg-background">
      {/* Left Panel: Search & Catalog */}
      <div className="flex-1 flex flex-col p-4 border-r overflow-hidden">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search medicine..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-4">
            {medicinesLoading ? (
               Array.from({ length: 9 }).map((_, i) => (
                <Card key={i} className="animate-pulse h-24" />
              ))
            ) : medicines?.map(med => (
              <Card 
                key={med.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedMedForBatch(med)}
              >
                <CardContent className="p-3">
                  <div className="font-medium text-sm line-clamp-1">{med.name}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1">{med.genericName}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-primary font-bold text-xs">{formatMoney(med.sellPriceMinor)}</span>
                    <Badge variant="outline" className="text-[9px] px-1">{med.qtyOnHand || 0} left</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className="w-full md:w-[400px] flex flex-col bg-card border-t md:border-t-0 overflow-hidden shadow-lg">
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Cart ({cart.length})
          </CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Your cart is empty</p>
              </div>
            ) : cart.map(item => (
              <div key={item.batchId} className="flex justify-between items-start border-b pb-3">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-sm font-medium line-clamp-1">{item.medicineName}</div>
                  <div className="text-[10px] text-muted-foreground">Batch: {item.batchNumber}</div>
                  <div className="text-xs font-semibold mt-1">{formatMoney(item.sellPriceMinor)} each</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 bg-muted rounded-md p-1">
                    <button 
                      onClick={() => updateQty(item.batchId, -1)}
                      className="p-1 hover:bg-background rounded"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold min-w-[20px] text-center">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.batchId, 1)}
                      className="p-1 hover:bg-background rounded"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold">{formatMoney(item.sellPriceMinor * item.qty)}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer: Totals & Meta */}
        <div className="p-4 border-t space-y-4 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer</Label>
              <select 
                className="w-full text-xs p-2 rounded-md border bg-background"
                value={customerId || ""}
                onChange={(e) => setCustomerId(e.target.value || null)}
              >
                <option value="">Walk-in Customer</option>
                {customers?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Doctor</Label>
              <select 
                className="w-full text-xs p-2 rounded-md border bg-background"
                value={doctorId || ""}
                onChange={(e) => setDoctorId(e.target.value || null)}
              >
                <option value="">No Doctor</option>
                {doctors?.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Method</Label>
            <RadioGroup 
              value={paymentMethod} 
              onValueChange={(val: any) => setPaymentMethod(val)}
              className="flex flex-wrap gap-2"
            >
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="cash" id="p-cash" />
                <Label htmlFor="p-cash" className="text-xs">Cash</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="upi" id="p-upi" />
                <Label htmlFor="p-upi" className="text-xs">UPI</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="card" id="p-card" />
                <Label htmlFor="p-card" className="text-xs">Card</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="udhari" id="p-udhari" />
                <Label htmlFor="p-udhari" className="text-xs">Udhari</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Discount (₹)</span>
              <Input 
                type="number" 
                className="h-7 w-20 text-right text-xs" 
                value={discount} 
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t text-primary">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

          <UIButton 
            className="w-full py-6 text-lg font-bold gap-2" 
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCompleteSale}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
            Complete Sale
          </UIButton>
        </div>
      </div>

      {/* Batch Selection Dialog */}
      <Dialog open={!!selectedMedForBatch} onOpenChange={() => setSelectedMedForBatch(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Select Batch for {selectedMedForBatch?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {availableBatches.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No stock available for this medicine.</div>
            ) : (
              availableBatches.map(batch => (
                <div 
                  key={batch.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => addToCart(selectedMedForBatch, batch)}
                >
                  <div>
                    <div className="font-bold text-sm">{batch.batchNumber}</div>
                    <div className="text-xs text-muted-foreground">Expiry: {batch.expiryDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{formatMoney(batch.sellPriceMinor)}</div>
                    <div className="text-[10px] text-muted-foreground">{batch.qtyOnHand} in stock</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
