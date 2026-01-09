import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Smartphone, Copy, RefreshCw, QrCode, Check, ChevronDown, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';

interface TokenRecord {
  id: string;
  token: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  device_name: string | null;
}

export const QuickRecordSettings = () => {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deviceName, setDeviceName] = useState('My iPhone');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTokens();
    }
  }, [user]);

  const fetchTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('quick_record_tokens')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens((data as TokenRecord[]) || []);
    } catch (err) {
      console.error('Error fetching tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      // Generate a secure random token
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase
        .from('quick_record_tokens')
        .insert({
          user_id: user.id,
          token,
          device_name: deviceName || 'My iPhone',
          expires_at: null, // No expiry by default
        });

      if (error) throw error;

      toast.success('Quick Record link created!');
      fetchTokens();
      setDeviceName('My iPhone');
    } catch (err) {
      console.error('Error generating token:', err);
      toast.error('Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const deleteToken = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_record_tokens')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Token deleted');
      fetchTokens();
    } catch (err) {
      console.error('Error deleting token:', err);
      toast.error('Failed to delete token');
    }
  };

  const getQuickRecordUrl = (token: string) => {
    return `https://gpnotewell.co.uk/quick-record?token=${token}`;
  };

  const copyToClipboard = async (token: string, id: string) => {
    const url = getQuickRecordUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const showQrCode = async (token: string, id: string) => {
    const url = getQuickRecordUrl(token);
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrCodeUrl(qrDataUrl);
      setShowQr(id);
    } catch (err) {
      console.error('QR generation error:', err);
      toast.error('Failed to generate QR code');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return null;
  }

  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-left">
                  <Smartphone className="h-5 w-5" />
                  Quick Record (iPhone Shortcut)
                </CardTitle>
                <p className="text-muted-foreground text-sm text-left mt-1">
                  Create a link to save on your iPhone that auto-starts meeting recording without login.
                </p>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Create new token */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label>Create New Quick Record Link</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Device name (e.g., My iPhone)"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={generateToken} disabled={generating}>
                  {generating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Create Link'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each link is unique and can be revoked at any time.
              </p>
            </div>

            {/* Existing tokens */}
            {tokens.length > 0 && (
              <div className="space-y-3">
                <Label>Your Quick Record Links</Label>
                {tokens.map((tokenRecord) => (
                  <div key={tokenRecord.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{tokenRecord.device_name || 'Quick Record'}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {formatDate(tokenRecord.created_at)}
                          {tokenRecord.last_used_at && ` • Last used: ${formatDate(tokenRecord.last_used_at)}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteToken(tokenRecord.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(tokenRecord.token, tokenRecord.id)}
                        className="flex-1"
                      >
                        {copiedId === tokenRecord.id ? (
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
                        onClick={() => showQrCode(tokenRecord.token, tokenRecord.id)}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        QR Code
                      </Button>
                    </div>

                    {showQr === tokenRecord.id && qrCodeUrl && (
                      <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg">
                        <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                        <p className="text-xs text-muted-foreground text-center">
                          Scan with your iPhone camera to open, then tap "Add to Home Screen"
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowQr(null)}
                        >
                          Hide
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Instructions */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
              <p className="font-medium text-sm">How to add to iPhone Home Screen:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copy the link or scan the QR code on your iPhone</li>
                <li>Open the link in Safari</li>
                <li>Tap the Share button (square with arrow)</li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Keep this link private - anyone with it can record meetings as you.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
