import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus } from 'lucide-react';
import type { MemberPractice, NRESClaimant } from '@/hooks/useNRESClaimants';

interface QuickAddClaimantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addClaimant: (name: string, role: 'gp' | 'pm', memberPractice?: MemberPractice) => Promise<NRESClaimant | null>;
  saving: boolean;
  userPracticeName: string | null;
  onAdded?: (newClaimantId: string) => void;
}

export function QuickAddClaimantDialog({
  open,
  onOpenChange,
  addClaimant,
  saving,
  userPracticeName,
  onAdded,
}: QuickAddClaimantDialogProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'gp' | 'pm'>('gp');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await addClaimant(name.trim(), role, (userPracticeName as MemberPractice) || undefined);
    if (result) {
      setName('');
      setRole('gp');
      onOpenChange(false);
      onAdded?.(result.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add staff member
          </DialogTitle>
          <DialogDescription>
            Quickly add a GP or Practice Manager so you can log hours on their behalf.
            {userPracticeName && <> They will be added to <strong>{userPracticeName}</strong>.</>}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="quick-claimant-name" className="text-xs">Full name</Label>
            <Input
              id="quick-claimant-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. James Toplis"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <RadioGroup
              value={role}
              onValueChange={(v) => setRole(v as 'gp' | 'pm')}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="gp" id="quick-role-gp" />
                <span className="text-sm">GP <span className="text-muted-foreground">(£100/hr)</span></span>
              </label>
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="pm" id="quick-role-pm" />
                <span className="text-sm">Practice Manager <span className="text-muted-foreground">(£50/hr)</span></span>
              </label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
