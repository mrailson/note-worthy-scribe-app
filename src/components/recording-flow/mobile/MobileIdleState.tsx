import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Mic, ChevronRight, CheckCircle2, Settings } from 'lucide-react';
import { useMeetingPreferences, SectionKey } from '@/hooks/useMeetingPreferences';
import './mobile-recording.css';

interface MobileIdleStateProps {
  onStartRecording: () => void;
}

interface RecentMeeting {
  id: string;
  title: string;
  created_at: string;
  duration_minutes: number | null;
  word_count: number | null;
}

/* ── Section display config ─────────────────────────────────────── */
const SECTION_ROWS: { key: SectionKey; label: string }[] = [
  { key: 'section_exec_summary', label: 'Executive Summary' },
  { key: 'section_key_points', label: 'Key Points' },
  { key: 'section_decisions', label: 'Key Decisions' },
  { key: 'section_actions', label: 'Action Items' },
  { key: 'section_open_items', label: 'Open Items' },
  { key: 'section_attendees', label: 'Attendees' },
  { key: 'section_next_meeting', label: 'Next Meeting' },
  { key: 'section_full_transcript', label: 'Full Transcript' },
];

const LENGTH_OPTIONS: { label: string; value: 'concise' | 'standard' | 'detailed' }[] = [
  { label: 'Brief', value: 'concise' },
  { label: 'Standard', value: 'standard' },
  { label: 'Detailed', value: 'detailed' },
];

const LENGTH_DESCRIPTIONS: Record<string, string> = {
  concise: 'Key points only — ideal for quick reference emails.',
  standard: 'Balanced summary with actions and decisions.',
  detailed: 'Full notes with discussion points and full context.',
};

export const MobileIdleState: React.FC<MobileIdleStateProps> = ({ onStartRecording }) => {
  const [recentMeeting, setRecentMeeting] = useState<RecentMeeting | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefs, setNotesLength, toggleSection } = useMeetingPreferences();

  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, created_at, duration_minutes, word_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setRecentMeeting(data);
    };
    fetchRecent();
  }, [user]);

  const formatMeetingDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatWordCount = (count: number | null) => {
    if (!count) return '';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K words`;
    return `${count} words`;
  };

  return (
    <div className="nw-mobile-rec">
      <div className="nw-idle-hero">
        {/* Settings cog — top-left of hero area */}
        <button
          className="nw-mobile-settings-cog"
          onClick={() => setSettingsOpen(true)}
          aria-label="Recording settings"
        >
          <Settings size={20} strokeWidth={1.8} />
        </button>

        <div>
          <div className="nw-idle-title">Ready to record</div>
          <div className="nw-idle-subtitle">
            Tap the button to start capturing your meeting. Notewell will transcribe and generate notes automatically.
          </div>
        </div>

        <div className="nw-record-btn-wrap">
          <div className="nw-record-ring" />
          <button className="nw-record-btn" onClick={onStartRecording}>
            <Mic size={36} strokeWidth={1.5} />
            <span className="nw-record-btn-label">Record</span>
          </button>
        </div>

        <div className="nw-steps">
          <div className="nw-step">
            <div className="nw-step-num">1</div>
            <div className="nw-step-text">Tap record to start</div>
          </div>
          <div className="nw-step">
            <div className="nw-step-num">2</div>
            <div className="nw-step-text">Live transcript appears</div>
          </div>
          <div className="nw-step">
            <div className="nw-step-num">3</div>
            <div className="nw-step-text">Notes generated on stop</div>
          </div>
        </div>
      </div>

      {recentMeeting && (
        <div className="nw-recent-bar">
          <div
            className="nw-recent-card"
            onClick={() => navigate('/meeting-summary', { state: { id: recentMeeting.id } })}
          >
            <div className="nw-recent-icon">
              <CheckCircle2 size={16} stroke="var(--nw-green)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="nw-recent-title">{recentMeeting.title || 'Untitled Meeting'}</div>
              <div className="nw-recent-meta">
                {format(new Date(recentMeeting.created_at), 'dd MMM · HH:mm')}
                {recentMeeting.duration_minutes ? ` · ${formatMeetingDuration(recentMeeting.duration_minutes)}` : ''}
                {recentMeeting.word_count ? ` · ${formatWordCount(recentMeeting.word_count)}` : ''}
              </div>
            </div>
            <div className="nw-recent-arrow">
              <ChevronRight size={16} />
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Bottom Sheet ──────────────────────────────────── */}
      {settingsOpen && (
        <div className="nw-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div
            className="nw-settings-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="nw-sheet-handle-wrap">
              <div className="nw-sheet-handle" />
            </div>

            <div className="nw-sheet-body">
              {/* ── Notes Length ─────────────────────────────────── */}
              <div className="nw-sheet-section-label">Notes Length</div>
              <div className="nw-sheet-card" style={{ padding: '16px' }}>
                {/* Segmented control */}
                <div className="nw-segmented-control">
                  {LENGTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`nw-segment ${prefs.notes_length === opt.value ? 'nw-segment--active' : ''}`}
                      onClick={() => setNotesLength(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="nw-length-helper">
                  {LENGTH_DESCRIPTIONS[prefs.notes_length] || LENGTH_DESCRIPTIONS.standard}
                </p>
              </div>

              {/* ── Email Output Sections ────────────────────────── */}
              <div className="nw-sheet-section-label">Email Output Sections</div>
              <div className="nw-sheet-card" style={{ padding: 0 }}>
                {SECTION_ROWS.map((row, idx) => (
                  <div
                    key={row.key}
                    className="nw-section-row"
                    style={idx < SECTION_ROWS.length - 1 ? { borderBottom: '1px solid #f2f2f7' } : undefined}
                  >
                    <span className="nw-section-label">{row.label}</span>
                    <button
                      className={`nw-ios-toggle ${prefs[row.key] ? 'nw-ios-toggle--on' : ''}`}
                      onClick={() => toggleSection(row.key)}
                      role="switch"
                      aria-checked={prefs[row.key]}
                    >
                      <span className="nw-ios-toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>

              {/* ── Save button ──────────────────────────────────── */}
              <button className="nw-sheet-save-btn" onClick={() => setSettingsOpen(false)}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};