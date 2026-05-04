import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Mic, Monitor, FileText, List, AlertTriangle, Info, Loader2, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useMeetingPreferences, type SectionKey } from '@/hooks/useMeetingPreferences';

// ── Constants ──────────────────────────────────────────────────────────────

const NOTES_SECTIONS: { id: SectionKey; name: string; desc: string; icon: string }[] = [
  { id: 'section_exec_summary', name: 'Executive summary', desc: 'High-level meeting overview', icon: '📋' },
  { id: 'section_key_points', name: 'Key discussion points', desc: 'Numbered topic summaries', icon: '🔑' },
  { id: 'section_decisions', name: 'Decisions register', desc: 'RESOLVED / AGREED / NOTED items', icon: '✅' },
  { id: 'section_actions', name: 'Action log', desc: 'Owner, deadline, status for each action', icon: '📌' },
  { id: 'section_open_items', name: 'Open items & risks', desc: 'Unresolved matters carried forward', icon: '⚠️' },
  { id: 'section_attendees', name: 'Attendees', desc: 'Names and roles of participants', icon: '👥' },
  { id: 'section_next_meeting', name: 'Next meeting', desc: 'Date, time, and agenda preview', icon: '📅' },
  { id: 'section_full_transcript', name: 'Appendix: full transcript', desc: 'Included in the DOCX export', icon: '📄' },
];

const NOTES_LENGTHS = [
  { id: 'concise' as const, label: 'Concise', sub: '~800 words', desc: 'Key decisions and actions only. Best for short stand-ups or brief check-ins.' },
  { id: 'standard' as const, label: 'Standard', sub: '~1,500 words', desc: 'Balanced coverage with discussion context. Works for most governance meetings.' },
  { id: 'detailed' as const, label: 'Detailed', sub: '~2,500 words', desc: 'Full discussion capture with speaker attribution. Best for board and audit committees.' },
];

type AudioMode = 'mic_only' | 'mic_system';

// ── Mic Test Hook (real Web Audio API) ─────────────────────────────────────

function useMicTest(deviceId: string) {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    setTesting(false);
    setLevel(0);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setTesting(true);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setLevel(Math.min(100, (avg / 128) * 100));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.error('Mic test failed:', err);
    }
  }, [deviceId]);

  useEffect(() => () => { stop(); }, [stop]);

  return { testing, level, start, stop };
}

// ── Settings trigger button ────────────────────────────────────────────────

export const SettingsTriggerButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
      'border border-border bg-card text-muted-foreground',
      'text-xs font-medium cursor-pointer',
      'transition-all duration-150',
      'hover:border-primary hover:text-primary hover:bg-accent'
    )}
  >
    <Settings className="h-3.5 w-3.5" />
    Settings
  </button>
);

// ── Main Settings Panel ────────────────────────────────────────────────────

