import { useLocation, Link } from "wouter";
import { useListDoctors } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Stethoscope, Phone, Building2, ChevronRight, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Doctors() {
  const { data: doctors, isLoading } = useListDoctors();
  const [, setLocation] = useLocation();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Doctors</h1>
          <p className="text-muted-foreground">Manage prescribing physicians and referrals.</p>
        </div>
        <Link href="/doctors/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add Doctor
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Stethoscope className="h-5 w-5 text-primary mb-2" />
            <div className="text-2xl font-bold">{doctors?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Total Doctors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Award className="h-5 w-5 text-yellow-600 mb-2" />
            <div className="text-2xl font-bold">
              {doctors?.filter(d => d.scriptCount30d > 0).length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Active (30d)</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : doctors?.length === 0 ? (
        <Card className="p-12 text-center">
          <Stethoscope className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-semibold">No doctors found</h3>
          <p className="text-muted-foreground mb-6">Add doctors to track prescriptions and referrals.</p>
          <Link href="/doctors/new">
            <Button variant="outline">Add Doctor</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors?.map((doctor) => (
            <Card key={doctor.id} className="group">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Dr. {doctor.name}</CardTitle>
                    <div className="text-xs font-medium text-primary uppercase tracking-wider">{doctor.qualification || "General Physician"}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/5 text-primary">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-3">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Building2 className="h-3 w-3" /> {doctor.clinic || "No clinic listed"}</div>
                    <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {doctor.phone || "No phone"}</div>
                  </div>
                  <div className="pt-3 border-t grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Revenue (30d)</div>
                      <div className="font-bold text-primary">{formatMoney(doctor.revenueMinor30d)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Scripts</div>
                      <div className="font-bold">{doctor.scriptCount30d}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
