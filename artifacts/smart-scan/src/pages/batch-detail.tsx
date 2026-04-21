import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Layout } from '@/components/layout';
import { getInventory, removeBatch, MedicineBatch } from '@/lib/store';
import { lookupCatalog } from '@/lib/catalog';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Trash2, ShieldCheck, ShieldAlert, Package, Calendar, Tag, ChevronDown, Activity } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [batch, setBatch] = useState<MedicineBatch | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const inventory = getInventory();
    const found = inventory.find(b => b.id === id);
    if (found) {
      setBatch(found);
    } else {
      toast.error('Batch not found');
      setLocation('/');
    }
  }, [id, setLocation]);

  if (!batch) return null;

  const now = new Date();
  const expiryDate = new Date(batch.expiryDate);
  const daysToExpiry = differenceInDays(expiryDate, now);
  const isExpired = daysToExpiry < 0;
  
  const catalogEntry = batch.catalogId ? lookupCatalog(batch.medicineName) : null;

  const handleDelete = () => {
    removeBatch(batch.id);
    toast.success('Batch removed from inventory');
    setLocation('/');
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
              <ArrowLeft size={18} />
            </Button>
            <h2 className="text-2xl font-bold tracking-tight">Batch Details</h2>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 size={16} />
                Delete Batch
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove {batch.medicineName} (Batch: {batch.batchNumber}) from your inventory.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="border-sidebar-border shadow-sm">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                      {batch.medicineName}
                      {batch.verified ? (
                        <ShieldCheck size={24} className="text-primary" />
                      ) : (
                        <ShieldAlert size={24} className="text-amber-500" />
                      )}
                    </h1>
                    {batch.genericName && (
                      <p className="text-lg text-muted-foreground flex items-center gap-2">
                        <Activity size={18} />
                        {batch.genericName}
                      </p>
                    )}
                  </div>
                  
                  {isExpired ? (
                    <Badge variant="destructive" className="px-3 py-1 text-sm uppercase tracking-wider">
                      Expired
                    </Badge>
                  ) : daysToExpiry <= 30 ? (
                    <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 text-sm uppercase tracking-wider">
                      Expiring Soon
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-700 hover:bg-green-500/20 px-3 py-1 text-sm uppercase tracking-wider border-none">
                      Active
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4 mt-8">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Package size={16} />
                      Batch Number
                    </p>
                    <p className="text-lg font-mono">{batch.batchNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Tag size={16} />
                      Price (MRP)
                    </p>
                    <p className="text-lg font-medium">
                      {(batch.priceMinor / 100).toLocaleString('en-IN', { style: 'currency', currency: batch.currency })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Calendar size={16} />
                      Expiry Date
                    </p>
                    <p className={`text-lg font-medium ${isExpired ? 'text-destructive' : ''}`}>
                      {format(expiryDate, 'MMMM yyyy')}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({isExpired ? `${Math.abs(daysToExpiry)} days ago` : `in ${daysToExpiry} days`})
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Added On</p>
                    <p className="text-base text-muted-foreground">
                      {format(batch.createdAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {batch.rawOcrText && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-sidebar-border rounded-lg bg-card shadow-sm">
                <div className="px-6 py-4 flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    Source OCR Text
                  </h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                      <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="px-6 pb-6 pt-0">
                    <Separator className="mb-4" />
                    <div className="bg-muted rounded p-4 font-mono text-xs text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {batch.rawOcrText}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <div className="space-y-6">
            {catalogEntry && catalogEntry.alternatives.length > 0 && (
              <Card className="border-sidebar-border shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="text-base">Generic Alternatives</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3">
                    {catalogEntry.alternatives.map((alt, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span className="font-medium text-sm">{alt.name}</span>
                        <span className="text-sm text-muted-foreground">₹{(alt.priceMinor / 100).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            
            <Card className="border-sidebar-border shadow-sm bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <ShieldCheck className="text-primary mt-0.5 shrink-0" size={20} />
                <div className="text-sm">
                  <p className="font-semibold text-primary">System Checked</p>
                  <p className="text-muted-foreground mt-1">
                    This item has been scanned and cross-referenced with your local catalog.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
