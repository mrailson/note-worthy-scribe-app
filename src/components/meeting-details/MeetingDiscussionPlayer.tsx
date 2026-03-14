import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface DialogueTurn {
  speaker: 'ALICE' | 'GEORGE';
  text: string;
  startTime: number;
  endTime: number;
}

interface SlideAnnotation {
  turnIndex: number;
  heading: string;
  figure?: string | null;
  bullets?: string[] | null;
}

interface MeetingDiscussionPlayerProps {
  audioUrl: string;
  dialogueScript: string;
  meetingTitle: string;
  meetingDate?: string;
  slideAnnotations?: SlideAnnotation[];
}

const SPEAKER_STYLES = {
  ALICE: {
    name: 'Alice',
    role: 'Meeting Attendee',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-300 dark:border-blue-700',
    textColor: 'text-blue-800 dark:text-blue-200',
    accentColor: 'bg-blue-600',
    avatarBg: 'bg-blue-100 dark:bg-blue-900',
    avatarText: 'text-blue-700 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  GEORGE: {
    name: 'George',
    role: 'Colleague',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    borderColor: 'border-teal-300 dark:border-teal-700',
    textColor: 'text-teal-800 dark:text-teal-200',
    accentColor: 'bg-teal-600',
    avatarBg: 'bg-teal-100 dark:bg-teal-900',
    avatarText: 'text-teal-700 dark:text-teal-300',
    dotColor: 'bg-teal-500',
  },
};

