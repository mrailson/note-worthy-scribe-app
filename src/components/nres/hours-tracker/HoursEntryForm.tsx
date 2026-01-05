import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus } from 'lucide-react';
import { ACTIVITY_TYPES } from '@/types/nresHoursTypes';
import { format } from 'date-fns';

interface HoursEntryFormProps {
  saving: boolean;
  onSubmit: (entry: {
    work_date: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    activity_type: string;
    description: string | null;
  }) => Promise<any>;
}

export function HoursEntryForm({ saving, onSubmit }: HoursEntryFormProps) {
  const [workDate, setWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [activityType, setActivityType] = useState<string>('');
  const [description, setDescription] = useState('');

  const calculateDuration = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  };

  const duration = calculateDuration(startTime, endTime);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityType || duration <= 0) return;

    const result = await onSubmit({
      work_date: workDate,
      start_time: startTime,
      end_time: endTime,
      duration_hours: duration,
      activity_type: activityType,
      description: description || null
    });

    if (result) {
      // Reset form but keep date and times for quick re-entry
      setActivityType('');
      setDescription('');
    }
  };

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
              <Label className="text-xs">Duration</Label>
              <div className="mt-1 h-10 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                {duration.toFixed(2)} hours
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
