import { useLocation, Link } from "wouter";
import { useListSuppliers } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Store, Phone, FileText, ChevronRight, IndianRupee } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Suppliers() {
  const { data: suppliers, isLoading, error } = useListSuppliers();
  const [, setLocation] = useLocation();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Suppliers</h1>
          <p className="text-muted-foreground">Manage your medicine wholesalers and payments.</p>
        </div>
        <Link href="/suppliers/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : suppliers?.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-semibold">No suppliers found</h3>
          <p className="text-muted-foreground mb-6">Get started by adding your first supplier.</p>
          <Link href="/suppliers/new">
            <Button variant="outline">Add Supplier</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers?.map((supplier) => (
            <Card 
              key={supplier.id} 
              className="cursor-pointer hover:border-primary transition-colors group"
              onClick={() => setLocation(`/suppliers/${supplier.id}`)}
            >
              <CardHeader className="p-4 pb-2 flex flex-row justify-between items-start space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{supplier.name}</CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {supplier.contactPhone || "No phone"}
                  </div>
                </div>
                <div className="p-2 rounded-full bg-primary/5 group-hover:bg-primary group-hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-4 border-t mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Outstanding</div>
                    <div className={`text-lg font-bold ${supplier.outstandingMinor > 0 ? "text-destructive" : "text-green-600"}`}>
                      {formatMoney(supplier.outstandingMinor)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Invoices</div>
                    <div className="text-lg font-bold">{supplier.invoiceCount}</div>
                  </div>
                </div>
                {supplier.nextDueDate && (
                  <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Next due: {supplier.nextDueDate}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
