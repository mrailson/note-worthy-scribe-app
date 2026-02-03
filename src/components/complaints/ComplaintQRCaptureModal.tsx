import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  QrCode, 
  Smartphone, 
  Copy, 
  Check, 
  Loader2, 
  FileText, 
  Mail, 
  Printer,
  MessageSquare,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CapturedImage {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  ocr_text: string | null;
  processed: boolean;
  created_at: string;
}

interface ComplaintQRCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagesReceived?: (images: CapturedImage[]) => void;
}

export function ComplaintQRCaptureModal({
  open,
  onOpenChange,
  onImagesReceived
}: ComplaintQRCaptureModalProps) {
  const { user } = useAuth();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  
  // Get the base URL for the capture page
  const getCaptureUrl = useCallback(() => {
    const baseUrl = window.location.origin;
    return shortCode ? `${baseUrl}/complaint-capture/${shortCode}` : '';
  }, [shortCode]);
  
  // Create capture session
  const createSession = useCallback(async () => {
    if (!user || isCreatingSession) return;
    
    setIsCreatingSession(true);
    try {
      const sessionToken = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('complaint_capture_sessions')
        .insert({
          user_id: user.id,
          session_token: sessionToken,
        })
        .select('id, short_code')
        .single();
      
      if (error) throw error;
      
      setSessionId(data.id);
      setShortCode(data.short_code);
      
    } catch (error) {
      console.error('Failed to create capture session:', error);
      showToast.error('Failed to create capture session');
    } finally {
      setIsCreatingSession(false);
    }
  }, [user, isCreatingSession]);
  
  // Generate QR code when short code is available
  useEffect(() => {
    if (shortCode) {
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
  }, [shortCode, getCaptureUrl]);
  
  // Create session when modal opens
  useEffect(() => {
    if (open && user && !sessionId) {
      createSession();
    }
  }, [open, user, sessionId, createSession]);
  
  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant two-tone chime
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  // Subscribe to image uploads
  useEffect(() => {
    if (!open || !sessionId) return;
    
    const channel = supabase
      .channel(`complaint-captures-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'complaint_captured_images',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const newImage = payload.new as CapturedImage;
        setCapturedImages(prev => {
          // De-dupe (can happen if we fetch existing images then also receive inserts)
          if (prev.some(img => img.id === newImage.id)) return prev;

          const newImages = [...prev, newImage];
          // Show toast with updated count
          playNotificationSound();
          showToast.success(`📷 Photo ${newImages.length} received from phone!`, {
            duration: 3000,
          });
          return newImages;
        });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, sessionId, playNotificationSound]);

  // Load any images already uploaded for this session (covers cases where Realtime events were missed)
  useEffect(() => {
    if (!open || !sessionId) return;

    let cancelled = false;

    const loadExisting = async () => {
      setIsLoadingExisting(true);
      try {
        const { data, error } = await supabase
          .from('complaint_captured_images')
          .select('id, file_name, file_url, file_size, ocr_text, processed, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        setCapturedImages((prev) => {
          const byId = new Map<string, CapturedImage>();
          prev.forEach((img) => byId.set(img.id, img));
          (data ?? []).forEach((img) => byId.set(img.id, img as CapturedImage));
          return Array.from(byId.values());
        });
      } catch (e) {
        // Non-fatal; Realtime may still bring images in.
        console.warn('Failed to load existing captured images', e);
      } finally {
        if (!cancelled) setIsLoadingExisting(false);
      }
    };

    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);
  
  // Subscribe to phone connection broadcasts
  useEffect(() => {
    if (!open || !sessionId) return;
    
    const channel = supabase
      .channel(`complaint-connection-${sessionId}`)
      .on('broadcast', { event: 'phone_connected' }, () => {
        setIsPhoneConnected(true);
        playNotificationSound();
        showToast.success('📱 Phone connected!');
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, sessionId, playNotificationSound]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Don't reset immediately to allow for re-opening
      const timeout = setTimeout(() => {
        if (!open) {
          setSessionId(null);
          setShortCode(null);
          setQrCodeUrl('');
          setCapturedImages([]);
          setIsPhoneConnected(false);
        }
      }, 500);
      return () => clearTimeout(timeout);
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
  
  const emailLink = () => {
    const subject = encodeURIComponent('Capture Complaint Documents');
    const body = encodeURIComponent(`Use this link to capture photos of complaint documents:\n\n${getCaptureUrl()}\n\nThis link expires in 60 minutes.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };
  
  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrCodeUrl) {
      printWindow.document.write(`
        <html>
          <head><title>Complaint Capture QR Code</title></head>
          <body style="text-align: center; padding: 40px; font-family: Arial, sans-serif;">
            <h2>Scan to Capture Complaint Documents</h2>
            <img src="${qrCodeUrl}" style="width: 300px; height: 300px;" />
            <p style="margin-top: 20px;">Code: <strong>${shortCode}</strong></p>
            <p style="color: #666;">Link expires in 60 minutes</p>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">${getCaptureUrl()}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  const handleDone = () => {
    if (capturedImages.length > 0 && onImagesReceived) {
      onImagesReceived(capturedImages);
    }
    onOpenChange(false);
  };
  
  const removeImage = (imageId: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== imageId));
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
            Scan this QR code with your phone to capture photos of complaint letters or documents
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          {/* Connected badge */}
          {isPhoneConnected && (
            <Badge variant="default" className="bg-green-600 mb-3 animate-pulse">
              <Smartphone className="h-3 w-3 mr-1" />
              Phone Connected
            </Badge>
          )}
          
          {/* QR Code */}
          {qrCodeUrl ? (
            <div className={`bg-white p-4 rounded-xl shadow-lg transition-all ${isPhoneConnected ? 'ring-2 ring-green-500' : ''}`}>
              <img src={qrCodeUrl} alt="QR Code for document capture" className="w-64 h-64" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {/* Short code display */}
          {shortCode && (
            <p className="mt-2 text-sm text-muted-foreground">
              Code: <span className="font-mono font-bold">{shortCode}</span>
            </p>
          )}
          
          {/* Instructions OR Captured images */}
          {capturedImages.length > 0 ? (
            <div className="mt-4 w-full">
              <div className="flex items-center justify-center mb-3">
                <Badge variant="default" className="bg-green-600">
                  <FileText className="h-3 w-3 mr-1" />
                  {capturedImages.length} photo{capturedImages.length !== 1 ? 's' : ''} received
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-24 overflow-y-auto">
                {capturedImages.map((img) => (
                  <div key={img.id} className="relative group">
                    <img 
                      src={img.file_url} 
                      alt={img.file_name}
                      className="w-full h-16 object-cover rounded-md border"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center text-sm text-muted-foreground space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span>Open camera on your phone and scan</span>
              </div>
              <p>
                {isLoadingExisting ? 'Checking for uploads…' : 'Photos will appear here automatically'}
              </p>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              disabled={!shortCode}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={emailLink}
              disabled={!shortCode}
            >
              <Mail className="h-4 w-4 mr-1" />
              Email Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={printQR}
              disabled={!qrCodeUrl}
            >
              <Printer className="h-4 w-4 mr-1" />
              Print QR
            </Button>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDone}>
            {capturedImages.length > 0 ? `Use ${capturedImages.length} Photo(s)` : 'Done'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
