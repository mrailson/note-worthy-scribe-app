import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus, User } from 'lucide-react';
import { ACTIVITY_TYPES, CLAIMANT_TYPES } from '@/types/nresHoursTypes';
import { format } from 'date-fns';
import { NRESClaimant } from '@/hooks/useNRESClaimants';

interface HoursEntryFormProps {
  saving: boolean;
  claimants: NRESClaimant[];
  onSubmit: (entry: {
    work_date: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    activity_type: string;
    description: string | null;
    claimant_type: 'gp' | 'pm' | null;
    claimant_name: string | null;
  }) => Promise<any>;
}

export function HoursEntryForm({ saving, claimants, onSubmit }: HoursEntryFormProps) {
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [activityType, setActivityType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [claimantSelection, setClaimantSelection] = useState<string>('personal');

  const calculateDuration = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  };

  const duration = calculateDuration(startTime, endTime);

  // Get display info based on selection
  const getSelectionInfo = () => {
    if (claimantSelection === 'personal') {
      return { rate: null, name: null, type: null };
    }
    
    // Check if it's a managed claimant (UUID format)
    const managedClaimant = claimants.find(c => c.id === claimantSelection);
    if (managedClaimant) {
      return {
        rate: managedClaimant.role === 'gp' ? 100 : 50,
        name: managedClaimant.name,
        type: managedClaimant.role as 'gp' | 'pm'
      };
    }

    // Legacy type selection (gp or pm without name)
    if (claimantSelection === 'gp') {
      return { rate: 100, name: null, type: 'gp' as const };
    }
    if (claimantSelection === 'pm') {
      return { rate: 50, name: null, type: 'pm' as const };
    }

    return { rate: null, name: null, type: null };
  };

  const selectionInfo = getSelectionInfo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityType || duration <= 0) return;

    const result = await onSubmit({
      work_date: workDate,
      start_time: startTime,
      end_time: endTime,
      duration_hours: duration,
      activity_type: activityType,
      description: description || null,
      claimant_type: selectionInfo.type,
      claimant_name: selectionInfo.name
    });

    if (result) {
      // Reset form but keep date, times, and claimant for batch entries
      setActivityType('');
      setDescription('');
    }
  };

  // Group claimants by role
  const gpClaimants = claimants.filter(c => c.role === 'gp' && c.is_active);
  const pmClaimants = claimants.filter(c => c.role === 'pm' && c.is_active);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Log Hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Claimant Selection */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <Label className="text-xs font-medium flex items-center gap-1 mb-2">
              <User className="w-3 h-3" />
              Claim For
            </Label>
            <Select value={claimantSelection} onValueChange={setClaimantSelection}>
              <SelectTrigger>
                <SelectValue placeholder="Select who this claim is for...">
                  {claimantSelection === 'personal' && 'Personal Rate (Your own hours)'}
                  {claimantSelection === 'gp' && 'GP (£100/hr) - Unnamed'}
                  {claimantSelection === 'pm' && 'Practice Manager (£50/hr) - Unnamed'}
                  {claimants.find(c => c.id === claimantSelection) && (
                    <>
                      {claimants.find(c => c.id === claimantSelection)?.role === 'gp' ? 'GP' : 'PM'} (£{claimants.find(c => c.id === claimantSelection)?.role === 'gp' ? '100' : '50'}/hr) - {claimants.find(c => c.id === claimantSelection)?.name}
                    </>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <span className="flex items-center gap-2">
                    Personal Rate (Your own hours)
                  </span>
                </SelectItem>
                
                {gpClaimants.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      GPs (£100/hr)
                    </div>
                    {gpClaimants.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {pmClaimants.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      Practice Managers (£50/hr)
                    </div>
                    {pmClaimants.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </>
                )}

                {claimants.length === 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                      Quick Add (no saved claimant)
                    </div>
                    <SelectItem value="gp">GP (£100/hr) - Unnamed</SelectItem>
                    <SelectItem value="pm">Practice Manager (£50/hr) - Unnamed</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            
            {selectionInfo.rate && (
              <p className="text-xs text-muted-foreground mt-2">
                Rate: £{selectionInfo.rate}/hr
                {selectionInfo.name && ` • ${selectionInfo.name}`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="work-date" className="text-xs">Date</Label>
              <Input
                id="work-date"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="start-time" className="text-xs">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="end-time" className="text-xs">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Duration / Amount</Label>
              <div className="mt-1 h-10 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                {duration.toFixed(2)} hrs
                {selectionInfo.rate && (
                  <span className="ml-2 text-muted-foreground">= £{(duration * selectionInfo.rate).toFixed(2)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="activity-type" className="text-xs">Activity Type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
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
              <Label htmlFor="description" className="text-xs">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Brief notes about the work..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={saving || !activityType || duration <= 0}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
