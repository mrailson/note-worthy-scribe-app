import React from 'react';
import { format } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './mobile-meetings.css';

interface Meeting {
  id: string;
  title: string;
  status: string;
  start_time: string;
  created_at: string;
  duration_minutes: number | null;
  word_count?: number;
}

interface MobileMeetingListProps {
  meetings: Meeting[];
  totalCount: number;
  loading: boolean;
  onSelectMeeting: (meetingId: string) => void;
}

export const MobileMeetingList: React.FC<MobileMeetingListProps> = ({
  meetings,
  totalCount,
  loading,
  onSelectMeeting,
}) => {
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatWordCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="nw-mobile-meetings">
      <div className="nw-mh-header">
        <div className="nw-mh-header-row">
          <div>
            <div className="nw-mh-header-title">Meeting history</div>
            <div className="nw-mh-header-subtitle">{totalCount} meeting{totalCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="nw-mh-loading">Loading meetings…</div>
      ) : meetings.length === 0 ? (
        <div className="nw-mh-empty">
          <div className="nw-mh-empty-title">No meetings yet</div>
          <div className="nw-mh-empty-text">Record your first meeting to see it here</div>
        </div>
      ) : (
        meetings.map((m) => (
          <div key={m.id} className="nw-mh-card" onClick={() => onSelectMeeting(m.id)}>
            <div className="nw-mh-card-title">{m.title}</div>
            <div className="nw-mh-meta">
              <span className="nw-mh-meta-item">
                <span className={`nw-mh-status-dot ${m.status === 'complete' ? 'complete' : 'recording'}`} />
                {m.status}
              </span>
              <span className="nw-mh-meta-item">
                {format(new Date(m.created_at), 'dd MMM · HH:mm')}
              </span>
              {m.duration_minutes && (
                <span className="nw-mh-meta-item">{formatDuration(m.duration_minutes)}</span>
              )}
              {m.word_count && m.word_count > 0 && (
                <span className="nw-mh-meta-item">{formatWordCount(m.word_count)} words</span>
              )}
            </div>
          </div>
        ))
      )}

      <div className="nw-mh-safe-bottom" />
    </div>
  );
};
