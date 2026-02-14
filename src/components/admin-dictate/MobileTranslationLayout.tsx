import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Mic,
  MicOff,
  Loader2,
  QrCode,
  FileText,
  X,
  Pause,
  Play,
  Send,
  XCircle,
  Volume2,
  Check,
  Trash2,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranslationMessage } from '@/hooks/useReceptionTranslation';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';

// Import localised label maps from the parent (we'll pass them as needed via props)

interface MobileTranslationLayoutProps {
  // Session info
  patientLanguage: string;
  languageInfo: typeof HEALTHCARE_LANGUAGES[number] | undefined;
  isTrainingMode: boolean;
  
  // Messages & state
  messages: TranslationMessage[];
  transcript: string;
  isTranslating: boolean;
  isListening: boolean;
  isConnecting: boolean;
  isMicPaused: boolean;
  speakerMode: 'staff' | 'patient';
  
  // Confirmation
  showConfirmation: boolean;
  pendingTranscript: string | null;
  pendingSpeaker: 'staff' | 'patient';
  
  // Training
  isTrainingReplyLoading: boolean;
  
  // Audio
  playingAudioId: string | null;
  loadingAudio: Record<string, boolean>;
  
  // Handlers
  onSpeakerModeChange: (mode: 'staff' | 'patient') => void;
  onToggleListening: () => void;
  onToggleMicPause: () => void;
  onConfirmSend: () => void;
  onCancelSend: () => void;
  onAddMore: () => void;
  onPendingTranscriptChange: (text: string) => void;
  onDeleteMessage: (id: string) => void;
  onPlayAudio: (messageId: string, text: string, languageCode: string) => void;
  onStopAudio: () => void;
  onDownloadReport: () => void;
  onEndSession: () => void;
  onShowQR: () => void;
  
  // Report state
  isGeneratingReport: boolean;
  
  // Refs
  scrollRef: React.RefObject<HTMLDivElement>;
  
  // Localised labels
  gpPracticeSaid: string;
  patientSaid: string;
  playAudioLabel: string;
  loadingAudioLabel: string;
  stopAudioLabel: string;
  sendLabel: string;
  discardLabel: string;
  queuedLabel: string;
}

