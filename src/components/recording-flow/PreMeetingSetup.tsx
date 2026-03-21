import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { useMeetingSetup } from './MeetingSetupContext';
import { ContextStatusPill } from './ContextStatusPill';
import { AvatarStack } from './AvatarStack';
import { useContacts } from '@/hooks/useContacts';
import { useMeetingGroups } from '@/hooks/useMeetingGroups';
import { SPEAKER_COLORS } from '@/types/contactTypes';
import type { MeetingGroup } from '@/types/contactTypes';

interface PreMeetingSetupProps {
  onStartRecording: () => void;
}

export const PreMeetingSetup: React.FC<PreMeetingSetupProps> = ({ onStartRecording }) => {
  const {
    attendees, agendaItems, activeGroup,
    presentCount, apologiesCount,
    lastUpdate, addAgendaItem, removeAgendaItem,
    toggleAttendeeStatus, loadGroup,
  } = useMeetingSetup();

  const { contacts } = useContacts();
  const { groups } = useMeetingGroups();
  const [agendaInput, setAgendaInput] = useState('');

  const handleAddAgenda = () => {
    if (agendaInput.trim()) {
      addAgendaItem(agendaInput.trim());
      setAgendaInput('');
    }
  };

  const handleLoadGroup = (group: MeetingGroup) => {
    loadGroup(group, contacts);
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
          Prepare Your Meeting
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set up attendees and agenda before recording — everything carries through
        </p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Left: Attendees */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <span className="text-sm font-extrabold text-foreground">👥 Attendees</span>
            {attendees.length > 0 && (
              <div className="flex gap-2 text-xs font-bold">
                <span className="text-emerald-600">● {presentCount}</span>
                <span className="text-amber-500">● {apologiesCount}</span>
                <span className="text-red-500">● {attendees.filter(a => a.status === 'absent').length}</span>
              </div>
            )}
          </div>
          <div className="p-4 max-h-[360px] overflow-y-auto">
            {/* Group Quick-Load (no attendees yet) */}
            {attendees.length === 0 && (
              <>
                <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">
                  Load a Meeting Group
                </div>
                {groups.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <div className="text-2xl mb-2">👥</div>
                    <p className="text-xs font-semibold">No meeting groups yet</p>
                    <p className="text-xs mt-1">Create groups in the Import Content modal</p>
                  </div>
                )}
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleLoadGroup(g)}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg mb-1.5 text-left transition-all duration-150 hover:translate-x-0.5 cursor-pointer"
                    style={{
                      border: `1.5px solid ${g.color}33`,
                      background: `${g.color}08`,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = g.color;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${g.color}33`;
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{
                        background: `${g.color}18`,
                        border: `1.5px solid ${g.color}`,
                      }}
                    >
                      {g.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate">{g.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {g.description || 'Meeting group'} · {g.contact_ids.length + (g.additional_members?.length || 0)} members
                      </div>
                    </div>
                    <AvatarStack
                      members={(g.additional_members || []).slice(0, 3).map(m => ({ initials: m.initials, name: m.name }))}
                      max={3}
                      size={20}
                    />
                  </button>
                ))}
              </>
            )}

            {/* Loaded attendees */}
            {attendees.length > 0 && (
              <>
                {activeGroup && (
                  <div
                    className="flex items-center gap-2 p-2 rounded-lg mb-2.5"
                    style={{
                      background: `${activeGroup.color}08`,
                      border: `1px solid ${activeGroup.color}33`,
                    }}
                  >
                    <span className="text-sm">{activeGroup.icon}</span>
                    <span className="text-xs font-bold" style={{ color: activeGroup.color }}>
                      {activeGroup.name}
                    </span>
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted-foreground">{attendees.length} loaded</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  {attendees.map((a, i) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all duration-200"
                      style={{
                        background: a.status === 'present' ? 'transparent' : a.status === 'apologies' ? '#F59E0B08' : '#EF444408',
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}22, ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}44)`,
                          border: `2px solid ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`,
                          color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
                          fontSize: 9,
                        }}
                      >
                        {a.initials}
                      </div>
                      <span
                        className="flex-1 text-xs font-semibold text-foreground truncate"
                        style={{
                          textDecoration: a.status === 'absent' ? 'line-through' : 'none',
                          opacity: a.status === 'absent' ? 0.4 : 1,
                        }}
                      >
                        {a.name}
                      </span>
                      <button
                        onClick={() => toggleAttendeeStatus(a.id)}
                        className="px-2.5 py-0.5 rounded-md text-[10px] font-bold text-white transition-all duration-150 cursor-pointer"
                        style={{
                          background:
                            a.status === 'present' ? '#10B981' :
                            a.status === 'apologies' ? '#F59E0B' : '#EF4444',
                        }}
                      >
                        {a.status === 'present' ? 'Present' : a.status === 'apologies' ? 'Apologies' : 'Absent'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Right: Agenda */}
        <Card className="overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <span className="text-sm font-extrabold text-foreground">📋 Agenda</span>
            {agendaItems.length > 0 && (
              <span className="text-xs text-muted-foreground font-semibold">{agendaItems.length} items</span>
            )}
          </div>
          <div className="p-4 flex-1">
            {agendaItems.length === 0 && (
              <div className="text-center py-5 text-muted-foreground">
                <div className="text-2xl mb-1.5">📋</div>
                <div className="text-xs font-semibold text-foreground/70">No agenda items yet</div>
                <div className="text-[11px] mt-1">Add items below — they help the AI segment the transcript</div>
              </div>
            )}
            {agendaItems.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-1 bg-muted/30 border border-muted animate-fade-in"
              >
                <span className="text-[11px] font-bold text-muted-foreground/40 font-mono w-[18px]">{i + 1}.</span>
                <span className="flex-1 text-xs text-foreground/80 font-medium">{item.text}</span>
                <button
                  onClick={() => removeAgendaItem(item.id)}
                  className="text-muted-foreground/30 hover:text-destructive transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Input
              value={agendaInput}
              onChange={e => setAgendaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddAgenda(); }}
              placeholder="Type agenda item + Enter..."
              className="mt-2 border-dashed border-muted-foreground/30 bg-muted/20 text-xs"
            />
          </div>
        </Card>
      </div>

      {/* Bottom: Pre-Recording Summary + Start Button */}
      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
        {/* Context pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          <ContextStatusPill
            icon="👥" label="Attendees"
            color={attendees.length > 0 ? '#10B981' : '#94A3B8'}
            value={attendees.length > 0 ? `${presentCount} present` : 'None'}
            pulse={lastUpdate === 'group' || lastUpdate === 'attendance'}
          />
          {apologiesCount > 0 && (
            <ContextStatusPill
              icon="📨" label="Apologies" color="#F59E0B"
              value={apologiesCount.toString()}
              pulse={lastUpdate === 'attendance'}
            />
          )}
          <ContextStatusPill
            icon="📋" label="Agenda"
            color={agendaItems.length > 0 ? '#3B82F6' : '#94A3B8'}
            value={agendaItems.length > 0 ? `${agendaItems.length} items` : 'None'}
            pulse={lastUpdate === 'agenda'}
          />
          {activeGroup && (
            <ContextStatusPill
              icon={activeGroup.icon} label="Group" color={activeGroup.color}
              value={activeGroup.name}
            />
          )}
        </div>

        {/* Start Recording button */}
        <Button
          onClick={onStartRecording}
          className="px-8 py-6 rounded-xl text-[15px] font-extrabold shadow-lg transition-all duration-200 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #EF4444, #DC2626)',
            boxShadow: '0 4px 20px #EF444444',
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white mr-2" />
          Start Recording
        </Button>
      </Card>

      {/* Skip setup */}
      <div className="text-center">
        <button
          onClick={onStartRecording}
          className="text-[11px] text-muted-foreground underline cursor-pointer hover:text-foreground transition-colors"
        >
          or start recording without setup — you can add context during the meeting
        </button>
      </div>
    </div>
  );
};
