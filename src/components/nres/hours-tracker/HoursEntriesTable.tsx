import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { NRESHoursEntry } from '@/types/nresHoursTypes';
import { ACTIVITY_TYPES, CLAIMANT_TYPES, getClaimantRate } from '@/types/nresHoursTypes';
import { NRESClaimant } from '@/hooks/useNRESClaimants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface HoursEntriesTableProps {
  entries: NRESHoursEntry[];
  hourlyRate: number | null;
  loading: boolean;
  claimants?: NRESClaimant[];
  onUpdate: (id: string, updates: Partial<NRESHoursEntry>) => Promise<NRESHoursEntry | null>;
}

type SortField = 'date' | 'duration' | 'amount' | 'claimant';
type SortDirection = 'asc' | 'desc' | null;

export function HoursEntriesTable({ entries, hourlyRate, loading, claimants = [], onUpdate }: HoursEntriesTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [isOpen, setIsOpen] = useState(true);
  
  // Edit state
  const [editingEntry, setEditingEntry] = useState<NRESHoursEntry | null>(null);
  const [editWorkDate, setEditWorkDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editActivityType, setEditActivityType] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editClaimantType, setEditClaimantType] = useState<string>('personal');
  const [editClaimantName, setEditClaimantName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getEntryRate = (entry: NRESHoursEntry): number | null => {
    const claimantRate = getClaimantRate(entry.claimant_type);
    return claimantRate ?? hourlyRate;
  };

  const sortedEntries = useMemo(() => {
    if (!sortField || !sortDirection) {
      return entries;
    }

    return [...entries].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = parseISO(a.work_date).getTime() - parseISO(b.work_date).getTime();
          break;
        case 'duration':
          comparison = Number(a.duration_hours) - Number(b.duration_hours);
          break;
        case 'amount':
          const rateA = getEntryRate(a) ?? 0;
          const rateB = getEntryRate(b) ?? 0;
          const amountA = Number(a.duration_hours) * rateA;
          const amountB = Number(b.duration_hours) * rateB;
          comparison = amountA - amountB;
          break;
        case 'claimant':
          const nameA = a.claimant_name || '';
          const nameB = b.claimant_name || '';
          comparison = nameA.localeCompare(nameB);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [entries, sortField, sortDirection, hourlyRate]);


  const openEditDialog = (entry: NRESHoursEntry) => {
    setEditingEntry(entry);
    setEditWorkDate(entry.work_date);
    setEditStartTime(entry.start_time.substring(0, 5));
    setEditEndTime(entry.end_time.substring(0, 5));
    setEditActivityType(entry.activity_type);
    setEditDescription(entry.description || '');
    setEditClaimantType(entry.claimant_type || 'personal');
    setEditClaimantName(entry.claimant_name || '');
  };

  const closeEditDialog = () => {
    setEditingEntry(null);
    setEditWorkDate('');
    setEditStartTime('');
    setEditEndTime('');
    setEditActivityType('');
    setEditDescription('');
    setEditClaimantType('personal');
    setEditClaimantName('');
  };

  const calculateDuration = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !editActivityType) return;

    const duration = calculateDuration(editStartTime, editEndTime);
    if (duration <= 0) return;

    const claimantType = editClaimantType === 'personal' ? null : editClaimantType as 'gp' | 'pm';

    setSaving(true);
    await onUpdate(editingEntry.id, {
      work_date: editWorkDate,
      start_time: editStartTime,
      end_time: editEndTime,
      duration_hours: duration,
      activity_type: editActivityType,
      description: editDescription || null,
      claimant_type: claimantType,
      claimant_name: editClaimantName || null
    });
    setSaving(false);
    closeEditDialog();
  };

  const editDuration = calculateDuration(editStartTime, editEndTime);

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const getClaimantLabel = (entry: NRESHoursEntry): string => {
    if (entry.claimant_type === 'gp') return 'GP';
    if (entry.claimant_type === 'pm') return 'PM';
    return 'Personal';
  };

  const getClaimantBadgeVariant = (entry: NRESHoursEntry): 'default' | 'secondary' | 'outline' => {
    if (entry.claimant_type === 'gp') return 'default';
    if (entry.claimant_type === 'pm') return 'secondary';
    return 'outline';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3 h-3 ml-1" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No hours logged yet. Add your first entry above.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Hours Entries
                  <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
                </CardTitle>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 -ml-2 font-medium hover:bg-transparent"
                          onClick={() => handleSort('date')}
                        >
                          Date
                          <SortIcon field="date" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 -ml-2 font-medium hover:bg-transparent"
                          onClick={() => handleSort('claimant')}
                        >
                          Claimant
                          <SortIcon field="claimant" />
                        </Button>
                      </TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 -ml-2 font-medium hover:bg-transparent"
                          onClick={() => handleSort('duration')}
                        >
                          Duration
                          <SortIcon field="duration" />
                        </Button>
                      </TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 -mr-2 font-medium hover:bg-transparent"
                          onClick={() => handleSort('amount')}
                        >
                          Amount
                          <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEntries.map((entry) => {
                      const rate = getEntryRate(entry);
                      const amount = rate ? Number(entry.duration_hours) * rate : null;
                      
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {format(new Date(entry.work_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={getClaimantBadgeVariant(entry)} className="w-fit text-xs">
                                {getClaimantLabel(entry)}
                              </Badge>
                              {entry.claimant_name && (
                                <span className="text-xs text-muted-foreground">{entry.claimant_name}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {Number(entry.duration_hours).toFixed(2)} hrs
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.activity_type}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {entry.description || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {amount ? `£${amount.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(entry)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hours Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Claimant Selection */}
            <div className="p-3 bg-muted/50 rounded-lg border">
              <Label className="text-xs font-medium mb-2 block">Claim For</Label>
              <Select
                value={
                  editClaimantType === 'personal' || !editClaimantType
                    ? 'personal'
                    : claimants.find(c => c.name === editClaimantName && c.role === editClaimantType)?.id || editClaimantType
                }
                onValueChange={(value) => {
                  if (value === 'personal') {
                    setEditClaimantType('personal');
                    setEditClaimantName('');
                  } else {
                    const claimant = claimants.find(c => c.id === value);
                    if (claimant) {
                      setEditClaimantType(claimant.role);
                      setEditClaimantName(claimant.name);
                    } else if (value === 'gp' || value === 'pm') {
                      setEditClaimantType(value);
                      setEditClaimantName('');
                    }
                  }
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select who this claim is for..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Rate (Your own hours)</SelectItem>
                  
                  {claimants.filter(c => c.role === 'gp' && c.is_active).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                        GPs (£100/hr)
                      </div>
                      {claimants.filter(c => c.role === 'gp' && c.is_active).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {claimants.filter(c => c.role === 'pm' && c.is_active).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                        Practice Managers (£50/hr)
                      </div>
                      {claimants.filter(c => c.role === 'pm' && c.is_active).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-date" className="text-xs">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editWorkDate}
                  onChange={(e) => setEditWorkDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Duration</Label>
                <div className="mt-1 h-10 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                  {editDuration.toFixed(2)} hours
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start" className="text-xs">Start Time</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-end" className="text-xs">End Time</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-activity" className="text-xs">Activity Type</Label>
              <Select value={editActivityType} onValueChange={setEditActivityType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select activity..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-description" className="text-xs">Description</Label>
              <Input
                id="edit-description"
                placeholder="Brief notes about the work..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={saving || !editActivityType || editDuration <= 0}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}