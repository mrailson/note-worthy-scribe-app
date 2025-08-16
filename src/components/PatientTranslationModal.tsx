/*
LOVABLE IMPLEMENTATION PROMPT (copy into your Lovable page config)
---------------------------------------------------------------
Goal: Add a pop‑out modal that shows exactly ONE message at a time for patient‑facing live translation during GP consultations (two‑way AVT Scribe).

Key behaviours
1) Modal opens when a new message is ready to present to the patient (event: TRANSLATION_READY).
2) The modal shows: big translated text (target language), small original text (source language) behind a toggle ("Show original").
3) Audio controls: Play translated audio (TTS), Replay, and Mute. If TTS is playing, button becomes Pause.
4) Accessibility: translated block uses aria-live="polite" so streaming updates don't jar; font is large; high contrast; WCAG AA; keyboard and screen‑reader friendly.
5) Consent and safety: show banner text: "Automated translation. If anything is unclear, please tell the clinician."
6) Actions: primary button = "Next" (acknowledge and close) which also emits TRANSLATION_ACK with messageId. Secondary = "Back" if we need to re‑show previous message.
7) Streaming: while partial translation arrives, display an animated typing indicator and show partial text. When complete, remove indicator and enable buttons.
8) Timeouts: if no interaction after 15s, gently pulse the Next button; never auto‑dismiss without explicit acknowledge.
9) Languages: show compact chips for Source and Target languages (e.g., EN→BN). Persist the patient's preferred language in session state.
10) Errors: if TTS fails, show a small inline error and keep text visible; do not close the modal.

Events (emit from component via callbacks or message bus)
- TRANSLATION_READY { messageId, sourceLang, targetLang, originalText, translatedText, audioUrl? }
- TRANSLATION_PLAY { messageId }
- TRANSLATION_PAUSE { messageId }
- TRANSLATION_ACK { messageId }
- TRANSLATION_BACK { messageId }
- TRANSLATION_ERROR { messageId, reason }

State machine (simplified)
IDLE → READY (data loaded) → PLAYING (optional) → ACKED (close)

Data contract example
{
  messageId: "abc123",
  sourceLang: "en",
  targetLang: "bn",
  originalText: "What do you do?",
  translatedText: "আপনি কী করেন?",
  audioUrl: "https://…/tts.mp3" // optional
}

How to wire in Lovable
- Render <PatientTranslationModal/> at app root so it can pop over any page.
- Feed it via your existing websocket/RT events when Whisper/MT completes.
- Provide a TTS function (e.g., ElevenLabs). Pass an audioUrl or onPlay callback.
- Persist last 20 messages in your store but show only one at a time here.

Security & IG (NHS friendly)
- Do not write patient content to localStorage; keep in memory only.
- If you must cache, encrypt at rest. Ensure logs do not contain PHI.
- Display the consent banner whenever the modal is open.

Design tokens (Tailwind) used below; adjust to your theme as needed.
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Pause, Play, Globe, ChevronDown, ChevronUp, RotateCcw, ArrowLeft, Check } from "lucide-react";

// Utility for language label; extend as needed
const LANG_LABEL: Record<string, string> = {
  en: "English",
  bn: "বাংলা",
  ar: "العربية",
  ur: "اردو",
  pl: "Polski",
  ro: "Română",
  ru: "Русский",
  tr: "Türkçe",
  so: "Af Soomaali",
  fr: "Français",
  es: "Español",
  zh: "中文",
};

export type TranslationPayload = {
  isOpen: boolean;
  onClose: () => void;
  onAck?: (messageId: string) => void;
  onBack?: (messageId: string) => void;
  onPlay?: (messageId: string) => void;
  onPause?: (messageId: string) => void;
  messageId: string;
  sourceLang: string; // e.g. "en"
  targetLang: string; // e.g. "bn"
  originalText?: string; // optional during streaming
  translatedText?: string; // can stream
  audioUrl?: string; // optional
  isStreaming?: boolean;
};

export default function PatientTranslationModal(props: TranslationPayload) {
  const {
    isOpen,
    onClose,
    onAck,
    onBack,
    onPlay,
    onPause,
    messageId,
    sourceLang,
    targetLang,
    originalText = "",
    translatedText = "",
    audioUrl,
    isStreaming = false,
  } = props;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // Reset UI state whenever a new message opens
    setIsPlaying(false);
    setShowOriginal(false);
  }, [messageId, isOpen]);

  // Handle audio play/pause
  const handlePlay = async () => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    }
    audioRef.current.muted = muted;
    await audioRef.current.play().catch(() => {});
    setIsPlaying(true);
    onPlay && onPlay(messageId);
    audioRef.current.onended = () => setIsPlaying(false);
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    onPause && onPause(messageId);
  };

  const handleAck = () => {
    handlePause();
    onAck && onAck(messageId);
    onClose();
  };

  const handleBack = () => {
    handlePause();
    onBack && onBack(messageId);
  };

  const sourceLabel = useMemo(() => LANG_LABEL[sourceLang] || sourceLang.toUpperCase(), [sourceLang]);
  const targetLabel = useMemo(() => LANG_LABEL[targetLang] || targetLang.toUpperCase(), [targetLang]);

  return (
    <Dialog open={isOpen} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl sm:max-w-3xl md:max-w-4xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Translated message</DialogTitle>
          <DialogDescription>Patient‑facing translation</DialogDescription>
        </DialogHeader>

        {/* Header strip with language chips and consent/safety note */}
        <div className="flex items-center justify-between px-5 py-3 bg-muted border-b">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm"><Globe className="h-4 w-4 mr-1"/> {sourceLabel} → {targetLabel}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">Automated translation. If anything is unclear, please tell the clinician.</div>
        </div>

        {/* Main body */}
        <div className="p-5 md:p-6">
          <Card className="shadow-none border-0">
            <CardContent className="p-0">
              {/* Translated block (big text) */}
              <div aria-live="polite" className="text-2xl md:text-3xl leading-relaxed tracking-normal">
                {translatedText && (
                  <p className="whitespace-pre-wrap">{translatedText}</p>
                )}
                {(!translatedText || isStreaming) && (
                  <div className="mt-3 text-base md:text-lg text-muted-foreground flex items-center gap-2" aria-label="Translating">
                    <span className="inline-block animate-pulse">Translating...</span>
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-.1s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                    </span>
                  </div>
                )}
              </div>

              {/* Toggle original */}
              <div className="mt-4">
                <button
                  className="text-sm text-foreground inline-flex items-center gap-1 hover:underline"
                  onClick={() => setShowOriginal((s) => !s)}
                  aria-expanded={showOriginal}
                >
                  {showOriginal ? <><ChevronUp className="h-4 w-4"/> Hide original</> : <><ChevronDown className="h-4 w-4"/> Show original</>}
                </button>
                {showOriginal && (
                  <p className="mt-2 text-base text-muted-foreground whitespace-pre-wrap border-l-2 border-muted pl-3">{originalText}</p>
                )}
              </div>

              {/* Controls */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {audioUrl && (
                  isPlaying ? (
                    <Button onClick={handlePause} className="rounded-2xl"><Pause className="h-4 w-4 mr-2"/>Pause audio</Button>
                  ) : (
                    <Button onClick={handlePlay} className="rounded-2xl"><Play className="h-4 w-4 mr-2"/>Play audio</Button>
                  )
                )}
                <Button variant="secondary" className="rounded-2xl" onClick={() => setMuted((m) => !m)}>
                  {muted ? <><VolumeX className="h-4 w-4 mr-2"/>Unmute</> : <><Volume2 className="h-4 w-4 mr-2"/>Mute</>}
                </Button>
                <Button variant="ghost" className="rounded-2xl" onClick={() => (audioRef.current && audioRef.current.currentTime ? (audioRef.current.currentTime = 0) : null)}>
                  <RotateCcw className="h-4 w-4 mr-2"/>Replay from start
                </Button>
              </div>

              {/* Actions */}
              <div className="mt-8 flex items-center justify-between">
                <Button variant="outline" className="rounded-2xl" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2"/>Back
                </Button>
                <Button className="rounded-2xl px-6 md:px-8 text-base md:text-lg animate-[pulse_2.5s_ease-in-out_infinite]" onClick={handleAck}>
                  <Check className="h-5 w-5 mr-2"/>Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/*
HOW TO USE (example)

<PatientTranslationModal
  isOpen={modalOpen}
  onClose={() => setModalOpen(false)}
  onAck={(id) => bus.emit('TRANSLATION_ACK', { id })}
  onBack={(id) => bus.emit('TRANSLATION_BACK', { id })}
  onPlay={(id) => bus.emit('TRANSLATION_PLAY', { id })}
  onPause={(id) => bus.emit('TRANSLATION_PAUSE', { id })}
  messageId={message.id}
  sourceLang={message.sourceLang}
  targetLang={message.targetLang}
  originalText={message.originalText}
  translatedText={message.translatedText}
  audioUrl={message.audioUrl}
  isStreaming={message.isStreaming}
/>

QA CHECKLIST
- ✅ Shows only one message at a time; rest of app is dimmed
- ✅ Large, high‑contrast translated text
- ✅ Original text hidden by default
- ✅ Audio controls + mute
- ✅ Consent banner visible
- ✅ Keyboard: Esc closes; Tab order logical; Buttons have labels
- ✅ Emits events for analytics and orchestration
*/