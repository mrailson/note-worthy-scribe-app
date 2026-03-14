import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Download, Maximize2, Minimize2,
         ClipboardList, TrendingUp, CheckCircle2, AlertTriangle, ListChecks, MessageCircle } from 'lucide-react';
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
  turnTimings?: Array<{ startTime: number; endTime: number }>;
}

type SlideType = 'overview' | 'statistic' | 'decision' | 'risk' | 'action' | 'topic';

const detectSlideType = (
  slide: { heading?: string; figure?: string | null; bullets?: string[] | null },
  turnText?: string
): SlideType => {
  const h = (slide.heading || '').toLowerCase();
  if (h.includes('overview') || h.includes('meeting in brief') || h.includes('introduction')) return 'overview';
  if (h.includes('decision') || h.includes('agreed') || h.includes('approved') || h.includes('resolved')) return 'decision';
  if (h.includes('risk') || h.includes('concern') || h.includes('challenge') || h.includes('issue') || h.includes('shortfall')) return 'risk';
  if (h.includes('action') || h.includes('next step') || h.includes('follow up') || h.includes('takeaway')) return 'action';
  if (slide.figure) return 'statistic';
  return 'topic';
};

interface SlideTheme {
  gradient: string;
  accentColor: string;
  iconBg: string;
  iconColor: string;
  headingColor: string;
  figureColor: string;
  bulletColor: string;
  borderAccent: string;
  badgeLabel: string;
}

const SLIDE_THEMES: Record<SlideType, SlideTheme> = {
  overview: {
    gradient: 'from-slate-900 via-blue-950 to-slate-900',
    accentColor: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    headingColor: 'text-blue-300',
    figureColor: 'text-white',
    bulletColor: 'text-blue-200/80',
    borderAccent: 'border-blue-500/30',
    badgeLabel: 'Overview',
  },
  statistic: {
    gradient: 'from-slate-900 via-emerald-950 to-slate-900',
    accentColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    headingColor: 'text-emerald-300',
    figureColor: 'text-emerald-400',
    bulletColor: 'text-emerald-200/80',
    borderAccent: 'border-emerald-500/30',
    badgeLabel: 'Key Figure',
  },
  decision: {
    gradient: 'from-slate-900 via-amber-950 to-slate-900',
    accentColor: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    headingColor: 'text-amber-300',
    figureColor: 'text-amber-400',
    bulletColor: 'text-amber-200/80',
    borderAccent: 'border-amber-500/30',
    badgeLabel: 'Decision',
  },
  risk: {
    gradient: 'from-slate-900 via-red-950 to-slate-900',
    accentColor: 'text-red-400',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    headingColor: 'text-red-300',
    figureColor: 'text-red-400',
    bulletColor: 'text-red-200/80',
    borderAccent: 'border-red-500/30',
    badgeLabel: 'Risk',
  },
  action: {
    gradient: 'from-slate-900 via-purple-950 to-slate-900',
    accentColor: 'text-purple-400',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    headingColor: 'text-purple-300',
    figureColor: 'text-purple-400',
    bulletColor: 'text-purple-200/80',
    borderAccent: 'border-purple-500/30',
    badgeLabel: 'Actions',
  },
  topic: {
    gradient: 'from-slate-900 via-teal-950 to-slate-900',
    accentColor: 'text-teal-400',
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
    headingColor: 'text-teal-300',
    figureColor: 'text-white',
    bulletColor: 'text-teal-200/80',
    borderAccent: 'border-teal-500/30',
    badgeLabel: 'Discussion',
  },
};

const SLIDE_ICONS: Record<SlideType, React.ReactNode> = {
  overview: <ClipboardList className="h-5 w-5" />,
  statistic: <TrendingUp className="h-5 w-5" />,
  decision: <CheckCircle2 className="h-5 w-5" />,
  risk: <AlertTriangle className="h-5 w-5" />,
  action: <ListChecks className="h-5 w-5" />,
  topic: <MessageCircle className="h-5 w-5" />,
};

