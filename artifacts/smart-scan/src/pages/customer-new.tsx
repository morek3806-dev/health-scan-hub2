import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCustomer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { toast } from "sonner";

export default function CustomerNew() {
  const [, setLocation] = useLocation();
  const createCustomerMutation = useCreateCustomer();
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    udhariLimitMinor: 0,
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      const customer = await createCustomerMutation.mutateAsync({ 
        data: {
          ...formData,
          udhariLimitMinor: Math.round((parseFloat(formData.udhariLimitMinor as any) || 0) * 100)
        } 
      });
      toast.success("Customer added");
      setLocation(`/customers/${customer.id}`);
    } catch (e) {
      toast.error("Failed to add customer");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <header>
        <Button variant="ghost" className="gap-2 mb-4" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Add New Customer</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <User className="h-4 w-4" /> Patient Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input 
                id="name" 
                placeholder="Patient's name" 
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
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Udhari Limit (₹)</Label>
                <Input 
                  id="limit" 
                  type="number"
                  placeholder="0.00" 
                  value={formData.udhariLimitMinor}
                  onChange={(e) => setFormData({ ...formData, udhariLimitMinor: e.target.value as any })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea 
                id="address" 
                placeholder="Patient's home address" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Allergies, chronic conditions, etc." 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={createCustomerMutation.isPending}>
              {createCustomerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Customer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
