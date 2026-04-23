import { useLocation, Link } from "wouter";
import { useListCustomers } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, User, Phone, ChevronRight, IndianRupee, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Customers() {
  const { data: customers, isLoading } = useListCustomers();
  const [, setLocation] = useLocation();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Customers</h1>
          <p className="text-muted-foreground">Manage patients and Udhari (credit) accounts.</p>
        </div>
        <Link href="/customers/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : customers?.length === 0 ? (
        <Card className="p-12 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-semibold">No customers found</h3>
          <p className="text-muted-foreground mb-6">Add your first customer to track their purchase history.</p>
          <Link href="/customers/new">
            <Button variant="outline">Add Customer</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers?.map((customer) => (
            <Card 
              key={customer.id} 
              className="cursor-pointer hover:border-primary transition-colors group"
              onClick={() => setLocation(`/customers/${customer.id}`)}
            >
              <CardHeader className="p-4 pb-2 flex flex-row justify-between items-start space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {customer.phone || "No phone"}
                  </div>
                </div>
                <div className="p-2 rounded-full bg-primary/5 group-hover:bg-primary group-hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-4 border-t mt-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Balance Due</div>
                    <div className={`text-xl font-bold ${customer.balanceMinor > 0 ? "text-destructive" : "text-green-600"}`}>
                      {formatMoney(customer.balanceMinor)}
                    </div>
                  </div>
                  {customer.lastActivityAt && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {format(new Date(customer.lastActivityAt), "dd MMM")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
