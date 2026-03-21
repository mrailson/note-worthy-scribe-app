import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Users, Plus, Search, Pencil, Trash2, Info } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import {
  ATTENDEE_ROLES, SUGGESTED_ORGANISATIONS, ROLE_COLORS,
  SPEAKER_COLORS, generateInitials,
} from '@/types/contactTypes';
import type { Contact } from '@/types/contactTypes';

export const ContactDirectory: React.FC = () => {
  const { contacts, loading, createContact, updateContact, deleteContact, organisations } = useContacts();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formRole, setFormRole] = useState('Guest');
  const [formEmail, setFormEmail] = useState('');
  const [customOrg, setCustomOrg] = useState('');

  const allOrgs = useMemo(() => {
    const set = new Set([...SUGGESTED_ORGANISATIONS, ...organisations]);
    return [...set].sort();
  }, [organisations]);

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.org.toLowerCase().includes(q) ||
      c.initials.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const resetForm = () => {
    setFormName('');
    setFormOrg('');
    setFormRole('Guest');
    setFormEmail('');
    setCustomOrg('');
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setFormName(contact.name);
    setFormOrg(allOrgs.includes(contact.org) ? contact.org : '__custom__');
    if (!allOrgs.includes(contact.org)) setCustomOrg(contact.org);
    setFormRole(contact.default_role);
    setFormEmail(contact.email || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    const finalOrg = formOrg === '__custom__' ? customOrg : formOrg;
    const initials = generateInitials(formName);
    if (editing) {
      await updateContact(editing.id, {
        name: formName,
        initials,
        org: finalOrg || '',
        default_role: formRole,
        email: formEmail || null,
      });
    } else {
      await createContact({
        name: formName,
        initials,
        org: finalOrg || '',
        default_role: formRole,
        email: formEmail || null,
      });
    }
    setShowForm(false);
    resetForm();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Contact Directory
        </CardTitle>
        <CardDescription>
          Manage your regular meeting attendees. Contacts can be loaded into meetings with one tap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Contacts are loaded into meetings with one tap. Add your regular meeting attendees here to save time.
          </p>
        </div>

        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or organisation..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Contact
          </Button>
        </div>

        {/* Contact list */}
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading contacts...</p>}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? 'No contacts match your search.' : 'No contacts yet. Add your first contact above.'}
              </p>
            )}
            {filtered.map((contact, idx) => {
              const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
              const roleColor = ROLE_COLORS[contact.default_role] || ROLE_COLORS.Guest;
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                >
                  {/* Avatar */}
                  <div
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: `${color}22`,
                      border: `2px solid ${color}`,
                      color,
                    }}
                  >
                    {contact.initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{contact.name}</span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background: roleColor.bg,
                          color: roleColor.text,
                          border: `1px solid ${roleColor.border}33`,
                        }}
                      >
                        {contact.default_role}
                      </span>
                    </div>
                    {contact.org && (
                      <p className="text-xs text-muted-foreground truncate">{contact.org}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(contact)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {contacts.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        )}
      </CardContent>

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update contact details.' : 'Add a new contact to your directory.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Dr Julia Railson"
              />
              {formName && (
                <p className="text-xs text-muted-foreground">
                  Initials: <span className="font-mono font-bold">{generateInitials(formName)}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select value={formOrg} onValueChange={setFormOrg}>
                <SelectTrigger><SelectValue placeholder="Select organisation..." /></SelectTrigger>
                <SelectContent>
                  {allOrgs.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Other (type below)</SelectItem>
                </SelectContent>
              </Select>
              {formOrg === '__custom__' && (
                <Input
                  value={customOrg}
                  onChange={e => setCustomOrg(e.target.value)}
                  placeholder="Type organisation name..."
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Default Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDEE_ROLES.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="email@example.nhs.uk"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {editing ? 'Update' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteContact(deleteTarget.id);
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
