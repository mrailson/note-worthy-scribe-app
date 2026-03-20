import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Consistent speaker colours — each speaker index maps to a distinct hue
const SPEAKER_COLOURS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-700' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-700' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-300 dark:border-rose-700' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-200', border: 'border-cyan-300 dark:border-cyan-700' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-200', border: 'border-indigo-300 dark:border-indigo-700' },
];

interface TranscriptSegment {
  speaker: string;
  text: string;
}

/** Returns true if the transcript contains [Speaker N] or [Speaker A] style labels */
export function hasSpeakerLabels(transcript: string): boolean {
  return /\[Speaker\s+[A-Za-z0-9]+\]/i.test(transcript);
}

/** Parse transcript text into speaker-labelled segments */
function parseSegments(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Match [Speaker X]: text patterns (handles both numbered and lettered)
  const regex = /\[Speaker\s+([A-Za-z0-9]+)\]\s*:\s*/gi;
  
  let lastIndex = 0;
  let lastSpeaker = '';
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(transcript)) !== null) {
    // Capture text before this speaker label (if any)
    if (lastIndex > 0 && lastSpeaker) {
      const text = transcript.substring(lastIndex, match.index).trim();
      if (text) {
        segments.push({ speaker: lastSpeaker, text });
      }
    } else if (match.index > 0 && lastIndex === 0) {
      // Text before first speaker label
      const preText = transcript.substring(0, match.index).trim();
      if (preText) {
        segments.push({ speaker: '', text: preText });
      }
    }
    
    lastSpeaker = match[1];
    lastIndex = match.index + match[0].length;
  }
  
  // Capture remaining text after last speaker label
  if (lastIndex > 0 && lastSpeaker) {
    const text = transcript.substring(lastIndex).trim();
    if (text) {
      segments.push({ speaker: lastSpeaker, text });
    }
  }
  
  // If no speaker labels found, return the whole transcript as a single segment
  if (segments.length === 0 && transcript.trim()) {
    segments.push({ speaker: '', text: transcript.trim() });
  }
  
  return segments;
}

interface SpeakerLabelledTranscriptProps {
  transcript: string;
  className?: string;
}

export const SpeakerLabelledTranscript: React.FC<SpeakerLabelledTranscriptProps> = ({
  transcript,
  className,
}) => {
  const segments = useMemo(() => parseSegments(transcript), [transcript]);
  
  // Build a map of speaker labels to colour indices
  const speakerColourMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const seg of segments) {
      if (seg.speaker && !map.has(seg.speaker)) {
        map.set(seg.speaker, idx % SPEAKER_COLOURS.length);
        idx++;
      }
    }
    return map;
  }, [segments]);

  if (segments.length === 0) {
    return <p className="text-muted-foreground text-sm italic">No transcript available</p>;
  }

  // If there are no speaker labels, just render plain text
  if (!segments.some(s => s.speaker)) {
    return (
      <div className={cn('whitespace-pre-wrap text-sm leading-relaxed', className)}>
        {transcript}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {segments.map((seg, i) => {
        const colourIdx = speakerColourMap.get(seg.speaker) ?? 0;
        const colours = SPEAKER_COLOURS[colourIdx];
        
        return (
          <div key={i} className="flex gap-2 items-start">
            {seg.speaker ? (
              <Badge 
                variant="outline"
                className={cn(
                  'shrink-0 mt-0.5 text-xs font-medium px-2 py-0.5 border',
                  colours.bg,
                  colours.text,
                  colours.border,
                )}
              >
                Speaker {seg.speaker}
              </Badge>
            ) : (
              <div className="shrink-0 w-20" />
            )}
            <p className="text-sm leading-relaxed text-foreground flex-1">
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
};
