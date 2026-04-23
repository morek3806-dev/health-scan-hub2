import { useListAlerts, useAckAlert, type Alert as AlertT } from "@workspace/api-client-react";
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
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const KIND_META: Record<string, { label: string; tone: string; Icon: typeof AlertTriangle }> = {
  low_stock: { label: "Low Stock", tone: "bg-orange-500/10 text-orange-600 border-orange-200", Icon: Package },
  near_expiry: { label: "Near Expiry", tone: "bg-amber-500/10 text-amber-600 border-amber-200", Icon: Clock },
  overdue_payment: { label: "Overdue Payment", tone: "bg-destructive/10 text-destructive border-destructive/30", Icon: IndianRupee },
};

export default function Alerts() {
  const { data: alerts, isLoading, refetch } = useListAlerts();
  const ackMutation = useAckAlert();

  const handleAck = async (id: string) => {
    try {
      await ackMutation.mutateAsync({ id });
      toast.success("Alert acknowledged");
      refetch();
    } catch {
      toast.error("Failed to acknowledge alert");
    }
  };

  const open = (alerts || []).filter((a) => !a.acknowledged);
  const grouped = open.reduce<Record<string, AlertT[]>>((acc, a) => {
    (acc[a.kind] = acc[a.kind] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts Inbox</h1>
          <p className="text-muted-foreground">Stock and payment notifications.</p>
        </div>
        <Badge variant="secondary" className="gap-2 px-3 py-1">
          <Bell className="h-4 w-4" /> {open.length} Open
        </Badge>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-30" />
          <h3 className="text-lg font-semibold">All clear</h3>
          <p className="text-muted-foreground">No pending alerts at the moment.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([kind, list]) => {
            const meta = KIND_META[kind] ?? { label: kind, tone: "bg-muted text-muted-foreground border-muted", Icon: AlertTriangle };
            const Icon = meta.Icon;
            return (
              <div key={kind} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" /> {meta.label} ({list.length})
                </h2>
                <div className="grid gap-3">
                  {list.map((alert) => (
                    <Card key={alert.id} className={`overflow-hidden border-l-4 ${meta.tone}`}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${meta.tone}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{alert.title}</div>
                          <div className="text-xs text-muted-foreground">{alert.message}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
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
