import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Plus, Trash2 } from 'lucide-react';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS } from '@/data/nresPractices';
import { useNRESUserAccess } from '@/hooks/useNRESUserAccess';
import { useNRESBuyBackRateSettings, type RoleConfig } from '@/hooks/useNRESBuyBackRateSettings';
import type { BuyBackAccessRole } from '@/hooks/useNRESBuyBackAccess';

const ROLES: { key: BuyBackAccessRole; label: string }[] = [
  { key: 'submit', label: 'Submit' },
  { key: 'view', label: 'View' },
  { key: 'approver', label: 'Approver' },
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

export function BuyBackAccessSettingsModal({ open, onOpenChange, hasAccess, grantAccess, revokeByKey }: Props) {
  const { data: users, isLoading } = useNRESUserAccess();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name?.toLowerCase().includes(q)) ||
      (u.email?.toLowerCase().includes(q)) ||
      (u.practice_name?.toLowerCase().includes(q))
    );
  }, [users, search]);

  const selectedUser = useMemo(() => users?.find(u => u.user_id === selectedUserId), [users, selectedUserId]);

  const handleToggle = async (userId: string, practiceKey: string, role: BuyBackAccessRole, checked: boolean) => {
    if (checked) {
      await grantAccess(userId, practiceKey, role);
    } else {
      await revokeByKey(userId, practiceKey, role);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Buy-Back Settings</DialogTitle>
          <DialogDescription>Manage access permissions, rates and role types.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="access" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="access">Access Permissions</TabsTrigger>
            <TabsTrigger value="rates">Rates &amp; Roles</TabsTrigger>
          </TabsList>

          {/* Access Permissions Tab */}
          <TabsContent value="access" className="flex-1 min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                {/* User list */}
                <div className="w-64 shrink-0 flex flex-col border rounded-md overflow-hidden">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        className="pl-7 h-8 text-xs"
                        placeholder="Search users..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {filteredUsers.map(u => (
                      <button
                        key={u.user_id}
                        className={`w-full text-left px-3 py-2 text-xs border-b hover:bg-muted/50 transition-colors ${
                          selectedUserId === u.user_id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                        }`}
                        onClick={() => setSelectedUserId(u.user_id)}
                      >
                        <p className="font-medium truncate">{u.full_name || 'No name'}</p>
                        <p className="text-muted-foreground truncate">{u.email}</p>
                        {u.practice_name && <p className="text-muted-foreground truncate">{u.practice_name}</p>}
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">No users found</p>
                    )}
                  </div>
                </div>

                {/* Permissions grid */}
                <div className="flex-1 overflow-y-auto">
                  {selectedUser ? (
                    <div className="space-y-3">
                      <div className="mb-3">
                        <h3 className="font-semibold text-sm">{selectedUser.full_name || 'No name'}</h3>
                        <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                      </div>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Practice</th>
                              {ROLES.map(r => (
                                <th key={r.key} className="text-center p-2 font-medium w-20">{r.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {NRES_PRACTICE_KEYS.map(pk => (
                              <tr key={pk} className="border-t">
                                <td className="p-2">{NRES_PRACTICES[pk]}</td>
                                {ROLES.map(r => {
                                  const checked = hasAccess(selectedUser.user_id, pk, r.key);
                                  return (
                                    <td key={r.key} className="p-2 text-center">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(val) => handleToggle(selectedUser.user_id, pk, r.key, !!val)}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Changes are saved automatically. Users will only see claims and staff for practices they are assigned to.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Select a user to manage their access
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Rates & Roles Tab */}
          <TabsContent value="rates" className="flex-1 min-h-0 overflow-y-auto">
            <RatesAndRolesPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function RatesAndRolesPanel() {
  const { settings, loading, saving, updateSettings } = useNRESBuyBackRateSettings();
  const [onCostsPct, setOnCostsPct] = useState<string>('');
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [initialised, setInitialised] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');

  // Initialise local state from fetched settings
  if (!loading && !initialised) {
    setOnCostsPct(String(settings.on_costs_pct));
    setRoles(settings.roles_config);
    setInitialised(true);
  }

  const onCostsPctNum = parseFloat(onCostsPct) || 0;
  const onCostMultiplier = 1 + onCostsPctNum / 100;

  const handleRoleFieldChange = (index: number, field: keyof RoleConfig, value: any) => {
    setRoles(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleAddRole = () => {
    if (!newRoleLabel.trim()) return;
    const key = newRoleLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (roles.some(r => r.key === key)) {
      return;
    }
    setRoles(prev => [...prev, {
      key,
      label: newRoleLabel.trim(),
      annual_rate: 0,
      allocation_default: 'hours' as const,
      working_hours_per_year: 1950,
    }]);
    setNewRoleLabel('');
  };

  const handleDeleteRole = (index: number) => {
    setRoles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    updateSettings(onCostsPctNum, roles);
  };

  const hasChanges = initialised && (
    onCostsPct !== String(settings.on_costs_pct) ||
    JSON.stringify(roles) !== JSON.stringify(settings.roles_config)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Section A: On-Costs */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Employer On-Costs</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="w-28 h-8 text-sm"
            value={onCostsPct}
            onChange={e => setOnCostsPct(e.target.value)}
            step="0.01"
            min="0"
            max="100"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Applied on top of base annual salary (e.g. 29.38% covers NI, pension and other employer costs).
        </p>
      </div>

      <Separator />

      {/* Section B: Role Management */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Role Types</h3>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Role</th>
                <th className="text-left p-2 font-medium">Base Annual Rate (£)</th>
                <th className="text-left p-2 font-medium">Default Allocation</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => (
                <tr key={role.key} className="border-t">
                  <td className="p-2">
                    <Input
                      className="h-7 text-xs w-full"
                      value={role.label}
                      onChange={e => handleRoleFieldChange(i, 'label', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      className="h-7 text-xs w-28 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      value={role.annual_rate}
                      onChange={e => handleRoleFieldChange(i, 'annual_rate', parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </td>
                  <td className="p-2">
                    <Select
                      value={role.allocation_default}
                      onValueChange={v => handleRoleFieldChange(i, 'allocation_default', v)}
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sessions">Sessions</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="wte">WTE</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRole(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Input
            className="h-8 text-xs w-40"
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

      {/* Section C: Cost Breakdown */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Cost Breakdown</h3>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Role</th>
                <th className="text-right p-2 font-medium">Base Annual</th>
                <th className="text-right p-2 font-medium">Staff Pay Rate (Hourly)</th>
                <th className="text-right p-2 font-medium">On-Costs ({onCostsPctNum}%)</th>
                <th className="text-right p-2 font-medium">Total Annual</th>
                <th className="text-right p-2 font-medium">Equiv. Hourly (incl. On-Costs)</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => {
                const workingHrs = role.working_hours_per_year || 1950;
                // For sessions-based roles, annual_rate is per session per year
                // A WTE GP does 9 sessions/wk, so multiply to get full annual salary equivalent
                const fullAnnualBase = role.allocation_default === 'sessions'
                  ? role.annual_rate * 9
                  : role.annual_rate;
                const staffHourlyRate = workingHrs > 0 ? fullAnnualBase / workingHrs : 0;
                const onCostsAmt = role.annual_rate * (onCostsPctNum / 100);
                const totalAnnual = role.annual_rate + onCostsAmt;
                // Full annual with on-costs for hourly equiv
                const fullAnnualWithOnCosts = role.allocation_default === 'sessions'
                  ? totalAnnual * 9
                  : totalAnnual;
                const hourlyEquivWithOnCosts = workingHrs > 0 ? fullAnnualWithOnCosts / workingHrs : 0;
                return (
                  <tr key={role.key} className="border-t">
                    <td className="p-2">
                      {role.label}
                      {role.allocation_default === 'sessions' && (
                        <span className="text-muted-foreground ml-1">(per session/yr)</span>
                      )}
                    </td>
                    <td className="p-2 text-right">{fmtGBP(role.annual_rate)}</td>
                    <td className="p-2 text-right">{fmtGBP(staffHourlyRate)}/hr</td>
                    <td className="p-2 text-right">{fmtGBP(onCostsAmt)}</td>
                    <td className="p-2 text-right font-medium">{fmtGBP(totalAnnual)}</td>
                    <td className="p-2 text-right font-medium">{fmtGBP(hourlyEquivWithOnCosts)}/hr</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Staff Pay Rate = Base Annual ÷ {roles[0]?.working_hours_per_year || 1950} hrs/yr. Equiv. Hourly = Total Annual (incl. on-costs) ÷ {roles[0]?.working_hours_per_year || 1950} hrs/yr. GP rates shown per session — hourly equivalents based on 9 sessions/wk.
        </p>
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
