import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateDoctor } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

export default function DoctorNew() {
  const [, setLocation] = useLocation();
  const createDoctorMutation = useCreateDoctor();
  
  const [formData, setFormData] = useState({
    name: "",
    qualification: "",
    clinic: "",
    phone: "",
    registrationNo: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Doctor name is required");
      return;
    }

    try {
      await createDoctorMutation.mutateAsync({ data: formData });
      toast.success("Doctor profile created");
      setLocation("/doctors");
    } catch (e) {
      toast.error("Failed to create doctor profile");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <header>
        <Button variant="ghost" className="gap-2 mb-4" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Register New Doctor</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Stethoscope className="h-4 w-4" /> Professional Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Doctor Name *</Label>
              <div className="flex gap-2">
                <div className="bg-muted px-3 py-2 border rounded-md text-sm font-medium flex items-center">Dr.</div>
                <Input 
                  id="name" 
                  placeholder="Full name" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qual">Qualification</Label>
                <Input 
                  id="qual" 
                  placeholder="e.g. MBBS, MD" 
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg">Registration No</Label>
                <Input 
                  id="reg" 
                  placeholder="Medical Council Reg No" 
                  value={formData.registrationNo}
                  onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic">Clinic / Hospital Name</Label>
              <Input 
                id="clinic" 
                placeholder="Where does the doctor practice?" 
                value={formData.clinic}
                onChange={(e) => setFormData({ ...formData, clinic: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Contact Phone</Label>
              <Input 
                id="phone" 
                placeholder="Doctor's or clinic's phone" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={createDoctorMutation.isPending}>
              {createDoctorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Doctor Profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
