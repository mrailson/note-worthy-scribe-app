import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCodeSVG from 'qrcode-svg';

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyTitle: string;
  publicToken: string;
  shortCode?: string;
}

export const QRCodeModal = ({
  open,
  onOpenChange,
  surveyTitle,
  publicToken,
  shortCode,
}: QRCodeModalProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  // Use short URL if available, otherwise fall back to public_token
  const surveyUrl = shortCode 
    ? `${window.location.origin}/s/${shortCode}`
    : `${window.location.origin}/survey/${publicToken}`;

  useEffect(() => {
    if (open && (publicToken || shortCode)) {
      const qr = new QRCodeSVG({
        content: surveyUrl,
        width: 300,
        height: 300,
        padding: 4,
        color: '#000000',
        background: '#ffffff',
        ecl: 'M',
      });
      setQrSvg(qr.svg());
    }
  }, [open, publicToken, shortCode, surveyUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    toast({
      title: 'Link copied',
      description: 'Survey link copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    // Create a canvas from SVG
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw QR code
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 30, 300, 300);
      
      // Add title
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(surveyTitle, canvas.width / 2, 370);
      
      // Add instruction
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText('Scan to complete survey', canvas.width / 2, 400);
      
      // Add URL (truncated if needed)
      ctx.font = '10px system-ui, sans-serif';
      const displayUrl = surveyUrl.length > 50 ? surveyUrl.slice(0, 47) + '...' : surveyUrl;
      ctx.fillText(displayUrl, canvas.width / 2, 430);

      // Download
      const link = document.createElement('a');
      link.download = `${surveyTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-qr-code.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: 'Downloaded',
        description: 'QR code saved as PNG',
      });
    };
    
    const svgBlob = new Blob([qrSvg], { type: 'image/svg+xml' });
    img.src = URL.createObjectURL(svgBlob);
  };

  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Survey QR Code - ${surveyTitle}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 40px;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 20px;
              color: #000;
            }
            .qr-code {
              margin: 20px auto;
            }
            .instruction {
              font-size: 18px;
              color: #666;
              margin-top: 20px;
            }
            .url {
              font-size: 12px;
              color: #999;
              margin-top: 10px;
              word-break: break-all;
              max-width: 400px;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>${surveyTitle}</h1>
            <div class="qr-code">${qrSvg}</div>
            <p class="instruction">Scan to complete survey</p>
            <p class="url">${surveyUrl}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Survey QR Code</DialogTitle>
          <DialogDescription>
            Print or download this QR code for your waiting room
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4" ref={printRef}>
          <div
            className="bg-white p-4 rounded-lg border"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-4 font-medium text-center">{surveyTitle}</p>
          <p className="text-sm text-muted-foreground">Scan to complete survey</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={copyLink} variant="outline" className="w-full">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Survey Link
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button onClick={downloadQR} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
            <Button onClick={printQR} variant="outline" className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