const SPEAKER_STYLES = {
  ALICE: {
    name: 'Alice',
    role: 'Meeting Attendee',
    accentColor: 'bg-blue-600',
    avatarBg: 'bg-blue-100 dark:bg-blue-900',
    avatarText: 'text-blue-700 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  GEORGE: {
    name: 'George',
    role: 'Colleague',
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
  turnTimings,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for fullscreen changes (including Escape key exit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerRef.current.requestFullscreen();
    }
  };

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

  // Recalculate turn timing — use real synthesis timings if available, else fallback to word-count estimation
  const timedTurns = useMemo(() => {
    if (turns.length === 0) return turns;

    // If we have real timings from synthesis, use them directly
    if (turnTimings && turnTimings.length === turns.length) {
      console.log('⏱️ Using real synthesis timings for slide sync');
      return turns.map((turn, i) => ({
        ...turn,
        startTime: turnTimings[i].startTime,
        endTime: turnTimings[i].endTime,
      }));
    }

    // Fallback: proportional word-count estimation (for old discussions without saved timings)
    if (duration <= 0) return turns.map(t => ({ ...t, startTime: 0, endTime: 0 }));

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
  }, [turns, turnTimings, duration]);

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

  const activeTurn = timedTurns[activeTurnIndex];
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
    const turn = timedTurns[turnIdx];
    if (!turn) return null;
    const figureMatch = turn.text.match(/(£[\d,]+(?:\.\d+)?|[\d.]+%|\d+ (?:families|patients|meetings|days|weeks|months|staff|practices|sessions))/i);
    return {
      heading: turn.text.split(/[.!?]/)[0].trim().substring(0, 60),
      figure: figureMatch?.[1] || null,
      bullets: null,
    };
  };

  const activeSlide = getActiveSlide(activeTurnIndex);
  const slideType = activeSlide ? detectSlideType(activeSlide, activeTurn?.text) : 'overview';
  const theme = SLIDE_THEMES[slideType];

  return (
    <div ref={playerRef} className={`rounded-xl overflow-hidden border border-border bg-card shadow-lg ${isFullscreen ? 'flex flex-col h-screen' : ''}`}>
      {/* Audio bars animation */}
      <style>{`
        @keyframes audioBar {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>

      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Visual display area — themed by slide content */}
      <div className={`relative bg-gradient-to-br ${theme.gradient} text-white ${isFullscreen ? 'flex-1' : 'min-h-[360px]'} flex flex-col transition-all duration-700 overflow-hidden`}>

        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full ${theme.iconBg} blur-3xl opacity-40 transition-all duration-700`} />
          <div className={`absolute -bottom-16 -left-16 w-48 h-48 rounded-full ${theme.iconBg} blur-3xl opacity-30 transition-all duration-700`} />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>

        {/* Top bar — meeting info + slide type badge + fullscreen */}
        <div className="relative z-10 flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Meeting Discussion
            </p>
            <h3 className={`${isFullscreen ? 'text-2xl' : 'text-lg'} font-semibold text-slate-100 mt-1 leading-tight`}>
              {meetingTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${theme.iconBg} border ${theme.borderAccent} backdrop-blur-sm`}>
              <span className={theme.iconColor}>{SLIDE_ICONS[slideType]}</span>
              <span className={`text-xs font-semibold ${theme.accentColor} uppercase tracking-wide`}>
                {theme.badgeLabel}
              </span>
            </div>
            <button
              onClick={toggleFullscreen}
              className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen
                ? <Minimize2 className="h-3 w-3 text-white/60" />
                : <Maximize2 className="h-3 w-3 text-white/60" />
              }
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className={`relative z-10 flex-1 flex items-center gap-6 ${isFullscreen ? 'px-12 pb-8' : 'px-6 pb-4'}`}>

          {/* Left: Speaker indicator */}
          <div className={`flex flex-col items-center gap-3 ${isFullscreen ? 'min-w-[120px]' : 'min-w-[80px]'}`}>
            <div className={`${isFullscreen ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-2xl'} rounded-full flex items-center justify-center font-bold transition-all duration-300 ${activeStyle.avatarBg} ${activeStyle.avatarText} ring-2 ring-white/10`}>
              {activeTurn?.speaker === 'ALICE' ? 'A' : 'G'}
            </div>
            <div className="text-center">
              <p className={`text-slate-200 ${isFullscreen ? 'text-base' : 'text-sm'} font-semibold`}>{activeStyle.name}</p>
              <p className={`text-slate-400 ${isFullscreen ? 'text-sm' : 'text-xs'}`}>{activeStyle.role}</p>
            </div>
            {isPlaying && (
              <div className="flex items-end gap-0.5 h-5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`w-1 rounded-full ${activeStyle.accentColor}`}
                    style={{
                      height: '16px',
                      animation: `audioBar ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Slide content card */}
          <div className={`flex-1 min-w-0 rounded-xl border ${theme.borderAccent} bg-white/5 backdrop-blur-sm ${isFullscreen ? 'p-8' : 'p-5'} space-y-3 transition-all duration-500`}>

            {/* Slide heading with icon */}
            {activeSlide?.heading && (
              <div className="flex items-center gap-2.5">
                <div className={`flex-shrink-0 ${isFullscreen ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg ${theme.iconBg} flex items-center justify-center ${theme.iconColor}`}>
                  {SLIDE_ICONS[slideType]}
                </div>
                <h4 className={`${isFullscreen ? 'text-xl' : 'text-base'} font-semibold ${theme.headingColor} leading-tight`}>
                  {activeSlide.heading}
                </h4>
              </div>
            )}

            {/* Key figure — large and prominent */}
            {activeSlide?.figure && (
              <div className="py-1">
                <span className={`${isFullscreen ? 'text-6xl' : 'text-4xl'} font-bold ${theme.figureColor} font-mono tracking-tight`}>
                  {activeSlide.figure}
                </span>
              </div>
            )}

            {/* Bullet points */}
            {activeSlide?.bullets && activeSlide.bullets.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {activeSlide.bullets.map((b: string, i: number) => (
                  <li key={i} className={`${theme.bulletColor} ${isFullscreen ? 'text-base' : 'text-sm'} flex items-start gap-2`}>
                    <span className={`${theme.accentColor} mt-0.5 text-xs`}>●</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Current speech text — italicised quote */}
            <div className="pt-2 border-t border-white/10">
              <p className={`text-white/80 ${isFullscreen ? 'text-lg' : 'text-sm'} leading-relaxed italic`}>
                "{activeTurn?.text || 'Press play to begin the discussion...'}"
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar — turn progress dots */}
        <div className="relative z-10 flex items-center justify-between px-6 pb-4">
          <p className="text-xs text-slate-500">{meetingDate || ''}</p>
          <div className="flex items-center gap-1.5">
            {timedTurns.slice(Math.max(0, activeTurnIndex - 6), activeTurnIndex + 7).map((t, i) => {
              const realIdx = Math.max(0, activeTurnIndex - 6) + i;
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
                  onClick={() => seekTo(timedTurns[realIdx].startTime)}
                  title={`${t.speaker}: ${t.text.substring(0, 40)}...`}
                />
              );
            })}
          </div>
          <p className="text-xs text-slate-500">Notewell AI</p>
        </div>
      </div>

      {/* Audio controls */}
      <div className={`p-4 space-y-3 ${isFullscreen ? 'bg-slate-900 border-t border-white/10' : 'bg-card border-t border-border'}`}>

        {/* Progress bar */}
        <div className="flex items-center gap-3 text-sm">
          <span className={`w-10 text-right tabular-nums ${isFullscreen ? 'text-white/50' : 'text-muted-foreground'}`}>{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 1}
            step={0.1}
            onValueChange={([v]) => seekTo(v)}
            className="flex-1"
          />
          <span className={`w-10 tabular-nums ${isFullscreen ? 'text-white/50' : 'text-muted-foreground'}`}>{formatTime(duration)}</span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => seekTo(currentTime - 15)} className={isFullscreen ? 'text-white/70 hover:text-white hover:bg-white/10' : ''}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className={`h-10 w-10 rounded-full ${isFullscreen ? 'bg-white text-slate-900 hover:bg-white/90' : ''}`}
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => seekTo(currentTime + 15)} className={isFullscreen ? 'text-white/70 hover:text-white hover:bg-white/10' : ''}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Turn counter */}
        <p className={`text-xs text-center ${isFullscreen ? 'text-white/40' : 'text-muted-foreground'}`}>
          Exchange {activeTurnIndex + 1} of {timedTurns.length} —{' '}
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
