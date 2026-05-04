import React from 'react';
import { Check, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeetingProgressData {
  status: string;
  word_count?: number | null;
  notes_generation_status?: string | null;
  summary_exists?: boolean;
  notes_email_sent_at?: string | null;
  remote_chunk_paths?: string[] | null;
  mixed_audio_url?: string | null;
}

interface MeetingProgressBadgesProps {
  meeting: MeetingProgressData;
  className?: string;
}

const badgeBase = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-tight transition-all duration-300';

const styles = {
  pending: 'bg-[hsl(210,40%,96%)] text-[hsl(215,16%,59%)] border border-dashed border-[hsl(215,20%,80%)]',
  uploaded: 'bg-[hsl(213,97%,92%)] text-[hsl(224,76%,48%)] border border-solid border-[hsl(213,94%,78%)]',
  green: 'bg-[hsl(142,72%,93%)] text-[hsl(143,64%,24%)] border border-solid border-[hsl(142,69%,73%)]',
  failed: 'bg-[hsl(0,84%,95%)] text-[hsl(0,72%,41%)] border border-solid border-[hsl(0,84%,74%)]',
  disabled: 'bg-[hsl(210,40%,96%)] text-[hsl(215,16%,59%)] border border-solid border-[hsl(215,20%,86%)]',
};

export const MeetingProgressBadges: React.FC<MeetingProgressBadgesProps> = ({ meeting, className }) => {
  const isAudioMissing = meeting.status === 'audio_missing';
  const isFailed = meeting.status === 'failed' || meeting.status === 'transcription_failed';
  const isUploading = meeting.status === 'recording' || meeting.status === 'uploading';

  // Determine uploaded state
  const hasAudio = !!(
    meeting.remote_chunk_paths?.length ||
    meeting.mixed_audio_url
  ) && !isAudioMissing && !isUploading;

  // Determine transcription state
  const hasTranscript = !!(meeting.word_count && meeting.word_count > 0);

  // Determine notes state
  const hasNotes = !!(
    meeting.summary_exists ||
    meeting.notes_generation_status === 'completed'
  );

  // Determine email state
  const hasEmail = !!meeting.notes_email_sent_at;

  // Audio missing — show single red badge
  if (isAudioMissing) {
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        <span className={cn(badgeBase, styles.failed)}>
          <X size={10} strokeWidth={3} /> No Audio
        </span>
      </div>
    );
  }

  const formatWordCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {/* Word count / Transcription */}
      {isFailed ? (
        <span className={cn(badgeBase, styles.failed)}>
          <X size={10} strokeWidth={3} /> Failed
        </span>
      ) : hasTranscript ? (
        <span className={cn(badgeBase, styles.green)}>
          <Check size={10} strokeWidth={3} /> {formatWordCount(meeting.word_count!)} words
        </span>
      ) : (
        <span className={cn(badgeBase, styles.pending)}>
          <MoreHorizontal size={10} /> Transcribe
        </span>
      )}
    </div>
  );
};
