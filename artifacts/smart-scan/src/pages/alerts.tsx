import { useListAlerts, useAckAlert } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  Package, 
  IndianRupee, 
  CheckCircle2,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Alerts() {
  const { data: alerts, isLoading, refetch } = useListAlerts();
  const ackMutation = useAckAlert();

  const handleAck = async (id: string) => {
    try {
      await ackMutation.mutateAsync({ id });
      toast.success("Alert acknowledged");
      refetch();
    } catch (e) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const groupedAlerts = {
    critical: alerts?.filter(a => a.severity === "critical") || [],
    warning: alerts?.filter(a => a.severity === "warning") || [],
    info: alerts?.filter(a => a.severity === "info") || [],
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Alerts Inbox</h1>
          <p className="text-muted-foreground">Critical notifications about stock and payments.</p>
        </div>
        <Badge variant="secondary" className="gap-2 px-3 py-1">
          <Bell className="h-4 w-4" /> {alerts?.length || 0} Total
        </Badge>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (alerts?.length || 0) === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-20" />
          <h3 className="text-lg font-semibold">All clear!</h3>
          <p className="text-muted-foreground">No pending alerts at the moment.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedAlerts).map(([severity, list]) => {
            if (list.length === 0) return null;
            
            return (
              <div key={severity} className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                   <span className={`h-2 w-2 rounded-full ${
                     severity === "critical" ? "bg-destructive" : 
                     severity === "warning" ? "bg-orange-500" : "bg-blue-500"
                   }`} />
                   {severity} Alerts
                </h2>
                <div className="grid gap-3">
                  {list.map(alert => (
                    <Card key={alert.id} className="overflow-hidden border-l-4 border-l-transparent hover:bg-muted/30 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          alert.kind === "low_stock" ? "bg-orange-500/10 text-orange-600" :
                          alert.kind === "expired" ? "bg-destructive/10 text-destructive" :
                          alert.kind === "near_expiry" ? "bg-amber-500/10 text-amber-600" :
                          "bg-blue-500/10 text-blue-600"
                        }`}>
                          {alert.kind === "low_stock" || alert.kind === "expired" ? <Package className="h-5 w-5" /> :
                           alert.kind === "payment_due" ? <IndianRupee className="h-5 w-5" /> :
                           <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm line-clamp-1">{alert.message}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3" /> {format(new Date(alert.createdAt), "dd MMM, hh:mm a")}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-1"
                          onClick={() => handleAck(alert.id)}
                          disabled={ackMutation.isPending}
                        >
                          {ackMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          <span className="hidden sm:inline">Acknowledge</span>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
