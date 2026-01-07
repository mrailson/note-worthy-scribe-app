import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Smartphone, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import QRCode from 'qrcode';
import { useDeviceInfo } from '@/hooks/use-mobile';

interface TokenRecord {
  id: string;
  token: string;
  device_name: string | null;
}

export const QuickRecordQRLink = () => {
  const { user } = useAuth();
  const { isIOS } = useDeviceInfo();
  const [activeToken, setActiveToken] = useState<TokenRecord | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActiveToken();
    }
  }, [user]);

  const fetchActiveToken = async () => {
    try {
      const { data, error } = await supabase
        .from('quick_record_tokens')
        .select('id, token, device_name')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveToken(data as TokenRecord);
      }
    } catch (err) {
      console.error('Error fetching quick record token:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowQr = async () => {
    if (!activeToken) return;
    
    const url = `https://gpnotewell.co.uk/quick-record?token=${activeToken.token}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrCodeUrl(qrDataUrl);
      setShowQrModal(true);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  // Don't render on mobile/smartphone devices - they're already on phone
  const isSmartphone = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Don't render anything if on smartphone or no token after loading completes
  if (isSmartphone || (!loading && !activeToken)) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShowQr}
            disabled={loading || !activeToken}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          <p className="font-medium">Use Smartphone</p>
          <p className="text-xs text-muted-foreground">Scan a QR code to record meetings on your phone instead of this computer</p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Switch to Smartphone
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code with your iPhone/Android camera to start recording a meeting on your phone.
            </p>
            
            {qrCodeUrl && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCodeUrl} alt="Quick Record QR Code" className="w-56 h-56" />
              </div>
            )}
            
            <p className="text-xs text-muted-foreground text-center">
              {activeToken?.device_name || 'Quick Record'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
