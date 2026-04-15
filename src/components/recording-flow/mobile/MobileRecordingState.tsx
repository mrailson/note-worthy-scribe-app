import React, { useState, useMemo } from 'react';
import { useMeetingSetup } from '../MeetingSetupContext';
import { Eye, EyeOff, Pause } from 'lucide-react';
import './mobile-recording.css';

interface MobileRecordingStateProps {
  onStopRecording: () => void;
  wordCount: number;
  transcriptText: string;
  recentFinals?: string[];
  currentPartial?: string;
}

// CSS-only waveform bars generated once
const WAVE_BARS = Array.from({ length: 32 }).map((_, i) => ({
  delay: `${i * 0.06}s`,
  duration: `${0.5 + Math.random() * 0.6}s`,
  opacity: 0.25 + Math.random() * 0.4,
}));

export const MobileRecordingState: React.FC<MobileRecordingStateProps> = ({
  onStopRecording,
  wordCount,
  transcriptText,
  recentFinals = [],
  currentPartial = '',
}) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const { recordingDuration } = useMeetingSetup();

  const mm = String(Math.floor(recordingDuration / 60)).padStart(2, '0');
  const ss = String(recordingDuration % 60).padStart(2, '0');

  // Count active engines — simplified: check if transcript is flowing
  const engineCount = transcriptText.length > 0 ? 3 : 0;

  // Get last ~200 chars of transcript for display
  const displayTranscript = useMemo(() => {
    if (!transcriptText) return '';
    return transcriptText.length > 300
      ? '…' + transcriptText.slice(-300)
      : transcriptText;
  }, [transcriptText]);

  return (
    <div className="nw-mobile-rec" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 60px)' }}>
      <div className="nw-rec-main">
        {/* Timer */}
        <div className="nw-rec-timer-section">
          <div className="nw-rec-live-badge">
            <span className="nw-rec-dot" />
            Recording
          </div>
          <div className="nw-rec-time">
            {mm}<span className="nw-rec-time-colon">:</span>{ss}
          </div>
        </div>

        {/* Stats */}
        <div className="nw-rec-stats">
          <div className="nw-rec-stat">
            <div className="nw-rec-stat-value" style={{ color: 'var(--nw-blue)' }}>
              {wordCount.toLocaleString()}
            </div>
            <div className="nw-rec-stat-label">Words</div>
          </div>
          <div className="nw-rec-stat">
            <div className="nw-rec-stat-value">{engineCount}</div>
            <div className="nw-rec-stat-label">Engines</div>
          </div>
          <div className="nw-rec-stat">
            <div className="nw-rec-stat-value" style={{ color: 'var(--nw-green)' }}>
              Live
            </div>
            <div className="nw-rec-stat-label">Status</div>
          </div>
        </div>

        {/* CSS-only Waveform */}
        <div className="nw-rec-wave">
          {WAVE_BARS.map((bar, i) => (
            <div
              key={i}
              className="nw-rec-wave-bar"
              style={{
                animationDelay: bar.delay,
                animationDuration: bar.duration,
                opacity: bar.opacity,
              }}
            />
          ))}
        </div>

        {/* Live transcript — hidden by default */}
        {showTranscript ? (
          <div className="nw-rec-transcript" style={{ animation: 'nw-slide-up 0.25s ease-out' }}>
            <div className="nw-rec-transcript-header">
              <span className="nw-rec-transcript-label">Live transcript</span>
              <button
                onClick={() => setShowTranscript(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--nw-blue)',
                  fontFamily: 'inherit',
                  padding: '4px 0',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Hide
              </button>
            </div>
            <div className="nw-rec-transcript-text">
              {displayTranscript ? (
                <>
                  {displayTranscript}
                  <span className="nw-rec-transcript-cursor" />
                </>
              ) : (
                <span style={{ color: 'var(--nw-text3)', fontStyle: 'italic' }}>
                  Waiting for speech…
                </span>
              )}
            </div>
          </div>
        ) : (
          <button
            className="nw-show-transcript-btn"
            onClick={() => setShowTranscript(true)}
          >
            <Eye size={16} />
            Show live transcript
            {wordCount > 0 && (
              <span style={{ fontWeight: 400 }}>· {wordCount.toLocaleString()} words</span>
            )}
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="nw-rec-controls" style={{ position: 'relative' }}>
        {confirmingStop && (
          <div style={{
            position: 'absolute', bottom: '90px', left: 16, right: 16,
            background: '#fff', borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            padding: '20px 18px', zIndex: 100,
            border: '1px solid #e5e7eb',
          }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 6, textAlign: 'center' }}>
              Stop recording?
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 18 }}>
              Your notes will be generated. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmingStop(false)}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 12,
                  background: '#f3f4f6', border: 'none',
                  fontSize: 15, fontWeight: 600, color: '#374151', cursor: 'pointer',
                }}
              >
                Keep recording
              </button>
              <button
                onClick={() => { setConfirmingStop(false); onStopRecording(); }}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 12,
                  background: '#dc2626', border: 'none',
                  fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer',
                }}
              >
                Stop &amp; save
              </button>
            </div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <button className="nw-rec-secondary" aria-label="Pause">
            <Pause size={22} fill="currentColor" stroke="none" />
          </button>
          <div className="nw-rec-control-label">Pause</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            className="nw-rec-stop"
            onClick={() => setConfirmingStop(true)}
            aria-label="Stop recording"
          >
            <div className="nw-rec-stop-inner" />
          </button>
          <div className="nw-rec-control-label">Stop</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            className="nw-rec-secondary"
            onClick={() => setShowTranscript(s => !s)}
            aria-label={showTranscript ? 'Hide transcript' : 'Show transcript'}
            style={showTranscript ? { background: 'var(--nw-blue-soft)', color: 'var(--nw-blue)' } : {}}
          >
            {showTranscript ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <div className="nw-rec-control-label">{showTranscript ? 'Hide' : 'Transcript'}</div>
        </div>
      </div>
    </div>
  );
};