export const MobileTranslationLayout: React.FC<MobileTranslationLayoutProps> = ({
  patientLanguage,
  languageInfo,
  isTrainingMode,
  messages,
  transcript,
  isTranslating,
  isListening,
  isConnecting,
  isMicPaused,
  speakerMode,
  showConfirmation,
  pendingTranscript,
  pendingSpeaker,
  isTrainingReplyLoading,
  playingAudioId,
  loadingAudio,
  onSpeakerModeChange,
  onToggleListening,
  onToggleMicPause,
  onConfirmSend,
  onCancelSend,
  onAddMore,
  onPendingTranscriptChange,
  onDeleteMessage,
  onPlayAudio,
  onStopAudio,
  onDownloadReport,
  onEndSession,
  onShowQR,
  isGeneratingReport,
  scrollRef,
  gpPracticeSaid,
  patientSaid,
  playAudioLabel,
  loadingAudioLabel,
  stopAudioLabel,
  sendLabel,
  discardLabel,
  queuedLabel,
}) => {
  const isStaffMode = speakerMode === 'staff';
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages, transcript, or confirmation state changes
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript, pendingTranscript, showConfirmation, isTranslating, isTrainingReplyLoading]);

  const renderMobileMessage = (msg: TranslationMessage, index: number) => {
    const isStaffMessage = msg.speaker === 'staff';
    const messageId = msg.id || `msg-${index}`;
    const patientText = isStaffMessage ? msg.translatedText : msg.originalText;
    const englishText = isStaffMessage ? msg.originalText : msg.translatedText;
    const isLoadingAudio = loadingAudio[messageId];
    const isLatest = index === messages.length - 1;

    return (
      <div
        key={msg.id || index}
        className={cn(
          "flex flex-col gap-1 max-w-[85%] rounded-2xl px-3 py-2",
          isStaffMessage
            ? "self-start bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800"
            : "self-end bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
          isLatest && "ring-2 ring-offset-1",
          isLatest && isStaffMessage && "ring-blue-400",
          isLatest && !isStaffMessage && "ring-slate-400"
        )}
      >
        {/* English text */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground">
            🇬🇧 {isStaffMessage ? 'You:' : '🗣️ Patient:'}
          </p>
          {isStaffMessage && (
            <button
              onClick={() => onDeleteMessage(msg.id)}
              className="p-0.5 text-muted-foreground/60 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-sm leading-snug">{englishText}</p>

        {/* Divider */}
        {patientText && (
          <>
            <div className="border-t border-border/50 my-1" />
            <p className="text-[11px] font-semibold text-muted-foreground">
              {languageInfo?.flag} {isStaffMessage ? gpPracticeSaid : patientSaid}
            </p>
            <p className="text-sm leading-snug">{patientText}</p>

            {/* Audio button for staff messages */}
            {isStaffMessage && (() => {
              const langConfig = HEALTHCARE_LANGUAGES.find(l => l.code === patientLanguage);
              const hasTTS = langConfig?.hasElevenLabsVoice || langConfig?.hasGoogleTTSVoice;
              if (!hasTTS) return null;
              return (
                <button
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors",
                    playingAudioId === messageId
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  )}
                  onClick={() => {
                    if (playingAudioId === messageId) {
                      onStopAudio();
                    } else {
                      onPlayAudio(messageId, patientText, patientLanguage);
                    }
                  }}
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : playingAudioId === messageId ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  <span>
                    {isLoadingAudio ? loadingAudioLabel : playingAudioId === messageId ? stopAudioLabel : playAudioLabel}
                  </span>
                </button>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Training banner */}
      {isTrainingMode && (
        <div className="bg-amber-500 text-white text-center py-1.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 flex-shrink-0">
          <GraduationCap className="h-3.5 w-3.5" />
          TRAINING MODE
        </div>
      )}

      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          {languageInfo && (
            <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5 flex-shrink-0">
              {languageInfo.flag} {languageInfo.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowQR} title="QR Code">
            <QrCode className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDownloadReport}
            disabled={isGeneratingReport || messages.length === 0}
            title="Download Report"
          >
            {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onEndSession} title="End Session">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea
        className="flex-1 min-h-0"
        ref={scrollRef}
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="flex flex-col gap-3 p-3 pb-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-base">Tap the mic to start</p>
            </div>
          ) : (
            messages.map((msg, idx) => renderMobileMessage(msg, idx))
          )}

          {/* Live transcript */}
          {transcript && !isMicPaused && (
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 animate-pulse",
              speakerMode === 'patient'
                ? "self-end bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                : "self-start bg-primary/30 border border-primary/40"
            )}>
              <p className="text-xs font-medium mb-0.5">🎤 Listening…</p>
              <p className="text-sm">{transcript}</p>
            </div>
          )}

          {/* Pending text (Add More state) */}
          {pendingTranscript && !showConfirmation && (
            <div className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 border",
              speakerMode === 'patient'
                ? "self-end bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : "self-start bg-primary/20 border-primary/40"
            )}>
              <p className="text-xs font-medium mb-1 text-muted-foreground">📝 {queuedLabel}</p>
              <p className="text-sm mb-2">{pendingTranscript}</p>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={onCancelSend}>
                  <X className="h-3 w-3" /> {discardLabel}
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={onConfirmSend}>
                  <Check className="h-3 w-3" /> {sendLabel}
                </Button>
              </div>
            </div>
          )}

          {/* Confirmation card */}
          {showConfirmation && pendingTranscript && (
            <div className={cn(
              "rounded-2xl px-3 py-3 border-2 mx-1",
              pendingSpeaker === 'patient'
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700"
                : "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700"
            )}>
              <p className="text-xs font-semibold mb-1.5">📝 Confirm message:</p>
              <textarea
                data-confirmation-textarea
                value={pendingTranscript}
                onChange={(e) => onPendingTranscriptChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onConfirmSend();
                  }
                }}
                className="w-full text-sm bg-transparent border-b border-border/50 outline-none resize-none min-h-[2.5em] mb-2 rounded px-1"
                rows={Math.max(2, Math.ceil((pendingTranscript?.length || 0) / 40))}
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onCancelSend}>
                  <XCircle className="h-3 w-3" /> {discardLabel}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onAddMore}>
                  <Mic className="h-3 w-3" /> Add More
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={onConfirmSend}>
                  <Send className="h-3 w-3" /> {sendLabel}
                </Button>
              </div>
            </div>
          )}

          {isTranslating && (
            <div className="text-center text-muted-foreground text-xs py-1">Translating…</div>
          )}

          {/* Training typing indicator */}
          {isTrainingMode && isTrainingReplyLoading && (
            <div className="self-end flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 px-3 py-1.5">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Patient typing…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Bottom Toolbar — sticky, safe-area-aware */}
      <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur-sm px-3 pt-3 pb-safe">
        {/* Speaker mode pills */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button
            onClick={() => onSpeakerModeChange('staff')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all touch-manipulation",
              isStaffMode
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            🇬🇧 You
          </button>
          <button
            onClick={() => onSpeakerModeChange('patient')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all touch-manipulation",
              !isStaffMode
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            {languageInfo?.flag} Patient
          </button>
        </div>

        {/* Mic row */}
        <div className="flex items-center justify-center gap-3 pb-2">
          {/* Pause/Resume — only when listening */}
          {isListening && (
            <Button
              size="sm"
              variant={isMicPaused ? 'default' : 'outline'}
              className="h-10 w-10 rounded-full p-0 touch-manipulation"
              onClick={onToggleMicPause}
            >
              {isMicPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          )}

          {/* Main mic button */}
          <Button
            variant={isListening ? 'destructive' : isConnecting ? 'secondary' : 'outline'}
            className={cn(
              "h-16 w-16 rounded-full touch-manipulation",
              isListening && "animate-mic-glow",
              !isListening && !isConnecting && "text-muted-foreground border-muted-foreground/40"
            )}
            onClick={onToggleListening}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isListening ? (
              <Mic className="h-8 w-8" />
            ) : (
              <MicOff className="h-8 w-8" />
            )}
          </Button>
        </div>

        {/* Direction hint */}
        <p className="text-center text-[10px] text-muted-foreground pb-1">
          {isListening
            ? `Listening for ${isStaffMode ? 'English' : (languageInfo?.name || 'patient language')}…`
            : 'Tap mic to start'}
        </p>
      </div>
    </div>
  );
};
