import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Smartphone, QrCode, WifiOff, Upload, Shield, Mic, Volume2, Square, Pause, Info, CheckCircle, Lock, Lightbulb, FileAudio, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceInfo } from '@/hooks/use-mobile';
import { CreateMeetingTab } from '@/components/meeting/import/CreateMeetingTab';
import QRCode from 'qrcode';

interface TokenRecord {
  id: string;
  token: string;
  device_name: string | null;
}

export const SmartphoneRecordingHub = () => {
  const { user } = useAuth();
  const { isIOS } = useDeviceInfo();
  const [open, setOpen] = useState(false);
  const [activeToken, setActiveToken] = useState<TokenRecord | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

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

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && activeToken) generateQr();
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Smartphone Recording
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue={defaultTab} className="w-full">
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
                      Requires internet on both devices during recording.
                    </p>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Tab 2: Offline Guide */}
            <TabsContent value="offline">
              <div className="space-y-4 py-2">
                {/* iPhone Section */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🍎</span>
                  <span className="text-sm font-semibold text-foreground">iPhone Recording</span>
                </div>

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

                {/* Divider */}
                <div className="border-t border-border my-4" />

                {/* Android Section */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🤖</span>
                  <span className="text-sm font-semibold text-foreground">Android Recording</span>
                </div>

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
            </TabsContent>

            {/* Tab 3: Import Audio */}
            <TabsContent value="import">
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Use this when you've recorded a meeting offline on your phone and are now back online.
                </p>

                {/* iPhone instructions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🍎</span>
                    <span className="text-xs font-semibold text-foreground">iPhone (Voice Memos)</span>
                  </div>
                  <div className="ml-6 space-y-1.5 text-xs text-foreground/90">
                    <p><strong>1.</strong> Open <strong>Voice Memos</strong> → tap the recording</p>
                    <p><strong>2.</strong> Tap <strong>Share</strong> → <strong>Save to Files</strong> (On My iPhone, OneDrive, or NHS-approved storage)</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 text-primary shrink-0" />
                      The file is usually saved as .m4a — perfect for NoteWell.
                    </p>
                    <p><strong>3.</strong> Return here → <strong>Choose Files</strong> or drag &amp; drop → <strong>Create Meeting &amp; Generate Notes</strong></p>
                  </div>
                </div>

                {/* Android instructions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🤖</span>
                    <span className="text-xs font-semibold text-foreground">Android (Voice Recorder)</span>
                  </div>
                  <div className="ml-6 space-y-1.5 text-xs text-foreground/90">
                    <p><strong>1.</strong> Open <strong>Voice Recorder</strong> → select the recording</p>
                    <p><strong>2.</strong> Tap <strong>Share</strong> → save to Files, Downloads, or OneDrive</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3 text-primary shrink-0" />
                      Common formats: .m4a, .aac, .wav — all supported.
                    </p>
                    <p><strong>3.</strong> Return here → <strong>Choose Files</strong> → <strong>Create Meeting &amp; Generate Notes</strong></p>
                  </div>
                </div>

                {/* Supported files & tips */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/50 rounded-lg p-2.5 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-foreground">Supported files</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">MP3, M4A, WAV, PDF, DOCX, TXT — or paste text directly</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 border border-border/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-foreground">Good practice</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Upload promptly, delete from phone after, ensure consent was declared</p>
                  </div>
                </div>

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