export const MeetingDiscussionPlayer: React.FC<MeetingDiscussionPlayerProps> = ({
  audioUrl,
  dialogueScript,
  meetingTitle,
  meetingDate,
  slideAnnotations,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);

  // Parse turns from script (timing calculated separately from actual duration)
  const turns = useMemo(() => {
    const parsed: DialogueTurn[] = [];
    const lines = dialogueScript.split('\n').filter(l => l.trim());
    let currentSpeaker: 'ALICE' | 'GEORGE' | null = null;
    let currentText = '';

    const flush = () => {
      if (currentSpeaker && currentText.trim()) {
        parsed.push({
          speaker: currentSpeaker,
          text: currentText.trim(),
          startTime: 0,
          endTime: 0,
        });
      }
    };

    for (const line of lines) {
      const aliceMatch = line.match(/^ALICE:\s*(.*)$/);
      const georgeMatch = line.match(/^GEORGE:\s*(.*)$/);

      if (aliceMatch) { flush(); currentSpeaker = 'ALICE'; currentText = aliceMatch[1]; }
      else if (georgeMatch) { flush(); currentSpeaker = 'GEORGE'; currentText = georgeMatch[1]; }
      else if (currentSpeaker) { currentText += ' ' + line.trim(); }
    }
    flush();

    return parsed;
  }, [dialogueScript]);

  // Recalculate turn timing proportionally from actual audio duration
  const timedTurns = useMemo(() => {
    if (turns.length === 0 || duration <= 0) return turns;

    const wordCounts = turns.map(t => t.text.split(/\s+/).length);
    const totalWords = wordCounts.reduce((sum, wc) => sum + wc, 0);

    if (totalWords === 0) return turns;

    const GAP = 0.25;
    const totalGapTime = GAP * (turns.length - 1);
    const availableSpeakingTime = Math.max(duration - totalGapTime, duration * 0.8);

    let runningTime = 0;
    return turns.map((turn, i) => {
      const proportion = wordCounts[i] / totalWords;
      const turnDuration = proportion * availableSpeakingTime;
      const startTime = runningTime;
      const endTime = runningTime + turnDuration;
      runningTime = endTime + GAP;

      return { ...turn, startTime, endTime };
    });
  }, [turns, duration]);

  // Track active turn based on audio playback time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);

      let newIdx = 0;
      for (let i = 0; i < timedTurns.length; i++) {
        if (time >= timedTurns[i].startTime) {
          newIdx = i;
        } else {
          break;
        }
      }

      if (newIdx !== activeTurnIndex) {
        setActiveTurnIndex(newIdx);
      }
    };

    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [timedTurns, duration, activeTurnIndex]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, seconds));
    }
  }, [duration]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const activeTurn = turns[activeTurnIndex];
  const activeStyle = activeTurn ? SPEAKER_STYLES[activeTurn.speaker] : SPEAKER_STYLES.ALICE;

  // Get active slide from annotations or fallback to text extraction
  const getActiveSlide = (turnIdx: number): { heading: string; figure: string | null; bullets: string[] | null } | null => {
    if (slideAnnotations && slideAnnotations.length > 0) {
      let activeSlide = slideAnnotations[0];
      for (const slide of slideAnnotations) {
        if (slide.turnIndex <= turnIdx) {
          activeSlide = slide;
        } else {
          break;
        }
      }
      return {
        heading: activeSlide.heading,
        figure: activeSlide.figure || null,
        bullets: activeSlide.bullets || null,
      };
    }

    // Fallback: extract from text
    const turn = turns[turnIdx];
    if (!turn) return null;
    const figureMatch = turn.text.match(/(£[\d,]+(?:\.\d+)?|[\d.]+%|\d+ (?:families|patients|meetings|days|weeks|months|staff|practices|sessions))/i);
    return {
      heading: turn.text.split(/[.!?]/)[0].trim().substring(0, 60),
      figure: figureMatch?.[1] || null,
      bullets: null,
    };
  };

  const activeSlide = getActiveSlide(activeTurnIndex);

  // Progress dots — show a window around the active turn
  const dotWindowStart = Math.max(0, activeTurnIndex - 5);
  const dotWindowEnd = Math.min(turns.length, activeTurnIndex + 6);
  const visibleDots = turns.slice(dotWindowStart, dotWindowEnd);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shadow-lg">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Visual display area */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white min-h-[320px] flex flex-col">

        {/* Meeting title overlay */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
            {meetingDate || 'Meeting Discussion'}
          </p>
          <h3 className="text-lg font-semibold text-slate-100 mt-1 leading-tight">
            {meetingTitle}
          </h3>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center gap-6 px-6 pb-4">

          {/* Left: Speaker indicator */}
          <div className="flex flex-col items-center gap-3 min-w-[80px]">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-300 ${activeStyle.avatarBg} ${activeStyle.avatarText}`}>
              {activeTurn?.speaker === 'ALICE' ? 'A' : 'G'}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-200">{activeStyle.name}</p>
              <p className="text-xs text-slate-400">{activeStyle.role}</p>
            </div>
            {isPlaying && (
              <div className="flex items-end gap-0.5 h-5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`w-1 rounded-full ${activeStyle.accentColor}`}
                    style={{
                      height: `${8 + Math.random() * 12}px`,
                      animation: `pulse ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Current text / slide */}
          <div className="flex-1 min-w-0 space-y-3">
            {activeSlide?.heading && (
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                {activeSlide.heading}
              </p>
            )}
            {activeSlide?.figure && (
              <div className="mb-2">
                <span className="text-4xl font-bold text-white font-mono tracking-tight">{activeSlide.figure}</span>
              </div>
            )}
            {activeSlide?.bullets && activeSlide.bullets.length > 0 && (
              <ul className="space-y-1">
                {activeSlide.bullets.map((b: string, i: number) => (
                  <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                    <span className="text-white/40 mt-1">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-white/90 text-base leading-relaxed italic mt-4">
              "{activeTurn?.text || 'Press play to begin the discussion...'}"
            </p>
          </div>
        </div>

        {/* Turn progress dots */}
        <div className="flex justify-center items-center gap-1.5 pb-4 px-6">
          {visibleDots.map((t, i) => {
            const realIdx = dotWindowStart + i;
            const isActive = realIdx === activeTurnIndex;
            const isPast = realIdx < activeTurnIndex;
            const dotStyle = SPEAKER_STYLES[t.speaker];
            return (
              <button
                key={realIdx}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? `w-6 h-2.5 ${dotStyle.dotColor}`
                    : isPast
                    ? `w-2 h-2 ${dotStyle.dotColor} opacity-40`
                    : 'w-2 h-2 bg-slate-600'
                }`}
                onClick={() => {
                  const estimatedTotal = turns.length > 0 ? turns[turns.length - 1].endTime : 1;
                  const scale = duration > 0 ? duration / estimatedTotal : 1;
                  seekTo(turns[realIdx].startTime * scale);
                }}
                title={`${t.speaker}: ${t.text.substring(0, 40)}...`}
              />
            );
          })}
        </div>
      </div>

      {/* Audio controls */}
      <div className="bg-card border-t border-border p-4 space-y-3">

        {/* Progress bar */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 1}
            step={0.1}
            onValueChange={([v]) => seekTo(v)}
            className="flex-1"
          />
          <span className="w-10 tabular-nums">{formatTime(duration)}</span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => seekTo(currentTime - 15)}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => seekTo(currentTime + 15)}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Turn counter */}
        <p className="text-xs text-center text-muted-foreground">
          Exchange {activeTurnIndex + 1} of {turns.length} —{' '}
          {activeTurn?.speaker === 'ALICE'
            ? 'Alice speaking'
            : activeTurn?.speaker === 'GEORGE'
            ? 'George speaking'
            : 'Ready'}
        </p>
      </div>
    </div>
  );
};
