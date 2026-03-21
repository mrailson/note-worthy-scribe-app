import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { SPEAKER_COLORS } from '@/types/contactTypes';
import type { MeetingGroup, Contact } from '@/types/contactTypes';

interface GroupManageViewProps {
  groups: MeetingGroup[];
  contacts: Contact[];
  activeGroupId: string | null;
  onBack: () => void;
  onNewGroup: () => void;
  onEditGroup: (group: MeetingGroup) => void;
  onDeleteGroup: (id: string) => void;
  onLoadGroup: (group: MeetingGroup) => void;
}

export const GroupManageView: React.FC<GroupManageViewProps> = ({
  groups, contacts, activeGroupId, onBack, onNewGroup, onEditGroup, onDeleteGroup, onLoadGroup,
}) => {
  const getMemberCount = (g: MeetingGroup) =>
    (g.contact_ids?.length || 0) + (g.additional_members?.length || 0);

  const getAvatarMembers = (g: MeetingGroup) => {
    const members: { initials: string; name: string }[] = [];
    for (const cid of (g.contact_ids || [])) {
      const c = contacts.find(x => x.id === cid);
      if (c) members.push({ initials: c.initials, name: c.name });
    }
    for (const m of (g.additional_members || [])) {
      members.push({ initials: m.initials, name: m.name });
    }
    return members;
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-extrabold">Meeting Groups</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewGroup}
          className="border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/50 font-bold text-xs"
        >
          + New Group
        </Button>
      </div>

      {/* Groups list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2">
          {groups.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm font-semibold">No groups yet</div>
              <div className="text-xs mt-1">Create a group to quickly load attendees into meetings</div>
            </div>
          )}
          {groups.map(g => {
            const memberCount = getMemberCount(g);
            const avatarMembers = getAvatarMembers(g);
            const isLoaded = activeGroupId === g.id;
            return (
              <div
                key={g.id}
                className="p-4 rounded-xl border"
                style={{
                  borderColor: `${g.color}33`,
                  background: `${g.color}04`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{
                      background: `${g.color}20`,
                      border: `2px solid ${g.color}`,
                    }}
                  >
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold">{g.name}</div>
                    {g.description && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{g.description}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Avatar stack */}
                      <div className="flex items-center">
                        {avatarMembers.slice(0, 6).map((m, i) => {
                          const color = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
                          return (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-background"
                              style={{
                                background: `${color}22`,
                                color,
                                marginLeft: i === 0 ? 0 : -6,
                                zIndex: 6 - i,
                              }}
                            >
                              {m.initials}
                            </div>
                          );
                        })}
                        {avatarMembers.length > 6 && (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold bg-muted border-2 border-background text-muted-foreground"
                            style={{ marginLeft: -6 }}
                          >
                            +{avatarMembers.length - 6}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{memberCount} members</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3">
                  <Button
                    size="sm"
                    onClick={() => onLoadGroup(g)}
                    disabled={isLoaded}
                    className="flex-1 text-xs font-bold"
                    style={{
                      background: isLoaded ? undefined : g.color,
                      color: isLoaded ? undefined : '#fff',
                    }}
                  >
                    {isLoaded ? '✓ Loaded' : 'Load into Meeting'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditGroup(g)}
                    className="text-xs font-semibold"
                  >
                    ✏️ Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Delete "${g.name}"?`)) onDeleteGroup(g.id);
                    }}
                    className="text-xs text-destructive hover:bg-destructive/10 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
