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
import { QrCode, Smartphone, Copy, Check, Loader2, Mail, Printer, MessageSquare, FileImage } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UploadedFile } from '@/types/ai4gp';

interface ChatQRCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagesReceived: (files: UploadedFile[]) => void;
}

export function ChatQRCaptureModal({
  open,
  onOpenChange,
  onImagesReceived
}: ChatQRCaptureModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [uploadCount, setUploadCount] = useState(0);
  const [receivedImages, setReceivedImages] = useState<UploadedFile[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  // Get the base URL for the capture page
  const getCaptureUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/ai-capture/${sessionToken}`;
  };
  
  // Create a capture session when modal opens
  useEffect(() => {
    if (open && !sessionToken) {
      createSession();
    }
  }, [open]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSessionToken('');
      setSessionId('');
      setUploadCount(0);
      setReceivedImages([]);
      setQrCodeUrl('');
    }
  }, [open]);
  
  const createSession = async () => {
    setIsCreatingSession(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        onOpenChange(false);
        return;
      }
      
      // Generate a random token
      const token = crypto.randomUUID();
      
      // Create the session in the database
      const { data: session, error } = await supabase
        .from('ai_chat_capture_sessions')
        .insert({
          user_id: user.id,
          session_token: token,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to create session:', error);
        toast.error('Failed to create capture session');
        onOpenChange(false);
        return;
      }
      
      setSessionToken(token);
      setSessionId(session.id);
    } catch (err) {
      console.error('Error creating session:', err);
      toast.error('Failed to create capture session');
      onOpenChange(false);
    } finally {
      setIsCreatingSession(false);
    }
  };
  
  // Generate QR code when session is created
  useEffect(() => {
    if (sessionToken) {
      const url = getCaptureUrl();
      QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }).then(setQrCodeUrl);
    }
  }, [sessionToken]);
  
  // Subscribe to image uploads via realtime
  useEffect(() => {
    if (!open || !sessionId) return;
    
    const channel = supabase
      .channel(`ai-chat-captures-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_chat_captured_images',
        filter: `session_id=eq.${sessionId}`
      }, async (payload) => {
        const newImage = payload.new as { id: string; file_name: string; file_url: string; file_size: number };
        
        setUploadCount(prev => prev + 1);
        
        // Create UploadedFile from the received image
        const uploadedFile: UploadedFile = {
          name: newImage.file_name,
          type: 'image/jpeg',
          content: newImage.file_url,
          size: newImage.file_size || 0,
          isLoading: false
        };
        
        setReceivedImages(prev => [...prev, uploadedFile]);
        toast.success('Photo received from phone');
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, sessionId]);
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getCaptureUrl());
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };
  
  const emailLink = () => {
    const url = getCaptureUrl();
    const subject = encodeURIComponent('Photo Capture Link');
    const body = encodeURIComponent(`Click this link to capture and send photos:\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };
  
  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Photo Capture QR Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              text-align: center;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 10px;
              color: #1a1a1a;
            }
            .subtitle {
              font-size: 18px;
              color: #666;
              margin-bottom: 30px;
            }
            img {
              width: 300px;
              height: 300px;
              border: 2px solid #e5e5e5;
              border-radius: 12px;
            }
            .instructions {
              margin-top: 30px;
              font-size: 16px;
              color: #666;
              max-width: 400px;
            }
            .url {
              margin-top: 20px;
              font-size: 12px;
              color: #999;
              word-break: break-all;
            }
            @media print {
              body { padding: 40px; }
            }
          </style>
        </head>
        <body>
          <h1>📷 Capture Photos</h1>
          <p class="subtitle">Scan this QR code with your phone camera</p>
          <img src="${qrCodeUrl}" alt="QR Code" />
          <p class="instructions">
            1. Open your phone's camera app<br/>
            2. Point at the QR code<br/>
            3. Tap the link that appears<br/>
            4. Take photos and upload
          </p>
          <p class="url">${getCaptureUrl()}</p>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  
  const copyForAccurx = () => {
    const url = getCaptureUrl();
    const message = `Please click this link to send us a photo: ${url}`;
    navigator.clipboard.writeText(message)
      .then(() => {
        toast.success('SMS text copied for Accurx');
      })
      .catch(() => {
        toast.error('Failed to copy');
      });
  };
  
  const handleDone = () => {
    if (receivedImages.length > 0) {
      onImagesReceived(receivedImages);
    }
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Capture Photos with Phone
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone to capture and send photos directly to this chat
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          {/* QR Code */}
          {isCreatingSession ? (
            <div className="w-[300px] h-[300px] bg-muted rounded-xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : qrCodeUrl ? (
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <img src={qrCodeUrl} alt="QR Code for photo capture" className="w-[300px] h-[300px]" />
            </div>
          ) : (
            <div className="w-[300px] h-[300px] bg-muted rounded-xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {/* Instructions */}
          <div className="mt-4 text-center text-sm text-muted-foreground space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>Open camera on your phone and scan</span>
            </div>
            <p>Photos will appear in your chat automatically</p>
          </div>
          
          {/* Upload count indicator */}
          {uploadCount > 0 && (
            <Badge variant="default" className="mt-4 bg-green-600">
              <FileImage className="h-3 w-3 mr-1" />
              {uploadCount} photo(s) received
            </Badge>
          )}
          
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              disabled={!sessionToken}
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
            
            <Button
              variant="outline"
              size="sm"
              onClick={emailLink}
              disabled={!sessionToken}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email Link
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={printQR}
              disabled={!qrCodeUrl}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print QR
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={copyForAccurx}
              disabled={!sessionToken}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Accurx SMS
            </Button>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={handleDone}>
            {receivedImages.length > 0 ? `Done (${receivedImages.length} photos)` : 'Done'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
