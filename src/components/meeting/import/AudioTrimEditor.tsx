import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Scissors,
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  RotateCcw,
  Loader2,
  FileAudio,
  FileText,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAudioDuration, trimAudioFile, formatTrimDuration } from '@/utils/audioTrimmer';

interface TrimFile {
  file: File;
  type: 'audio' | 'text' | 'document';
  duration: number; // seconds, 0 for non-audio
  startSec: number;
  endSec: number;
  isLoading: boolean;
}

interface AudioTrimEditorProps {
  files: Array<{ file: File; type: 'audio' | 'text' | 'document' }>;
  onTrimConfirm: (trimmedFiles: File[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export const AudioTrimEditor: React.FC<AudioTrimEditorProps> = ({
  files,
  onTrimConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [trimFiles, setTrimFiles] = useState<TrimFile[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const hasAudioFiles = files.some(f => f.type === 'audio');

  // Decode audio durations when editor opens
  useEffect(() => {
    if (!isOpen || trimFiles.length > 0) return;

    const decode = async () => {
      setIsDecoding(true);
      const results: TrimFile[] = [];

      for (const f of files) {
        if (f.type === 'audio') {
          try {
            const duration = await getAudioDuration(f.file);
            results.push({
              file: f.file,
              type: f.type,
              duration,
              startSec: 0,
              endSec: duration,
              isLoading: false,
            });
          } catch (err) {
            console.error(`Failed to decode ${f.file.name}:`, err);
            results.push({
              file: f.file,
              type: f.type,
              duration: 0,
              startSec: 0,
              endSec: 0,
              isLoading: false,
            });
          }
        } else {
          results.push({
            file: f.file,
            type: f.type,
            duration: 0,
            startSec: 0,
            endSec: 0,
            isLoading: false,
          });
        }
      }

      setTrimFiles(results);
      setIsDecoding(false);
    };

    decode();
  }, [isOpen, files, trimFiles.length]);

  // Reset trim files when source files change
  useEffect(() => {
    setTrimFiles([]);
  }, [files]);

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    setPlayingIndex(null);
  }, []);

  const handlePreview = useCallback(async (index: number) => {
    if (playingIndex === index) {
      stopPlayback();
      return;
    }

    stopPlayback();
    const tf = trimFiles[index];
    if (!tf || tf.type !== 'audio') return;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const buffer = await tf.file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(buffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startSec = tf.startSec;
      const duration = tf.endSec - tf.startSec;

      source.onended = () => setPlayingIndex(null);
      source.start(0, startSec, duration);
      sourceNodeRef.current = source;
      setPlayingIndex(index);
    } catch (err) {
      console.error('Preview playback failed:', err);
      setPlayingIndex(null);
    }
  }, [playingIndex, trimFiles, stopPlayback]);

  const handleReset = useCallback((index: number) => {
    setTrimFiles(prev =>
      prev.map((tf, i) =>
        i === index ? { ...tf, startSec: 0, endSec: tf.duration } : tf
      )
    );
  }, []);

  const handleTrimChange = useCallback((index: number, values: number[]) => {
    stopPlayback();
    setTrimFiles(prev =>
      prev.map((tf, i) =>
        i === index ? { ...tf, startSec: values[0], endSec: values[1] } : tf
      )
    );
  }, [stopPlayback]);

  const handleConfirm = async () => {
    setIsTrimming(true);
    stopPlayback();

    try {
      const result: File[] = [];
      for (const tf of trimFiles) {
        if (tf.type !== 'audio' || tf.duration === 0) {
          result.push(tf.file);
          continue;
        }
        // Only trim if the user actually changed the range
        const isTrimmed = tf.startSec > 0.5 || tf.endSec < tf.duration - 0.5;
        if (isTrimmed) {
          const trimmed = await trimAudioFile(tf.file, tf.startSec, tf.endSec);
          result.push(trimmed);
        } else {
          result.push(tf.file);
        }
      }
      onTrimConfirm(result);
    } catch (err) {
      console.error('Trim failed:', err);
    } finally {
      setIsTrimming(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stopPlayback]);

  if (!hasAudioFiles) return null;

  const hasTrimChanges = trimFiles.some(
    tf => tf.type === 'audio' && tf.duration > 0 && (tf.startSec > 0.5 || tf.endSec < tf.duration - 0.5)
  );

  const totalKeeping = trimFiles
    .filter(tf => tf.type === 'audio' && tf.duration > 0)
    .reduce((sum, tf) => sum + (tf.endSec - tf.startSec), 0);

  const totalOriginal = trimFiles
    .filter(tf => tf.type === 'audio' && tf.duration > 0)
    .reduce((sum, tf) => sum + tf.duration, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            disabled={isProcessing}
          >
            <div className="flex items-center gap-2.5">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">Edit Audio Before Processing</span>
                <span className="text-xs text-muted-foreground ml-2">Advanced</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasTrimChanges && (
                <Badge variant="secondary" className="text-xs">
                  Trimmed
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Trim the start or end of recordings if they ran too long or contain dead air. 
              Non-audio files are passed through unchanged.
            </p>

            {isDecoding ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Decoding audio files…
              </div>
            ) : (
              <div className="space-y-2">
                {trimFiles.map((tf, index) => (
                  <TrimCard
                    key={`${tf.file.name}-${index}`}
                    trimFile={tf}
                    index={index}
                    total={trimFiles.filter(t => t.type === 'audio').length}
                    isPlaying={playingIndex === index}
                    onPreview={() => handlePreview(index)}
                    onReset={() => handleReset(index)}
                    onTrimChange={(values) => handleTrimChange(index, values)}
                  />
                ))}
              </div>
            )}

            {/* Summary & Confirm */}
            {trimFiles.length > 0 && !isDecoding && (
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                  {hasTrimChanges ? (
                    <>
                      Keeping {formatTrimDuration(totalKeeping)} of {formatTrimDuration(totalOriginal)} total
                    </>
                  ) : (
                    'No trims applied — files will be processed as-is'
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      stopPlayback();
                      onCancel();
                      setIsOpen(false);
                    }}
                    disabled={isTrimming}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={isTrimming}
                  >
                    {isTrimming ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        Trimming…
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {hasTrimChanges ? 'Process Trimmed Audio' : 'Process As-Is'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// --- Per-file trim card ---

interface TrimCardProps {
  trimFile: TrimFile;
  index: number;
  total: number;
  isPlaying: boolean;
  onPreview: () => void;
  onReset: () => void;
  onTrimChange: (values: number[]) => void;
}

const TrimCard: React.FC<TrimCardProps> = ({
  trimFile,
  index,
  total,
  isPlaying,
  onPreview,
  onReset,
  onTrimChange,
}) => {
  const { file, type, duration, startSec, endSec } = trimFile;

  if (type !== 'audio' || duration === 0) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border border-border/30">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate flex-1">{file.name}</span>
        <Badge variant="outline" className="text-xs">Not editable</Badge>
      </div>
    );
  }

  const keeping = endSec - startSec;
  const isTrimmed = startSec > 0.5 || endSec < duration - 0.5;

  return (
    <Card className="border-border/50">
      <CardContent className="p-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {total > 1 && (
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {index + 1}.
              </span>
            )}
            <FileAudio className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{file.name}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTrimDuration(duration)} total
          </span>
        </div>

        {/* Dual-thumb range slider */}
        <div className="px-1">
          <Slider
            value={[startSec, endSec]}
            min={0}
            max={duration}
            step={0.5}
            onValueChange={onTrimChange}
            className="w-full"
          />
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Start: {formatTrimDuration(startSec)}</span>
          <span>End: {formatTrimDuration(endSec)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onPreview}
            >
              {isPlaying ? (
                <>
                  <Square className="h-3 w-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Preview
                </>
              )}
            </Button>
            {isTrimmed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onReset}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
          <div className={cn(
            "text-xs font-medium",
            isTrimmed ? "text-primary" : "text-muted-foreground"
          )}>
            Keeping: {formatTrimDuration(keeping)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
