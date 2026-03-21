import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Plus, X, Users, BookUser, Building2 } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useMeetingGroups } from '@/hooks/useMeetingGroups';
import { useNotewellDirectory } from '@/hooks/useNotewellDirectory';
import { supabase } from '@/integrations/supabase/client';
import {
  ATTENDEE_ROLES, ROLE_COLORS, SPEAKER_COLORS,
  SUGGESTED_ORGANISATIONS, generateInitials,
} from '@/types/contactTypes';
import type { MeetingAttendee, Contact, MeetingGroup } from '@/types/contactTypes';
import type { NotewellUser } from '@/hooks/useNotewellDirectory';
import type { ImportedContent } from './LiveImportModal';
import { GroupManageView } from './GroupManageView';
import { GroupEditView } from './GroupEditView';

interface MeetingAttendeesTabProps {
  meetingId?: string | null;
  onImport?: (content: ImportedContent) => Promise<void>;
  isImporting?: boolean;
}

export const MeetingAttendeesTab: React.FC<MeetingAttendeesTabProps> = ({
  meetingId,
  onImport,
  isImporting,
}) => {
  const { contacts } = useContacts();
  const { groups, createGroup, updateGroup, deleteGroup } = useMeetingGroups();
  const { practiceGroups, loading: directoryLoading, loaded: directoryLoaded, fetchDirectory } = useNotewellDirectory({ includeAll: true });

  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [search, setSearch] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('External / Other');
  const [newRole, setNewRole] = useState('Guest');
  const [saveToContacts, setSaveToContacts] = useState(true);
  const [filterOrg, setFilterOrg] = useState('All');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showGroups, setShowGroups] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Group management views: 'pick' | 'manage' | 'edit'
  const [groupView, setGroupView] = useState<'pick' | 'manage' | 'edit'>('pick');
  const [editingGroup, setEditingGroup] = useState<MeetingGroup | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Notewell directory on mount
  useEffect(() => {
    if (!directoryLoaded && !directoryLoading) fetchDirectory();
  }, [directoryLoaded, directoryLoading, fetchDirectory]);

  // Load existing attendees from meeting
  useEffect(() => {
    if (!meetingId || loaded) return;
    const load = async () => {
      const { data } = await supabase
        .from('meetings')
        .select('meeting_attendees_json')
        .eq('id', meetingId)
        .single();
      if (data?.meeting_attendees_json) {
        setAttendees(data.meeting_attendees_json as any as MeetingAttendee[]);
        if ((data.meeting_attendees_json as any[]).length > 4) setShowGroups(false);
      }
      setLoaded(true);
    };
    load();
  }, [meetingId, loaded]);

  // Debounced save to meeting
  const saveAttendees = useCallback((updated: MeetingAttendee[]) => {
    if (!meetingId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await supabase
        .from('meetings')
        .update({ meeting_attendees_json: updated as any })
        .eq('id', meetingId);
    }, 2000);
  }, [meetingId]);

  const updateAttendees = useCallback((updater: (prev: MeetingAttendee[]) => MeetingAttendee[]) => {
    setAttendees(prev => {
      const next = updater(prev);
      saveAttendees(next);
      return next;
    });
  }, [saveAttendees]);

  // Search contacts + Notewell directory
  const addedIds = useMemo(() => new Set(attendees.map(a => a.contact_id).filter(Boolean)), [attendees]);
  const addedNames = useMemo(() => new Set(attendees.map(a => a.name.toLowerCase())), [attendees]);

  const directoryUsers = useMemo(() => {
    const users: NotewellUser[] = [];
    for (const group of practiceGroups) {
      for (const u of group.users) {
        if (!users.some(x => x.user_id === u.user_id)) users.push(u);
      }
    }
    return users;
  }, [practiceGroups]);

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return { contacts: [] as Contact[], directory: [] as NotewellUser[] };
    const q = search.toLowerCase();
    const contactMatches = contacts.filter(c =>
      !addedIds.has(c.id) &&
      (c.name.toLowerCase().includes(q) || c.org.toLowerCase().includes(q))
    );
    const directoryMatches = directoryUsers.filter(u =>
      !addedNames.has(u.full_name.toLowerCase()) &&
      (u.full_name.toLowerCase().includes(q) ||
       u.practice_name.toLowerCase().includes(q) ||
       (u.email && u.email.toLowerCase().includes(q)))
    );
    return { contacts: contactMatches, directory: directoryMatches };
  }, [contacts, directoryUsers, search, addedIds, addedNames]);

  const hasSearchResults = searchResults.contacts.length > 0 || searchResults.directory.length > 0;

  const addContactAsAttendee = (contact: Contact) => {
    updateAttendees(prev => [
      ...prev,
      {
        id: Date.now(),
        name: contact.name,
        initials: contact.initials,
        role: contact.default_role,
        org: contact.org,
        status: 'present' as const,
        contact_id: contact.id,
      },
    ]);
    setSearch('');
  };

  const addDirectoryUserAsAttendee = (user: NotewellUser) => {
    updateAttendees(prev => [
      ...prev,
      {
        id: Date.now(),
        name: user.full_name,
        initials: generateInitials(user.full_name),
        role: user.practice_role || user.title || 'Guest',
        org: user.practice_name,
        status: 'present' as const,
      },
    ]);
    setSearch('');
  };

  const loadGroup = async (group: MeetingGroup) => {
    const existingContactIds = new Set(attendees.map(a => a.contact_id).filter(Boolean));
    const existingNames = new Set(attendees.map(a => a.name.toLowerCase()));
    const newMembers: MeetingAttendee[] = [];

    for (const contactId of group.contact_ids || []) {
      if (existingContactIds.has(contactId)) continue;
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        newMembers.push({
          id: Date.now() + Math.random(),
          name: contact.name,
          initials: contact.initials,
          role: contact.default_role,
          org: contact.org,
          status: 'present',
          contact_id: contact.id,
        });
        existingContactIds.add(contactId);
      }
    }

    for (const member of group.additional_members || []) {
      if (existingNames.has(member.name.toLowerCase())) continue;
      newMembers.push({
        id: Date.now() + Math.random(),
        name: member.name,
        initials: member.initials,
        role: member.role,
        org: member.org,
        status: 'present',
      });
      existingNames.add(member.name.toLowerCase());
    }

    if (newMembers.length > 0) {
      updateAttendees(prev => [...prev, ...newMembers]);
    }
    setActiveGroupId(group.id);
    setShowGroups(false);
    setGroupView('pick');
  };

  const addNewAttendee = async () => {
    if (!newName.trim()) return;
    const initials = generateInitials(newName);
    const newAttendee: MeetingAttendee = {
      id: Date.now(),
      name: newName.trim(),
      initials,
      role: newRole,
      org: newOrg,
      status: 'present',
    };

    if (saveToContacts) {
      const { data } = await supabase
        .from('contacts' as any)
        .insert({
          name: newName.trim(),
          initials,
          org: newOrg,
          default_role: newRole,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        } as any)
        .select('id')
        .single();
      if (data) {
        newAttendee.contact_id = (data as any).id;
      }
    }

    updateAttendees(prev => [...prev, newAttendee]);
    setNewName('');
    setNewOrg('External / Other');
    setNewRole('Guest');
    setShowAddNew(false);
  };

  const removeAttendee = (id: number | string) => {
    updateAttendees(prev => prev.filter(a => a.id !== id));
  };

  const updateStatus = (id: number | string, status: MeetingAttendee['status']) => {
    updateAttendees(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  // Organisation filter
  const activeOrgs = useMemo(() => [...new Set(attendees.map(a => a.org).filter(Boolean))], [attendees]);
  const filteredAttendees = filterOrg === 'All'
    ? attendees
    : attendees.filter(a => a.org === filterOrg);

  // Summary counts
  const presentCount = attendees.filter(a => a.status === 'present').length;
  const apologiesCount = attendees.filter(a => a.status === 'apologies').length;
  const absentCount = attendees.filter(a => a.status === 'absent').length;

  // ── Group Edit View ──
  if (groupView === 'edit') {
    return (
      <GroupEditView
        group={editingGroup}
        contacts={contacts}
        onSave={async (data) => {
          if (editingGroup?.id) {
            await updateGroup(editingGroup.id, data);
          } else {
            await createGroup(data);
          }
          setGroupView('manage');
          setEditingGroup(null);
        }}
        onCancel={() => { setGroupView('manage'); setEditingGroup(null); }}
      />
    );
  }

  // ── Group Manage View ──
  if (groupView === 'manage') {
    return (
      <GroupManageView
        groups={groups}
        contacts={contacts}
        activeGroupId={activeGroupId}
        onBack={() => setGroupView('pick')}
        onNewGroup={() => { setEditingGroup(null); setGroupView('edit'); }}
        onEditGroup={(g) => { setEditingGroup(g); setGroupView('edit'); }}
        onDeleteGroup={async (id) => {
          await deleteGroup(id);
          if (activeGroupId === id) setActiveGroupId(null);
        }}
        onLoadGroup={loadGroup}
      />
    );
  }

  // ── Main Pick View ──
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Meeting Groups — Quick Load */}
      {showGroups && attendees.length <= 4 && groups.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Quick Load — Meeting Groups
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setGroupView('manage')}
                className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
              >
                Manage Groups
              </button>
              <button
                onClick={() => setShowGroups(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Hide
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {groups.map(group => {
              const totalMembers = (group.contact_ids?.length || 0) + (group.additional_members?.length || 0);
              const isLoaded = activeGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => !isLoaded && loadGroup(group)}
                  disabled={isLoaded}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    isLoaded
                      ? 'opacity-60 cursor-default'
                      : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                  }`}
                  style={{
                    borderColor: isLoaded ? group.color : undefined,
                    background: isLoaded ? `${group.color}08` : undefined,
                  }}
                >
                  <span className="text-lg shrink-0 mt-0.5">{group.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold truncate">{group.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {group.description}
                    </div>
                    <div
                      className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${group.color}15`, color: group.color }}
                    >
                      {isLoaded ? '✓ Loaded' : `${totalMembers} members`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsed group indicator */}
      {!showGroups && activeGroupId && (() => {
        const activeGroup = groups.find(g => g.id === activeGroupId);
        return activeGroup ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: `${activeGroup.color}08`,
              border: `1px solid ${activeGroup.color}33`,
            }}
          >
            <span className="text-base">{activeGroup.icon}</span>
            <span className="text-xs font-bold flex-1" style={{ color: activeGroup.color }}>
              {activeGroup.name}
            </span>
            <button
              onClick={() => setGroupView('manage')}
              className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold hover:underline"
            >
              Manage
            </button>
            <button
              onClick={() => setShowGroups(true)}
              className="text-[11px] text-muted-foreground underline"
            >
              Change
            </button>
          </div>
        ) : null;
      })()}

      {/* Show groups button when collapsed */}
      {!showGroups && !activeGroupId && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowGroups(true)}
            className="flex-1 p-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors text-left"
          >
            📋 Load a meeting group preset...
          </button>
          {groups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupView('manage')}
              className="shrink-0 text-xs font-bold border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700"
            >
              Manage Groups
            </Button>
          )}
        </div>
      )}

      {/* Search & Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts & Notewell directory..."
            className="pl-9"
          />
        </div>
        <Button
          variant={showAddNew ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAddNew(!showAddNew)}
          className="shrink-0"
        >
          {showAddNew ? 'Cancel' : '+ New'}
        </Button>
      </div>

      {/* Search results dropdown */}
      {search.length >= 2 && (
        <div className="bg-card border rounded-xl max-h-[240px] overflow-auto shadow-lg">
          {!hasSearchResults ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found.{' '}
              <button
                className="text-primary font-semibold hover:underline"
                onClick={() => {
                  setShowAddNew(true);
                  setNewName(search);
                  setSearch('');
                }}
              >
                Add as new?
              </button>
            </div>
          ) : (
            <>
              {searchResults.contacts.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                    <BookUser className="w-3 h-3" /> My Contacts
                  </div>
                  {searchResults.contacts.map((c) => {
                    const color = SPEAKER_COLORS[c.id % SPEAKER_COLORS.length];
                    return (
                      <div
                        key={`contact-${c.id}`}
                        onClick={() => addContactAsAttendee(c)}
                        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors border-b border-border/30 last:border-0"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                          style={{ background: `${color}22`, border: `2px solid ${color}`, color }}
                        >
                          {c.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.org}</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {searchResults.directory.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Notewell Directory
                  </div>
                  {searchResults.directory.map((u) => {
                    const initials = generateInitials(u.full_name);
                    return (
                      <div
                        key={`dir-${u.user_id}`}
                        onClick={() => addDirectoryUserAsAttendee(u)}
                        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors border-b border-border/30 last:border-0"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700"
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold">{u.full_name}</div>
                          <div className="text-[11px] text-muted-foreground">{u.practice_name}</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Add new form */}
      {showAddNew && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
            Add New Attendee
          </div>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Full name"
            onKeyDown={e => e.key === 'Enter' && addNewAttendee()}
          />
          <div className="flex gap-2">
            <Select value={newOrg} onValueChange={setNewOrg}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUGGESTED_ORGANISATIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTENDEE_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={saveToContacts} onCheckedChange={(c) => setSaveToContacts(!!c)} />
            <span className="text-xs text-muted-foreground">Also save to contacts directory</span>
          </label>
          <Button
            onClick={addNewAttendee}
            disabled={!newName.trim()}
            className="w-full"
          >
            Add to Meeting
          </Button>
        </div>
      )}

      {/* Organisation filter pills */}
      {attendees.length > 0 && activeOrgs.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...activeOrgs].map(org => (
            <button
              key={org}
              onClick={() => setFilterOrg(org)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                filterOrg === org
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700'
                  : 'bg-card border text-muted-foreground hover:text-foreground'
              }`}
            >
              {org === 'All' ? `All (${attendees.length})` : org}
            </button>
          ))}
        </div>
      )}

      {/* Attendee list */}
      <ScrollArea className="flex-1 max-h-[300px]">
        <div className="space-y-1.5">
          {filteredAttendees.length === 0 && attendees.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-50" />
              <div className="text-sm font-semibold">No attendees added</div>
              <div className="text-xs mt-1">Search above or add a new attendee to get started</div>
            </div>
          )}
          {filteredAttendees.map((a, idx) => {
            const color = SPEAKER_COLORS[typeof a.id === 'number' ? a.id % SPEAKER_COLORS.length : idx % SPEAKER_COLORS.length];
            const roleColor = ROLE_COLORS[a.role] || ROLE_COLORS.Guest;
            return (
              <div
                key={a.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-card border transition-all hover:shadow-sm"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `${color}22`, border: `2px solid ${color}`, color }}
                >
                  {a.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold truncate">{a.name}</span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}33` }}
                    >
                      {a.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{a.org}</div>
                </div>
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted shrink-0">
                  {([
                    { val: 'present' as const, label: 'Present', activeClass: 'bg-emerald-500 text-white' },
                    { val: 'apologies' as const, label: 'Apologies', activeClass: 'bg-amber-500 text-white' },
                    { val: 'absent' as const, label: 'Absent', activeClass: 'bg-red-500 text-white' },
                  ]).map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => updateStatus(a.id, opt.val)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        a.status === opt.val ? opt.activeClass : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => removeAttendee(a.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Summary bar */}
      {attendees.length > 0 && (
        <div className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-muted border">
          <div className="flex gap-4 text-xs font-bold">
            <span className="text-emerald-600 dark:text-emerald-400">● {presentCount} Present</span>
            <span className="text-amber-600 dark:text-amber-400">● {apologiesCount} Apologies</span>
            <span className="text-red-600 dark:text-red-400">● {absentCount} Absent</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Auto-populates session report</span>
        </div>
      )}
    </div>
  );
};
