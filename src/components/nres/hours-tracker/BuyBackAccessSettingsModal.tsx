import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS } from '@/data/nresPractices';
import { useNRESUserAccess } from '@/hooks/useNRESUserAccess';
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
          <DialogTitle>Buy-Back Access Settings</DialogTitle>
          <DialogDescription>Assign users to practices with Submit, View, or Approver roles.</DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
