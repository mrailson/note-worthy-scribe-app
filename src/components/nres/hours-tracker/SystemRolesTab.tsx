import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Crown, ClipboardList, Briefcase, Eye, Pencil, Check, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useNRESSystemRoles, formatRoleLabel, type SystemRole, type SystemRoleEntry } from '@/hooks/useNRESSystemRoles';

const ROLE_SECTIONS: { role: SystemRole; icon: React.ReactNode; description: string }[] = [
  { role: 'super_admin', icon: <Crown className="w-4 h-4 text-amber-500" />, description: 'Full system access — settings, all claims, all actions, system configuration' },
  { role: 'management_lead', icon: <ClipboardList className="w-4 h-4 text-blue-500" />, description: 'Verify claims, assist practices, view all claims, run exports' },
  { role: 'pml_director', icon: <Briefcase className="w-4 h-4 text-purple-500" />, description: 'Approve, Query, or Reject verified claims. Cannot edit claims or manage settings' },
  { role: 'pml_finance', icon: <Eye className="w-4 h-4 text-emerald-500" />, description: 'View approved/invoiced/paid claims, mark as paid, download invoices' },
];

function AddRoleForm({ role, onAdd }: { role: SystemRole; onAdd: (email: string, name: string, org: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');

  const handleAdd = () => {
    if (!email.trim() || !name.trim()) return;
    onAdd(email, name, org);
    setEmail(''); setName(''); setOrg('');
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <Input className="h-8 text-xs flex-1" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <Input className="h-8 text-xs flex-1" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <Input className="h-8 text-xs flex-[0.8]" placeholder="Organisation (optional)" value={org} onChange={e => setOrg(e.target.value)} />
      <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAdd} disabled={!email.trim() || !name.trim()}>
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function RoleEntryRow({ entry, role, onRemove, onToggle, onUpdateOrg }: {
  entry: SystemRoleEntry; role: SystemRole;
  onRemove: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onUpdateOrg: (id: string, org: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [orgValue, setOrgValue] = useState(entry.organisation || '');

  const handleSave = () => {
    onUpdateOrg(entry.id, orgValue);
    setEditing(false);
  };

  const handleCancel = () => {
    setOrgValue(entry.organisation || '');
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 text-xs py-1.5 px-2 rounded hover:bg-muted/30 transition-colors">
      <span className="font-medium w-36 truncate">{entry.user_name}</span>
      <span className="text-muted-foreground flex-1 truncate">{entry.user_email}</span>
      {editing ? (
        <div className="flex items-center gap-1 w-48">
          <Input
            className="h-6 text-xs flex-1"
            placeholder="Organisation"
            value={orgValue}
            onChange={e => setOrgValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" onClick={handleSave}>
            <Check className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={handleCancel}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 w-48 text-right justify-end group cursor-pointer hover:text-foreground text-muted-foreground truncate"
          title="Click to edit organisation"
        >
          <span className="truncate">{entry.organisation || '—'}</span>
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
        </button>
      )}
      <Switch checked={entry.is_active} onCheckedChange={v => onToggle(entry.id, v)} className="scale-75" />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Remove <strong>{entry.user_name}</strong> from the <strong>{formatRoleLabel(role)}</strong> role? This can be re-added later.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRemove(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleSection({ role, icon, description, entries, onAdd, onRemove, onToggle, onUpdateOrg }: {
  role: SystemRole; icon: React.ReactNode; description: string;
  entries: SystemRoleEntry[];
  onAdd: (email: string, name: string, org: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onUpdateOrg: (id: string, org: string) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-3 border-b">
        <div className="flex items-center gap-2 mb-0.5">
          {icon}
          <h4 className="text-sm font-semibold">{formatRoleLabel(role)}</h4>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entries.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-3">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2 text-centre">No users assigned yet</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map(entry => (
              <RoleEntryRow
                key={entry.id}
                entry={entry}
                role={role}
                onRemove={onRemove}
                onToggle={onToggle}
                onUpdateOrg={onUpdateOrg}
              />
            ))}
          </div>
        )}
        <AddRoleForm role={role} onAdd={(email, name, org) => onAdd(email, name, org)} />
      </div>
    </div>
  );
}

export function SystemRolesTab() {
  const { roles, loading, addRole, removeRole, toggleActive, updateOrganisation } = useNRESSystemRoles();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4 pt-2">
      <div>
        <p className="text-xs text-muted-foreground">
          Configure who has system-level access to the NRES Buy-Back Claims module. A person can hold multiple roles simultaneously.
        </p>
      </div>
      {ROLE_SECTIONS.map(({ role, icon, description }) => (
        <RoleSection
          key={role}
          role={role}
          icon={icon}
          description={description}
          entries={roles.filter(r => r.role === role)}
          onAdd={(email, name, org) => addRole(email, name, role, org)}
          onRemove={removeRole}
          onToggle={toggleActive}
          onUpdateOrg={updateOrganisation}
        />
      ))}
    </div>
  );
}