interface DesktopRecordingSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DesktopRecordingSettings: React.FC<DesktopRecordingSettingsProps> = ({
  open,
  onOpenChange,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const { prefs, loading, setAudioMode, setMicDevice, setNotesLength, setTranscriptionEngine, toggleSection } = useMeetingPreferences();

  const selectedMic = prefs.preferred_mic_device_id || 'default';
  const audioMode = prefs.audio_mode;
  const notesLength = prefs.notes_length;
  const transcriptionEngine = prefs.transcription_engine;

  const mic = useMicTest(selectedMic);

  // Enumerate devices
  useEffect(() => {
    if (!open) return;
    const enumerate = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(allDevices.filter(d => d.kind === 'audioinput'));
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }
    };
    enumerate();
  }, [open]);

  const enabledCount = NOTES_SECTIONS.filter(s => prefs[s.id]).length;
  const selectedLengthDesc = NOTES_LENGTHS.find(l => l.id === notesLength)?.desc;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] max-w-[90vw] p-0 flex flex-col gap-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0">
          <SheetTitle className="text-base font-semibold tracking-tight">
            Recording settings
          </SheetTitle>
        </SheetHeader>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading settings…</span>
          </div>
        )}

        {/* Scrollable body */}
        {!loading && (
        <div className="flex-1 overflow-y-auto">

          {/* ── Section 1: Audio Input ── */}
          <div className="px-5 py-5 border-b border-border">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3.5">
              <Mic className="h-3.5 w-3.5" />
              Audio input
            </div>

            <label className="text-sm font-medium text-foreground block mb-1.5">Microphone</label>
            <div className="relative mb-4">
              <select
                value={selectedMic}
                onChange={e => {
                  const dev = devices.find(d => d.deviceId === e.target.value);
                  setMicDevice(e.target.value, dev?.label || 'System default');
                  mic.stop();
                }}
                className={cn(
                  'w-full appearance-none rounded-lg border border-border bg-card px-3 py-2.5 pr-8',
                  'text-sm text-foreground cursor-pointer',
                  'transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10'
                )}
              >
                <option value="default">System default microphone</option>
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>

            <label className="text-sm font-medium text-foreground block mb-1.5">Test microphone</label>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <button
                onClick={mic.testing ? mic.stop : mic.start}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer transition-colors',
                  mic.testing
                    ? 'bg-success/10 border-success text-success'
                    : 'bg-accent border-primary text-primary hover:bg-primary/10'
                )}
              >
                {mic.testing ? 'Stop test' : 'Test mic'}
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-75',
                    mic.level > 30 ? 'bg-success' : mic.level > 10 ? 'bg-warning' : 'bg-muted-foreground/30'
                  )}
                  style={{ width: `${mic.testing ? mic.level : 0}%` }}
                />
              </div>
              <span
                className="text-xs font-medium min-w-[40px] text-right"
                style={{
                  color: mic.testing
                    ? mic.level > 30 ? 'hsl(var(--success))' : 'hsl(var(--warning))'
                    : undefined,
                }}
              >
                {mic.testing ? (mic.level > 30 ? 'Good' : 'Low') : 'Idle'}
              </span>
            </div>
          </div>

          {/* ── Section 2: Audio Source ── */}
          <div className="px-5 py-5 border-b border-border">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3.5">
              <Monitor className="h-3.5 w-3.5" />
              Audio source
            </div>

            <div className="grid grid-cols-2 gap-2 mb-1">
              <button
                onClick={() => setAudioMode('mic_only')}
                className={cn(
                  'text-left p-3 rounded-xl border-[1.5px] transition-all cursor-pointer',
                  audioMode === 'mic_only'
                    ? 'border-primary bg-accent'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-1.5 text-[13px] font-semibold mb-1">
                  <Mic className="h-3.5 w-3.5" />
                  Mic only
                  <span className="inline-flex px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wide bg-success/10 text-success">
                    Default
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  Captures room audio through your microphone. Best for in-person meetings or Teams app recordings.
                </p>
              </button>

              <button
                onClick={() => setAudioMode('mic_system')}
                className={cn(
                  'text-left p-3 rounded-xl border-[1.5px] transition-all cursor-pointer',
                  audioMode === 'mic_system'
                    ? 'border-primary bg-accent'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <div className="flex items-center gap-1.5 text-[13px] font-semibold mb-1">
                  <Monitor className="h-3.5 w-3.5" />
                  Mic + system
                </div>
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  Captures both your mic and computer audio. Required for browser-based calls (Zoom, Google Meet in Chrome).
                </p>
              </button>
            </div>

            {audioMode === 'mic_system' && (
              <div className="flex gap-2.5 p-3 rounded-lg mt-3 bg-warning/10 text-warning text-xs leading-relaxed">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Screen sharing required.</strong> When you start recording, your browser will ask you to share a screen or tab. Select the tab with your meeting call and tick &ldquo;Share tab audio&rdquo; to capture remote participants. This is a browser security requirement &mdash; Notewell cannot access system audio directly.
                </div>
              </div>
            )}
            {audioMode === 'mic_only' && (
              <div className="flex gap-2.5 p-3 rounded-lg mt-3 bg-accent text-primary text-xs leading-relaxed">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  Works immediately with no screen sharing needed. If you&apos;re using the Teams or Zoom desktop app and playing audio through speakers, the mic will pick up all participants naturally. For headphone users on browser calls, switch to &ldquo;Mic + system&rdquo;.
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Notes Length ── */}
          <div className="px-5 py-5 border-b border-border">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3.5">
              <FileText className="h-3.5 w-3.5" />
              Meeting notes
            </div>

            <label className="text-sm font-medium text-foreground block mb-1">Output length</label>
            <p className="text-xs text-muted-foreground mb-3">
              Controls how much detail is included in the generated meeting notes.
            </p>

            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {NOTES_LENGTHS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setNotesLength(l.id)}
                  className={cn(
                    'py-2.5 px-2 rounded-lg border-[1.5px] text-center transition-all cursor-pointer',
                    notesLength === l.id
                      ? 'border-primary bg-accent text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <div className="text-[13px]">{l.label}</div>
                  <div className={cn(
                    'text-[10px] mt-0.5',
                    notesLength === l.id ? 'text-primary/70' : 'text-muted-foreground/60'
                  )}>
                    {l.sub}
                  </div>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedLengthDesc}
            </p>
          </div>

          {/* ── Section 4: Sections to include ── */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3.5">
              <span className="flex items-center gap-1.5">
                <List className="h-3.5 w-3.5" />
                Sections to include
              </span>
              <span className="normal-case tracking-normal font-medium">
                {enabledCount} of {NOTES_SECTIONS.length} enabled
              </span>
            </div>

            <div className="space-y-0">
              {NOTES_SECTIONS.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0',
                        prefs[s.id] ? 'bg-accent' : 'bg-muted'
                      )}
                    >
                      {s.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={prefs[s.id]}
                    onCheckedChange={() => toggleSection(s.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
