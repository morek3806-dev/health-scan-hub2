import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Camera, FileImage, Image as ImageIcon } from 'lucide-react';
import { useScanStore } from '@/lib/store';
import { parseOcrText } from '@/lib/ocr';

export default function Scan() {
  const [, setLocation] = useLocation();
  const setScanData = useScanStore(state => state.setScanData);
  const clearScanData = useScanStore(state => state.clearScanData);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (fileOrUrl: File | string) => {
    try {
      setIsScanning(true);
      clearScanData();
      setProgress(10);
      setStatusText('Initializing engine...');

      // Dynamic import to keep bundle small
      const Tesseract = (await import('tesseract.js')).default;
      
      setProgress(30);
      setStatusText('Reading text from image...');
      
      const result = await Tesseract.recognize(
        fileOrUrl,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(30 + Math.floor(m.progress * 60));
            }
          }
        }
      );

      setProgress(95);
      setStatusText('Parsing medical data...');
      
      const rawText = result.data.text;
      const parsed = parseOcrText(rawText);
      
      const imageUrl = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
      setScanData(imageUrl, parsed, rawText);
      
      setProgress(100);
      setTimeout(() => {
        setLocation('/scan/review');
      }, 400);

    } catch (err) {
      console.error(err);
      setIsScanning(false);
      setStatusText('Scan failed. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleScan(e.target.files[0]);
    }
  };

  const handleSample = () => {
    handleScan('/samples/sample-bill.png');
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col p-6 md:p-8 max-w-3xl mx-auto w-full justify-center">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Scan Medical Bill</h2>
          <p className="text-muted-foreground text-lg">Upload or snap a photo of a pharmacy bill to extract data instantly.</p>
        </div>

        {isScanning ? (
          <Card className="border-sidebar-border shadow-lg p-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ScanLineAnimated />
              </div>
              <h3 className="text-xl font-semibold mb-2">{statusText}</h3>
              <Progress value={progress} className="h-2 w-full max-w-sm mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card 
              className="border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer shadow-sm group"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="p-10 flex flex-col items-center text-center">
                <div className="p-4 bg-background rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform text-primary">
                  <Camera size={32} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Camera or Upload</h3>
                <p className="text-sm text-muted-foreground">Take a photo or upload an image file</p>
              </CardContent>
            </Card>

            <Card 
              className="border-sidebar-border hover:border-sidebar-accent-foreground/20 hover:bg-muted/50 transition-all cursor-pointer shadow-sm group"
              onClick={handleSample}
            >
              <CardContent className="p-10 flex flex-col items-center text-center">
                <div className="p-4 bg-background rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform text-muted-foreground">
                  <FileImage size={32} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Use Sample Bill</h3>
                <p className="text-sm text-muted-foreground">Try the demo with a pre-generated bill</p>
              </CardContent>
            </Card>
          </div>
        )}
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>
    </Layout>
  );
}

function ScanLineAnimated() {
  return (
    <div className="relative">
      <FileImage size={32} className="text-primary" />
      <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(20,184,166,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
    </div>
  );
}
