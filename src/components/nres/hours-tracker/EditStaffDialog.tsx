import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';

interface EditStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: BuyBackStaffMember | null;
  saving: boolean;
  onSave: (id: string, updates: Partial<BuyBackStaffMember>) => Promise<any>;
  staffRoles: string[];
  practiceKeys: string[];
  practiceNames: Record<string, string>;
}

export function EditStaffDialog({
  open,
  onOpenChange,
  staff,
  saving,
  onSave,
  staffRoles,
  practiceKeys,
  practiceNames,
}: EditStaffDialogProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('GP');
  const [allocType, setAllocType] = useState<'sessions' | 'wte' | 'hours' | 'daily'>('sessions');
  const [allocValue, setAllocValue] = useState('');
  const [category, setCategory] = useState<'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'meeting'>('buyback');
  const [practice, setPractice] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open && staff) {
      setName(staff.staff_name);
      setRole(staff.staff_role);
      setAllocType(staff.allocation_type);
      setAllocValue(String(staff.allocation_value));
      setCategory(staff.staff_category);
      setPractice(staff.practice_key || '');
      setStartDate(staff.start_date ? new Date(staff.start_date) : undefined);
      setIsActive(staff.is_active);
    }
  }, [open, staff]);

  const isManagement = category === 'management';
  const isGpLocum = category === 'gp_locum';
  const GP_LOCUM_MAX_DAILY = 750;
  const GP_LOCUM_SESSION_RATE = 375;
  const maxAlloc = isGpLocum
    ? (allocType === 'daily' ? GP_LOCUM_MAX_DAILY : allocType === 'sessions' ? 20 : 9)
    : (allocType === 'wte' ? 1 : allocType === 'hours' ? 37.5 : allocType === 'daily' ? 2000 : 9);

  const handleAllocValueChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > maxAlloc) {
      setAllocValue(String(maxAlloc));
      return;
    }
    setAllocValue(val);
  };

  const handleSave = async () => {
    if (!staff || !name.trim() || !allocValue) return;
    const numVal = parseFloat(allocValue);
    await onSave(staff.id, {
      staff_name: name.trim(),
      staff_role: role,
      allocation_type: allocType,
      allocation_value: numVal,
      staff_category: category,
      practice_key: practice || null,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      is_active: isActive,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[calc(100vh-8rem)] bg-white overflow-y-auto border shadow-xl rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
          <DialogDescription>Update the details for this staff member.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Practice</Label>
              <Select value={practice} onValueChange={setPractice}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {practiceKeys.map(k => (
                    <SelectItem key={k} value={k}>{practiceNames[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={v => {
                const newCat = v as 'buyback' | 'new_sda' | 'management' | 'gp_locum';
                setCategory(newCat);
                if (newCat === 'gp_locum') {
                  setRole('GP Locum');
                  if (allocType !== 'daily' && allocType !== 'sessions') setAllocType('daily');
                }
              }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyback">Buy-Back</SelectItem>
                  <SelectItem value="new_sda">New SDA</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="gp_locum">GP Locum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input className="h-9" value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              {isManagement ? (
                <Input className="h-9 bg-muted" value="NRES Management" disabled />
              ) : isGpLocum ? (
                <Input className="h-9 bg-muted" value="GP Locum" disabled />
              ) : (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {staffRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Allocation Type</Label>
              {isManagement ? (
                <Input className="h-9 bg-muted" value="Hrs/wk" disabled />
              ) : isGpLocum ? (
                <Select value={allocType} onValueChange={v => { setAllocType(v as 'sessions' | 'daily'); setAllocValue(''); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Rate</SelectItem>
                    <SelectItem value="sessions">Sessions</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={allocType} onValueChange={v => { setAllocType(v as 'sessions' | 'wte' | 'hours' | 'daily'); setAllocValue(''); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sessions">Sessions</SelectItem>
                    <SelectItem value="hours">Hrs/wk</SelectItem>
                    <SelectItem value="wte">WTE</SelectItem>
                    <SelectItem value="daily">Daily Rate</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {allocType === 'sessions' ? 'Weekly Sessions' : allocType === 'hours' ? 'Weekly Hours' : allocType === 'daily' ? 'Daily Rate (£)' : 'WTE Value'}
              </Label>
              <Input
                type="number"
                className="h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={allocValue}
                onChange={e => handleAllocValueChange(e.target.value)}
                placeholder="0"
                min="0"
                max={maxAlloc}
                step={allocType === 'wte' ? 0.1 : 1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-9 w-full justify-start text-left font-normal text-xs", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'None'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !allocValue}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
