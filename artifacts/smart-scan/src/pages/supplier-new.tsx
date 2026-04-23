import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateSupplier } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

export default function SupplierNew() {
  const [, setLocation] = useLocation();
  const createSupplierMutation = useCreateSupplier();
  
  const [formData, setFormData] = useState({
    name: "",
    contactPhone: "",
    gstin: "",
    address: "",
    creditDays: 30,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      const supplier = await createSupplierMutation.mutateAsync({ data: formData });
      toast.success("Supplier created");
      setLocation(`/suppliers/${supplier.id}`);
    } catch (e) {
      toast.error("Failed to create supplier");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <header>
        <Button variant="ghost" className="gap-2 mb-4" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Add New Supplier</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Store className="h-4 w-4" /> Supplier Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input 
                id="name" 
                placeholder="e.g. LifeCare Wholesalers" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  placeholder="10-digit mobile" 
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst">GSTIN</Label>
                <Input 
                  id="gst" 
                  placeholder="22AAAAA0000A1Z5" 
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Credit Days</Label>
              <Input 
                id="days" 
                type="number" 
                value={formData.creditDays}
                onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea 
                id="address" 
                placeholder="Full business address" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={createSupplierMutation.isPending}>
              {createSupplierMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Supplier
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
