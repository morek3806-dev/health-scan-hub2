import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/layout';
import { useScanStore, addBatch, getInventory } from '@/lib/store';
import { lookupCatalog, checkInteractions, CatalogEntry, InteractionSeverity } from '@/lib/catalog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, AlertTriangle, ArrowLeft, Save, AlertCircle, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function Review() {
  const [, setLocation] = useLocation();
  const { imageUrl, parsedData, rawText, clearScanData } = useScanStore();
  
  const [medicineName, setMedicineName] = useState(parsedData?.medicineName || '');
  const [batchNumber, setBatchNumber] = useState(parsedData?.batchNumber || '');
  const [expiryDate, setExpiryDate] = useState(
    parsedData?.expiryDate ? format(parseISO(parsedData.expiryDate), 'yyyy-MM-dd') : ''
  );
  const [priceMinor, setPriceMinor] = useState(parsedData?.priceMinor ? (parsedData.priceMinor / 100).toString() : '');

  const [catalogMatch, setCatalogMatch] = useState<CatalogEntry | null>(null);
  const [interactions, setInteractions] = useState<{generic: string, interaction: {severity: InteractionSeverity, description: string}}[]>([]);

  useEffect(() => {
    if (!parsedData && !imageUrl) {
      setLocation('/scan');
      return;
    }

    if (medicineName) {
      const match = lookupCatalog(medicineName);
      setCatalogMatch(match || null);

      if (match) {
        const inventory = getInventory();
        const existingGenerics = inventory.map(b => b.genericName).filter(Boolean) as string[];
        const alerts = checkInteractions(match.genericName, existingGenerics);
        setInteractions(alerts);
      } else {
        setInteractions([]);
      }
    }
  }, [medicineName, imageUrl, parsedData, setLocation]);

  const handleSave = () => {
    if (!medicineName || !batchNumber || !expiryDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    addBatch({
      id: `b-${Date.now()}`,
      medicineName,
      genericName: catalogMatch?.genericName,
      batchNumber,
      expiryDate: new Date(expiryDate).toISOString(),
      priceMinor: Math.round(parseFloat(priceMinor || '0') * 100),
      currency: 'INR',
      verified: !!catalogMatch,
      catalogId: catalogMatch?.catalogId,
      rawOcrText: rawText || undefined,
      createdAt: Date.now(),
    });

    clearScanData();
    toast.success('Batch saved successfully');
    setLocation('/');
  };

  if (!imageUrl) return null;

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-4 md:p-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/scan')}>
              <ArrowLeft size={18} />
            </Button>
            <h2 className="text-xl font-bold tracking-tight">Review Extracted Data</h2>
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save size={16} />
            Confirm & Save
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            
            {catalogMatch ? (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="text-green-600 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-400">Verified in Catalog</p>
                  <p className="text-sm text-green-700 dark:text-green-500 mt-1">
                    Matched as <span className="font-medium">{catalogMatch.canonicalName}</span> ({catalogMatch.genericName})
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-400">Not Found in Catalog</p>
                  <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                    This medicine isn't in your standard catalog. You can still save it as an unverified entry.
                  </p>
                </div>
              </div>
            )}

            <Card className="border-sidebar-border shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="medName">Medicine Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="medName" 
                    value={medicineName} 
                    onChange={e => setMedicineName(e.target.value)} 
                    className="font-medium text-lg"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="batch">Batch Number <span className="text-destructive">*</span></Label>
                    <Input 
                      id="batch" 
                      value={batchNumber} 
                      onChange={e => setBatchNumber(e.target.value)} 
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Date <span className="text-destructive">*</span></Label>
                    <Input 
                      id="expiry" 
                      type="date"
                      value={expiryDate} 
                      onChange={e => setExpiryDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (MRP)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                    <Input 
                      id="price" 
                      type="number"
                      step="0.01"
                      value={priceMinor} 
                      onChange={e => setPriceMinor(e.target.value)} 
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {interactions.length > 0 && (
              <Card className="border-destructive/30 shadow-sm bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle size={20} />
                    Drug Interactions Detected
                  </CardTitle>
                  <CardDescription className="text-destructive/80">
                    This new medicine clashes with existing stock.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {interactions.map((alert, i) => (
                    <div key={i} className="bg-background rounded-md p-3 border border-destructive/20 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">With <span className="underline decoration-dashed">{alert.generic}</span></p>
                        <Badge variant="outline" className={`
                          ${alert.interaction.severity === 'MAJOR' ? 'border-destructive text-destructive' : ''}
                          ${alert.interaction.severity === 'MODERATE' ? 'border-orange-500 text-orange-600' : ''}
                          ${alert.interaction.severity === 'MINOR' ? 'border-amber-400 text-amber-600' : ''}
                        `}>
                          {alert.interaction.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.interaction.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {catalogMatch && catalogMatch.alternatives.length > 0 && (
              <Card className="border-sidebar-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown size={20} className="text-primary" />
                    Generic Alternatives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {catalogMatch.alternatives.map((alt, i) => (
                      <li key={i} className="flex justify-between items-center py-2 border-b last:border-0 border-border">
                        <span className="font-medium">{alt.name}</span>
                        <span className="text-muted-foreground">₹{(alt.priceMinor / 100).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="border-sidebar-border shadow-sm overflow-hidden sticky top-6">
              <div className="bg-muted p-2 border-b border-border text-xs font-medium text-center uppercase tracking-wider text-muted-foreground">
                Source Document
              </div>
              <img src={imageUrl} alt="Scanned bill" className="w-full object-contain max-h-[500px] border-b border-border" />
              <div className="p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Raw OCR Output (Debug)</p>
                <div className="bg-background rounded border border-border p-3 text-[10px] font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto text-muted-foreground">
                  {rawText || 'No text extracted.'}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
