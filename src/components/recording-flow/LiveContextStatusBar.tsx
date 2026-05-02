import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMeetingSetup } from './MeetingSetupContext';
import { ContextStatusPill } from './ContextStatusPill';
import { AvatarStack } from './AvatarStack';
import { LiveTranscriptGlassPanel } from './LiveTranscriptGlassPanel';
import { AttendeePreviewPanel } from './AttendeePreviewPanel';
import { AgendaPreviewPanel } from './AgendaPreviewPanel';
import { useIsMobile } from '@/hooks/use-mobile';

interface LiveContextStatusBarProps {
  onEditContext: (tab?: string) => void;
  onStopRecording: () => void;
  formatDuration: (seconds: number) => string;
  wordCount?: number;
  transcriptText?: string;
  recentFinals?: string[];
  currentPartial?: string;
  assemblyFullTranscript?: string;
  deepgramText?: string;
  whisperChunkText?: string;
  whisperChunkNum?: number;
  
  browserText?: string;
}

export const LiveContextStatusBar: React.FC<LiveContextStatusBarProps> = ({
  onEditContext,
  onStopRecording,
  formatDuration,
  wordCount = 0,
  transcriptText = '',
  recentFinals = [],
  currentPartial = '',
  assemblyFullTranscript = '',
  deepgramText = '',
  whisperChunkText = '',
  whisperChunkNum = 0,
  
  browserText = '',
}) => {
  const isMobile = useIsMobile();
  const {
    attendees, agendaItems, activeGroup,
    presentCount, apologiesCount, absentCount,
    lastUpdate, confirmationMessage,
    recordingDuration,
  } = useMeetingSetup();

  const [attendeePreviewOpen, setAttendeePreviewOpen] = useState(false);
  const [agendaPreviewOpen, setAgendaPreviewOpen] = useState(false);

  const presentAttendees = attendees.filter(a => a.status === 'present');

  return (
    <div className="animate-fade-in space-y-2">
      {/* Single compact status bar */}
      <Card className="px-3 py-2.5 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          {/* REC badge with timer */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: '#EF444420', border: '1.5px solid #EF444466' }}
          >
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-[11px] font-bold text-destructive">REC</span>
            <span className="text-[12px] font-extrabold text-destructive font-mono">
              {formatDuration(recordingDuration)}
            </span>
          </div>

          {/* Divider — hidden on mobile */}
          {!isMobile && <div className="w-px h-5 bg-border" />}

          {/* Status pills — all hidden on mobile */}
          {!isMobile && (
            <div style={{ position: 'relative' }}>
              <ContextStatusPill
                icon="👥" label="Present" color="#10B981"
                value={presentCount.toString()}
                pulse={lastUpdate === 'attendance'}
                onClick={attendees.length > 0 ? () => { setAttendeePreviewOpen(o => !o); setAgendaPreviewOpen(false); } : undefined}
              />
              <AttendeePreviewPanel
                open={attendeePreviewOpen}
                onClose={() => setAttendeePreviewOpen(false)}
                attendees={attendees}
              />
            </div>
          )}
          {!isMobile && apologiesCount > 0 && (
            <ContextStatusPill
              icon="📨" label="Apologies" color="#F59E0B"
              value={apologiesCount.toString()}
              pulse={lastUpdate === 'attendance'}
              onClick={attendees.length > 0 ? () => { setAttendeePreviewOpen(o => !o); setAgendaPreviewOpen(false); } : undefined}
            />
          )}
          {!isMobile && (
            <div style={{ position: 'relative' }}>
              <ContextStatusPill
                icon="📋" label="Agenda"
                color={agendaItems.length > 0 ? '#3B82F6' : '#94A3B8'}
                value={agendaItems.length > 0 ? `${agendaItems.length} items` : 'None'}
                pulse={lastUpdate === 'agenda'}
                onClick={agendaItems.length > 0 ? () => { setAgendaPreviewOpen(o => !o); setAttendeePreviewOpen(false); } : undefined}
              />
              <AgendaPreviewPanel
                open={agendaPreviewOpen}
                onClose={() => setAgendaPreviewOpen(false)}
                items={agendaItems}
              />
            </div>
          )}

          {/* Duration pill — hide on mobile (already in REC badge) */}
          {!isMobile && (
            <ContextStatusPill
              icon="⏱" label="Duration" color="#6366F1"
              value={formatDuration(recordingDuration)}
            />
          )}

          {/* Live transcript glass panel */}
          <LiveTranscriptGlassPanel
            isRecording={true}
            wordCount={wordCount}
            transcriptText={transcriptText}
            recentFinals={recentFinals}
            currentPartial={currentPartial}
            assemblyFullTranscript={assemblyFullTranscript}
            deepgramText={deepgramText}
            whisperChunkText={whisperChunkText}
            whisperChunkNum={whisperChunkNum}
            
          />

          {/* Avatar stack */}
          {!isMobile && presentAttendees.length > 0 && (
            <>
              <div className="w-px h-5 bg-border" />
              <AvatarStack
                members={presentAttendees.map(a => ({ initials: a.initials, name: a.name }))}
                max={4}
                size={20}
              />
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons — hidden on mobile */}
          {!isMobile && (
            <div className="flex gap-1.5 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditContext()}
                className="text-[11px] font-bold border-amber-500/40 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 h-7 px-2.5"
              >
                ✏️ Edit Context
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onStopRecording}
                className="text-[11px] font-bold border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20 h-7 px-2.5"
              >
                ⏹ Stop
              </Button>
            </div>
          )}
        </div>

        {/* Confirmation flash */}
        {confirmationMessage && (
          <div className="mt-2 px-3 py-1 rounded-lg animate-fade-in flex items-center gap-1.5"
            style={{ background: '#10B98115', border: '1px solid #10B98133' }}
          >
            <span className="text-xs">✅</span>
            <span className="text-[11px] font-semibold text-emerald-600">{confirmationMessage}</span>
          </div>
        )}
      </Card>

      {/* Quick Action Cards — hidden on mobile */}
      {!isMobile && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onEditContext('attendees')}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card transition-all duration-150 cursor-pointer hover:border-amber-500/50 hover:bg-muted/50"
          >
            <span className="text-base">👥</span>
            <span className="text-[11px] font-bold text-foreground">Edit Attendees</span>
          </button>
          <button
            onClick={() => onEditContext('agenda')}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card transition-all duration-150 cursor-pointer hover:border-blue-500/50 hover:bg-muted/50"
          >
            <span className="text-base">📋</span>
            <span className="text-[11px] font-bold text-foreground">Add Agenda</span>
          </button>
          <button
            onClick={() => onEditContext('screenshot')}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card transition-all duration-150 cursor-pointer hover:border-violet-500/50 hover:bg-muted/50"
          >
            <span className="text-base">📸</span>
            <span className="text-[11px] font-bold text-foreground">Screenshot</span>
          </button>
        </div>
      )}
    </div>
  );
};
