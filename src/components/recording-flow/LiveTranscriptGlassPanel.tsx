import React, { useState, useEffect, useRef, useMemo } from 'react';

interface TranscriptLine {
  id: number;
  text: string;
}

interface LiveTranscriptGlassPanelProps {
  isRecording: boolean;
  wordCount: number;
  /** The current running transcript text — new sentences appended over time */
  transcriptText: string;
}

/**
 * A compact glass panel toggled from the word-count badge.
 * Shows the last 3 completed lines with a fade/blur cascade
 * plus a blinking cursor on the active partial line.
 */
export const LiveTranscriptGlassPanel: React.FC<LiveTranscriptGlassPanelProps> = ({
  isRecording,
  wordCount,
  transcriptText,
}) => {
  const [open, setOpen] = useState(false);
  const prevTextRef = useRef('');
  const lineIdRef = useRef(0);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [currentPartial, setCurrentPartial] = useState('');

  // Split incoming transcript into completed sentences and a trailing partial
  useEffect(() => {
    if (!transcriptText || transcriptText.length === 0) {
      setLines([]);
      setCurrentPartial('');
      prevTextRef.current = '';
      return;
    }

    // Only process the new portion
    const text = transcriptText.trim();
    
    // Split on sentence boundaries (. ! ?)
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const matches = text.match(sentenceRegex) || [];
    const completedText = matches.join('');
    const partial = text.slice(completedText.length).trim();

    // Build line objects from completed sentences
    const newLines: TranscriptLine[] = matches
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map((s, i) => ({ id: i, text: s }));

    setLines(newLines);
    setCurrentPartial(partial);
  }, [transcriptText]);

  // Auto-close when recording stops
  useEffect(() => {
    if (!isRecording) {
      setOpen(false);
      setLines([]);
      setCurrentPartial('');
      prevTextRef.current = '';
    }
  }, [isRecording]);

  // Only show the last 3 completed lines
  const visibleLines = lines.slice(-3);

  if (!isRecording) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Word Count Badge — toggle trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${wordCount} words captured. Click to ${open ? 'hide' : 'show'} live transcript`}
        className="nw-badge-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: open
            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.2))'
            : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted) / 0.8))',
          color: 'hsl(var(--foreground))',
          border: open ? '1.5px solid hsl(var(--primary) / 0.5)' : '1.5px solid hsl(var(--border))',
          borderRadius: 10,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: open ? 'scale(1.04)' : 'scale(1)',
          boxShadow: open
            ? '0 4px 20px hsl(var(--primary) / 0.15)'
            : '0 2px 8px hsl(var(--foreground) / 0.04)',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      >
        {/* Document icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>

        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{wordCount}</span>
        <span style={{ opacity: 0.6, fontWeight: 500 }}>words</span>

        {/* Recording pulse dot */}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: 'hsl(var(--destructive))',
            animation: 'nw-pulse 1.5s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Glass Panel */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          left: '50%',
          transform: open ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(-6px) scale(0.98)',
          width: 420,
          height: 160,
          background: 'hsl(var(--background) / 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid hsl(var(--border) / 0.25)',
          borderRadius: 16,
          boxShadow: '0 20px 50px hsl(var(--foreground) / 0.08), inset 0 0 0 1px hsl(var(--background) / 0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderBottom: '1px solid hsl(var(--border) / 0.12)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                boxShadow: '0 0 6px #3B82F6',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>
              Live Preview
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
            {wordCount} words
          </span>
        </div>

        {/* Transcript Lines */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '8px 14px 12px',
            overflow: 'hidden',
          }}
        >
          {visibleLines.length === 0 && !currentPartial && (
            <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic', margin: 0 }}>
              Listening… speak to see live transcript
            </p>
          )}

          {visibleLines.map((line, i) => {
            const age = visibleLines.length - i; // 3=oldest, 1=newest
            const opacity = age === 3 ? 0.2 : age === 2 ? 0.45 : 1;
            const scale = age === 3 ? 0.97 : 1;
            const blur = age === 3 ? 1.5 : 0;

            return (
              <div
                key={line.id}
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'hsl(var(--foreground) / 0.85)',
                  opacity,
                  transform: `scale(${scale})`,
                  filter: blur > 0 ? `blur(${blur}px)` : 'none',
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: 'left center',
                  animation: 'nw-fadeSlideIn 0.35s ease-out',
                  margin: 0,
                  padding: 0,
                }}
              >
                {line.text}
              </div>
            );
          })}

          {/* Active partial line with blinking cursor */}
          {currentPartial && (
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                display: 'flex',
                alignItems: 'center',
                margin: 0,
                padding: 0,
              }}
            >
              {currentPartial}
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 15,
                  backgroundColor: 'hsl(var(--primary))',
                  marginLeft: 3,
                  animation: 'nw-blink 0.8s step-end infinite',
                  flexShrink: 0,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Scoped Keyframes */}
      <style>{`
        @keyframes nw-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes nw-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes nw-fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
