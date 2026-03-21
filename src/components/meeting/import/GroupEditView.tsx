import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, X, Search, BookUser, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ATTENDEE_ROLES,
  SPEAKER_COLORS,
  SUGGESTED_ORGANISATIONS,
  GROUP_ICONS,
  GROUP_COLORS,
  generateInitials,
} from '@/types/contactTypes';
import type { Contact, MeetingGroup, AdditionalMember } from '@/types/contactTypes';
import { useContacts } from '@/hooks/useContacts';
import { useNotewellDirectory } from '@/hooks/useNotewellDirectory';
import type { NotewellUser } from '@/hooks/useNotewellDirectory';

interface EditableMember {
  id: number | string;
  name: string;
  initials: string;
  org: string;
  role: string;
  source: 'contact' | 'directory' | 'custom';
  contact_id?: number;
}

interface GroupEditViewProps {
  group: MeetingGroup | null;
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
  group,
  contacts,
  onSave,
  onCancel,
}) => {
  const {
    contacts: liveContacts,
    createContact,
  } = useContacts();
  const {
    practiceGroups,
    loading: directoryLoading,
    loaded: directoryLoaded,
    fetchDirectory,
  } = useNotewellDirectory({ includeAll: true });
  const isNew = !group?.id;

  useEffect(() => {
    if (!directoryLoaded && !directoryLoading) fetchDirectory();
  }, [directoryLoaded, directoryLoading, fetchDirectory]);

  const availableContacts = useMemo(() => {
    const merged = [...contacts, ...liveContacts];
    const byId = new Map<number, Contact>();

    for (const contact of merged) {
      byId.set(contact.id, contact);
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, liveContacts]);

  const directoryUsers = useMemo(() => {
    const users: NotewellUser[] = [];

    for (const practiceGroup of practiceGroups) {
      for (const user of practiceGroup.users) {
        if (!users.some(existing => existing.user_id === user.user_id)) {
          users.push(user);
        }
      }
    }

    return users;
  }, [practiceGroups]);

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [icon, setIcon] = useState(group?.icon || '📋');
  const [color, setColor] = useState(group?.color || '#3B82F6');
  const [memberSearch, setMemberSearch] = useState('');
  const [filterOrg, setFilterOrg] = useState('All');
  const [showAddNew, setShowAddNew] = useState(false);
  const [showDetails, setShowDetails] = useState(isNew);
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('External / Other');
  const [newRole, setNewRole] = useState('Guest');

  const [members, setMembers] = useState<EditableMember[]>(() => {
    const initialMembers: EditableMember[] = [];

    if (group) {
      for (const contactId of group.contact_ids || []) {
        const matchedContact = contacts.find(contact => contact.id === contactId);

        if (matchedContact) {
          initialMembers.push({
            id: matchedContact.id,
            name: matchedContact.name,
            initials: matchedContact.initials,
            org: matchedContact.org,
            role: matchedContact.default_role,
            source: 'contact',
            contact_id: matchedContact.id,
          });
        }
      }

      for (const member of group.additional_members || []) {
        initialMembers.push({
          id: `member-${Date.now()}-${Math.random()}`,
          name: member.name,
          initials: member.initials,
          org: member.org,
          role: member.role,
          source: 'custom',
        });
      }
    }

    return initialMembers;
  });

  useEffect(() => {
    if (!group) return;

    setMembers(currentMembers => {
      const existingIds = new Set(currentMembers.map(member => `${member.contact_id ?? member.id}`));
      const mergedMembers = [...currentMembers];

      for (const contactId of group.contact_ids || []) {
        const matchedContact = availableContacts.find(contact => contact.id === contactId);

        if (matchedContact && !existingIds.has(String(matchedContact.id))) {
          mergedMembers.push({
            id: matchedContact.id,
            name: matchedContact.name,
            initials: matchedContact.initials,
            org: matchedContact.org,
            role: matchedContact.default_role,
            source: 'contact',
            contact_id: matchedContact.id,
          });
        }
      }

      return mergedMembers;
    });
  }, [group, availableContacts]);

  const memberContactIds = useMemo(
    () => new Set(members.map(member => member.contact_id).filter(Boolean)),
    [members]
  );

  const memberNames = useMemo(
    () => new Set(members.map(member => member.name.trim().toLowerCase())),
    [members]
  );

  const filteredContacts = useMemo(() => {
    if (!memberSearch.trim()) return [];

    const query = memberSearch.toLowerCase();

    return availableContacts.filter(contact =>
      !memberContactIds.has(contact.id) &&
      (
        contact.name.toLowerCase().includes(query) ||
        contact.org.toLowerCase().includes(query) ||
        contact.default_role.toLowerCase().includes(query) ||
        (contact.email && contact.email.toLowerCase().includes(query))
      )
    );
  }, [availableContacts, memberSearch, memberContactIds]);

  const filteredDirectory = useMemo(() => {
    if (!memberSearch.trim()) return [];

    const query = memberSearch.toLowerCase();

    return directoryUsers.filter(user =>
      !memberNames.has(user.full_name.trim().toLowerCase()) &&
      (
        user.full_name.toLowerCase().includes(query) ||
        user.practice_name.toLowerCase().includes(query) ||
        user.organisation_type.toLowerCase().includes(query) ||
        (user.practice_role && user.practice_role.toLowerCase().includes(query)) ||
        (user.role && user.role.toLowerCase().includes(query)) ||
        (user.title && user.title.toLowerCase().includes(query)) ||
        (user.email && user.email.toLowerCase().includes(query))
      )
    );
  }, [directoryUsers, memberSearch, memberNames]);

  const addContactMember = (contact: Contact) => {
    setMembers(previous => [
      ...previous,
      {
        id: contact.id,
        name: contact.name,
        initials: contact.initials,
        org: contact.org,
        role: contact.default_role,
        source: 'contact',
        contact_id: contact.id,
      },
    ]);
    setMemberSearch('');
  };

  const addDirectoryMember = (user: NotewellUser) => {
    setMembers(previous => [
      ...previous,
      {
        id: `directory-${user.user_id}`,
        name: user.full_name,
        initials: generateInitials(user.full_name),
        org: user.practice_name,
        role: user.practice_role || user.title || 'Guest',
        source: 'directory',
      },
    ]);
    setMemberSearch('');
  };

  const addNewMember = async (alsoSaveToContacts: boolean) => {
    if (!newName.trim()) return;

    const initials = generateInitials(newName);

    if (alsoSaveToContacts) {
      const savedContact = await createContact({
        name: newName.trim(),
        initials,
        org: newOrg,
        default_role: newRole,
        email: null,
      });

      if (savedContact) {
        setMembers(previous => [
          ...previous,
          {
            id: savedContact.id,
            name: savedContact.name,
            initials: savedContact.initials,
            org: savedContact.org,
            role: savedContact.default_role,
            source: 'contact',
            contact_id: savedContact.id,
          },
        ]);
      }
    } else {
      setMembers(previous => [
        ...previous,
        {
          id: `custom-${Date.now()}`,
          name: newName.trim(),
          initials,
          org: newOrg,
          role: newRole,
          source: 'custom',
        },
      ]);
    }

    setNewName('');
    setNewOrg('External / Other');
    setNewRole('Guest');
    setShowAddNew(false);
  };

  const removeMember = (id: number | string) => {
    setMembers(previous => previous.filter(member => member.id !== id));
  };

  const updateMemberRole = (id: number | string, role: string) => {
    setMembers(previous =>
      previous.map(member => (member.id === id ? { ...member, role } : member))
    );
  };

  const updateMemberField = (
    id: number | string,
    field: 'name' | 'org',
    value: string
  ) => {
    setMembers(previous =>
      previous.map(member => {
        if (member.id !== id || member.source === 'contact') return member;

        if (field === 'name') {
          return {
            ...member,
            name: value,
            initials: generateInitials(value),
          };
        }

        return {
          ...member,
          org: value,
        };
      })
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const contact_ids = members
      .filter(member => member.contact_id)
      .map(member => member.contact_id!);

    const additional_members: AdditionalMember[] = members
      .filter(member => !member.contact_id)
      .map(member => ({
        name: member.name.trim(),
        initials: generateInitials(member.name),
        org: member.org.trim(),
        role: member.role,
      }))
      .filter(member => member.name && member.org);

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
    <div className="flex flex-col gap-3 h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
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

      <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
        <button
          onClick={() => setShowDetails(prev => !prev)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border bg-muted/30 hover:bg-muted/60 transition-colors shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0">{icon}</span>
            <span className="text-sm font-bold truncate">{name || 'Untitled Group'}</span>
            {description && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline truncate">
                — {description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
            <span className="text-[10px] font-semibold">{showDetails ? 'Hide' : 'Edit'}</span>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showDetails && (
          <div className="flex flex-col gap-3 p-3 rounded-xl border bg-card shrink-0">
            <div
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{
                background: `${color}08`,
                border: `1.5px solid ${color}33`,
              }}
            >
              <div
                className="w-[44px] h-[44px] rounded-lg flex items-center justify-center text-[22px] shrink-0"
                style={{
                  background: `${color}20`,
                  border: `2px solid ${color}`,
                }}
              >
                {icon}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Icon</div>
                  <div className="flex gap-1 flex-wrap">
                    {GROUP_ICONS.map(groupIcon => (
                      <button
                        key={groupIcon}
                        onClick={() => setIcon(groupIcon)}
                        className={`w-6 h-6 rounded text-sm flex items-center justify-center transition-all ${
                          icon === groupIcon ? 'ring-2' : 'border hover:bg-accent'
                        }`}
                        style={
                          icon === groupIcon
                            ? { borderColor: color, background: `${color}15`, outline: `2px solid ${color}` }
                            : {}
                        }
                      >
                        {groupIcon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Colour</div>
                  <div className="flex gap-1 flex-wrap">
                    {GROUP_COLORS.map(groupColor => (
                      <button
                        key={groupColor}
                        onClick={() => setColor(groupColor)}
                        className="w-5 h-5 rounded-full transition-all"
                        style={{
                          background: groupColor,
                          border: color === groupColor ? '3px solid currentColor' : '2px solid transparent',
                          boxShadow: color === groupColor ? `0 0 0 2px var(--background), 0 0 0 4px ${groupColor}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Group Name *</div>
              <Input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. NRES Programme Board" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Description</div>
              <Input value={description} onChange={event => setDescription(event.target.value)} placeholder="e.g. PML + 7 practices" />
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex justify-between items-center mb-2 shrink-0">
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

          {showAddNew && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-2 space-y-2 shrink-0">
              <div className="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                Add default member
              </div>
              <Input
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="Full name"
              />
              <div className="flex gap-1.5">
                <Select value={newOrg} onValueChange={setNewOrg}>
                  <SelectTrigger className="flex-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUGGESTED_ORGANISATIONS.map(organisation => (
                      <SelectItem key={organisation} value={organisation}>
                        {organisation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-[130px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDEE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
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

          <div className="relative mb-1.5 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={memberSearch}
              onChange={event => setMemberSearch(event.target.value)}
              placeholder="Search contacts & Notewell directory..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mb-2 px-1 shrink-0">
            {directoryLoading
              ? 'Loading directory…'
              : 'Search by person, practice, role, or org type such as Management, ICB or PCN.'}
          </p>

          {memberSearch.length > 0 && (
            <div className="bg-card border rounded-xl max-h-[220px] overflow-auto shadow-lg mb-2 shrink-0">
              {filteredContacts.length === 0 && filteredDirectory.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No results found.{' '}
                  <button
                    className="text-amber-600 font-semibold hover:underline"
                    onClick={() => {
                      setShowAddNew(true);
                      setNewName(memberSearch);
                      setMemberSearch('');
                    }}
                  >
                    Add as default member?
                  </button>
                </div>
              ) : (
                <>
                  {filteredContacts.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                        <BookUser className="w-3 h-3" /> My Contacts
                      </div>
                      {filteredContacts.map(contact => {
                        const colour = SPEAKER_COLORS[contact.id % SPEAKER_COLORS.length];

                        return (
                          <div
                            key={contact.id}
                            onClick={() => addContactMember(contact)}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors border-b border-border/30 last:border-0"
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ background: `${colour}22`, border: `2px solid ${colour}`, color: colour }}
                            >
                              {contact.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold">{contact.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {contact.org} · {contact.default_role}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {filteredDirectory.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> Notewell Directory
                      </div>
                      {filteredDirectory.map(user => {
                        const initials = generateInitials(user.full_name);

                        return (
                          <div
                            key={`directory-${user.user_id}`}
                            onClick={() => addDirectoryMember(user)}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors border-b border-border/30 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold">{user.full_name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {user.practice_name} · {user.practice_role || user.title || user.organisation_type}
                              </div>
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

          <div className="flex-1 min-h-0 overflow-y-auto ios-scroll pr-2">
            <div className="flex flex-col gap-1.5 pb-2">
              {members.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No members yet — search above or create default members directly.
                </div>
              )}

              {members.map((member, index) => {
                const colour = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
                const isEditableDefault = member.source !== 'contact';

                return (
                  <div
                    key={`${member.id}-${index}`}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1"
                      style={{ background: `${colour}22`, border: `2px solid ${colour}`, color: colour }}
                    >
                      {member.initials}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {isEditableDefault ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              Default member
                            </span>
                            {member.source === 'directory' && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                From directory
                              </span>
                            )}
                          </div>
                          <Input
                            value={member.name}
                            onChange={event => updateMemberField(member.id, 'name', event.target.value)}
                            placeholder="Member name"
                            className="h-8 text-xs"
                          />
                          <Input
                            value={member.org}
                            onChange={event => updateMemberField(member.id, 'org', event.target.value)}
                            placeholder="Organisation"
                            className="h-8 text-xs"
                          />
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-bold truncate">{member.name}</div>
                          <div className="text-[10px] text-muted-foreground">{member.org}</div>
                        </>
                      )}
                    </div>

                    <Select value={member.role} onValueChange={value => updateMemberRole(member.id, value)}>
                      <SelectTrigger className="h-8 w-[128px] text-[10px] font-semibold shrink-0 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDEE_ROLES.map(role => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <button
                      onClick={() => removeMember(member.id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 mt-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};