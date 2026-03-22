import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Download, Share2, FileText, MessageSquare, Users, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const MeetingQAPanel = lazy(() => import('@/components/meeting-details/MeetingQAPanel').then(m => ({ default: m.MeetingQAPanel })));

import './mobile-meetings.css';

const AVATAR_COLORS = [
  { bg: '#DBEAFE', color: '#1E40AF' },
  { bg: '#D1FAE5', color: '#065F46' },
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#FCE7F3', color: '#9D174D' },
  { bg: '#E0E7FF', color: '#3730A3' },
  { bg: '#CCFBF1', color: '#134E4A' },
];

interface MeetingDetailData {
  id: string;
  title: string;
  status: string;
  start_time: string;
  created_at: string;
  duration_minutes: number | null;
  word_count?: number;
  overview?: string | null;
  best_of_all_transcript?: string | null;
  whisper_transcript_text?: string | null;
  assembly_transcript_text?: string | null;
  whisper_confidence?: number | null;
  assembly_confidence?: number | null;
  meeting_attendees_json?: any;
}

interface ActionItem {
  id: string;
  action_text: string;
  assignee_name?: string | null;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
}

interface MobileMeetingDetailProps {
  meetingId: string;
  open: boolean;
  onBack: () => void;
  onViewSummary: (meetingId: string) => void;
  onShowExport?: (wordCount?: number) => void;
}

type TabId = 'overview' | 'actions' | 'transcript' | 'ask-ai';

