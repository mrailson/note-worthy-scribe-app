import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, X, Search } from 'lucide-react';
import {
  ATTENDEE_ROLES, ROLE_COLORS, SPEAKER_COLORS,
  SUGGESTED_ORGANISATIONS, GROUP_ICONS, GROUP_COLORS,
  generateInitials,
} from '@/types/contactTypes';
import type { Contact, MeetingGroup, AdditionalMember } from '@/types/contactTypes';
import { useContacts } from '@/hooks/useContacts';

interface EditableMember {
  id: number | string;
  name: string;
  initials: string;
  org: string;
  role: string;
  fromContacts: boolean;
  contact_id?: number;
}

interface GroupEditViewProps {
  group: MeetingGroup | null; // null = new group
  contacts: Contact[];
  onSave: (data: {
    name: string;
    description: string;
    icon: string;
    color: string;
    contact_ids: number[];
    additional_members: AdditionalMember[];
  }) => void;
  onCancel: () => void;
}

export const GroupEditView: React.FC<GroupEditViewProps> = ({
  group, contacts, onSave, onCancel,
}) => {
  const { createContact } = useContacts();
  const isNew = !group?.id;

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [icon, setIcon] = useState(group?.icon || '📋');
  const [color, setColor] = useState(group?.color || '#3B82F6');
  const [memberSearch, setMemberSearch] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('External / Other');
  const [newRole, setNewRole] = useState('Guest');

  // Build initial members from group data
  const [members, setMembers] = useState<EditableMember[]>(() => {
    const result: EditableMember[] = [];
    if (group) {
      for (const cid of (group.contact_ids || [])) {
        const c = contacts.find(x => x.id === cid);
        if (c) {
          result.push({
            id: c.id,
            name: c.name,
            initials: c.initials,
            org: c.org,
            role: c.default_role,
            fromContacts: true,
            contact_id: c.id,
          });
        }
      }
      for (const m of (group.additional_members || [])) {
        result.push({
          id: `add-${Date.now()}-${Math.random()}`,
          name: m.name,
          initials: m.initials,
          org: m.org,
          role: m.role,
          fromContacts: false,
        });
      }
    }
    return result;
  });

  const memberContactIds = useMemo(() => new Set(members.filter(m => m.contact_id).map(m => m.contact_id)), [members]);
  const memberNames = useMemo(() => new Set(members.map(m => m.name.toLowerCase())), [members]);

  const filteredContacts = useMemo(() => {
    if (!memberSearch || memberSearch.length < 1) return [];
    const q = memberSearch.toLowerCase();
    return contacts.filter(c =>
      !memberContactIds.has(c.id) &&
      (c.name.toLowerCase().includes(q) || c.org.toLowerCase().includes(q))
    );
  }, [contacts, memberSearch, memberContactIds]);

  const addContactMember = (c: Contact) => {
    setMembers(prev => [...prev, {
      id: c.id,
      name: c.name,
      initials: c.initials,
      org: c.org,
      role: c.default_role,
      fromContacts: true,
      contact_id: c.id,
    }]);
    setMemberSearch('');
  };

  const addNewMember = async (alsoSaveToContacts: boolean) => {
    if (!newName.trim()) return;
    const initials = generateInitials(newName);

    if (alsoSaveToContacts) {
      const saved = await createContact({
        name: newName.trim(),
        initials,
        org: newOrg,
        default_role: newRole,
        email: null,
      });
      if (saved) {
        setMembers(prev => [...prev, {
          id: saved.id,
          name: saved.name,
          initials: saved.initials,
          org: saved.org,
          role: saved.default_role,
          fromContacts: true,
          contact_id: saved.id,
        }]);
      }
    } else {
      setMembers(prev => [...prev, {
        id: `new-${Date.now()}`,
        name: newName.trim(),
        initials,
        org: newOrg,
        role: newRole,
        fromContacts: false,
      }]);
    }

    setNewName('');
    setNewOrg('External / Other');
    setNewRole('Guest');
    setShowAddNew(false);
  };

  const removeMember = (id: number | string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateMemberRole = (id: number | string, role: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const contact_ids = members.filter(m => m.contact_id).map(m => m.contact_id!);
    const additional_members: AdditionalMember[] = members
      .filter(m => !m.contact_id)
      .map(m => ({ name: m.name, initials: m.initials, org: m.org, role: m.role }));

    onSave({
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      contact_ids,
      additional_members,
    });
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[15px] font-extrabold">
            {isNew ? 'New Meeting Group' : 'Edit Group'}
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!name.trim()}
          className="font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white"
        >
          💾 Save Group
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 pr-2">
          {/* Icon + Colour Preview */}
          <div
            className="flex items-center gap-3 p-3.5 rounded-xl"
            style={{
              background: `${color}08`,
              border: `1.5px solid ${color}33`,
            }}
          >
            <div
              className="w-[52px] h-[52px] rounded-xl flex items-center justify-center text-[26px] shrink-0"
              style={{
                background: `${color}20`,
                border: `2.5px solid ${color}`,
              }}
            >
              {icon}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Icon</div>
                <div className="flex gap-1 flex-wrap">
                  {GROUP_ICONS.map(ic => (
                    <button
                      key={ic}
                      onClick={() => setIcon(ic)}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                        icon === ic ? 'ring-2' : 'border hover:bg-accent'
                      }`}
                      style={icon === ic ? { borderColor: color, background: `${color}15`, outline: `2px solid ${color}` } : {}}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Colour</div>
                <div className="flex gap-1">
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-5 h-5 rounded-full transition-all"
                      style={{
                        background: c,
                        border: color === c ? '3px solid currentColor' : '2px solid transparent',
                        boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Name + Description */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Group Name *</div>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. NRES Programme Board"
            />
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. PML + 7 practices"
            />
          </div>

          {/* Members Section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Members ({members.length})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddNew(!showAddNew)}
                className="h-7 text-[11px] font-bold border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700"
              >
                {showAddNew ? 'Cancel' : '+ New Person'}
              </Button>
            </div>

            {/* Add new person (not in contacts) */}
            {showAddNew && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-2 space-y-2">
                <div className="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Add someone not in your contacts
                </div>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Full name"
                />
                <div className="flex gap-1.5">
                  <Select value={newOrg} onValueChange={setNewOrg}>
                    <SelectTrigger className="flex-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUGGESTED_ORGANISATIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDEE_ROLES.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => addNewMember(false)}
                    disabled={!newName.trim()}
                    className="flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Add to Group
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addNewMember(true)}
                    disabled={!newName.trim()}
                    className="flex-1 text-xs font-bold border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-200"
                  >
                    Add + Save to Contacts
                  </Button>
                </div>
              </div>
            )}

            {/* Search contacts to add */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search contacts to add..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            {memberSearch.length > 0 && (
              <div className="bg-card border rounded-xl max-h-[150px] overflow-auto shadow-lg mb-2">
                {filteredContacts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No contacts found.{' '}
                    <button
                      className="text-amber-600 font-semibold hover:underline"
                      onClick={() => {
                        setShowAddNew(true);
                        setNewName(memberSearch);
                        setMemberSearch('');
                      }}
                    >
                      Add as new?
                    </button>
                  </div>
                ) : filteredContacts.map(c => {
                  const clr = SPEAKER_COLORS[c.id % SPEAKER_COLORS.length];
                  return (
                    <div
                      key={c.id}
                      onClick={() => addContactMember(c)}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors border-b border-border/30 last:border-0"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ background: `${clr}22`, border: `2px solid ${clr}`, color: clr }}
                      >
                        {c.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.org}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current members list */}
            <div className="flex flex-col gap-1">
              {members.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No members yet — search contacts above or add a new person
                </div>
              )}
              {members.map((m, idx) => {
                const clr = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
                return (
                  <div
                    key={`${m.id}-${idx}`}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: `${clr}22`, border: `2px solid ${clr}`, color: clr }}
                    >
                      {m.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">{m.name}</span>
                        {!m.fromContacts && (
                          <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{m.org}</div>
                    </div>
                    <Select value={m.role} onValueChange={(v) => updateMemberRole(m.id, v)}>
                      <SelectTrigger className="h-7 w-[120px] text-[10px] font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDEE_ROLES.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
