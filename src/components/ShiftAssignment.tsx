import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek } from "date-fns";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: 'remote' | 'kings_heath' | 'various_practices';
  required_role: string;
}

interface StaffAssignment {
  id: string;
  shift_template_id: string;
  staff_member_id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  staff_member: {
    name: string;
    role: string;
  };
  shift_template: {
    name: string;
    required_role: string;
  };
}

interface ShiftAssignmentProps {
  currentWeek: Date;
  onAssignmentChange: () => void;
}

export const ShiftAssignment = ({ currentWeek, onAssignmentChange }: ShiftAssignmentProps) => {
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftTemplate | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetchShiftTemplates();
    fetchStaffMembers();
    fetchAssignments();
  }, [currentWeek]);

  const fetchShiftTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week');

      if (error) throw error;
      setShiftTemplates(data || []);
    } catch (error) {
      console.error('Error fetching shift templates:', error);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, name, role')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error fetching staff members:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('staff_assignments')
        .select(`
          *,
          staff_member:staff_members(name, role),
          shift_template:shift_templates(name, required_role)
        `)
        .gte('assignment_date', startDate)
        .lte('assignment_date', endDate);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const handleAssignStaff = async () => {
    if (!selectedShift || !selectedDate || !selectedStaff) {
      toast.error('Please select all required fields');
      return;
    }

    try {
      const assignmentData = {
        shift_template_id: selectedShift.id,
        staff_member_id: selectedStaff,
        assignment_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedShift.start_time,
        end_time: selectedShift.end_time,
        location: selectedShift.location,
        status: 'scheduled',
      };

      const { error } = await supabase
        .from('staff_assignments')
        .upsert([assignmentData], {
          onConflict: 'shift_template_id,assignment_date'
        });

      if (error) throw error;

      toast.success('Staff assigned successfully');
      setIsAssignDialogOpen(false);
      setSelectedShift(null);
      setSelectedDate(null);
      setSelectedStaff('');
      fetchAssignments();
      onAssignmentChange();
    } catch (error) {
      toast.error('Failed to assign staff');
      console.error('Error:', error);
    }
  };

  const getAssignmentForDay = (day: Date, shiftTemplate: ShiftTemplate) => {
    return assignments.find(a => 
      a.shift_template_id === shiftTemplate.id && 
      a.assignment_date === format(day, 'yyyy-MM-dd')
    );
  };

  const getShiftsForDay = (dayOfWeek: number) => {
    return shiftTemplates.filter(st => st.day_of_week === dayOfWeek);
  };

  const openAssignDialog = (shift: ShiftTemplate, date: Date) => {
    setSelectedShift(shift);
    setSelectedDate(date);
    setSelectedStaff('');
    setIsAssignDialogOpen(true);
  };

  const getLocationDisplay = (location: string) => {
    const locationMap = {
      remote: 'Remote',
      kings_heath: 'Kings Heath',
      various_practices: 'Various Practices'
    };
    return locationMap[location as keyof typeof locationMap] || location;
  };

  const getEligibleStaff = (requiredRole: string) => {
    return staffMembers.filter(staff => staff.role === requiredRole);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Shift Assignments - Week of {format(weekStart, "MMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map((day, index) => {
              const dayOfWeek = index + 1; // 1=Monday, 2=Tuesday, etc.
              const shifts = getShiftsForDay(dayOfWeek);
              const isSunday = index === 6;
              
              if (isSunday) {
                return (
                  <div key={day.toISOString()} className="p-4 border border-border/50 rounded-lg bg-muted/30">
                    <div className="text-center">
                      <h3 className="font-medium text-muted-foreground">{format(day, "EEE")}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{format(day, "MMM d")}</p>
                      <p className="text-xs text-muted-foreground mt-2">No service</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={day.toISOString()} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="text-center">
                    <h3 className="font-medium">{format(day, "EEE")}</h3>
                    <p className="text-xs text-muted-foreground">{format(day, "MMM d")}</p>
                  </div>
                  
                  {shifts.map((shift) => {
                    const assignment = getAssignmentForDay(day, shift);
                    const isAssigned = !!assignment;
                    
                    return (
                      <div 
                        key={shift.id}
                        className={`p-2 rounded border text-xs space-y-1 ${
                          isAssigned 
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        }`}
                      >
                        <div className="font-medium">{shift.name}</div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shift.start_time} - {shift.end_time}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getLocationDisplay(shift.location)}
                        </div>
                        
                        {isAssigned ? (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="text-xs">
                              {assignment.staff_member.name}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {assignment.staff_member.role}
                            </div>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full text-xs h-6"
                            onClick={() => openAssignDialog(shift, day)}
                          >
                            Assign {shift.required_role.toUpperCase()}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Staff to Shift</DialogTitle>
          </DialogHeader>
          {selectedShift && selectedDate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">{selectedShift.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "EEEE, MMM d, yyyy")} • {selectedShift.start_time} - {selectedShift.end_time}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getLocationDisplay(selectedShift.location)}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Select {selectedShift.required_role.toUpperCase()}</label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getEligibleStaff(selectedShift.required_role).map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignStaff}>
                  Assign Staff
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};