export const MobileMeetingDetail: React.FC<MobileMeetingDetailProps> = ({
  meetingId,
  open,
  onBack,
  onViewSummary,
  onShowExport,
}) => {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<MeetingDetailData | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);

  useEffect(() => {
    if (!meetingId || !user || !open) return;
    setLoading(true);
    setTab('overview');

    const fetchMeeting = async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, status, start_time, created_at, duration_minutes, word_count, overview, best_of_all_transcript, whisper_transcript_text, assembly_transcript_text, whisper_confidence, assembly_confidence, meeting_attendees_json')
        .eq('id', meetingId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) setMeeting(data);
      setLoading(false);
    };

    fetchMeeting();
  }, [meetingId, user, open]);

  // Fetch action items when actions tab is selected or on mount
  useEffect(() => {
    if (!meetingId || !user || !open) return;

    const fetchActionItems = async () => {
      setActionItemsLoading(true);
      const { data, error } = await supabase
        .from('meeting_action_items')
        .select('id, action_text, assignee_name, due_date, status, priority')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setActionItems(data);
      }
      setActionItemsLoading(false);
    };

    fetchActionItems();
  }, [meetingId, user, open]);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatWordCount = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Parse attendees from JSON
  const attendees = useMemo(() => {
    if (!meeting?.meeting_attendees_json) return [];
    try {
      const parsed = typeof meeting.meeting_attendees_json === 'string'
        ? JSON.parse(meeting.meeting_attendees_json)
        : meeting.meeting_attendees_json;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [meeting?.meeting_attendees_json]);

  // Parse overview into bullets
  const overviewBullets = useMemo(() => {
    if (!meeting?.overview) return [];
    const lines = meeting.overview
      .split(/[\n•\-]/)
      .map(l => l.trim())
      .filter(l => l.length > 10);
    return lines.slice(0, 8);
  }, [meeting?.overview]);

  // Transcript stats
  const transcriptStats = useMemo(() => {
    const whisperWords = meeting?.whisper_transcript_text?.split(/\s+/).length || 0;
    const assemblyWords = meeting?.assembly_transcript_text?.split(/\s+/).length || 0;
    const bestOfAllWords = meeting?.best_of_all_transcript?.split(/\s+/).length || 0;
    const avgConfidence = Math.round(
      ((meeting?.whisper_confidence || 0) + (meeting?.assembly_confidence || 0)) / 2
    );

    return { whisperWords, assemblyWords, bestOfAllWords, avgConfidence };
  }, [meeting]);

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // Separate open and completed action items
  const openActions = actionItems.filter(a => a.status !== 'Completed');
  const completedActions = actionItems.filter(a => a.status === 'Completed');

  const getPriorityStyle = (priority?: string | null) => {
    switch (priority?.toLowerCase()) {
      case 'high': return { background: 'var(--nw-red)', color: '#fff' };
      case 'medium': return { background: 'var(--nw-amber-light)', color: 'var(--nw-amber)' };
      case 'low': return { background: 'var(--nw-green-light)', color: 'var(--nw-green)' };
      default: return { background: 'var(--nw-surface2)', color: 'var(--nw-text2)' };
    }
  };

  if (!open) return null;

  return (
    <div className={`nw-mh-detail ${open ? 'open' : ''}`}>
      {/* Header */}
      <div className="nw-mh-header" style={{ paddingBottom: 0 }}>
        <div className="nw-mh-header-row">
          <button className="nw-mh-back" onClick={onBack}>
            <ChevronLeft size={20} /> Back
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="nw-mh-icon-btn" onClick={() => onShowExport?.(meeting?.word_count)}>
              <Download size={18} />
            </button>
            <button className="nw-mh-icon-btn" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: meeting?.title || 'Meeting', text: 'Shared from Notewell AI' }).catch(() => {});
              }
            }}>
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="nw-mh-loading">Loading meeting…</div>
      ) : meeting ? (
        <>
          {/* Hero */}
          <div className="nw-mh-hero">
            <div className="nw-mh-detail-title">{meeting.title}</div>
            <div className="nw-mh-chips">
              <span className="nw-mh-chip">
                {format(new Date(meeting.created_at), 'dd MMM yyyy')}
              </span>
              {meeting.duration_minutes && (
                <span className="nw-mh-chip">
                  <Clock size={13} /> {formatDuration(meeting.duration_minutes)}
                </span>
              )}
              <span className="nw-mh-chip">{formatWordCount(meeting.word_count)} words</span>
              <span className="nw-mh-chip" style={{
                background: 'var(--nw-green-light)',
                color: 'var(--nw-green)',
              }}>
                <span className="nw-mh-status-dot complete" style={{ width: 6, height: 6 }} />
                {meeting.status === 'complete' ? 'Completed' : meeting.status}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="nw-mh-quick-actions">
            <button className="nw-mh-quick-action" onClick={() => onViewSummary(meeting.id)}>
              <FileText size={22} />
              <span>Notes</span>
            </button>
            <button className="nw-mh-quick-action" onClick={() => setTab('ask-ai')}>
              <MessageSquare size={22} />
              <span>Ask AI</span>
            </button>
            <button className="nw-mh-quick-action" onClick={() => setTab('overview')}>
              <Users size={22} />
              <span>Attendees</span>
            </button>
            <button className="nw-mh-quick-action" onClick={() => onShowExport?.(meeting?.word_count)}>
              <Download size={22} />
              <span>Export</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="nw-mh-tabs">
            <button className={`nw-mh-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
              Overview
            </button>
            <button className={`nw-mh-tab ${tab === 'actions' ? 'active' : ''}`} onClick={() => setTab('actions')}>
              Actions
              {openActions.length > 0 && (
                <span className="nw-mh-tab-badge">{openActions.length}</span>
              )}
            </button>
            <button className={`nw-mh-tab ${tab === 'transcript' ? 'active' : ''}`} onClick={() => setTab('transcript')}>
              Transcript
            </button>
            <button className={`nw-mh-tab ${tab === 'ask-ai' ? 'active' : ''}`} onClick={() => setTab('ask-ai')}>
              Ask AI
            </button>
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="nw-mh-section">
              {meeting.overview && (
                <>
                  <div className="nw-mh-card-content">
                    <div className="nw-mh-overview-text">{meeting.overview}</div>
                  </div>

                  {overviewBullets.length > 1 && (
                    <>
                      <div className="nw-mh-section-title" style={{ marginTop: 20 }}>Key points</div>
                      <div className="nw-mh-card-content">
                        {overviewBullets.map((b, i) => (
                          <div key={i} className="nw-mh-bullet">
                            <div className="nw-mh-bullet-dot" />
                            <div>{b}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {!meeting.overview && (
                <div className="nw-mh-card-content">
                  <div className="nw-mh-overview-text" style={{ color: 'var(--nw-text3)', fontStyle: 'italic' }}>
                    No overview available. Tap "Notes" to generate meeting notes.
                  </div>
                </div>
              )}

              {attendees.length > 0 && (
                <>
                  <div className="nw-mh-section-title" style={{ marginTop: 20 }}>Attendees</div>
                  <div className="nw-mh-card-content">
                    {attendees.map((a: any, i: number) => {
                      const colours = AVATAR_COLORS[i % AVATAR_COLORS.length];
                      const name = a.name || a.attendee_name || 'Unknown';
                      return (
                        <div key={i} className="nw-mh-attendee-row">
                          <div className="nw-mh-avatar" style={{ background: colours.bg, color: colours.color }}>
                            {a.initials || getInitials(name)}
                          </div>
                          <div>
                            <div className="nw-mh-attendee-name">{name}</div>
                            {(a.role || a.title) && (
                              <div className="nw-mh-attendee-role">{a.role || a.title}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="nw-mh-safe-bottom" />
            </div>
          )}

          {tab === 'actions' && (
            <div className="nw-mh-section">
              {actionItemsLoading ? (
                <div className="nw-mh-loading">Loading action items…</div>
              ) : actionItems.length === 0 ? (
                <div className="nw-mh-card-content">
                  <div className="nw-mh-overview-text" style={{ color: 'var(--nw-text3)', fontStyle: 'italic' }}>
                    No action items found. Tap "Notes" to generate meeting notes — action items are extracted automatically.
                  </div>
                </div>
              ) : (
                <>
                  {openActions.length > 0 && (
                    <>
                      <div className="nw-mh-section-title">Open ({openActions.length})</div>
                      <div className="nw-mh-card-content">
                        {openActions.map((item) => (
                          <div key={item.id} className="nw-mh-action-item">
                            <div className="nw-mh-action-text">{item.action_text}</div>
                            <div className="nw-mh-action-meta">
                              {item.assignee_name && item.assignee_name !== 'TBC' && (
                                <span className="nw-mh-action-owner">{item.assignee_name}</span>
                              )}
                              {item.due_date && item.due_date !== 'TBC' && (
                                <span className="nw-mh-action-deadline">Due: {item.due_date}</span>
                              )}
                              {item.priority && (
                                <span className="nw-mh-action-badge" style={getPriorityStyle(item.priority)}>
                                  {item.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {completedActions.length > 0 && (
                    <>
                      <div className="nw-mh-section-title" style={{ marginTop: openActions.length > 0 ? 20 : 0 }}>
                        Completed ({completedActions.length})
                      </div>
                      <div className="nw-mh-card-content">
                        {completedActions.map((item) => (
                          <div key={item.id} className="nw-mh-action-item" style={{ opacity: 0.6 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <CheckCircle2 size={16} style={{ color: 'var(--nw-green)', flexShrink: 0, marginTop: 2 }} />
                              <div className="nw-mh-action-text" style={{ textDecoration: 'line-through' }}>
                                {item.action_text}
                              </div>
                            </div>
                            <div className="nw-mh-action-meta">
                              {item.assignee_name && item.assignee_name !== 'TBC' && (
                                <span className="nw-mh-action-owner">{item.assignee_name}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="nw-mh-safe-bottom" />
            </div>
          )}

          {tab === 'transcript' && (
            <div className="nw-mh-section">
              <div className="nw-mh-section-title">Pipeline sources</div>
              <div className="nw-mh-pipeline-grid">
                <div className="nw-mh-pipeline-card best">
                  <div className="nw-mh-pipeline-label">Best of All (merged)</div>
                  <div className="nw-mh-pipeline-value" style={{ color: 'var(--nw-blue)' }}>
                    {transcriptStats.bestOfAllWords > 0 ? transcriptStats.bestOfAllWords.toLocaleString() : '—'}
                  </div>
                  <div className="nw-mh-pipeline-sub">Canonical transcript</div>
                </div>
                <div className="nw-mh-pipeline-card">
                  <div className="nw-mh-pipeline-label">Whisper</div>
                  <div className="nw-mh-pipeline-value">
                    {transcriptStats.whisperWords > 0 ? transcriptStats.whisperWords.toLocaleString() : '—'}
                  </div>
                </div>
                <div className="nw-mh-pipeline-card">
                  <div className="nw-mh-pipeline-label">AssemblyAI</div>
                  <div className="nw-mh-pipeline-value">
                    {transcriptStats.assemblyWords > 0 ? transcriptStats.assemblyWords.toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {transcriptStats.avgConfidence > 0 && (
                <>
                  <div className="nw-mh-section-title">Confidence</div>
                  <div className="nw-mh-card-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, color: 'var(--nw-text2)' }}>Average batch confidence</span>
                      <span style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: transcriptStats.avgConfidence >= 50 ? 'var(--nw-green)' :
                               transcriptStats.avgConfidence >= 30 ? 'var(--nw-amber)' : 'var(--nw-red)',
                      }}>
                        {transcriptStats.avgConfidence}%
                      </span>
                    </div>
                    <div className="nw-mh-conf-bar">
                      <div className="nw-mh-conf-fill" style={{
                        width: `${transcriptStats.avgConfidence}%`,
                        background: transcriptStats.avgConfidence >= 50 ? 'var(--nw-green)' :
                                    transcriptStats.avgConfidence >= 30 ? 'var(--nw-amber)' : 'var(--nw-red)',
                      }} />
                    </div>
                  </div>
                </>
              )}

              {/* Transcript preview */}
              {meeting.best_of_all_transcript && (
                <>
                  <div className="nw-mh-section-title" style={{ marginTop: 20 }}>Transcript preview</div>
                  <div className="nw-mh-card-content" style={{ maxHeight: 200, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--nw-text)' }}>
                      {meeting.best_of_all_transcript.slice(0, 500)}
                    </div>
                    <div
                      onClick={() => setTab('transcript')}
                      style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                        background: 'linear-gradient(transparent, var(--nw-surface))',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--nw-blue)' }}>
                        View full transcript
                      </span>
                    </div>
                  </div>
                </>
              )}
              <div className="nw-mh-safe-bottom" />
            </div>
          )}
        </>
      ) : (
        <div className="nw-mh-loading">Meeting not found</div>
      )}
    </div>
  );
};
