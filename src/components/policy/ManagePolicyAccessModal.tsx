import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Shield, Users, Save } from 'lucide-react';
import { PolicyAccessLevel, PracticeUserWithAccess } from '@/hooks/usePolicyLibraryAccess';

interface ManagePolicyAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceName: string | null;
  practiceUsers: PracticeUserWithAccess[];
  isLoadingUsers: boolean;
  onSave: (changes: Array<{ userId: string; accessLevel: PolicyAccessLevel }>) => Promise<boolean>;
}

const accessLevelLabels: Record<PolicyAccessLevel, string> = {
  none: 'No Access',
  read: 'Read Only',
  edit: 'Edit',
};

const accessLevelColors: Record<PolicyAccessLevel, string> = {
  none: 'bg-muted text-muted-foreground',
  read: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  edit: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const roleLabels: Record<string, string> = {
  practice_user: 'Practice User',
  practice_manager: 'Practice Manager',
  gp: 'GP',
  nurse: 'Nurse',
  administrator: 'Administrator',
  receptionist: 'Receptionist',
  pcn_manager: 'PCN Manager',
  complaints_manager: 'Complaints Manager',
};

export const ManagePolicyAccessModal: React.FC<ManagePolicyAccessModalProps> = ({
  open,
  onOpenChange,
  practiceName,
  practiceUsers,
  isLoadingUsers,
  onSave,
}) => {
  const [localAccess, setLocalAccess] = useState<Record<string, PolicyAccessLevel>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialise local state from props
  useEffect(() => {
    const initial: Record<string, PolicyAccessLevel> = {};
    practiceUsers.forEach(u => {
      initial[u.user_id] = u.access_level;
    });
    setLocalAccess(initial);
    setHasChanges(false);
  }, [practiceUsers]);

  const handleAccessChange = (userId: string, level: PolicyAccessLevel) => {
    setLocalAccess(prev => ({ ...prev, [userId]: level }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changes = practiceUsers
        .filter(u => localAccess[u.user_id] !== u.access_level)
        .map(u => ({
          userId: u.user_id,
          accessLevel: localAccess[u.user_id],
        }));

      if (changes.length === 0) {
        onOpenChange(false);
        return;
      }

      const success = await onSave(changes);
      if (success) {
        setHasChanges(false);
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Manage Practice Policy Access
          </DialogTitle>
          <DialogDescription>
            Control which users at <strong>{practiceName}</strong> can view or edit the shared policy library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading practice users…</span>
            </div>
          ) : practiceUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No other users registered at this practice.</p>
              <p className="text-sm mt-1">Users need to be assigned to your practice first.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr,auto,auto] gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                <span>User</span>
                <span>Role</span>
                <span>Policy Access</span>
              </div>
              {practiceUsers.map(u => (
                <div
                  key={u.user_id}
                  className="grid grid-cols-[1fr,auto,auto] gap-3 items-center px-3 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {roleLabels[u.role] || u.role}
                  </Badge>
                  <Select
                    value={localAccess[u.user_id] || 'none'}
                    onValueChange={(val) => handleAccessChange(u.user_id, val as PolicyAccessLevel)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Access</SelectItem>
                      <SelectItem value="read">Read Only</SelectItem>
                      <SelectItem value="edit">Edit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {practiceUsers.filter(u => (localAccess[u.user_id] || 'none') !== 'none').length} of{' '}
            {practiceUsers.length} users have access
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
