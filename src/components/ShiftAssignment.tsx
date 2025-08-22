import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, MapPin, Clock, UserPlus, Activity, Droplets, UserCheck, Plus, MoreVertical, UserX, RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";

const formatDateWithOrdinal = (date: Date) => {
  const day = date.getDate();
  const ordinal = day <= 0 ? day : day < 20 ? ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][day % 10] || "th" : ["th", "st", "nd", "rd"][day % 10] || "th";
  return `${format(date, "EEEE")}, ${day}${ordinal} ${format(date, "MMMM yyyy")}`;
};

const formatShortDateWithOrdinal = (date: Date) => {
  const day = date.getDate();
  const ordinal = day <= 0 ? day : day < 20 ? ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][day % 10] || "th" : ["th", "st", "nd", "rd"][day % 10] || "th";
  return `${day}${ordinal} ${format(date, "MMM")}`;
};

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
  isMonthlyView?: boolean;
  isDetailedView?: boolean;
}

export const ShiftAssignment = ({ currentWeek, onAssignmentChange, isMonthlyView = false, isDetailedView = false }: ShiftAssignmentProps) => {
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [selectedShift, setSelectedShift] = useState<ShiftTemplate | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false);
  const [assignmentToSwap, setAssignmentToSwap] = useState<StaffAssignment | null>(null);
  const [isCopyingPreviousWeek, setIsCopyingPreviousWeek] = useState(false);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentWeek);
  const monthEnd = endOfMonth(currentWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetchShiftTemplates();
    fetchStaffMembers();
    fetchAssignments();
    fetchBankHolidays();
  }, [currentWeek, isMonthlyView]);

  const fetchBankHolidays = async () => {
    try {
      const startDate = isMonthlyView ? format(monthStart, 'yyyy-MM-dd') : format(weekStart, 'yyyy-MM-dd');
      const endDate = isMonthlyView ? format(monthEnd, 'yyyy-MM-dd') : format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('bank_holidays_closed_days')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      
      const holidayDates = new Set(data?.map(h => h.date) || []);
      setBankHolidays(holidayDates);
    } catch (error) {
      console.error('Error fetching bank holidays:', error);
    }
  };

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
      const startDate = isMonthlyView ? format(monthStart, 'yyyy-MM-dd') : format(weekStart, 'yyyy-MM-dd');
      const endDate = isMonthlyView ? format(monthEnd, 'yyyy-MM-dd') : format(addDays(weekStart, 6), 'yyyy-MM-dd');

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
        .insert([assignmentData]);

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

  const handleRemoveStaff = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('staff_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Staff member removed from shift');
      fetchAssignments();
      onAssignmentChange();
    } catch (error) {
      toast.error('Failed to remove staff member');
      console.error('Error:', error);
    }
  };

  const handleCancelShift = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('staff_assignments')
        .update({ status: 'cancelled_late_notice' })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Shift marked as cancelled with late notice');
      fetchAssignments();
      onAssignmentChange();
    } catch (error) {
      toast.error('Failed to update shift status');
      console.error('Error:', error);
    }
  };

  const handleSwapStaff = async () => {
    if (!assignmentToSwap || !selectedStaff) {
      toast.error('Please select a staff member to swap with');
      return;
    }

    try {
      const { error } = await supabase
        .from('staff_assignments')
        .update({ staff_member_id: selectedStaff })
        .eq('id', assignmentToSwap.id);

      if (error) throw error;

      toast.success('Staff member swapped successfully');
      setIsSwapDialogOpen(false);
      setAssignmentToSwap(null);
      setSelectedStaff('');
      fetchAssignments();
      onAssignmentChange();
    } catch (error) {
      toast.error('Failed to swap staff member');
      console.error('Error:', error);
    }
  };

  const openSwapDialog = (assignment: StaffAssignment) => {
    setAssignmentToSwap(assignment);
    setSelectedStaff('');
    setIsSwapDialogOpen(true);
  };

  const getAssignmentsForDay = (day: Date, shiftTemplate: ShiftTemplate) => {
    return assignments.filter(a => 
      a.shift_template_id === shiftTemplate.id && 
      a.assignment_date === format(day, 'yyyy-MM-dd')
    );
  };

  const getAvailableStaff = (requiredRole: string, day: Date, shiftTemplate: ShiftTemplate) => {
    const assignedStaffIds = getAssignmentsForDay(day, shiftTemplate).map(a => a.staff_member_id);
    return staffMembers.filter(staff => 
      staff.role === requiredRole && 
      !assignedStaffIds.includes(staff.id)
    );
  };

  const getShiftsForDay = (dayOfWeek: number) => {
    return shiftTemplates.filter(st => st.day_of_week === dayOfWeek);
  };

  // Check if Enhanced Access requirements are met for a specific day
  const isEnhancedAccessRequirementMet = (day: Date, shifts: any[]) => {
    const dayOfWeek = getDay(day);
    const isSaturday = dayOfWeek === 6;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Mon-Fri
    const isBankHoliday = bankHolidays.has(format(day, 'yyyy-MM-dd'));
    
    // Exclude bank holidays or shut days
    if (isBankHoliday || dayOfWeek === 0) return false;
    
    if (isWeekday) {
      // Mon-Fri: Need GP booked between 18:30-20:00 (or 18:30-20:30)
      return shifts.some(shift => {
        const shiftAssignments = assignments.filter(a => 
          a.shift_template_id === shift.id && 
          a.assignment_date === format(day, 'yyyy-MM-dd') &&
          a.status !== 'cancelled_late_notice'
        );
        
        // Check if shift is evening shift (18:30 start) and has GP assigned
        const isEveningShift = shift.start_time === '18:30:00' && 
          (shift.end_time === '20:00:00' || shift.end_time === '20:30:00');
        const hasGP = shiftAssignments.some(assignment => 
          assignment.staff_member.role === 'GP'
        );
        
        return isEveningShift && hasGP;
      });
    } else if (isSaturday) {
      // Saturday: Need both GP AND Receptionist booked
      const hasGP = shifts.some(shift => {
        const shiftAssignments = assignments.filter(a => 
          a.shift_template_id === shift.id && 
          a.assignment_date === format(day, 'yyyy-MM-dd') &&
          a.status !== 'cancelled_late_notice'
        );
        return shiftAssignments.some(assignment => assignment.staff_member.role === 'GP');
      });
      
      const hasReceptionist = shifts.some(shift => {
        const shiftAssignments = assignments.filter(a => 
          a.shift_template_id === shift.id && 
          a.assignment_date === format(day, 'yyyy-MM-dd') &&
          a.status !== 'cancelled_late_notice'
        );
        return shiftAssignments.some(assignment => assignment.staff_member.role === 'Receptionist');
      });
      
      return hasGP && hasReceptionist;
    }
    
    return false;
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

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'doctor':
      case 'dr':
      case 'gp':
        return <Activity className="h-3 w-3" />;
      case 'phlebotomist':
        return <Droplets className="h-3 w-3" />;
      case 'receptionist':
        return <UserCheck className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const formatStaffName = (name: string, role: string) => {
    const isDoctor = role?.toLowerCase() === 'doctor' || role?.toLowerCase() === 'dr' || role?.toLowerCase() === 'gp';
    return isDoctor ? `Dr ${name}` : name;
  };

  const calculateMonthlyHours = () => {
    if (!isMonthlyView || assignments.length === 0) return null;

    const hoursByRole = {
      GP: 0,
      Phlebotomist: 0,
      total: 0
    };

    assignments.forEach(assignment => {
      const role = assignment.staff_member.role.toLowerCase();
      
      // Skip receptionist roles
      if (role === 'receptionist') return;

      // Calculate hours for this assignment
      const startTime = new Date(`2000-01-01T${assignment.start_time}`);
      const endTime = new Date(`2000-01-01T${assignment.end_time}`);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      // Categorize the role
      if (role === 'doctor' || role === 'dr' || role === 'gp') {
        hoursByRole.GP += hours;
      } else if (role === 'phlebotomist') {
        hoursByRole.Phlebotomist += hours;
      }
      
      hoursByRole.total += hours;
    });

    return hoursByRole;
  };

  const monthlyHours = calculateMonthlyHours();

  const handleCopyPreviousWeek = async () => {
    setIsCopyingPreviousWeek(true);
    
    try {
      const previousWeekStart = addDays(weekStart, -7);
      const previousWeekEnd = addDays(weekStart, -1);
      
      // Fetch previous week's assignments
      const { data: previousAssignments, error: fetchError } = await supabase
        .from('staff_assignments')
        .select(`
          *,
          staff_member:staff_members(name, role),
          shift_template:shift_templates(name, required_role)
        `)
        .gte('assignment_date', format(previousWeekStart, 'yyyy-MM-dd'))
        .lte('assignment_date', format(previousWeekEnd, 'yyyy-MM-dd'));

      if (fetchError) throw fetchError;

      if (!previousAssignments || previousAssignments.length === 0) {
        toast.error('No assignments found for the previous week');
        return;
      }

      // Create new assignments for current week
      const newAssignments = previousAssignments.map(assignment => {
        const previousDate = new Date(assignment.assignment_date);
        const dayOfWeek = getDay(previousDate);
        const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0=Monday, 6=Sunday
        const newDate = addDays(weekStart, adjustedDayOfWeek);
        
        return {
          shift_template_id: assignment.shift_template_id,
          staff_member_id: assignment.staff_member_id,
          assignment_date: format(newDate, 'yyyy-MM-dd'),
          start_time: assignment.start_time,
          end_time: assignment.end_time,
          location: assignment.location,
          status: 'scheduled',
        };
      });

      // Check for existing assignments to avoid duplicates
      const { data: existingAssignments, error: existingError } = await supabase
        .from('staff_assignments')
        .select('shift_template_id, assignment_date')
        .gte('assignment_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('assignment_date', format(addDays(weekStart, 6), 'yyyy-MM-dd'));

      if (existingError) throw existingError;

      // Filter out assignments that already exist
      const existingKeys = new Set(
        existingAssignments?.map(a => `${a.shift_template_id}-${a.assignment_date}`) || []
      );
      
      const filteredNewAssignments = newAssignments.filter(assignment => 
        !existingKeys.has(`${assignment.shift_template_id}-${assignment.assignment_date}`)
      );

      if (filteredNewAssignments.length === 0) {
        toast.error('All shifts for this week are already assigned');
        return;
      }

      // Insert new assignments
      const { error: insertError } = await supabase
        .from('staff_assignments')
        .insert(filteredNewAssignments);

      if (insertError) throw insertError;

      toast.success(`Copied ${filteredNewAssignments.length} assignments from previous week`);
      fetchAssignments();
      onAssignmentChange();
    } catch (error) {
      toast.error('Failed to copy previous week assignments');
      console.error('Error:', error);
    } finally {
      setIsCopyingPreviousWeek(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {isMonthlyView 
                ? `${format(currentWeek, "MMMM yyyy")} Shift Assignments`
                : `Shift Assignments - Week of ${formatDateWithOrdinal(weekStart)}`
              }
            </CardTitle>
            {!isMonthlyView && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPreviousWeek}
                disabled={isCopyingPreviousWeek}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                {isCopyingPreviousWeek ? 'Copying...' : 'Copy Previous Week'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isMonthlyView ? (
            <>
              <div className={`grid grid-cols-7 gap-2 ${isDetailedView ? '' : ''}`}>
                {/* Month header */}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="p-2 text-center font-medium text-sm text-muted-foreground">
                    {day}
                  </div>
                ))}
                {/* Add empty cells for days before month starts */}
                {(() => {
                  const firstDayOfMonth = startOfMonth(currentWeek);
                  const startDay = getDay(firstDayOfMonth); // 0 = Sunday, 1 = Monday, etc.
                  const mondayStart = startDay === 0 ? 6 : startDay - 1; // Convert to Monday = 0
                  
                  return Array.from({ length: mondayStart }, (_, i) => (
                    <div key={`empty-${i}`} className="p-2 min-h-[60px]"></div>
                  ));
                })()}
                {/* Month days */}
                {eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
                  const dayOfWeek = getDay(day); // 0 = Sunday, 1 = Monday, etc.
                  const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday to 7
                  const shifts = getShiftsForDay(adjustedDayOfWeek);
                  const isSunday = dayOfWeek === 0;
                  const isBankHoliday = bankHolidays.has(format(day, 'yyyy-MM-dd'));
                  const isClosedDay = isSunday || isBankHoliday;
                  
                  const hasAssignments = !isClosedDay && shifts.some(shift => {
                    const shiftAssignments = assignments.filter(a => 
                      a.shift_template_id === shift.id && 
                      a.assignment_date === format(day, 'yyyy-MM-dd')
                    );
                    return shiftAssignments.length > 0;
                  });

                  const hasCancelledShifts = !isClosedDay && shifts.some(shift => {
                    const shiftAssignments = assignments.filter(a => 
                      a.shift_template_id === shift.id && 
                      a.assignment_date === format(day, 'yyyy-MM-dd')
                    );
                    return shiftAssignments.some(a => a.status === 'cancelled_late_notice');
                  });
                  
                  const allAssigned = !isClosedDay && shifts.length > 0 && shifts.every(shift => {
                    const shiftAssignments = assignments.filter(a => 
                      a.shift_template_id === shift.id && 
                      a.assignment_date === format(day, 'yyyy-MM-dd')
                    );
                    return shiftAssignments.length > 0;
                  });

                  const enhancedAccessMet = !isClosedDay && isEnhancedAccessRequirementMet(day, shifts);

                  return (
                     <div 
                       key={day.toISOString()} 
                       className={`p-2 border rounded text-center cursor-pointer hover:bg-muted/20 ${
                         isDetailedView ? 'min-h-[140px]' : 'min-h-[60px]'
                        } ${
                          isClosedDay 
                            ? "border-border/50 bg-muted/30"
                            : hasCancelledShifts
                            ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20"
                            : allAssigned || enhancedAccessMet
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                            : hasAssignments
                            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                            : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        }`}
                      >
                       <div className="text-sm font-medium">{format(day, "d")}</div>
                       {isClosedDay ? (
                         <div className="text-xs text-muted-foreground mt-1">
                           {isBankHoliday ? 'Bank Holiday' : 'No service'}
                         </div>
                      ) : isDetailedView ? (
                        <div className="mt-1 space-y-1 text-left">
                          {shifts.map(shift => {
                            const shiftAssignments = assignments.filter(a => 
                              a.shift_template_id === shift.id && 
                              a.assignment_date === format(day, 'yyyy-MM-dd')
                            );
                            return (
                              <div key={shift.id} className="text-xs border-b border-border/30 pb-1 last:border-b-0">
                                <div className="font-medium text-xs text-center">{shift.start_time}-{shift.end_time}</div>
                                <div className="text-center text-muted-foreground text-xs">{getLocationDisplay(shift.location)}</div>
                                 {shiftAssignments.length > 0 ? (
                                   shiftAssignments.map(assignment => (
                                     <div key={assignment.id} className={`text-center truncate flex items-center justify-center gap-1 ${
                                       assignment.status === 'cancelled_late_notice' 
                                         ? 'text-orange-600' 
                                         : 'text-green-600'
                                     }`}>
                                       {getRoleIcon(assignment.staff_member.role)}
                                       <span>{formatStaffName(assignment.staff_member.name, assignment.staff_member.role)}</span>
                                       {assignment.status === 'cancelled_late_notice' && <AlertTriangle className="h-3 w-3" />}
                                     </div>
                                   ))
                                ) : (
                                  <div className="text-red-600 text-center">Unassigned</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : shifts.length > 0 ? (
                        <div className="mt-1 space-y-1">
                          {shifts.slice(0, 2).map(shift => {
                            const shiftAssignments = assignments.filter(a => 
                              a.shift_template_id === shift.id && 
                              a.assignment_date === format(day, 'yyyy-MM-dd')
                            );
                            return (
                              <div key={shift.id} className="text-xs">
                                {shiftAssignments.length > 0 ? (
                                  <div className="text-green-600 font-medium">✓ {shift.start_time}</div>
                                ) : (
                                  <div className="text-red-600">✗ {shift.start_time}</div>
                                )}
                              </div>
                            );
                          })}
                          {shifts.length > 2 && (
                            <div className="text-xs text-muted-foreground">+{shifts.length - 2} more</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mt-1">No shifts</div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Monthly Hours Summary */}
              {monthlyHours && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Monthly Hours Summary - {format(currentWeek, "MMMM yyyy")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-primary">{monthlyHours.total.toFixed(1)}h</div>
                        <div className="text-sm text-muted-foreground">Total Hours</div>
                        <div className="text-xs text-muted-foreground mt-1">(Excluding Receptionist)</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-600">{monthlyHours.GP.toFixed(1)}h</div>
                        <div className="text-sm text-muted-foreground">GP Hours</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {monthlyHours.total > 0 ? `${((monthlyHours.GP / monthlyHours.total) * 100).toFixed(1)}% of total` : '0% of total'}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-600">{monthlyHours.Phlebotomist.toFixed(1)}h</div>
                        <div className="text-sm text-muted-foreground">Phlebotomist Hours</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {monthlyHours.total > 0 ? `${((monthlyHours.Phlebotomist / monthlyHours.total) * 100).toFixed(1)}% of total` : '0% of total'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
            
          ) : (
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((day, index) => {
                const dayOfWeek = index + 1; // 1=Monday, 2=Tuesday, etc.
                const shifts = getShiftsForDay(dayOfWeek);
                const isSunday = index === 6;
                const isBankHoliday = bankHolidays.has(format(day, 'yyyy-MM-dd'));
                const isClosedDay = isSunday || isBankHoliday;
                
                if (isClosedDay) {
                  return (
                    <div key={day.toISOString()} className="p-4 border border-border/50 rounded-lg bg-muted/30">
                      <div className="text-center">
                        <h3 className="font-medium text-muted-foreground">{format(day, "EEE")}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{formatShortDateWithOrdinal(day)}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {isBankHoliday ? 'Bank Holiday' : 'No service'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={day.toISOString()} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="text-center">
                      <h3 className="font-medium">{format(day, "EEE")}</h3>
                      <p className="text-xs text-muted-foreground">{formatShortDateWithOrdinal(day)}</p>
                    </div>
                    
                     {shifts.map((shift) => {
                       const shiftAssignments = getAssignmentsForDay(day, shift);
                       const hasAssignments = shiftAssignments.length > 0;
                       const availableStaff = getAvailableStaff(shift.required_role, day, shift);
                       const canAddMore = availableStaff.length > 0;
                       const enhancedAccessMet = isEnhancedAccessRequirementMet(day, [shift]);
                       
                        return (
                          <div 
                            key={shift.id}
                           className={`p-2 rounded border text-xs space-y-1 ${
                             hasAssignments 
                               ? shiftAssignments.some(a => a.status === 'cancelled_late_notice')
                                 ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20"
                                 : enhancedAccessMet
                                 ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                                 : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
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
                          
                          {hasAssignments ? (
                            <div className="space-y-1">
                               {shiftAssignments.map((assignment, idx) => (
                                 <div key={assignment.id} className="flex items-center justify-between">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button 
                                          variant="secondary" 
                                          size="sm"
                                          className="h-auto px-2 py-1 text-xs flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
                                        >
                                          {getRoleIcon(assignment.staff_member.role)}
                                          {formatStaffName(assignment.staff_member.name, assignment.staff_member.role)}
                                          <MoreVertical className="h-3 w-3 ml-1" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                       <DropdownMenuContent align="end" side="bottom" className="z-50 bg-background border border-border shadow-lg">
                                         <DropdownMenuItem onClick={() => openSwapDialog(assignment)}>
                                           <RefreshCw className="h-3 w-3 mr-2" />
                                           Swap Staff Member
                                         </DropdownMenuItem>
                                         <DropdownMenuItem 
                                           onClick={() => handleCancelShift(assignment.id)}
                                           className="text-orange-600 focus:text-orange-600"
                                         >
                                           <AlertTriangle className="h-3 w-3 mr-2" />
                                           {['doctor', 'dr', 'gp'].includes(assignment.staff_member.role.toLowerCase()) 
                                             ? 'Late Notice Cancelled by GP'
                                             : 'Late Notice Cancelled'
                                           }
                                         </DropdownMenuItem>
                                         <DropdownMenuItem 
                                           onClick={() => handleRemoveStaff(assignment.id)}
                                           className="text-destructive"
                                         >
                                           <UserX className="h-3 w-3 mr-2" />
                                           Remove
                                         </DropdownMenuItem>
                                       </DropdownMenuContent>
                                   </DropdownMenu>
                                 </div>
                               ))}
                              {canAddMore && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="w-full text-xs h-6 mt-1"
                                  onClick={() => openAssignDialog(shift, day)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              )}
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
          )}
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
                  {formatDateWithOrdinal(selectedDate)} • {selectedShift.start_time} - {selectedShift.end_time}
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
                    {getAvailableStaff(selectedShift.required_role, selectedDate, selectedShift).map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getAvailableStaff(selectedShift.required_role, selectedDate, selectedShift).length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    All available {selectedShift.required_role} staff are already assigned to this shift.
                  </p>
                )}
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

      <Dialog open={isSwapDialogOpen} onOpenChange={setIsSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Swap Staff Member</DialogTitle>
          </DialogHeader>
          {assignmentToSwap && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Current Assignment</h4>
                <p className="text-sm text-muted-foreground">
                  {formatStaffName(assignmentToSwap.staff_member.name, assignmentToSwap.staff_member.role)} - {assignmentToSwap.shift_template.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(assignmentToSwap.assignment_date), 'EEEE, MMMM do, yyyy')} • {assignmentToSwap.start_time} - {assignmentToSwap.end_time}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getLocationDisplay(assignmentToSwap.location)}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Swap with {assignmentToSwap.shift_template.required_role.toUpperCase()}</label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose replacement staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getEligibleStaff(assignmentToSwap.shift_template.required_role)
                      .filter(staff => staff.id !== assignmentToSwap.staff_member_id)
                      .map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {formatStaffName(staff.name, staff.role)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSwapDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSwapStaff} disabled={!selectedStaff}>
                  Swap Staff
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};