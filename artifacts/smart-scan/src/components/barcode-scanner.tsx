import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, CameraOff, Loader2 } from "lucide-react";

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    setSupported(typeof window !== "undefined" && !!window.BarcodeDetector);
    setError(null);
    stoppedRef.current = false;

    const start = async () => {
      if (!window.BarcodeDetector) return;
      setStarting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector!({
          formats: ["code_128", "ean_13", "ean_8", "code_39", "qr_code", "upc_a", "upc_e"],
        });
        const tick = async () => {
          if (stoppedRef.current || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              const code = results[0].rawValue.trim();
              if (code) {
                stoppedRef.current = true;
                cleanup();
                onDetected(code);
                return;
              }
            }
          } catch {
            // ignore frame errors
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera unavailable");
      } finally {
        setStarting(false);
      }
    };

    const cleanup = () => {
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    start();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    setManual("");
    onDetected(code);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Scan Batch Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {supported === false ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-sm">
              <CameraOff className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                Camera barcode scanning is not supported on this browser. Use the manual entry below.
              </div>
            </div>
          ) : (
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-1 bg-primary/80 shadow-lg shadow-primary/50 rounded-full animate-pulse" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-black/60">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Starting camera...
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-black/70 text-center p-4 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Or enter batch number manually</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. PCT-2027A"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitManual()}
              />
              <Button onClick={submitManual} disabled={!manual.trim()}>Add</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
