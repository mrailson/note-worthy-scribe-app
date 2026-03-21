import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Mic, ChevronRight, CheckCircle2 } from 'lucide-react';
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

export const MobileIdleState: React.FC<MobileIdleStateProps> = ({ onStartRecording }) => {
  const [recentMeeting, setRecentMeeting] = useState<RecentMeeting | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

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
    </div>
  );
};
