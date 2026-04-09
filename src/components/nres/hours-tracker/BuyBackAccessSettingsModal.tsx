import { useState, useMemo } from 'react';
import { GroundRulesEditor, getDefaultGroundRules } from './GroundRulesEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Plus, Trash2, Settings2, Info, Mail, Users, Building2 } from 'lucide-react';
import { EvidenceConfigTab } from './EvidenceConfigTab';
import { SystemRolesTab } from './SystemRolesTab';
import { useNRESSystemRoles } from '@/hooks/useNRESSystemRoles';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS, NRES_ODS_CODES } from '@/data/nresPractices';
import { useNRESUserAccess } from '@/hooks/useNRESUserAccess';
import { useNRESBuyBackRateSettings, type RoleConfig, type ManagementRoleConfig } from '@/hooks/useNRESBuyBackRateSettings';
import { useAuth } from '@/contexts/AuthContext';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import type { BuyBackAccessRole } from '@/hooks/useNRESBuyBackAccess';
import type { NRESUser } from '@/types/nresAccess';

const ACCESS_ROLES: { key: BuyBackAccessRole; label: string; description: string }[] = [
  { key: 'submit', label: 'Submitter', description: 'Create, edit and submit claims' },
  { key: 'verifier', label: 'Verifier', description: 'Verify/validate claims' },
  { key: 'approver', label: 'Approver', description: 'Approve or reject claims' },
  { key: 'view', label: 'View', description: 'View claims (read-only)' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasAccess: (userId: string, practiceKey: string, role: BuyBackAccessRole) => boolean;
  grantAccess: (userId: string, practiceKey: string, role: BuyBackAccessRole) => Promise<void>;
  revokeByKey: (userId: string, practiceKey: string, role: BuyBackAccessRole) => Promise<void>;
}

/** Format a number as £X,XXX.XX */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Practice-First Access Panel ── */

function PracticeFirstAccessPanel({ users, hasAccess, grantAccess, revokeByKey }: {
  users: NRESUser[];
  hasAccess: (userId: string, practiceKey: string, role: BuyBackAccessRole) => boolean;
  grantAccess: (userId: string, practiceKey: string, role: BuyBackAccessRole) => Promise<void>;
  revokeByKey: (userId: string, practiceKey: string, role: BuyBackAccessRole) => Promise<void>;
}) {
  const [selectedPractice, setSelectedPractice] = useState<string>(NRES_PRACTICE_KEYS[0]);
  const [addSearch, setAddSearch] = useState('');

  // Users assigned to selected practice (any role)
  const assignedUsers = useMemo(() => {
    return users.filter(u =>
      ACCESS_ROLES.some(r => hasAccess(u.user_id, selectedPractice, r.key))
    );
  }, [users, selectedPractice, hasAccess]);

  // Users NOT assigned to selected practice
  const unassignedUsers = useMemo(() => {
    const assigned = new Set(assignedUsers.map(u => u.user_id));
    let available = users.filter(u => !assigned.has(u.user_id));
    if (addSearch.trim()) {
      const q = addSearch.toLowerCase();
      available = available.filter(u =>
        (u.full_name?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q))
      );
    }
    // Sort: admin users first
    return available.sort((a, b) => {
      const aAdmin = NRES_ADMIN_EMAILS.includes(a.email?.toLowerCase() || '');
      const bAdmin = NRES_ADMIN_EMAILS.includes(b.email?.toLowerCase() || '');
      if (aAdmin && !bAdmin) return -1;
      if (!aAdmin && bAdmin) return 1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [users, assignedUsers, addSearch]);

  // Count assigned users per practice
  const practiceUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    NRES_PRACTICE_KEYS.forEach(pk => {
      counts[pk] = users.filter(u =>
        ACCESS_ROLES.some(r => hasAccess(u.user_id, pk, r.key))
      ).length;
    });
    return counts;
  }, [users, hasAccess]);

  const handleAddUser = async (userId: string) => {
    await grantAccess(userId, selectedPractice, 'submit');
  };

  const handleRemoveAllRoles = async (userId: string) => {
    for (const r of ACCESS_ROLES) {
      if (hasAccess(userId, selectedPractice, r.key)) {
        await revokeByKey(userId, selectedPractice, r.key);
      }
    }
  };

  const handleRoleToggle = async (userId: string, role: BuyBackAccessRole, checked: boolean) => {
    if (checked) {
      await grantAccess(userId, selectedPractice, role);
    } else {
      await revokeByKey(userId, selectedPractice, role);
    }
  };

  return (
    <div className="flex gap-4 flex-1 min-h-0 overflow-hidden pb-2">
      {/* Left: Practice list */}
      <div className="w-56 shrink-0 flex flex-col border rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 border-b">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Practices</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {NRES_PRACTICE_KEYS.map(pk => (
            <button
              key={pk}
              className={`w-full text-left px-3 py-2.5 text-xs border-b transition-colors ${
                selectedPractice === pk
                  ? 'bg-primary/10 border-l-2 border-l-primary font-semibold'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => { setSelectedPractice(pk); setAddSearch(''); }}
            >
              <p className="truncate">{NRES_PRACTICES[pk]}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{NRES_ODS_CODES[pk]}</span>
                {practiceUserCounts[pk] > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{practiceUserCounts[pk]} user{practiceUserCounts[pk] !== 1 ? 's' : ''}</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: User assignments for selected practice */}
      <div className="flex-1 overflow-y-auto space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{NRES_PRACTICES[selectedPractice]}</h3>
          <p className="text-[10px] text-muted-foreground">ODS: {NRES_ODS_CODES[selectedPractice]} · Manage user access for this practice</p>
        </div>

        {/* Assigned users */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Assigned Users ({assignedUsers.length})</span>
          </div>
          {assignedUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3 text-center border rounded-md bg-muted/20">No users assigned to this practice</p>
          ) : (
            <div className="border rounded-md overflow-hidden divide-y">
              {assignedUsers.map(u => {
                const isAdmin = NRES_ADMIN_EMAILS.includes(u.email?.toLowerCase() || '');
                return (
                  <div key={u.user_id} className="px-3 py-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{u.full_name || 'No name'}</span>
                        {isAdmin && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/30 text-primary">Admin</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveAllRoles(u.user_id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                    <p className="text-muted-foreground mb-2">{u.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCESS_ROLES.map(r => {
                        const checked = hasAccess(u.user_id, selectedPractice, r.key);
                        return (
                          <button
                            key={r.key}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              checked
                                ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                : 'border-border text-muted-foreground hover:border-primary/20 hover:text-foreground'
                            }`}
                            onClick={() => handleRoleToggle(u.user_id, r.key, !checked)}
                            title={r.description}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Add user section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Add User to {NRES_PRACTICES[selectedPractice]}</span>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-8 text-xs"
              placeholder="Search available users..."
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
            />
          </div>
          {unassignedUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              {addSearch ? 'No matching users found' : 'All users are already assigned'}
            </p>
          ) : (
            <div className="border rounded-md overflow-hidden divide-y max-h-48 overflow-y-auto">
              {unassignedUsers.slice(0, 20).map(u => {
                const isAdmin = NRES_ADMIN_EMAILS.includes(u.email?.toLowerCase() || '');
                return (
                  <div key={u.user_id} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{u.full_name || 'No name'}</span>
                        {isAdmin && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/30 text-primary">Admin</Badge>}
                      </div>
                      <p className="text-muted-foreground">{u.email}</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleAddUser(u.user_id)}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                );
              })}
              {unassignedUsers.length > 20 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  Showing 20 of {unassignedUsers.length} — use search to filter
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Changes are saved automatically. Users will only see claims and staff for practices they are assigned to.
        </p>
      </div>
    </div>
  );
}

export function BuyBackAccessSettingsModal({ open, onOpenChange, hasAccess, grantAccess, revokeByKey }: Props) {
  const { data: users, isLoading } = useNRESUserAccess();
  const { isSuperAdmin } = useNRESSystemRoles();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col px-8 sm:px-10">
        <DialogHeader className="border-b border-border pb-4 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Buy-Back Settings</DialogTitle>
              <DialogDescription className="mt-0.5">Manage access permissions, rates and role types.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="access" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none p-0 h-auto mb-4">
            {isSuperAdmin && (
              <TabsTrigger value="system-roles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">System Roles</TabsTrigger>
            )}
            <TabsTrigger value="access" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">Access Permissions</TabsTrigger>
            <TabsTrigger value="rates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">Rates &amp; Roles</TabsTrigger>
            <TabsTrigger value="evidence" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">Evidence Requirements</TabsTrigger>
            <TabsTrigger value="email" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium">Email Settings</TabsTrigger>
          </TabsList>

          {/* System Roles Tab */}
          {isSuperAdmin && (
            <TabsContent value="system-roles" className="flex-1 min-h-0 overflow-y-auto mt-0">
              <SystemRolesTab />
            </TabsContent>
          )}

          {/* Access Permissions Tab */}
          <TabsContent value="access" className="flex-1 min-h-0 overflow-y-auto mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PracticeFirstAccessPanel
                users={users || []}
                hasAccess={hasAccess}
                grantAccess={grantAccess}
                revokeByKey={revokeByKey}
              />
            )}
          </TabsContent>

          {/* Rates & Roles Tab */}
          <TabsContent value="rates" className="flex-1 min-h-0 overflow-y-auto mt-0">
            <RatesAndRolesPanel />
          </TabsContent>

          {/* Evidence Requirements Tab */}
          <TabsContent value="evidence" className="flex-1 min-h-0 overflow-y-auto mt-0">
            <EvidenceConfigTab />
          </TabsContent>

          {/* Email Settings Tab */}
          <TabsContent value="email" className="flex-1 min-h-0 overflow-y-auto mt-0">
            <EmailSettingsPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function RatesAndRolesPanel() {
  const { settings, loading, saving, updateSettings, updateManagementRoles } = useNRESBuyBackRateSettings();
  const [niPct, setNiPct] = useState<string>('');
  const [pensionPct, setPensionPct] = useState<string>('');
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [mgmtRoles, setMgmtRoles] = useState<ManagementRoleConfig[]>([]);
  const [initialised, setInitialised] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');

  // Initialise local state from fetched settings
  if (!loading && !initialised) {
    setNiPct(String(settings.employer_ni_pct));
    setPensionPct(String(settings.employer_pension_pct));
    // Filter out any management role that crept into clinical roles
    setRoles(settings.roles_config.filter(r => !r.key.startsWith('nres_')));
    setMgmtRoles(settings.management_roles_config.map(r => ({
      ...r,
      max_hours_per_week: (r as any).max_hours_per_week ?? 8,
    })));
    setInitialised(true);
  }

  const niPctNum = parseFloat(niPct) || 0;
  const pensionPctNum = parseFloat(pensionPct) || 0;
  const onCostsPctNum = niPctNum + pensionPctNum;
  const _onCostMultiplier = 1 + onCostsPctNum / 100;

  const handleRoleFieldChange = (index: number, field: keyof RoleConfig, value: any) => {
    setRoles(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleMgmtFieldChange = (index: number, field: string, value: any) => {
    setMgmtRoles(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleAddRole = () => {
    if (!newRoleLabel.trim()) return;
    const key = newRoleLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (roles.some(r => r.key === key)) return;
    setRoles(prev => [...prev, {
      key,
      label: newRoleLabel.trim(),
      annual_rate: 0,
      allocation_default: 'hours' as const,
      working_hours_per_year: 1950,
      ground_rules: getDefaultGroundRules(key),
    }]);
    setNewRoleLabel('');
  };

  const handleGroundRulesChange = (index: number, rules: import('@/hooks/useNRESBuyBackRateSettings').GroundRule[]) => {
    setRoles(prev => prev.map((r, i) => i === index ? { ...r, ground_rules: rules } : r));
  };

  const handleDeleteRole = (index: number) => {
    setRoles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await updateSettings(niPctNum, pensionPctNum, roles);
    await updateManagementRoles(mgmtRoles);
  };

  const hasChanges = initialised && (
    niPct !== String(settings.employer_ni_pct) ||
    pensionPct !== String(settings.employer_pension_pct) ||
    JSON.stringify(roles) !== JSON.stringify(settings.roles_config.filter(r => !r.key.startsWith('nres_'))) ||
    JSON.stringify(mgmtRoles) !== JSON.stringify(settings.management_roles_config)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 pt-2">
      {/* Section A: On-Costs — split into NI and Pension */}
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Employer On-Costs</h3>
        <p className="text-xs text-muted-foreground mb-3">
          On-costs are the additional employer contributions paid on top of an employee's base salary. They consist of two components:
        </p>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Employer National Insurance</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  className="w-28 h-9 text-sm bg-white dark:bg-slate-900"
                  value={niPct}
                  onChange={e => setNiPct(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Employer NI contributions (Class 1 secondary)
              </p>
            </div>
            <div>
              <Label className="text-xs font-medium">Employer Pension Contributions</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  className="w-28 h-9 text-sm bg-white dark:bg-slate-900"
                  value={pensionPct}
                  onChange={e => setPensionPct(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                NHS Pension Scheme employer contribution rate
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-xs">
            <span className="font-medium">Combined on-costs rate: </span>
            <span className="font-semibold text-primary">{onCostsPctNum.toFixed(2)}%</span>
            <span className="text-muted-foreground ml-1">(NI {niPctNum}% + Pension {pensionPctNum}%)</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section B: Role Management */}
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Role Types</h3>
        <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-left px-3 py-2.5 font-medium">Base Annual Rate (£)</th>
                <th className="text-left px-3 py-2.5 font-medium">Default Allocation</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => (
                <React.Fragment key={role.key}>
                  <tr className="border-t">
                    <td className="px-3 py-2.5">
                      <Input
                        className="h-8 text-xs w-full bg-white dark:bg-slate-900"
                        value={role.label}
                        onChange={e => handleRoleFieldChange(i, 'label', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        className="h-8 text-xs w-28 bg-white dark:bg-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        value={role.annual_rate}
                        onChange={e => handleRoleFieldChange(i, 'annual_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Select
                        value={role.allocation_default}
                        onValueChange={v => handleRoleFieldChange(i, 'allocation_default', v)}
                      >
                        <SelectTrigger className="h-8 text-xs w-28 bg-white dark:bg-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sessions">Sessions</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="wte">WTE</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRole(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-3 pb-2">
                      <GroundRulesEditor role={role} onRulesChange={(rules) => handleGroundRulesChange(i, rules)} />
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Input
            className="h-8 text-xs w-40 bg-white dark:bg-slate-900"
            placeholder="New role name"
            value={newRoleLabel}
            onChange={e => setNewRoleLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRole()}
          />
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddRole} disabled={!newRoleLabel.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Role
          </Button>
        </div>
      </div>

      <Separator />

      {/* Section B2: Management Roles */}
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">NRES Management Rates</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Management time is billed at a simple hourly rate — no annual salary, on-costs, or allocation type.
        </p>
        <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-left px-3 py-2.5 font-medium">Person</th>
                <th className="text-left px-3 py-2.5 font-medium">Hourly Rate (£)</th>
                <th className="text-left px-3 py-2.5 font-medium">Max Hrs/Week</th>
                <th className="text-left px-3 py-2.5 font-medium">Billing Entity</th>
                <th className="text-left px-3 py-2.5 font-medium">Org Code</th>
              </tr>
            </thead>
            <tbody>
              {mgmtRoles.map((role, i) => (
                <tr key={role.key} className="border-t">
                  <td className="px-3 py-2.5 text-xs font-medium">{role.label}</td>
                  <td className="px-3 py-2.5">
                    <Input
                      className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                      value={role.person_name}
                      onChange={e => handleMgmtFieldChange(i, 'person_name', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      className="h-8 text-xs w-24 bg-white dark:bg-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      value={role.hourly_rate}
                      onChange={e => handleMgmtFieldChange(i, 'hourly_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      className="h-8 text-xs w-20 bg-white dark:bg-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      value={role.max_hours_per_week ?? 8}
                      onChange={e => handleMgmtFieldChange(i, 'max_hours_per_week', parseFloat(e.target.value) || 0)}
                      min="0"
                      max="40"
                      step="0.5"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      className="h-8 text-xs w-44 bg-white dark:bg-slate-900"
                      value={role.billing_entity}
                      onChange={e => handleMgmtFieldChange(i, 'billing_entity', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      className="h-8 text-xs w-20 bg-white dark:bg-slate-900"
                      value={role.billing_org_code}
                      onChange={e => handleMgmtFieldChange(i, 'billing_org_code', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {mgmtRoles.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No management roles configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Section C: Cost Breakdown */}
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Cost Breakdown</h3>
        <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-right px-3 py-2.5 font-medium">Base Annual</th>
                <th className="text-right px-3 py-2.5 font-medium">Staff Pay Rate (Hourly)</th>
                <th className="text-right px-3 py-2.5 font-medium">Employer NI ({niPctNum}%)</th>
                <th className="text-right px-3 py-2.5 font-medium">Employer Pension ({pensionPctNum}%)</th>
                <th className="text-right px-3 py-2.5 font-medium">Total On-Costs</th>
                <th className="text-right px-3 py-2.5 font-medium">Total Annual</th>
                <th className="text-right px-3 py-2.5 font-medium">Equiv. Hourly (incl. On-Costs)</th>
                <th className="text-right px-3 py-2.5 font-medium">Max Monthly Claim</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => {
                const workingHrs = role.working_hours_per_year || 1950;
                const fullAnnualBase = role.allocation_default === 'sessions'
                  ? role.annual_rate * 9
                  : role.annual_rate;
                const staffHourlyRate = workingHrs > 0 ? fullAnnualBase / workingHrs : 0;
                const niAmt = role.annual_rate * (niPctNum / 100);
                const pensionAmt = role.annual_rate * (pensionPctNum / 100);
                const totalOnCosts = niAmt + pensionAmt;
                const totalAnnual = role.annual_rate + totalOnCosts;
                const fullAnnualWithOnCosts = role.allocation_default === 'sessions'
                  ? totalAnnual * 9
                  : totalAnnual;
                const hourlyEquivWithOnCosts = workingHrs > 0 ? fullAnnualWithOnCosts / workingHrs : 0;
                // Max monthly = full allocation at 1.0 WTE / 9 sessions / 37.5 hrs
                const maxAlloc = role.allocation_default === 'sessions' ? 9 : role.allocation_default === 'hours' ? 37.5 : 1;
                const maxMonthly = role.allocation_default === 'sessions'
                  ? (maxAlloc * totalAnnual) / 12
                  : role.allocation_default === 'hours'
                  ? ((maxAlloc / 37.5) * totalAnnual) / 12
                  : (maxAlloc * totalAnnual) / 12;
                return (
                  <tr key={role.key} className="border-t">
                    <td className="px-3 py-2.5">
                      {role.label}
                      {role.allocation_default === 'sessions' && (
                        <span className="text-muted-foreground ml-1">(per session/yr)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">{fmtGBP(role.annual_rate)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtGBP(staffHourlyRate)}/hr</td>
                    <td className="px-3 py-2.5 text-right">{fmtGBP(niAmt)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtGBP(pensionAmt)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtGBP(totalOnCosts)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{fmtGBP(totalAnnual)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{fmtGBP(hourlyEquivWithOnCosts)}/hr</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-primary">{fmtGBP(maxMonthly)}/mo</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-2 mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            On-costs = Employer NI ({niPctNum}%) + Employer Pension ({pensionPctNum}%) = {onCostsPctNum.toFixed(2)}% total. Staff Pay Rate = Base Annual ÷ {roles[0]?.working_hours_per_year || 1950} hrs/yr. GP rates shown per session — hourly equivalents based on 9 sessions/wk. Max Monthly = full allocation at maximum capacity.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

const EMAIL_TYPES_TABLE = [
  { type: 'Claim Submitted', trigger: 'Claim is submitted', recipient: 'All practice approvers' },
  { type: 'Submission Confirmation', trigger: 'Claim is submitted', recipient: 'The submitting user' },
  { type: 'Claim Approved', trigger: 'Claim is approved', recipient: 'The submitting user' },
  { type: 'Approval Confirmation', trigger: 'Claim is approved', recipient: 'The reviewing approver' },
  { type: 'Claim Declined', trigger: 'Claim is declined', recipient: 'The submitting user' },
  { type: 'Decline Confirmation', trigger: 'Claim is declined', recipient: 'The reviewing approver' },
];

function EmailSettingsPanel() {
  const { settings, loading, saving, toggleEmailTestingMode } = useNRESBuyBackRateSettings();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const testingMode = settings.email_testing_mode;

  return (
    <div className="space-y-6 pb-4 pt-2">
      {/* Testing Mode Toggle */}
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Email Testing Mode</h3>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Testing Mode</span>
                <Badge className={testingMode
                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                }>
                  {testingMode ? 'Testing' : 'Live'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {testingMode
                  ? `All system emails will be redirected to your email (${user?.email}). No emails will reach actual recipients.`
                  : 'Emails are being sent to their intended recipients (approvers, submitters, etc.).'}
              </p>
            </div>
            <Switch
              checked={testingMode}
              onCheckedChange={(checked) => toggleEmailTestingMode(checked)}
              disabled={saving}
            />
          </div>
          {testingMode && (
            <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  <strong>Testing mode is active.</strong> All automated emails from the buy-back claims workflow will be sent to <strong>{user?.email}</strong> instead of their normal recipients. Toggle off when ready to go live.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Email Types Summary */}
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Automated Email Types</h3>
        <p className="text-xs text-muted-foreground mb-3">
          The following emails are sent automatically at key points in the claims workflow.
        </p>
        <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Email Type</th>
                <th className="text-left px-3 py-2.5 font-medium">Trigger</th>
                <th className="text-left px-3 py-2.5 font-medium">Recipient</th>
              </tr>
            </thead>
            <tbody>
              {EMAIL_TYPES_TABLE.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2.5 font-medium">{row.type}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.trigger}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {testingMode ? (
                      <span className="text-amber-600 dark:text-amber-400">{user?.email} (testing override)</span>
                    ) : (
                      row.recipient
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
