import React, { useState, useEffect, useCallback } from 'react';

interface LiveTranscriptGlassPanelProps {
  isRecording: boolean;
  wordCount: number;
  transcriptText: string;
  recentFinals?: string[];
  currentPartial?: string;
  /** Per-engine debug data */
  assemblyFullTranscript?: string;
  deepgramText?: string;
  whisperChunkText?: string;
  whisperChunkNum?: number;
  
}

const MAX_VISIBLE_LINES = 4;

type EngineKey = 'all' | 'assembly' | 'deepgram' | 'whisper';

const ENGINE_SOURCES: { key: EngineKey; label: string; hue: string }[] = [
  { key: 'all', label: 'All', hue: '0 0% 50%' },
  { key: 'assembly', label: 'AssemblyAI', hue: '217 91% 60%' },
  { key: 'deepgram', label: 'Deepgram', hue: '142 71% 45%' },
  { key: 'whisper', label: 'Whisper', hue: '270 67% 55%' },
];

export const LiveTranscriptGlassPanel: React.FC<LiveTranscriptGlassPanelProps> = ({
  isRecording,
  wordCount,
  transcriptText,
  recentFinals = [],
  currentPartial = '',
  assemblyFullTranscript = '',
  deepgramText = '',
  whisperChunkText = '',
  whisperChunkNum = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [activeEngines, setActiveEngines] = useState<Set<EngineKey>>(new Set(['all']));

  useEffect(() => {
    if (!isRecording) {
      setOpen(false);
      setActiveEngines(new Set(['all']));
    }
  }, [isRecording]);

  const toggleSource = useCallback((source: EngineKey) => {
    setActiveEngines(prev => {
      if (source === 'all') return new Set<EngineKey>(['all']);
      const next = new Set(prev);
      next.delete('all');
      if (next.has(source)) next.delete(source);
      else next.add(source);
      if (next.size === 0) return new Set<EngineKey>(['all']);
      return next;
    });
  }, []);

  // Use recentFinals if available, otherwise fall back to splitting assemblyFullTranscript
  const assemblyFallbackLines = recentFinals.length === 0 && assemblyFullTranscript
    ? splitIntoLines(assemblyFullTranscript, MAX_VISIBLE_LINES)
    : [];
  const visibleLines = recentFinals.length > 0
    ? recentFinals.slice(-MAX_VISIBLE_LINES)
    : assemblyFallbackLines;
  const isDebugMode = !activeEngines.has('all');

  if (!isRecording) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Word Count Badge */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${wordCount} words captured`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: open
            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.2))'
            : 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted) / 0.8))',
          color: 'hsl(var(--foreground))',
          border: open ? '1.5px solid hsl(var(--primary) / 0.5)' : '1.5px solid hsl(var(--border))',
          borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: open ? 'scale(1.04)' : 'scale(1)',
          boxShadow: open
            ? '0 4px 20px hsl(var(--primary) / 0.15)'
            : '0 2px 8px hsl(var(--foreground) / 0.04)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{wordCount}</span>
        <span style={{ opacity: 0.6, fontWeight: 500 }}>words</span>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: 'hsl(var(--destructive))',
          animation: 'nw-pulse 1.5s ease-in-out infinite', flexShrink: 0,
        }} />
      </button>

      {/* Glass Panel */}
      <div style={{
        position: 'absolute', top: 'calc(100% + 10px)', left: '50%',
        transform: open ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(-6px) scale(0.98)',
        width: 620,
        background: 'hsl(var(--background) / 0.88)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid hsl(var(--border) / 0.25)', borderRadius: 16,
        boxShadow: '0 20px 50px hsl(var(--foreground) / 0.08), inset 0 0 0 1px hsl(var(--background) / 0.5)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'inherit',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', borderBottom: '1px solid hsl(var(--border) / 0.12)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#3B82F6', boxShadow: '0 0 6px #3B82F6', flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>
              Live Preview
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>
            {wordCount} words
          </span>
        </div>

        {/* Engine pills */}
        <div style={{ display: 'flex', gap: 4, padding: '6px 14px', flexWrap: 'wrap' }}>
          {ENGINE_SOURCES.map(s => {
            const active = activeEngines.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggleSource(s.key)}
                style={{
                  fontSize: 10, padding: '2px 10px', borderRadius: 12, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: active ? 600 : 400,
                  border: `1px solid ${active ? `hsl(${s.hue} / 0.6)` : 'hsl(var(--border))'}`,
                  background: active ? `hsl(${s.hue} / 0.12)` : 'transparent',
                  color: active ? `hsl(${s.hue})` : 'hsl(var(--muted-foreground))',
                  transition: 'all 0.2s ease', outline: 'none',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Transcript content */}
        <div style={{
          maxHeight: isDebugMode ? 480 : 140,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '4px 14px 12px',
          transition: 'max-height 0.3s ease',
        }}>
          {!isDebugMode ? (
            /* Standard "All" view — 4 lines + partial */
            <AllView visibleLines={visibleLines} currentPartial={currentPartial} />
          ) : (
            /* Per-engine debug sections */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeEngines.has('assembly') && (
                <EngineSection
                  label="AssemblyAI"
                  hue="217 91% 60%"
                  lines={visibleLines.length > 0 ? visibleLines : splitIntoLines(assemblyFullTranscript, 4)}
                  partial={currentPartial}
                />
              )}
              {activeEngines.has('deepgram') && (
                <EngineSection
                  label="Deepgram"
                  hue="142 71% 45%"
                  lines={splitIntoLines(deepgramText, 4)}
                  emptyText="Deepgram: awaiting data…"
                />
              )}
              {activeEngines.has('whisper') && (
                <EngineSection
                  label={whisperChunkNum > 0 ? `Whisper (chunk ${whisperChunkNum})` : 'Whisper'}
                  hue="270 67% 55%"
                  lines={splitIntoLines(whisperChunkText, 4)}
                  emptyText="Whisper: recording… (transcribes on sync)"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes nw-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes nw-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

/* ── Helpers ── */

const splitIntoLines = (text: string | undefined, max: number): string[] => {
  if (!text || !text.trim()) return [];
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g);
  if (!sentences || sentences.length <= 1) return [text];
  const lines: string[] = [];
  let current = '';
  const perLine = Math.ceil(sentences.length / max);
  sentences.forEach((s, i) => {
    current += s;
    if ((i + 1) % perLine === 0 || i === sentences.length - 1) {
      lines.push(current.trim());
      current = '';
    }
  });
  return lines.slice(-max);
};

/* ── Sub-components ── */

const AllView: React.FC<{ visibleLines: string[]; currentPartial: string }> = ({ visibleLines, currentPartial }) => (
  <>
    {visibleLines.length === 0 && !currentPartial && (
      <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic', margin: 0 }}>
        Listening… speak to see live transcript
      </p>
    )}
    {visibleLines.map((line, i) => {
      const progress = visibleLines.length === 1 ? 1 : i / (visibleLines.length - 1);
      return (
        <div key={`${i}-${line.substring(0, 20)}`} style={{
          fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--foreground) / 0.85)',
          opacity: 0.4 + progress * 0.6,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'opacity 0.4s ease', margin: 0, padding: 0,
        }}>
          {line}
        </div>
      );
    })}
    {currentPartial && (
      <div style={{
        fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--foreground))',
        opacity: 0.4, fontStyle: 'italic', display: 'flex', alignItems: 'center',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0, padding: 0,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentPartial}</span>
        <span style={{
          display: 'inline-block', width: 2, height: 15,
          backgroundColor: 'hsl(var(--primary))', marginLeft: 3,
          animation: 'nw-blink 0.8s step-end infinite', flexShrink: 0,
        }} />
      </div>
    )}
  </>
);

interface EngineSectionProps {
  label: string;
  hue: string;
  lines: string[];
  partial?: string;
  emptyText?: string;
}

const EngineSection: React.FC<EngineSectionProps> = ({ label, hue, lines, partial, emptyText }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{
      fontSize: 10, fontWeight: 500, color: `hsl(${hue})`,
      borderBottom: `1px solid hsl(${hue} / 0.2)`,
      paddingBottom: 2, marginBottom: 3, letterSpacing: '0.05em',
    }}>
      {label}
    </div>
    {lines.length === 0 && !partial && (
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic', margin: 0 }}>
        {emptyText || 'Awaiting data…'}
      </p>
    )}
    {lines.map((line, i) => (
      <div key={`${i}-${line.substring(0, 20)}`} style={{
        fontSize: 12, lineHeight: 1.5, color: 'hsl(var(--foreground) / 0.8)',
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden', margin: 0,
      }}>
        {line}
      </div>
    ))}
    {partial && (
      <div style={{
        fontSize: 12, lineHeight: 1.5, color: 'hsl(var(--foreground))',
        opacity: 0.4, fontStyle: 'italic',
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden', margin: 0,
      }}>
        {partial}
      </div>
    )}
  </div>
);
