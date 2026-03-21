import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FolderOpen, Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import { useMeetingGroups } from '@/hooks/useMeetingGroups';
import { useContacts } from '@/hooks/useContacts';
import {
  GROUP_ICONS, GROUP_COLORS, SPEAKER_COLORS, ROLE_COLORS,
  ATTENDEE_ROLES, SUGGESTED_ORGANISATIONS, generateInitials,
} from '@/types/contactTypes';
import type { MeetingGroup, AdditionalMember, Contact } from '@/types/contactTypes';

export const MeetingGroupsManager: React.FC = () => {
  const { groups, loading, createGroup, updateGroup, deleteGroup } = useMeetingGroups();
  const { contacts } = useContacts();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MeetingGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeetingGroup | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState(GROUP_COLORS[0]);
  const [formIcon, setFormIcon] = useState(GROUP_ICONS[0]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [additionalMembers, setAdditionalMembers] = useState<AdditionalMember[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  // Additional member form
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberOrg, setAddMemberOrg] = useState('External / Other');
  const [addMemberRole, setAddMemberRole] = useState('Guest');

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormColor(GROUP_COLORS[0]);
    setFormIcon(GROUP_ICONS[0]);
    setSelectedContactIds(new Set());
    setAdditionalMembers([]);
    setContactSearch('');
    setAddMemberName('');
    setEditing(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (group: MeetingGroup) => {
    setEditing(group);
    setFormName(group.name);
    setFormDesc(group.description || '');
    setFormColor(group.color);
    setFormIcon(group.icon);
    setSelectedContactIds(new Set(group.contact_ids));
    setAdditionalMembers(group.additional_members || []);
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      name: formName,
      description: formDesc,
      color: formColor,
      icon: formIcon,
      contact_ids: Array.from(selectedContactIds),
      additional_members: additionalMembers,
    };
    if (editing) {
      await updateGroup(editing.id, payload);
    } else {
      await createGroup(payload);
    }
    setShowForm(false);
    resetForm();
  };

  const toggleContact = (id: number) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addAdditionalMember = () => {
    if (!addMemberName.trim()) return;
    setAdditionalMembers(prev => [...prev, {
      name: addMemberName.trim(),
      initials: generateInitials(addMemberName),
      org: addMemberOrg,
      role: addMemberRole,
    }]);
    setAddMemberName('');
    setAddMemberOrg('External / Other');
    setAddMemberRole('Guest');
  };

  const removeAdditionalMember = (idx: number) => {
    setAdditionalMembers(prev => prev.filter((_, i) => i !== idx));
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.org.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const getMemberCount = (group: MeetingGroup) =>
    (group.contact_ids?.length || 0) + (group.additional_members?.length || 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Meeting Groups
        </CardTitle>
        <CardDescription>
          Create preset groups of attendees for quick-loading into meetings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Create Group
        </Button>

        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading groups...</p>}
        {!loading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No meeting groups yet. Create one to quickly load attendees into meetings.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map(group => {
            const memberCount = getMemberCount(group);
            const memberContacts = contacts.filter(c => group.contact_ids?.includes(c.id));
            return (
              <div
                key={group.id}
                className="flex items-start gap-3 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow group"
                style={{ borderLeftColor: group.color, borderLeftWidth: 3 }}
              >
                <span className="text-xl shrink-0 mt-0.5">{group.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{group.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{memberCount}</Badge>
                  </div>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.description}</p>
                  )}
                  {/* Avatar stack */}
                  {memberContacts.length > 0 && (
                    <div className="flex -space-x-2 mt-2">
                      {memberContacts.slice(0, 5).map((c, i) => (
                        <div
                          key={c.id}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-background"
                          style={{
                            background: `${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}22`,
                            color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
                          }}
                          title={c.name}
                        >
                          {c.initials}
                        </div>
                      ))}
                      {memberCount > 5 && (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold border-2 border-background text-muted-foreground">
                          +{memberCount - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(group)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(group)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Meeting Group' : 'Create Meeting Group'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update group settings and members.' : 'Set up a new meeting group for quick-loading.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. NRES Programme Board" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description..." />
            </div>

            {/* Icon picker */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                      formIcon === icon ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted border'
                    }`}
                    onClick={() => setFormIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Colour picker */}
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-7 h-7 rounded-full transition-all ${
                      formColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ background: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
            </div>

            {/* Member selection */}
            <div className="space-y-2">
              <Label>Members from Contacts ({selectedContactIds.size} selected)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[160px] border rounded-lg p-2">
                {filteredContacts.map(contact => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedContactIds.has(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{contact.name}</span>
                      {contact.org && (
                        <span className="text-xs text-muted-foreground ml-2">{contact.org}</span>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: (ROLE_COLORS[contact.default_role] || ROLE_COLORS.Guest).bg,
                        color: (ROLE_COLORS[contact.default_role] || ROLE_COLORS.Guest).text,
                      }}
                    >
                      {contact.default_role}
                    </span>
                  </label>
                ))}
                {filteredContacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {contacts.length === 0 ? 'Add contacts in the directory first.' : 'No contacts match.'}
                  </p>
                )}
              </ScrollArea>
            </div>

            {/* Additional members */}
            <div className="space-y-2">
              <Label>Additional Members (not in directory)</Label>
              {additionalMembers.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.org}</span>
                  <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => removeAdditionalMember(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Name"
                  value={addMemberName}
                  onChange={e => setAddMemberName(e.target.value)}
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && addAdditionalMember()}
                />
                <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ATTENDEE_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={addAdditionalMember} disabled={!addMemberName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {editing ? 'Update Group' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteGroup(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
