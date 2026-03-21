import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMeetingSetup } from './MeetingSetupContext';
import { ContextStatusPill } from './ContextStatusPill';
import { AvatarStack } from './AvatarStack';
import { Users, ClipboardList, Camera } from 'lucide-react';

interface LiveContextStatusBarProps {
  onEditContext: (tab?: string) => void;
  onStopRecording: () => void;
  formatDuration: (seconds: number) => string;
}

export const LiveContextStatusBar: React.FC<LiveContextStatusBarProps> = ({
  onEditContext,
  onStopRecording,
  formatDuration,
}) => {
  const {
    attendees, agendaItems, activeGroup,
    presentCount, apologiesCount, absentCount,
    lastUpdate, confirmationMessage,
    recordingDuration,
  } = useMeetingSetup();

  const presentAttendees = attendees.filter(a => a.status === 'present');

  return (
    <div className="animate-fade-in space-y-4">
      {/* Live Context Status Bar */}
      <Card className="p-4 shadow-md">
        {/* Top row: REC + timer + controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* REC badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: '#EF444420', border: '1.5px solid #EF444466' }}
            >
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-bold text-destructive">REC</span>
              <span className="text-[13px] font-extrabold text-destructive font-mono">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            {/* Active group badge */}
            {activeGroup && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{
                  background: `${activeGroup.color}15`,
                  border: `1px solid ${activeGroup.color}33`,
                }}
              >
                <span className="text-xs">{activeGroup.icon}</span>
                <span className="text-[11px] font-bold" style={{ color: activeGroup.color }}>
                  {activeGroup.name}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditContext()}
              className="text-xs font-bold border-amber-500/40 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"
            >
              ✏️ Edit Context
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onStopRecording}
              className="text-xs font-bold border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20"
            >
              ⏹ Stop
            </Button>
          </div>
        </div>

        {/* Status Pills Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <ContextStatusPill
            icon="👥" label="Present" color="#10B981"
            value={presentCount.toString()}
            pulse={lastUpdate === 'attendance'}
          />
          {apologiesCount > 0 && (
            <ContextStatusPill
              icon="📨" label="Apologies" color="#F59E0B"
              value={apologiesCount.toString()}
              pulse={lastUpdate === 'attendance'}
            />
          )}
          {absentCount > 0 && (
            <ContextStatusPill
              icon="✕" label="Absent" color="#EF4444"
              value={absentCount.toString()}
              pulse={lastUpdate === 'attendance'}
            />
          )}
          <div className="w-px h-6 bg-border mx-1" />
          <ContextStatusPill
            icon="📋" label="Agenda"
            color={agendaItems.length > 0 ? '#3B82F6' : '#94A3B8'}
            value={agendaItems.length > 0 ? `${agendaItems.length} items` : 'None'}
            pulse={lastUpdate === 'agenda'}
          />
          {presentAttendees.length > 0 && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <AvatarStack
                  members={presentAttendees.map(a => ({ initials: a.initials, name: a.name }))}
                  max={5}
                  size={22}
                />
              </div>
            </>
          )}
        </div>

        {/* Confirmation flash */}
        {confirmationMessage && (
          <div className="mt-2.5 px-3 py-1.5 rounded-lg animate-fade-in flex items-center gap-1.5"
            style={{ background: '#10B98115', border: '1px solid #10B98133' }}
          >
            <span className="text-xs">✅</span>
            <span className="text-[11px] font-semibold text-emerald-600">{confirmationMessage}</span>
          </div>
        )}
      </Card>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <QuickActionCard
          icon="👥"
          title="Edit Attendees"
          subtitle="Add or update attendance"
          hoverColor="#F59E0B"
          onClick={() => onEditContext('attendees')}
        />
        <QuickActionCard
          icon="📋"
          title="Add Agenda Item"
          subtitle="Helps segment the transcript"
          hoverColor="#3B82F6"
          onClick={() => onEditContext('agenda')}
        />
        <QuickActionCard
          icon="📸"
          title="Add Screenshot"
          subtitle="Capture slides or documents"
          hoverColor="#8B5CF6"
          onClick={() => onEditContext('screenshot')}
        />
      </div>
    </div>
  );
};

function QuickActionCard({
  icon, title, subtitle, hoverColor, onClick,
}: {
  icon: string; title: string; subtitle: string; hoverColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-xl border border-border bg-card text-center transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md group"
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = hoverColor;
        (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted))';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '';
        (e.currentTarget as HTMLElement).style.background = '';
      }}
    >
      <div className="text-2xl mb-1.5">{icon}</div>
      <div className="text-xs font-bold text-foreground">{title}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}
