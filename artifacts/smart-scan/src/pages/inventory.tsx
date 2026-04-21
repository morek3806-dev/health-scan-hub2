import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { format, differenceInDays } from 'date-fns';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScanLine, Search, AlertCircle, CheckCircle2, Package, Clock, ShieldCheck } from 'lucide-react';
import { getInventory, MedicineBatch } from '@/lib/store';

export default function Inventory() {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setBatches(getInventory());
  }, []);

  const now = new Date();
  
  const total = batches.length;
  const expired = batches.filter(b => differenceInDays(new Date(b.expiryDate), now) < 0).length;
  const expiringSoon = batches.filter(b => {
    const days = differenceInDays(new Date(b.expiryDate), now);
    return days >= 0 && days <= 30;
  }).length;

  const filtered = batches.filter(b => 
    b.medicineName.toLowerCase().includes(search.toLowerCase()) || 
    b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
    (b.genericName && b.genericName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Layout>
      <div className="flex-1 p-6 md:p-8 overflow-y-auto w-full max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
            <p className="text-muted-foreground">Manage your medicine batches and expiries.</p>
          </div>
          <Link href="/scan" className="w-full md:w-auto">
            <Button size="lg" className="w-full md:w-auto gap-2 shadow-sm">
              <ScanLine size={18} />
              Scan New Bill
            </Button>
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-sidebar-border shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Package size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Batches</p>
                <h3 className="text-2xl font-bold">{total}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="border-sidebar-border shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring &lt; 30 Days</p>
                <h3 className="text-2xl font-bold">{expiringSoon}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="border-sidebar-border shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-destructive/10 text-destructive rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired</p>
                <h3 className="text-2xl font-bold">{expired}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-card border border-sidebar-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-sidebar-border flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input 
                placeholder="Search medicine or batch no..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch No</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No batches found. Try a different search or scan a bill.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((batch, i) => {
                    const expiryDate = new Date(batch.expiryDate);
                    const daysToExpiry = differenceInDays(expiryDate, now);
                    
                    let expiryColor = "bg-green-500/10 text-green-700 dark:text-green-400";
                    let expiryText = `In ${daysToExpiry} days`;
                    
                    if (daysToExpiry < 0) {
                      expiryColor = "bg-destructive/10 text-destructive";
                      expiryText = "Expired";
                    } else if (daysToExpiry <= 30) {
                      expiryColor = "bg-orange-500/10 text-orange-600 dark:text-orange-400";
                    }

                    return (
                      <TableRow key={batch.id} className={`hover:bg-muted/50 transition-colors cursor-pointer group`} onClick={() => window.location.href = `/batch/${batch.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-foreground flex items-center gap-1.5">
                                {batch.medicineName}
                                {batch.verified && <ShieldCheck size={14} className="text-primary" />}
                              </p>
                              {batch.genericName && (
                                <p className="text-xs text-muted-foreground">{batch.genericName}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{batch.batchNumber}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <span className="text-sm">{format(expiryDate, 'MMM yyyy')}</span>
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 rounded-sm font-medium ${expiryColor} border-none`}>
                              {expiryText}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(batch.priceMinor / 100).toLocaleString('en-IN', { style: 'currency', currency: batch.currency })}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
