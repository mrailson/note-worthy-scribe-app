import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Plus, ChevronRight, Check, Minus, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { useMeetings } from '@/hooks/useMeetings';
import type { BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';

/** Format a number as £X,XXX.XX */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MEETING_TYPES = [
  { value: 'pcn_board', label: 'PCN Board', colour: 'bg-blue-800 text-white' },
  { value: 'hub_clinical', label: 'Hub Clinical', colour: 'bg-green-600 text-white' },
  { value: 'neighbourhood', label: 'Neighbourhood', colour: 'bg-purple-600 text-white' },
  { value: 'education', label: 'Education', colour: 'bg-amber-500 text-white' },
  { value: 'other', label: 'Other', colour: 'bg-gray-500 text-white' },
];

function meetingTypeBadge(type: string) {
  const cfg = MEETING_TYPES.find(t => t.value === type) || MEETING_TYPES[4];
  return <Badge className={cn(cfg.colour, 'text-[10px]')}>{cfg.label}</Badge>;
}

interface MeetingScheduleSectionProps {
  neighbourhoodName: 'NRES' | 'ENN';
  practiceKey: string;
  claimMonth: string;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
  meetingStaff: BuyBackStaffMember[];
  meetingGpRate: number;
  meetingPmRate: number;
}

export function MeetingScheduleSection({
  neighbourhoodName,
  practiceKey,
  claimMonth,
  practiceKeys,
  practiceNames,
  meetingStaff,
  meetingGpRate,
  meetingPmRate,
}: MeetingScheduleSectionProps) {
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const effectivePractice = practiceKey && practiceKey !== 'all' ? practiceKey : null;

  const { meetings, attendance, loading, addMeeting, toggleAttendance, markAllPresent, deleteMeeting } = useMeetings(
    neighbourhoodName,
    effectivePractice,
    claimMonth,
  );

  // Staff filtered to meeting category for this practice
  const staffForPractice = meetingStaff.filter(s =>
    !effectivePractice || s.practice_key === effectivePractice
  );

  const getAttendanceSummary = (meetingId: string) => {
    const meetingAtt = attendance.filter(a => a.meeting_id === meetingId);
    const attended = meetingAtt.filter(a => a.attended).length;
    const total = staffForPractice.length;
    return { attended, total };
  };

  const isAttended = (meetingId: string, staffId: string) => {
    return attendance.some(a => a.meeting_id === meetingId && a.staff_id === staffId && a.attended);
  };

  const getStaffTotalHours = (staffId: string) => {
    return meetings.reduce((sum, m) => {
      if (isAttended(m.id, staffId)) return sum + m.duration_hours;
      return sum;
    }, 0);
  };

  const getStaffRate = (staff: BuyBackStaffMember) => {
    if ((staff.hourly_rate || 0) > 0) return staff.hourly_rate;
    return /gp/i.test(staff.staff_role) ? meetingGpRate : meetingPmRate;
  };

  const totalMeetingHours = staffForPractice.reduce((sum, s) => sum + getStaffTotalHours(s.id), 0);
  const totalClaimable = staffForPractice.reduce((sum, s) => {
    const hours = getStaffTotalHours(s.id);
    return sum + hours * getStaffRate(s);
  }, 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left">
              <ChevronRight className={cn("w-4 h-4 transition-transform", open && "rotate-90")} />
              <CardTitle className="text-lg flex items-center gap-2">
                🤝 Meeting Schedule & Attendance
              </CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</Badge>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="schedule">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
                  <TabsTrigger value="register" className="text-xs">Attendance Register</TabsTrigger>
                </TabsList>

                {/* Schedule Sub-Tab */}
                <TabsContent value="schedule" className="space-y-3 mt-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Meetings for {format(new Date(`${claimMonth}-01`), 'MMMM yyyy')}
                      {effectivePractice && ` — ${practiceNames[effectivePractice] || effectivePractice}`}
                    </p>
                    <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1">
                      <Plus className="w-3 h-3" /> Add Meeting
                    </Button>
                  </div>

                  {meetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No meetings scheduled for this month.</p>
                  ) : (
                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium text-xs">Type</th>
                            <th className="text-left p-2 font-medium text-xs">Title</th>
                            <th className="text-left p-2 font-medium text-xs">Date</th>
                            <th className="text-left p-2 font-medium text-xs">Time</th>
                            <th className="text-left p-2 font-medium text-xs">Duration</th>
                            <th className="text-left p-2 font-medium text-xs">Practice</th>
                            <th className="text-left p-2 font-medium text-xs">Attendance</th>
                            <th className="p-2 w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {meetings.map(m => {
                            const summary = getAttendanceSummary(m.id);
                            const isPast = new Date(m.meeting_date) <= new Date();
                            return (
                              <tr key={m.id} className="border-t">
                                <td className="p-2">{meetingTypeBadge(m.meeting_type)}</td>
                                <td className="p-2 text-xs">{m.title || '—'}</td>
                                <td className="p-2 text-xs">{format(new Date(m.meeting_date), 'dd/MM/yyyy')}</td>
                                <td className="p-2 text-xs">{m.start_time ? m.start_time.slice(0, 5) : '—'}</td>
                                <td className="p-2 text-xs">{m.duration_hours}h</td>
                                <td className="p-2 text-xs">{practiceNames[m.practice_key] || m.practice_key}</td>
                                <td className="p-2 text-xs">
                                  {isPast ? (
                                    <span className={cn(
                                      "font-medium",
                                      summary.attended === summary.total ? "text-green-600" : "text-amber-600"
                                    )}>
                                      {summary.attended} / {summary.total} attended
                                    </span>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMeeting(m.id)}>
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* Attendance Register Sub-Tab */}
                <TabsContent value="register" className="space-y-3 mt-3">
                  {staffForPractice.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No meeting staff registered for this practice. Add staff with the "Meeting Attendance" category first.
                    </p>
                  ) : meetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No meetings scheduled. Add meetings in the Schedule tab first.
                    </p>
                  ) : (
                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10">Staff Member</th>
                            <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10">Role</th>
                            {meetings.map(m => (
                              <th key={m.id} className="p-2 font-medium text-center min-w-[80px]">
                                <div className="space-y-0.5">
                                  {meetingTypeBadge(m.meeting_type)}
                                  <div className="text-[10px] text-muted-foreground">{format(new Date(m.meeting_date), 'dd/MM')}</div>
                                  <div className="text-[10px] text-muted-foreground">{m.duration_hours}h</div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 text-[9px] px-1 mt-0.5"
                                    onClick={() => markAllPresent(m.id, staffForPractice.map(s => s.id))}
                                  >
                                    Mark all
                                  </Button>
                                </div>
                              </th>
                            ))}
                            <th className="p-2 font-medium text-right">Total Hours</th>
                            <th className="p-2 font-medium text-right">Claimable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffForPractice.map(s => {
                            const totalHours = getStaffTotalHours(s.id);
                            const rate = getStaffRate(s);
                            const claimable = totalHours * rate;
                            return (
                              <tr key={s.id} className="border-t">
                                <td className="p-2 font-medium sticky left-0 bg-background z-10">{s.staff_name}</td>
                                <td className="p-2 sticky left-0 bg-background z-10">{s.staff_role}</td>
                                {meetings.map(m => {
                                  const att = isAttended(m.id, s.id);
                                  const isPast = new Date(m.meeting_date) <= new Date();
                                  return (
                                    <td key={m.id} className="p-2 text-center">
                                      {isPast ? (
                                        <Button
                                          size="icon"
                                          variant={att ? "default" : "outline"}
                                          className={cn(
                                            "h-7 w-7",
                                            att ? "bg-green-600 hover:bg-green-700 text-white" : "text-muted-foreground"
                                          )}
                                          onClick={() => toggleAttendance(m.id, s.id)}
                                        >
                                          {att ? <Check className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                        </Button>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="p-2 text-right font-medium">{totalHours.toFixed(1)}h</td>
                                <td className="p-2 text-right font-medium">{fmtGBP(claimable)}</td>
                              </tr>
                            );
                          })}
                          {/* Totals row */}
                          <tr className="border-t bg-muted/30 font-semibold">
                            <td colSpan={2 + meetings.length} className="p-2 text-right">Totals</td>
                            <td className="p-2 text-right">{totalMeetingHours.toFixed(1)}h</td>
                            <td className="p-2 text-right">{fmtGBP(totalClaimable)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Add Meeting Dialog */}
      <AddMeetingDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        practiceKeys={practiceKeys}
        practiceNames={practiceNames}
        defaultPractice={effectivePractice || ''}
        claimMonth={claimMonth}
        onAdd={addMeeting}
      />
    </Collapsible>
  );
}

function AddMeetingDialog({
  open,
  onOpenChange,
  practiceKeys,
  practiceNames,
  defaultPractice,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
  defaultPractice: string;
  claimMonth: string;
  onAdd: (meeting: any) => Promise<any>;
}) {
  const [meetingType, setMeetingType] = useState('pcn_board');
  const [title, setTitle] = useState('');
  const [practice, setPractice] = useState(defaultPractice);
  const [meetingDate, setMeetingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!practice || !meetingDate || !durationHours) return;
    setSaving(true);
    const result = await onAdd({
      practice_key: practice,
      meeting_type: meetingType,
      title: title || undefined,
      meeting_date: meetingDate,
      start_time: startTime || undefined,
      duration_hours: parseFloat(durationHours),
      is_recurring: isRecurring,
    });
    setSaving(false);
    if (result) {
      onOpenChange(false);
      setTitle('');
      setMeetingDate('');
      setStartTime('');
      setDurationHours('1');
      setIsRecurring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" /> Add Meeting
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Meeting Type</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Title (optional)</Label>
            <Input className="h-9" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly PCN Board" />
          </div>
          <div>
            <Label className="text-xs">Practice</Label>
            <Select value={practice} onValueChange={setPractice}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select practice" /></SelectTrigger>
              <SelectContent>
                {practiceKeys.map(k => (
                  <SelectItem key={k} value={k}>{practiceNames[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" className="h-9" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input type="time" className="h-9" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Duration (hours)</Label>
              <Input type="number" className="h-9" value={durationHours} onChange={e => setDurationHours(e.target.value)} min="0.5" max="8" step="0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={isRecurring} onCheckedChange={(c) => setIsRecurring(!!c)} />
            <Label className="text-xs">Recurring monthly</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !practice || !meetingDate || !durationHours}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
