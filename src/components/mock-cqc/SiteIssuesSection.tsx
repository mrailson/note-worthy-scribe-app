import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Plus, 
  Trash2, 
  QrCode, 
  AlertTriangle,
  Image as ImageIcon,
  X,
  Smartphone,
  Loader2,
  Check,
  Copy,
  Mail,
  Printer
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';

interface SiteIssue {
  id: string;
  description: string | null;
  photo_url: string | null;
  photo_file_name: string | null;
  created_at: string;
}

interface CapturedImage {
  id: string;
  file_name: string;
  file_url: string;
}

interface SiteIssuesSectionProps {
  sessionId: string;
}

export const SiteIssuesSection = ({ sessionId }: SiteIssuesSectionProps) => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<SiteIssue[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  // QR capture state
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [captureSessionId, setCaptureSessionId] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [pendingImages, setPendingImages] = useState<CapturedImage[]>([]);
  const [copied, setCopied] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Load existing issues
  useEffect(() => {
    loadIssues();
  }, [sessionId]);

  const loadIssues = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mock_inspection_site_issues')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Failed to load site issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get capture URL
  const getCaptureUrl = useCallback(() => {
    const baseUrl = window.location.origin;
    return shortCode ? `${baseUrl}/inspection-capture/${shortCode}` : '';
  }, [shortCode]);

  // Create capture session for walkthrough
  const createCaptureSession = useCallback(async () => {
    if (!user || isCreatingSession) return;

    setIsCreatingSession(true);
    try {
      const sessionToken = crypto.randomUUID();

      // For site walkthrough, we don't link to a specific element
      const { data, error } = await supabase
        .from('mock_inspection_capture_sessions')
        .insert({
          user_id: user.id,
          session_token: sessionToken,
          // element_id is null for site walkthroughs
        })
        .select('id, short_code')
        .single();

      if (error) throw error;

      setCaptureSessionId(data.id);
      setShortCode(data.short_code);
    } catch (error) {
      console.error('Failed to create capture session:', error);
      showToast.error('Failed to create capture session');
    } finally {
      setIsCreatingSession(false);
    }
  }, [user, isCreatingSession, sessionId]);

  // Generate QR code
  useEffect(() => {
    if (shortCode) {
      const url = getCaptureUrl();
      QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(setQrCodeUrl);
    }
  }, [shortCode, getCaptureUrl]);

  // Create session when modal opens
  useEffect(() => {
    if (showQRModal && user && !captureSessionId) {
      createCaptureSession();
    }
  }, [showQRModal, user, captureSessionId, createCaptureSession]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

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

  // Fetch images from capture session
  const fetchCapturedImages = useCallback(async () => {
    if (!captureSessionId) return;

    try {
      const { data, error } = await supabase
        .from('mock_inspection_captured_images')
        .select('id, file_name, file_url')
        .eq('session_id', captureSessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPendingImages((prev) => {
        const byId = new Map<string, CapturedImage>();
        prev.forEach((img) => byId.set(img.id, img));

        let newCount = 0;
        (data ?? []).forEach((img) => {
          if (!byId.has(img.id)) {
            newCount++;
          }
          byId.set(img.id, img as CapturedImage);
        });

        if (newCount > 0) {
          playNotificationSound();
          showToast.success(`📷 ${newCount} photo${newCount !== 1 ? 's' : ''} received!`);
        }

        return Array.from(byId.values());
      });
    } catch (e) {
      console.warn('Failed to fetch captured images', e);
    }
  }, [captureSessionId, playNotificationSound]);

  // Poll for new images + subscribe to phone connection
  useEffect(() => {
    if (!showQRModal || !captureSessionId) return;

    // Initial fetch
    fetchCapturedImages();

    // Poll every 2 seconds
    const pollInterval = setInterval(fetchCapturedImages, 2000);

    // Subscribe to phone connection broadcasts
    const channel = supabase
      .channel(`site-walkthrough-${captureSessionId}`)
      .on('broadcast', { event: 'phone_connected' }, () => {
        setIsPhoneConnected(true);
        playNotificationSound();
        showToast.success('📱 Phone connected!');
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [showQRModal, captureSessionId, fetchCapturedImages, playNotificationSound]);

  // Reset QR modal state when closed
  useEffect(() => {
    if (!showQRModal) {
      const timeout = setTimeout(() => {
        setCaptureSessionId(null);
        setShortCode(null);
        setQrCodeUrl('');
        setPendingImages([]);
        setIsPhoneConnected(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [showQRModal]);

  // Save captured images as issues
  const handleSaveWalkthroughImages = async () => {
    if (pendingImages.length === 0) {
      showQRModal && setShowQRModal(false);
      return;
    }

    try {
      // Create an issue for each captured image
      const issuesToInsert = pendingImages.map(img => ({
        session_id: sessionId,
        photo_url: img.file_url,
        photo_file_name: img.file_name,
        description: null
      }));

      const { error } = await supabase
        .from('mock_inspection_site_issues')
        .insert(issuesToInsert);

      if (error) throw error;

      showToast.success(`Added ${pendingImages.length} issue${pendingImages.length !== 1 ? 's' : ''} from walkthrough`);
      setShowQRModal(false);
      loadIssues();
    } catch (error) {
      console.error('Failed to save issues:', error);
      showToast.error('Failed to save issues');
    }
  };

  // Update issue description
  const handleSaveDescription = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('mock_inspection_site_issues')
        .update({ description: editDescription })
        .eq('id', issueId);

      if (error) throw error;

      setIssues(prev => prev.map(issue => 
        issue.id === issueId ? { ...issue, description: editDescription } : issue
      ));
      setEditingIssue(null);
      showToast.success('Description saved');
    } catch (error) {
      console.error('Failed to update description:', error);
      showToast.error('Failed to save description');
    }
  };

  // Delete issue
  const handleDeleteIssue = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('mock_inspection_site_issues')
        .delete()
        .eq('id', issueId);

      if (error) throw error;

      setIssues(prev => prev.filter(issue => issue.id !== issueId));
      showToast.success('Issue removed');
    } catch (error) {
      console.error('Failed to delete issue:', error);
      showToast.error('Failed to remove issue');
    }
  };

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
    const subject = encodeURIComponent('Site Walkthrough - Capture Issues');
    const body = encodeURIComponent(`Use this link to capture photos of site issues:\n\n${getCaptureUrl()}\n\nThis link expires in 60 minutes.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrCodeUrl) {
      printWindow.document.write(`
        <html>
          <head><title>Site Walkthrough - Capture Issues</title></head>
          <body style="text-align: center; padding: 40px; font-family: Arial, sans-serif;">
            <h2>Scan to Capture Site Issues</h2>
            <p style="margin-bottom: 20px;"><strong>Walk around and photograph any issues you find</strong></p>
            <img src="${qrCodeUrl}" style="width: 300px; height: 300px;" />
            <p style="margin-top: 20px;">Code: <strong>${shortCode}</strong></p>
            <p style="color: #666;">Link expires in 60 minutes</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const removePendingImage = (imageId: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== imageId));
  };

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card className="border-amber-200 dark:border-amber-800">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <CardTitle className="text-lg text-amber-600">Site Issues</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Issues discovered during walkthrough (broken tiles, peeling paint, etc.)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {issues.length > 0 && (
                    <Badge variant="secondary">{issues.length} issue{issues.length !== 1 ? 's' : ''}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-4">
              {/* Start Walkthrough Button */}
              <Button 
                onClick={() => setShowQRModal(true)}
                className="w-full mb-4 h-12"
                variant="outline"
              >
                <QrCode className="h-5 w-5 mr-2" />
                Start Site Walkthrough (Phone Capture)
              </Button>

              {/* Existing Issues */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No site issues captured yet</p>
                  <p className="text-sm mt-1">Use the walkthrough button above to capture issues with your phone</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {issues.map((issue) => (
                    <Card key={issue.id} className="overflow-hidden">
                      {issue.photo_url && (
                        <div className="relative aspect-video bg-muted">
                          <img 
                            src={issue.photo_url} 
                            alt={issue.description || 'Site issue'} 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={() => handleDeleteIssue(issue.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <CardContent className="p-3">
                        {editingIssue === issue.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Describe the issue..."
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveDescription(issue.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingIssue(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-muted/50 p-2 rounded -m-2"
                            onClick={() => {
                              setEditingIssue(issue.id);
                              setEditDescription(issue.description || '');
                            }}
                          >
                            {issue.description ? (
                              <p className="text-sm">{issue.description}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">Click to add description...</p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(issue.created_at).toLocaleString('en-GB', { 
                            day: 'numeric', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* QR Walkthrough Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Site Walkthrough
            </DialogTitle>
            <DialogDescription>
              Walk around and photograph any issues you find (broken tiles, peeling paint, damage, etc.)
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
                <img src={qrCodeUrl} alt="QR Code for site walkthrough" className="w-64 h-64" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-xl flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Short code */}
            {shortCode && (
              <p className="mt-2 text-sm text-muted-foreground">
                Code: <span className="font-mono font-bold">{shortCode}</span>
              </p>
            )}

            {/* Captured images or instructions */}
            {pendingImages.length > 0 ? (
              <div className="mt-4 w-full">
                <div className="flex items-center justify-center mb-3">
                  <Badge variant="default" className="bg-green-600">
                    <Camera className="h-3 w-3 mr-1" />
                    {pendingImages.length} photo{pendingImages.length !== 1 ? 's' : ''} captured
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-24 overflow-y-auto">
                  {pendingImages.map((img) => (
                    <div key={img.id} className="relative group">
                      <img 
                        src={img.file_url} 
                        alt={img.file_name}
                        className="w-full h-16 object-cover rounded-md border"
                      />
                      <button
                        onClick={() => removePendingImage(img.id)}
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
                  <span>Scan with your phone to start capturing</span>
                </div>
                <p>Photos will appear here automatically</p>
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
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={printQR}
                disabled={!qrCodeUrl}
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowQRModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWalkthroughImages}>
              {pendingImages.length > 0 ? `Save ${pendingImages.length} Issue(s)` : 'Done'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
