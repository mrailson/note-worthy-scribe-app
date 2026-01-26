import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Smartphone, Copy, Check, Loader2, FileText } from 'lucide-react';
import QRCode from 'qrcode';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';

interface DocumentCaptureQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionToken: string;
  sessionId: string;
  onDocumentUploaded?: () => void;
}

export function DocumentCaptureQRModal({
  open,
  onOpenChange,
  sessionToken,
  sessionId,
  onDocumentUploaded
}: DocumentCaptureQRModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  
  // Get the base URL for the capture page
  const getCaptureUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/doc-capture/${sessionToken}`;
  };
  
  // Generate QR code
  useEffect(() => {
    if (open && sessionToken) {
      const url = getCaptureUrl();
      QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }).then(setQrCodeUrl);
    }
  }, [open, sessionToken]);
  
  // Subscribe to document uploads
  useEffect(() => {
    if (!open || !sessionId) return;
    
    const channel = supabase
      .channel(`doc-uploads-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'translation_documents',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setUploadCount(prev => prev + 1);
        onDocumentUploaded?.();
        showToast.success('Document uploaded from phone');
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, sessionId, onDocumentUploaded]);
  
  // Reset upload count when modal opens
  useEffect(() => {
    if (open) {
      setUploadCount(0);
    }
  }, [open]);
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getCaptureUrl());
      setCopied(true);
      showToast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast.error('Failed to copy link');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Capture Documents with Phone
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone or iPad to capture photos of documents
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          {/* QR Code */}
          {qrCodeUrl ? (
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <img src={qrCodeUrl} alt="QR Code for document capture" className="w-64 h-64" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {/* Instructions */}
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>Open camera on your phone and scan</span>
            </div>
            <p>Photos will appear in your document queue automatically</p>
          </div>
          
          {/* Upload count indicator */}
          {uploadCount > 0 && (
            <Badge variant="default" className="mt-4 bg-green-600">
              <FileText className="h-3 w-3 mr-1" />
              {uploadCount} document(s) received
            </Badge>
          )}
          
          {/* Copy link button */}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={copyLink}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </>
            )}
          </Button>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
