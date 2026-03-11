import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2, Star, StarOff, Mail, Building2, User } from 'lucide-react';
import { ApprovalContact } from '@/hooks/useDocumentApproval';
import { toast } from 'sonner';

const TITLE_OPTIONS = ['', 'Dr', 'Mr', 'Mrs', 'Ms', 'Miss', 'Prof', 'Rev'];
const ORG_TYPE_OPTIONS = ['', 'Practice', 'PCN', 'Federation', 'ICB', 'Other'];

interface Props {
  contacts: ApprovalContact[];
  onSave: (contact: { name: string; email: string; role?: string; organisation?: string; title?: string; organisation_type?: string }) => Promise<void>;
  onUpdate: (id: string, updates: { name: string; email: string; role?: string; organisation?: string; title?: string; organisation_type?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavourite: (contact: ApprovalContact) => Promise<void>;
}

const emptyForm = { title: '', name: '', email: '', role: '', organisation: '', organisation_type: '' };

export function ApprovalDirectory({ contacts, onSave, onUpdate, onDelete, onToggleFavourite }: Props) {
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.organisation || '').toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Group by organisation_type
  const grouped = useMemo(() => {
    const map = new Map<string, ApprovalContact[]>();
    for (const c of filtered) {
      const key = c.organisation_type || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // Sort groups
    const order = ['Practice', 'PCN', 'Federation', 'ICB', 'Other'];
    return Array.from(map.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditOpen(true);
  };

  const openEdit = (c: ApprovalContact) => {
    setEditingId(c.id);
    setForm({
      title: c.title || '',
      name: c.name,
      email: c.email,
      role: c.role || '',
      organisation: c.organisation || '',
      organisation_type: c.organisation_type || '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onSave(form);
      }
      setEditOpen(false);
    } catch {
      toast.error('Failed to save contact');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openNew} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </p>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <Card className="p-8 text-center">
          <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0 ? 'No contacts yet. Add your first contact to get started.' : 'No contacts match your search.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([orgType, members]) => (
            <div key={orgType}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{orgType}</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{members.length}</Badge>
              </div>
              <div className="grid gap-2">
                {members.map(c => (
                  <Card key={c.id} className="px-4 py-3 flex items-center gap-3 group hover:shadow-sm transition-shadow">
                    <button
                      type="button"
                      onClick={() => onToggleFavourite(c)}
                      className="text-muted-foreground hover:text-yellow-500 transition-colors"
                      title={c.is_favourite ? 'Remove favourite' : 'Mark favourite'}
                    >
                      {c.is_favourite
                        ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        : <StarOff className="h-4 w-4" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.title ? `${c.title} ` : ''}{c.name}
                        {c.role && <span className="text-muted-foreground font-normal ml-1.5">— {c.role}</span>}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                        {c.organisation && (
                          <span className="truncate">{c.organisation}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDeleteId(c.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Select value={form.title} onValueChange={v => setForm(f => ({ ...f, title: v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {TITLE_OPTIONS.map(t => (
                      <SelectItem key={t || '__none'} value={t || ' '}>{t || '—'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Role</Label>
                <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Practice Manager" />
              </div>
              <div>
                <Label className="text-xs">Organisation</Label>
                <Input value={form.organisation} onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Organisation Type</Label>
              <Select value={form.organisation_type || ' '} onValueChange={v => setForm(f => ({ ...f, organisation_type: v.trim() }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ORG_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t || '__none'} value={t || ' '}>{t || '—'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Update' : 'Add Contact'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this contact? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
