import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Download, Share2, FileText, MessageSquare, Users, Clock, CheckCircle2, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

const TRANSCRIPT_PREVIEW_LENGTH = 500;
const TRANSCRIPT_EXPANDED_LENGTH = 5000;

const TranscriptInlineView = ({ transcript }: { transcript: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = transcript.length > TRANSCRIPT_PREVIEW_LENGTH;
  const displayText = expanded
    ? transcript.slice(0, TRANSCRIPT_EXPANDED_LENGTH)
    : transcript.slice(0, TRANSCRIPT_PREVIEW_LENGTH);
  const hasMore = transcript.length > TRANSCRIPT_EXPANDED_LENGTH && expanded;

  return (
    <>
      <div className="nw-mh-section-title" style={{ marginTop: 20 }}>
        {expanded ? 'Transcript' : 'Transcript preview'}
      </div>
      <div className="nw-mh-card-content" style={{ position: 'relative' }}>
        <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--nw-text)' }}>
          {displayText}
          {!expanded && isLong && '…'}
          {hasMore && '…'}
        </div>
        {isLong && (
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              textAlign: 'center',
              paddingTop: 12,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--nw-blue)' }}>
              {expanded ? 'Show less' : 'View full transcript'}
            </span>
          </div>
        )}
      </div>
    </>
  );
};
const DeleteMeetingSection = ({ meetingId, onDeleted }: { meetingId: string; onDeleted: () => void }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      toast.success('Meeting deleted permanently');
      onDeleted();
    } catch (err: any) {
      console.error('Delete meeting error:', err);
      toast.error('Failed to delete meeting: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div style={{ marginTop: 40, marginBottom: 20 }}>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '14px 16px',
            fontSize: 14,
            fontWeight: 500,
            color: '#DC2626',
            background: 'transparent',
            border: '1px solid #FECACA',
            borderRadius: 12,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Trash2 size={16} />
          Delete Meeting
        </button>
      ) : (
        <div style={{
          padding: 16,
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={20} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>
                Delete this meeting permanently?
              </p>
              <p style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
                This will permanently delete the meeting, all transcripts, notes, action items, and associated documents. This action cannot be undone.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--nw-text)',
                background: 'white',
                border: '1px solid var(--nw-border)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                background: '#DC2626',
                border: 'none',
                borderRadius: 10,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.7 : 1,
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


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

  // Parse overview into summary paragraph + key points
  const { summaryParagraph, keyPoints } = useMemo(() => {
    if (!meeting?.overview) return { summaryParagraph: '', keyPoints: [] };
    const raw = meeting.overview;

    // Find the first bullet marker (• or line starting with -)
    const bulletStart = raw.search(/[•]|\n\s*-\s/);
    let summary = '';
    let bulletSection = '';

    if (bulletStart > 0) {
      summary = raw.slice(0, bulletStart).trim();
      bulletSection = raw.slice(bulletStart);
    } else if (bulletStart === 0) {
      // Entire text is bullets
      bulletSection = raw;
    } else {
      // No bullet markers found — treat whole text as summary
      summary = raw.trim();
    }

    // Split bullet section into individual items
    const points = bulletSection
      .split(/[•]|\n\s*-\s/)
      .map(l => l.replace(/\n/g, ' ').trim())
      .filter(l => l.length > 20);

    const maxPoints = (meeting?.duration_minutes && meeting.duration_minutes >= 30) ? 10 : 8;
    return { summaryParagraph: summary, keyPoints: points.slice(0, maxPoints) };
  }, [meeting?.overview, meeting?.duration_minutes]);

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
              {meeting.overview ? (
                <>
                  {summaryParagraph && (
                    <div className="nw-mh-card-content" style={{ marginBottom: 16 }}>
                      <div className="nw-mh-overview-text">{summaryParagraph}</div>
                    </div>
                  )}

                  {keyPoints.length > 0 && (
                    <>
                      <div className="nw-mh-section-title" style={{ marginTop: summaryParagraph ? 24 : 0 }}>Key points</div>
                      <div className="nw-mh-card-content">
                        {keyPoints.map((b, i) => (
                          <div key={i} className="nw-mh-bullet">
                            <div className="nw-mh-bullet-dot" />
                            <div>{b}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
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

              {/* Transcript view */}
              {meeting.best_of_all_transcript && (
                <TranscriptInlineView transcript={meeting.best_of_all_transcript} />
              )}

              {/* Delete Meeting */}
              <DeleteMeetingSection meetingId={meeting.id} onDeleted={onBack} />

              <div className="nw-mh-safe-bottom" />
            </div>
          )}

          {tab === 'ask-ai' && (
            <div className="nw-mh-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--nw-blue)' }} />
                </div>
              }>
                <MeetingQAPanel
                  meetingId={meeting.id}
                  meetingTitle={meeting.title}
                />
              </Suspense>
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
