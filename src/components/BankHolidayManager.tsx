import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, AlertTriangle, CheckCircle, Plus, Clock, MapPin } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BankHoliday {
  id: string;
  date: string;
  name: string;
  type: string;
  is_replacement_required: boolean;
  hours_to_replace: number;
  replacement_deadline: string;
  replacement_completed: boolean;
  notes?: string;
}

interface ReplacementShift {
  id: string;
  bank_holiday_id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  location: string;
  required_role: string;
  status: string;
  assigned_to?: string;
  staff_member?: {
    name: string;
    role: string;
  };
}

export const BankHolidayManager = () => {
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);
  const [replacementShifts, setReplacementShifts] = useState<ReplacementShift[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReplacementDialogOpen, setIsReplacementDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<BankHoliday | null>(null);
  const [selectedReplacementDate, setSelectedReplacementDate] = useState<Date>();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    type: 'closed_day',
    notes: ''
  });

  useEffect(() => {
    fetchBankHolidays();
    fetchReplacementShifts();
  }, []);

  const fetchBankHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_holidays_closed_days')
        .select('*')
        .order('date');

      if (error) throw error;
      setBankHolidays(data || []);
    } catch (error) {
      console.error('Error fetching bank holidays:', error);
      toast.error('Failed to fetch bank holidays');
    }
  };

  const fetchReplacementShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('replacement_shifts')
        .select(`
          *,
          staff_member:staff_members(name, role)
        `)
        .order('assignment_date');

      if (error) throw error;
      setReplacementShifts(data || []);
    } catch (error) {
      console.error('Error fetching replacement shifts:', error);
    }
  };

  const addCustomHoliday = async () => {
    if (!selectedDate || !newHoliday.name) {
      toast.error('Please select a date and enter a name');
      return;
    }

    try {
      const dayOfWeek = selectedDate.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday
      const isSaturday = dayOfWeek === 6;
      
      let hoursToReplace = 0;
      let replacementRequired = false;
      
      if (isWeekday) {
        hoursToReplace = 2; // Updated to 2 hours for weekdays
        replacementRequired = true;
      } else if (isSaturday) {
        hoursToReplace = 8;
        replacementRequired = true;
      }

      const { error } = await supabase
        .from('bank_holidays_closed_days')
        .insert({
          date: format(selectedDate, 'yyyy-MM-dd'),
          name: newHoliday.name,
          type: newHoliday.type,
          is_replacement_required: replacementRequired,
          hours_to_replace: hoursToReplace,
          replacement_deadline: replacementRequired ? format(addDays(selectedDate, 14), 'yyyy-MM-dd') : null,
          notes: newHoliday.notes || null
        });

      if (error) throw error;

      toast.success('Holiday/Closed day added successfully');
      setIsAddDialogOpen(false);
      setSelectedDate(undefined);
      setNewHoliday({ name: '', type: 'closed_day', notes: '' });
      fetchBankHolidays();
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const openReplacementDialog = (holiday: BankHoliday) => {
    setSelectedHoliday(holiday);
    setSelectedReplacementDate(undefined);
    setIsReplacementDialogOpen(true);
  };

  const createReplacementShift = async () => {
    if (!selectedHoliday || !selectedReplacementDate) {
      toast.error('Please select a date for the replacement shift');
      return;
    }

    try {
      // Create the replacement shift
      const { error: shiftError } = await supabase
        .from('replacement_shifts')
        .insert({
          bank_holiday_id: selectedHoliday.id,
          assignment_date: format(selectedReplacementDate, 'yyyy-MM-dd'),
          start_time: '18:30',
          end_time: selectedHoliday.hours_to_replace === 8 ? '02:30' : '20:30',
          hours: selectedHoliday.hours_to_replace,
          location: 'kings_heath',
          required_role: 'doctor',
          status: 'scheduled'
        });

      if (shiftError) throw shiftError;

      // Mark the bank holiday as replacement completed
      const { error: holidayError } = await supabase
        .from('bank_holidays_closed_days')
        .update({ replacement_completed: true })
        .eq('id', selectedHoliday.id);

      if (holidayError) throw holidayError;

      toast.success(`Replacement shift created for ${format(selectedReplacementDate, "EEEE, do MMMM yyyy")}`);
      setIsReplacementDialogOpen(false);
      setSelectedHoliday(null);
      setSelectedReplacementDate(undefined);
      fetchBankHolidays();
      fetchReplacementShifts();
    } catch (error) {
      console.error('Error creating replacement shift:', error);
      toast.error('Failed to create replacement shift');
    }
  };

  const getStatusBadge = (holiday: BankHoliday) => {
    if (!holiday.is_replacement_required) {
      return <Badge variant="secondary">No replacement needed</Badge>;
    }
    
    if (holiday.replacement_completed) {
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Completed</Badge>;
    }

    const deadline = new Date(holiday.replacement_deadline);
    const now = new Date();
    const isOverdue = deadline < now;

    return (
      <Badge variant={isOverdue ? "destructive" : "secondary"}>
        {isOverdue ? "Overdue" : "Pending"}
      </Badge>
    );
  };

  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  const upcomingHolidays = bankHolidays.filter(h => 
    new Date(h.date) >= new Date() && 
    new Date(h.date) <= sixMonthsFromNow
  ).slice(0, 5);
  const pendingReplacements = bankHolidays.filter(h => 
    h.is_replacement_required && 
    !h.replacement_completed && 
    new Date(h.date) >= new Date() && 
    new Date(h.date) <= sixMonthsFromNow
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming Holidays</p>
                <p className="text-2xl font-bold">{upcomingHolidays.length}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Replacements</p>
                <p className="text-2xl font-bold text-orange-600">{pendingReplacements.length}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Hours to Replace</p>
                <p className="text-2xl font-bold text-blue-600">
                  {pendingReplacements.reduce((sum, h) => sum + (h.hours_to_replace || 0), 0)}h
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Bank Holidays */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Upcoming Bank Holidays & Closed Days
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Day
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Closed Day</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                    placeholder="e.g., Practice Training Day"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newHoliday.type} onValueChange={(value) => setNewHoliday({ ...newHoliday, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="closed_day">Closed Day</SelectItem>
                      <SelectItem value="bank_holiday">Bank Holiday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={newHoliday.notes}
                    onChange={(e) => setNewHoliday({ ...newHoliday, notes: e.target.value })}
                    placeholder="Additional information..."
                  />
                </div>

                <Button onClick={addCustomHoliday} className="w-full">
                  Add Closed Day
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingHolidays.map((holiday) => (
              <div key={holiday.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(holiday.date), "EEEE, do MMMM yyyy")}
                      </p>
                    </div>
                  </div>
                  {holiday.is_replacement_required && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Requires {holiday.hours_to_replace}h replacement by {format(new Date(holiday.replacement_deadline), "do MMM")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(holiday)}
                  {holiday.is_replacement_required && !holiday.replacement_completed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReplacementDialog(holiday)}
                    >
                      Create Replacement
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Replacement Dialog */}
      <Dialog open={isReplacementDialogOpen} onOpenChange={setIsReplacementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Replacement Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedHoliday && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium">Creating replacement for:</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{selectedHoliday.name}</strong> - {format(new Date(selectedHoliday.date), "EEEE, do MMMM yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Requires {selectedHoliday.hours_to_replace} hours replacement
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Select Replacement Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedReplacementDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedReplacementDate ? format(selectedReplacementDate, "PPP") : "Pick a date for replacement shift"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedReplacementDate}
                    onSelect={setSelectedReplacementDate}
                    disabled={(date) => date < new Date()}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsReplacementDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={createReplacementShift} className="flex-1">
                Create Replacement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Replacement Shifts */}
      {replacementShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Replacement Shifts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {replacementShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">
                          {format(new Date(shift.assignment_date), "EEEE, do MMMM yyyy")}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {shift.start_time} - {shift.end_time} ({shift.hours}h)
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {shift.location.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={shift.status === 'assigned' ? 'default' : 'secondary'}>
                      {shift.status}
                    </Badge>
                    {shift.staff_member && (
                      <span className="text-sm font-medium">
                        {shift.staff_member.role === 'doctor' ? 'Dr ' : ''}{shift.staff_member.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};