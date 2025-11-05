import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Eye, Play, Loader2, Square } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LiveTranscriptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transcriptText: string;
}

export const LiveTranscriptModal: React.FC<LiveTranscriptModalProps> = ({
  isOpen,
  onOpenChange,
  transcriptText,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptText, isOpen]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
      toast.success('Live transcript copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy transcript');
    }
  };

  const playTranscript = async () => {
    if (!transcriptText.trim()) {
      toast.error('No text to play');
      return;
    }

    try {
      setIsPlaying(true);

      // Stop any currently playing audio
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current = null;
      }
      try { sourceRef.current?.stop(); } catch {}
      sourceRef.current = null;
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }

      // Limit text for faster initial playback
      const MAX_QUICK_CHARS = 300;
      let textToPlay = transcriptText;
      let wasLimited = false;
      if (transcriptText.length > MAX_QUICK_CHARS) {
        const truncated = transcriptText.substring(0, MAX_QUICK_CHARS);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastExclamation = truncated.lastIndexOf('!');
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
        if (lastSentenceEnd > MAX_QUICK_CHARS * 0.7) {
          textToPlay = truncated.substring(0, lastSentenceEnd + 1);
        } else {
          const lastSpace = truncated.lastIndexOf(' ');
          textToPlay = truncated.substring(0, lastSpace) + '...';
        }
        wasLimited = true;
      }

      console.log('Calling deepgram-tts edge function...');
      
      // Call edge function
      const { data, error } = await supabase.functions.invoke('deepgram-tts', {
        body: { text: textToPlay }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data || !data.audioContent) {
        throw new Error('No audio content received from API');
      }

      if (wasLimited) {
        toast.info(`Playing first ${textToPlay.length} characters for faster playback`);
      }

      // Show warning if text was truncated by provider
      if (data.wasTruncated) {
        toast.warning(`Text was truncated to ${data.processedLength} characters (Deepgram limit: 2000)`);
      }

      // Convert base64 to audio blob
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // Decode with Web Audio for glitch-free start
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      audioCtxRef.current = ctx;

      const buffer: AudioBuffer = await ctx.decodeAudioData(arrayBuffer as ArrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPlaying(false);
        try { ctx.close(); } catch {}
        audioCtxRef.current = null;
        sourceRef.current = null;
      };

      sourceRef.current = source;

      await ctx.resume();
      source.start(0);
      toast.success('Playing transcript');

    } catch (error: any) {
      console.error('TTS error:', error);
      const errorMessage = error?.message || 'Failed to generate speech';
      toast.error(errorMessage);
      setIsPlaying(false);
    }
  };

  const stopTranscript = () => {
    // Stop HTMLAudio fallback if any
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
    // Stop WebAudio playback
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    toast.info('Playback stopped');
  };
  const wordCount = transcriptText.split(' ').filter(w => w.trim()).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[85vh] max-h-[85vh] flex flex-col p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="sr-only">Live Transcript</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 text-red-600 font-semibold">
              <Eye className="w-5 h-5" />
              Live Transcript - Full View
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Words: {wordCount}</span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Live
              </span>
              {!isPlaying ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={playTranscript}
                  disabled={!transcriptText}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={stopTranscript}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={!transcriptText}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-muted/20 p-4 rounded-lg text-sm leading-relaxed font-mono"
              style={{
                WebkitOverflowScrolling: 'touch',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
            >
              {transcriptText ? (
                <div className="whitespace-pre-wrap">
                  {transcriptText}
                </div>
              ) : (
                <div className="text-muted-foreground italic text-center pt-8">
                  Listening… interim speech appears here
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};