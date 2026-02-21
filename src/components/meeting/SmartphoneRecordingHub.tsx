import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Smartphone, QrCode, WifiOff, Upload, Shield, Mic, Volume2, Square, Pause, Info, CheckCircle, Lock, Lightbulb, FileAudio, Share2, ChevronDown, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { CreateMeetingTab } from '@/components/meeting/import/CreateMeetingTab';
import { showToast } from '@/utils/toastWrapper';
import QRCode from 'qrcode';

interface TokenRecord {
  id: string;
  token: string;
  device_name: string | null;
}

const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export const SmartphoneRecordingHub = () => {
  const { user } = useAuth();
  const { isIOS } = useDeviceInfo();
  const [open, setOpen] = useState(false);
  const [activeToken, setActiveToken] = useState<TokenRecord | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Audio import state
  const [audioImportQr, setAudioImportQr] = useState<string | null>(null);
  const [audioImportSessionId, setAudioImportSessionId] = useState<string | null>(null);
  const [audioImportShortCode, setAudioImportShortCode] = useState<string | null>(null);
  const [audioImportLoading, setAudioImportLoading] = useState(false);
  const [phoneUploadCount, setPhoneUploadCount] = useState(0);
  const filesAddedRef = useRef<((files: File[]) => void) | null>(null);

  const isSmartphone = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const defaultTab = isSmartphone ? 'offline' : 'qrcode';

  useEffect(() => {
    if (user) fetchActiveToken();
  }, [user]);

  const fetchActiveToken = async () => {
    try {
      const { data, error } = await supabase
        .from('quick_record_tokens')
        .select('id, token, device_name')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!error && data) setActiveToken(data as TokenRecord);
    } catch (err) {
      console.error('Error fetching quick record token:', err);
    } finally {
      setTokenLoading(false);
    }
  };

  const generateQr = async () => {
    if (!activeToken || qrCodeUrl) return;
    const url = `https://gpnotewell.co.uk/quick-record?token=${activeToken.token}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrCodeUrl(dataUrl);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  // Create audio import session and QR code
  const createAudioImportSession = useCallback(async () => {
    if (!user || audioImportSessionId || audioImportLoading) return;
    setAudioImportLoading(true);
    try {
      const shortCode = generateShortCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      const { data, error } = await supabase
        .from('audio_import_sessions')
        .insert({
          user_id: user.id,
          short_code: shortCode,
          expires_at: expiresAt,
        })
        .select('id, short_code')
        .single();

      if (error) throw error;

      setAudioImportSessionId(data.id);
      setAudioImportShortCode(data.short_code);

      // Generate QR code
      const origin = window.location.origin;
      const url = `${origin}/a/${data.short_code}`;
      const qr = await QRCode.toDataURL(url, {
        width: 240, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setAudioImportQr(qr);
    } catch (err) {
      console.error('Failed to create audio import session:', err);
    } finally {
      setAudioImportLoading(false);
    }
  }, [user, audioImportSessionId, audioImportLoading]);

  // Subscribe to Realtime for audio uploads
  useEffect(() => {
    if (!audioImportSessionId) return;

    const channel = supabase
      .channel(`audio-import-${audioImportSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audio_import_uploads',
          filter: `session_id=eq.${audioImportSessionId}`,
        },
        async (payload) => {
          console.log('📱 Audio file received from phone:', payload.new);
          const upload = payload.new as { file_name: string; file_url: string; storage_path: string; mime_type: string };

          setPhoneUploadCount(prev => prev + 1);
          showToast.success(`Audio file received: ${upload.file_name}`);

          // Download the file from storage and inject into CreateMeetingTab
          try {
            const { data: blob, error } = await supabase.storage
              .from('audio-imports')
              .download(upload.storage_path);

            if (error || !blob) {
              console.error('Failed to download audio import:', error);
              return;
            }

            const file = new File([blob], upload.file_name, {
              type: upload.mime_type || 'audio/mpeg',
            });

            if (filesAddedRef.current) {
              filesAddedRef.current([file]);
            }
          } catch (err) {
            console.error('Error processing phone upload:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [audioImportSessionId]);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (audioImportSessionId) {
        supabase
          .from('audio_import_sessions')
          .update({ is_active: false })
          .eq('id', audioImportSessionId)
          .then(() => console.log('Audio import session deactivated'));
      }
    };
  }, [audioImportSessionId]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && activeToken) generateQr();
  };

  const handleImportTabActive = () => {
    if (!audioImportSessionId && user) {
      createAudioImportSession();
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpen(true)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          <p className="font-medium">Use Smartphone / Import Audio</p>
          <p className="text-xs text-muted-foreground">Record on your phone, view the offline guide, or import audio files</p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-[42rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Smartphone Recording
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue={defaultTab} className="w-full" onValueChange={(v) => { if (v === 'import') handleImportTabActive(); }}>
            <TabsList className={`w-full grid ${isSmartphone ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {!isSmartphone && (
                <TabsTrigger value="qrcode" className="flex items-center gap-1.5 text-xs">
                  <QrCode className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Record via Phone</span>
                  <span className="sm:hidden">QR</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="offline" className="flex items-center gap-1.5 text-xs">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Offline Guide</span>
                <span className="sm:hidden">Offline</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import Audio</span>
                <span className="sm:hidden">Import</span>
                {phoneUploadCount > 0 && (
                  <Badge variant="default" className="ml-1 h-4 min-w-[16px] px-1 text-[10px] bg-green-600">
                    {phoneUploadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: QR Code */}
            {!isSmartphone && (
              <TabsContent value="qrcode">
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Scan this QR code with your phone camera to start recording a meeting on your smartphone.
                  </p>
                  {tokenLoading ? (
                    <p className="text-sm text-muted-foreground text-center">Loading…</p>
                  ) : activeToken && qrCodeUrl ? (
                    <>
                      <div className="flex justify-center p-4 bg-white rounded-lg">
                        <img src={qrCodeUrl} alt="Quick Record QR Code" className="w-56 h-56" />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {activeToken.device_name || 'Quick Record'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      No active quick-record token found. Set one up in Settings.
                    </p>
                  )}
                  <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                      Requires reliable internet on smartphone during recording. If not reliable, use the offline recording method — see the Offline Guide for instructions.
                    </p>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Tab 2: Offline Guide */}
            <TabsContent value="offline">
              <div className="space-y-4 py-2">
                {/* iPhone Section */}
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                    <span className="text-base">🍎</span>
                    <span className="text-sm font-semibold text-foreground">iPhone Recording</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-4 pt-3">

                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Offline, in-person, NHS-safe</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Best option: <strong>iPhone + Voice Memos</strong> (audio-only). Cleanest audio with least risk of failure. No internet required during recording.
                  </p>
                </div>

                <GuideStep number={1} title="Before the meeting" icon={<WifiOff className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Open <strong>Voice Memos</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Switch <strong>Aeroplane Mode ON</strong> — prevents calls, notifications &amp; radio noise</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Place the phone <strong>flat on the table</strong>, mic pointing upward, roughly central to participants</span></li>
                  </ul>
                  <div className="mt-2 bg-primary/5 rounded p-2 border border-primary/10">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 text-primary shrink-0" />
                      Positioning alone improves transcription accuracy by ~15–25%.
                    </p>
                  </div>
                </GuideStep>

                <GuideStep number={2} title="Start recording" icon={<Mic className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">●</span><span>Tap the red record button</span></li>
                    <li className="flex items-start gap-2"><Volume2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>Say aloud: <em>&quot;This meeting is being recorded for note-taking purposes.&quot;</em></span></li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Helps with consent, provides clear opening context, and improves speaker separation.</p>
                </GuideStep>

                <GuideStep number={3} title="During the meeting" icon={<Pause className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span><strong>Do not move</strong> the phone</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Avoid placing near laptops, cups, or paper shuffling</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>For long meetings — <strong>pause/resume</strong> is safe in Voice Memos</span></li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Voice Memos records locally — no internet required.</p>
                </GuideStep>

                <GuideStep number={4} title="Stop & name the file" icon={<Square className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Tap <strong>Stop</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Rename immediately, e.g. <em>&quot;PCN Board – 21 Feb 2026&quot;</em></span></li>
                  </ul>
                </GuideStep>

                <GuideStep number={5} title="Upload to Notewell" icon={<Upload className="h-3.5 w-3.5" />}>
                  <p className="text-xs text-muted-foreground mb-1.5">When you have internet again:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">1.</span><span>Open <strong>Voice Memos</strong> → tap the recording → tap <strong>Share</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">2.</span><span>Save to <strong>Files</strong>, <strong>OneDrive</strong>, or NHS-approved storage</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">3.</span><span>Use the <strong>Import Audio</strong> tab above to upload &amp; transcribe</span></li>
                  </ul>
                </GuideStep>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Divider */}
                <div className="border-t border-border my-4" />

                {/* Android Section */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                    <span className="text-base">🤖</span>
                    <span className="text-sm font-semibold text-foreground">Android Recording</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-4 pt-3">

                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Offline, in-person, NHS-safe</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Best option: <strong>Android built-in Voice Recorder</strong> (audio-only). Cleanest audio, lowest failure risk. No internet required during recording.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Works on Samsung, Google Pixel, and most Android devices. App name may be <strong>Voice Recorder</strong>, <strong>Samsung Voice Recorder</strong>, or <strong>Recorder</strong>.
                  </p>
                </div>

                <GuideStep number={1} title="Before the meeting" icon={<WifiOff className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Open <strong>Voice Recorder</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Switch <strong>Aeroplane Mode ON</strong> — prevents calls, notifications &amp; radio interference</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Place the phone <strong>flat on the table</strong>, microphone facing upward, roughly central to participants</span></li>
                  </ul>
                  <div className="mt-2 bg-primary/5 rounded p-2 border border-primary/10">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 text-primary shrink-0" />
                      Correct positioning alone improves transcription accuracy by ~15–25%.
                    </p>
                  </div>
                </GuideStep>

                <GuideStep number={2} title="Start recording" icon={<Mic className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">●</span><span>Tap the red <strong>Record</strong> button</span></li>
                    <li className="flex items-start gap-2"><Volume2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>Say clearly: <em>&quot;This meeting is being recorded for note-taking purposes.&quot;</em></span></li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Confirms consent, provides clean opening context, and improves speaker separation.</p>
                </GuideStep>

                <GuideStep number={3} title="During the meeting" icon={<Pause className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span><strong>Do not move</strong> the phone</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Avoid placing near laptops, cups, or paper shuffling</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>For long meetings — <strong>pause/resume</strong> is safe in Android Voice Recorder</span></li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Recording is fully offline and stored locally on the device.</p>
                </GuideStep>

                <GuideStep number={4} title="Stop & name the file" icon={<Square className="h-3.5 w-3.5" />}>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Tap <strong>Stop</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Rename immediately, e.g. <em>&quot;PCN Board – 21 Feb 2026&quot;</em></span></li>
                  </ul>
                  <div className="mt-2 bg-primary/5 rounded p-2 border border-primary/10">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 text-primary shrink-0" />
                      Clear file names = faster, more accurate processing in Notewell.
                    </p>
                  </div>
                </GuideStep>

                <GuideStep number={5} title="Upload to Notewell" icon={<Upload className="h-3.5 w-3.5" />}>
                  <p className="text-xs text-muted-foreground mb-1.5">When you have internet again:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">1.</span><span>Open <strong>Voice Recorder</strong> → tap the recording → tap <strong>Share</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">2.</span><span>Save to <strong>Files</strong>, <strong>OneDrive</strong>, or NHS-approved storage</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">3.</span><span>Use the <strong>Import Audio</strong> tab above to upload &amp; transcribe</span></li>
                  </ul>
                </GuideStep>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </TabsContent>

            {/* Tab 3: Import Audio */}
            <TabsContent value="import">
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Upload audio from your phone via QR code, or directly from this device.
                </p>

                {/* QR Code for phone upload */}
                {!isSmartphone && (
                  <Collapsible defaultOpen={true}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                      <QrCode className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Upload from Phone</span>
                      {phoneUploadCount > 0 && (
                        <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px] bg-green-600">
                          {phoneUploadCount} received
                        </Badge>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/50 mt-2">
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Scan with your phone camera to select and upload audio files directly.
                        </p>
                        {audioImportLoading ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        ) : audioImportQr ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="bg-white rounded-lg p-3">
                              <img src={audioImportQr} alt="Audio upload QR code" className="w-40 h-40" />
                            </div>
                            {audioImportShortCode && (
                              <p className="text-xs text-muted-foreground font-mono tracking-widest">
                                {audioImportShortCode}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground">
                              Files uploaded from your phone will appear here automatically.
                            </p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={createAudioImportSession}
                            className="w-full"
                          >
                            <QrCode className="h-3.5 w-3.5 mr-1.5" />
                            Generate QR Code
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* iPhone instructions */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                    <span className="text-base">🍎</span>
                    <span className="text-xs font-semibold text-foreground">iPhone (Voice Memos)</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 space-y-1.5 text-xs text-foreground/90 pt-2">
                      <p><strong>1.</strong> Open <strong>Voice Memos</strong> → tap the recording</p>
                      <p><strong>2.</strong> Tap <strong>Share</strong> → <strong>Save to Files</strong> (On My iPhone, OneDrive, or NHS-approved storage)</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3 text-primary shrink-0" />
                        The file is usually saved as .m4a — perfect for NoteWell.
                      </p>
                      <p><strong>3.</strong> Return here → <strong>Upload from This Device</strong> or drag &amp; drop → <strong>Create Meeting &amp; Generate Notes</strong></p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Android instructions */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                    <span className="text-base">🤖</span>
                    <span className="text-xs font-semibold text-foreground">Android (Voice Recorder)</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 space-y-1.5 text-xs text-foreground/90 pt-2">
                      <p><strong>1.</strong> Open <strong>Voice Recorder</strong> → select the recording</p>
                      <p><strong>2.</strong> Tap <strong>Share</strong> → save to Files, Downloads, or OneDrive</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3 text-primary shrink-0" />
                        Common formats: .m4a, .aac, .wav — all supported.
                      </p>
                      <p><strong>3.</strong> Return here → <strong>Upload from This Device</strong> → <strong>Create Meeting &amp; Generate Notes</strong></p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>


                <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/10">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Clear file names help processing — e.g. <em>&quot;PCN Board – 21 Feb 2026&quot;</em></span>
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Actual upload component */}
                <CreateMeetingTab
                  onComplete={() => setOpen(false)}
                  onClose={() => setOpen(false)}
                  onFilesAddedRef={filesAddedRef}
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

const GuideStep = ({ number, title, icon, children }: { number: number; title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">{number}</span>
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-semibold text-foreground">{title}</span>
    </div>
    <div className="ml-7 text-xs text-foreground/90 leading-relaxed">{children}</div>
  </div>
);
