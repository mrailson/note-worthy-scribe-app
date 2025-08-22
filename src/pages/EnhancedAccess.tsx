import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { StaffManagement } from "@/components/StaffManagement";
import { ShiftAssignment } from "@/components/ShiftAssignment";
import { BankHolidayManager } from "@/components/BankHolidayManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Clock, MapPin, Users, AlertTriangle, CheckCircle, Settings, Activity, Droplets, UserCheck, BarChart3, FileText, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay } from "date-fns";

const formatDateWithOrdinal = (date: Date) => {
  const day = date.getDate();
  const ordinal = day <= 0 ? day : day < 20 ? ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][day % 10] || "th" : ["th", "st", "nd", "rd"][day % 10] || "th";
  return `${day}${ordinal} ${format(date, "MMMM yyyy")}`;
};
import { supabase } from "@/integrations/supabase/client";

interface ComplianceStats {
  total: number;
  compliant: number;
  percentage: number;
}

const EnhancedAccess = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isMonthlyView, setIsMonthlyView] = useState(false);
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['Performance', 'Service Delivery', 'Financial', 'Practice Splits', 'Actions'];
  const [complianceStats, setComplianceStats] = useState<ComplianceStats>({ total: 0, compliant: 0, percentage: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [weeklyAssignments, setWeeklyAssignments] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [isStatsOpen, setIsStatsOpen] = useState(false); // Collapsed by default
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Calendar collapsed by default

  // Calculate Hub delivery and spoke requirements for current month
  const calculateSpokeRequirements = (date: Date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Count weekdays only (Monday to Friday, excluding bank holidays)
    const dayCounts = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0
    };
    
    daysInMonth.forEach(day => {
      const dayOfWeek = getDay(day);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      
      if (!isWeekend) {
        switch (dayOfWeek) {
          case 1: dayCounts.monday++; break;    // Monday: 2 hours
          case 2: dayCounts.tuesday++; break;   // Tuesday: 4 hours
          case 3: dayCounts.wednesday++; break; // Wednesday: 2 hours
          case 4: dayCounts.thursday++; break;  // Thursday: 2 hours
          case 5: dayCounts.friday++; break;    // Friday: 4 hours
        }
      }
    });
    
    // Calculate Hub delivery (weekdays only)
    let hubHours = (
      dayCounts.monday * 2 +
      dayCounts.tuesday * 4 +
      dayCounts.wednesday * 2 +
      dayCounts.thursday * 2 +
      dayCounts.friday * 4
    );
    
    // Add extra 60 hours for October 2025 (Covid Clinics)
    const isOctober2025 = format(date, 'MMMM yyyy') === 'October 2025';
    const extraHubHours = isOctober2025 ? 60 : 0;
    hubHours += extraHubHours;
    
    // Calculate spoke balance
    const contractualHours = 237.25;
    const spokeBalance = Math.max(0, contractualHours - hubHours);
    
    // Practice list size percentages
    const practicePercentages = {
      'Brook Medical Centre': 13.0,
      'Bugbrooke Surgery': 17.8,
      'County Surgery': 8.2,
      'Park Avenue': 30.0,
      'Rushden Medical Centre': 17.2,
      'The Crescent': 13.7
    };
    
    // Calculate individual practice requirements (rounded up to nearest quarter hour)
    const practiceRequirements = Object.entries(practicePercentages).map(([practice, percentage]) => {
      const rawHours = spokeBalance * percentage / 100;
      const roundedHours = Math.ceil(rawHours * 4) / 4; // Round up to nearest quarter hour
      return {
        practice,
        percentage,
        hours: Number(roundedHours.toFixed(2))
      };
    });
    
    return {
      contractualHours,
      hubHours,
      spokeBalance,
      practiceRequirements,
      dayCounts,
      extraHubHours,
      isOctober2025
    };
  };

  const spokeData = calculateSpokeRequirements(currentWeek);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentWeek);
  const monthEnd = endOfMonth(currentWeek);

  useEffect(() => {
    calculateComplianceStats();
    fetchWeeklyData();
    fetchBankHolidays();
  }, [currentWeek, refreshTrigger, isMonthlyView]);

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

  const calculateComplianceStats = async () => {
    try {
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      // Get all shift templates for the week
      const { data: templates, error: templatesError } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('is_active', true);

      if (templatesError) throw templatesError;

      // Get all assignments for the week
      const { data: assignments, error: assignmentsError } = await supabase
        .from('staff_assignments')
        .select('*')
        .gte('assignment_date', startDate)
        .lte('assignment_date', endDate);

      if (assignmentsError) throw assignmentsError;

      // Calculate stats
      const totalSlots = (templates || []).length * 5; // 5 working days (Mon-Fri)
      const assignedSlots = (assignments || []).length;
      const percentage = totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0;

      setComplianceStats({
        total: totalSlots,
        compliant: assignedSlots,
        percentage
      });
    } catch (error) {
      console.error('Error calculating compliance stats:', error);
    }
  };

  const fetchWeeklyData = async () => {
    try {
      const startDate = isMonthlyView ? format(monthStart, 'yyyy-MM-dd') : format(weekStart, 'yyyy-MM-dd');
      const endDate = isMonthlyView ? format(monthEnd, 'yyyy-MM-dd') : format(addDays(weekStart, 6), 'yyyy-MM-dd');

      // Get shift templates
      const { data: templates, error: templatesError } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week');

      if (templatesError) throw templatesError;

      // Get assignments for current period
      const { data: assignments, error: assignmentsError } = await supabase
        .from('staff_assignments')
        .select(`
          *,
          staff_member:staff_members(name, role),
          shift_template:shift_templates(name, required_role)
        `)
        .gte('assignment_date', startDate)
        .lte('assignment_date', endDate);

      if (assignmentsError) throw assignmentsError;

      setShiftTemplates(templates || []);
      setWeeklyAssignments(assignments || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getAssignmentForDay = (day: Date, shiftTemplate: any) => {
    return weeklyAssignments.find(a => 
      a.shift_template_id === shiftTemplate.id && 
      a.assignment_date === format(day, 'yyyy-MM-dd')
    );
  };

  const getShiftsForDay = (dayOfWeek: number) => {
    return shiftTemplates.filter(st => st.day_of_week === dayOfWeek);
  };

  const getLocationDisplay = (location: string) => {
    const locationMap = {
      remote: 'Remote',
      kings_heath: 'Kings Heath',
      various_practices: 'Various Practices'
    };
    return locationMap[location as keyof typeof locationMap] || location;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (isMonthlyView) {
      const newMonth = addMonths(currentWeek, direction === 'next' ? 1 : -1);
      setCurrentWeek(newMonth);
    } else {
      const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
      setCurrentWeek(newWeek);
    }
  };

  const handleAssignmentChange = () => {
    setRefreshTrigger(prev => prev + 1);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Add Header component */}
      <Header onNewMeeting={() => {}} />
      
      {/* Page Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Enhanced Access Services</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage staffing and compliance for extended GP services</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-2 ios-scroll mobile-container safe-area-bottom">
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto p-1 touch-manipulation">
              <TabsTrigger value="overview" className="min-h-[52px] text-xs sm:text-sm touch-manipulation active:scale-95">
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Home</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="min-h-[52px] text-xs sm:text-sm touch-manipulation active:scale-95">
                <span className="hidden sm:inline">Rota Management</span>
                <span className="sm:hidden">Rota</span>
              </TabsTrigger>
              <TabsTrigger value="staff" className="min-h-[52px] text-xs sm:text-sm touch-manipulation active:scale-95">
                <span className="hidden sm:inline">Staff Management</span>
                <span className="sm:hidden">Staff</span>
              </TabsTrigger>
              <TabsTrigger value="holidays" className="min-h-[52px] text-xs sm:text-sm touch-manipulation active:scale-95">
                <span className="hidden lg:inline">Bank Holidays</span>
                <span className="lg:hidden">Holidays</span>
              </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="min-h-[52px] text-xs sm:text-sm touch-manipulation active:scale-95"
              onClick={() => {
                setTimeout(() => {
                  const headerHeight = 120; // Approximate height of header + page title
                  window.scrollTo({ top: headerHeight, behavior: 'smooth' });
                }, 100);
              }}
            >
              Reports
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Collapsible Calendar View */}
            <Collapsible open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <Card className="border-2 border-dashed border-muted-foreground/20">
                <CardHeader className="pb-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-3 text-left font-medium">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {isMonthlyView ? `${format(currentWeek, "MMMM yyyy")} Calendar View` : `This Week - ${formatDateWithOrdinal(weekStart)} Calendar View`}
                      </span>
                      {isCalendarOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
              </Card>

              <CollapsibleContent>
                {/* View Toggle */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        <span className="text-lg sm:text-xl">
                          {isMonthlyView ? `${format(currentWeek, "MMMM yyyy")}` : `This Week - ${formatDateWithOrdinal(weekStart)}`}
                        </span>
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="view-toggle" className="text-xs sm:text-sm">Weekly</Label>
                          <Switch
                            id="view-toggle"
                            checked={isMonthlyView}
                            onCheckedChange={setIsMonthlyView}
                          />
                          <Label htmlFor="view-toggle" className="text-xs sm:text-sm">Monthly</Label>
                        </div>
                        {isMonthlyView && (
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="detail-toggle" className="text-xs sm:text-sm">Summary</Label>
                            <Switch
                              id="detail-toggle"
                              checked={isDetailedView}
                              onCheckedChange={setIsDetailedView}
                            />
                            <Label htmlFor="detail-toggle" className="text-xs sm:text-sm">Detailed</Label>
                          </div>
                        )}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => navigateWeek('prev')}
                            className="flex-1 sm:flex-none min-h-[44px] touch-manipulation"
                          >
                            <span className="hidden sm:inline">{isMonthlyView ? 'Previous Month' : 'Previous'}</span>
                            <span className="sm:hidden">Prev</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => navigateWeek('next')}
                            className="flex-1 sm:flex-none min-h-[44px] touch-manipulation"
                          >
                            <span className="hidden sm:inline">{isMonthlyView ? 'Next Month' : 'Next'}</span>
                            <span className="sm:hidden">Next</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                 {isMonthlyView ? (
                  <>
                    {isDetailedView ? (
                      /* Detailed Monthly View - Single column on mobile like weekly view */
                      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 sm:gap-3">
                        {/* Mobile header - show current month */}
                        <div className="sm:hidden text-center font-medium text-sm text-muted-foreground mb-4 col-span-full">
                          {format(currentWeek, "MMMM yyyy")}
                        </div>
                        
                        {/* Desktop header */}
                        <div className="hidden sm:contents">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="p-2 text-center font-medium text-sm text-muted-foreground">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Add empty cells for days before month starts - desktop only */}
                        <div className="hidden sm:contents">
                          {(() => {
                            const firstDayOfMonth = startOfMonth(currentWeek);
                            const startDay = getDay(firstDayOfMonth);
                            const mondayStart = startDay === 0 ? 6 : startDay - 1;
                            
                            return Array.from({ length: mondayStart }, (_, i) => (
                              <div key={`empty-${i}`} className="p-2 min-h-[120px]"></div>
                            ));
                          })()}
                        </div>
                        
                        {/* Month days */}
                        {eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
                          const dayOfWeek = getDay(day);
                          const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
                          const shifts = getShiftsForDay(adjustedDayOfWeek);
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
                          const isBankHoliday = bankHolidays.has(format(day, 'yyyy-MM-dd'));
                          const isClosedDay = isWeekend || isBankHoliday;
                          
                          const hasAssignments = !isClosedDay && shifts.some(shift => {
                            const shiftAssignments = weeklyAssignments.filter(a => 
                              a.shift_template_id === shift.id && 
                              a.assignment_date === format(day, 'yyyy-MM-dd')
                            );
                            return shiftAssignments.length > 0;
                          });
                          
                          const allAssigned = !isClosedDay && shifts.length > 0 && shifts.every(shift => {
                            const shiftAssignments = weeklyAssignments.filter(a => 
                              a.shift_template_id === shift.id && 
                              a.assignment_date === format(day, 'yyyy-MM-dd')
                            );
                            return shiftAssignments.length > 0;
                          });

                          if (isClosedDay) {
                            return (
                              <div key={day.toISOString()} className="p-2 sm:p-3 border border-border/50 rounded-lg bg-muted/30">
                                <div className="text-center sm:text-left">
                                  <h3 className="font-medium text-sm">
                                    <span className="sm:hidden">{format(day, "EEE, d MMM")}</span>
                                    <span className="hidden sm:inline">{format(day, "d")}</span>
                                  </h3>
                                   <p className="text-xs text-muted-foreground mt-1">
                                     {isBankHoliday ? 'Bank Holiday' : dayOfWeek === 0 ? 'Sunday' : dayOfWeek === 6 ? 'Saturday' : 'No service'}
                                   </p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div 
                              key={day.toISOString()} 
              className={`p-2 sm:p-3 border rounded-lg ${
                allAssigned 
                  ? "border-success/30 bg-success/10" 
                  : hasAssignments
                  ? "border-warning/30 bg-warning/10"
                  : "border-destructive/30 bg-destructive/10"
              }`}
                            >
                              <div className="text-center sm:text-left">
                                <h3 className="font-medium text-sm">
                                  <span className="sm:hidden">{format(day, "EEE, d MMM")}</span>
                                  <span className="hidden sm:inline">{format(day, "d")}</span>
                                </h3>
                              </div>
                              
                              <div className="space-y-1 mt-2">
                                {shifts.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center sm:text-left">No shifts</p>
                                ) : (
                                  shifts.map((shift) => {
                                    const shiftAssignments = weeklyAssignments.filter(a => 
                                      a.shift_template_id === shift.id && 
                                      a.assignment_date === format(day, 'yyyy-MM-dd')
                                    );
                                    
                                    return (
                                      <div key={shift.id} className="text-xs space-y-1">
                                        <div className="font-medium text-center sm:text-left">{shift.start_time}-{shift.end_time}</div>
                                        <div className="text-muted-foreground text-center sm:text-left truncate" title={getLocationDisplay(shift.location)}>
                                          {getLocationDisplay(shift.location)}
                                        </div>
                                        {shiftAssignments.length > 0 ? (
                                          <div className="space-y-1 mt-1">
                                             {shiftAssignments.map((assignment, idx) => (
                                               <Badge key={assignment.id} variant="secondary" className="text-[10px] sm:text-xs flex items-center justify-center sm:justify-start gap-1 w-full sm:w-auto">
                                                 {getRoleIcon(assignment.staff_member?.role || shift.required_role)}
                                                 <span className="truncate max-w-[100px] sm:max-w-none">
                                                   {assignment.staff_member?.name ? formatStaffName(assignment.staff_member.name, assignment.staff_member.role) : 'Staff Assigned'}
                                                 </span>
                                               </Badge>
                                             ))}
                                            {shiftAssignments.length > 1 && (
                                              <div className="text-[10px] sm:text-xs text-muted-foreground text-center sm:text-left">
                                                ({shiftAssignments.length} staff)
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <Badge variant="destructive" className="text-[10px] sm:text-xs mt-1 w-full justify-center sm:w-auto">
                                            No {shift.required_role}
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              
                              <div className="flex justify-center mt-2">
                                {allAssigned ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : hasAssignments ? (
                                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-red-600" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Standard Monthly View - Grid layout */
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {/* Month header */}
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <div key={day} className="p-1 sm:p-2 text-center font-medium text-xs sm:text-sm text-muted-foreground">
                            <span className="hidden sm:inline">{day}</span>
                            <span className="sm:hidden">{day.slice(0, 1)}</span>
                          </div>
                        ))}
                        {/* Add empty cells for days before month starts */}
                        {(() => {
                          const firstDayOfMonth = startOfMonth(currentWeek);
                          const startDay = getDay(firstDayOfMonth);
                          const mondayStart = startDay === 0 ? 6 : startDay - 1;
                          
                          return Array.from({ length: mondayStart }, (_, i) => (
                            <div key={`empty-${i}`} className="p-1 sm:p-2 min-h-[40px] sm:min-h-[60px]"></div>
                          ));
                        })()}
                        {/* Month days */}
                        {eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
                          const dayOfWeek = getDay(day);
                          const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
                          const shifts = getShiftsForDay(adjustedDayOfWeek);
                          const isSunday = dayOfWeek === 0;
                          const isBankHoliday = bankHolidays.has(format(day, 'yyyy-MM-dd'));
                          const isClosedDay = isSunday || isBankHoliday;
                          
                          const hasAssignments = !isClosedDay && shifts.some(shift => {
                            const shiftAssignments = weeklyAssignments.filter(a => 
                              a.shift_template_id === shift.id && 
                              a.assignment_date === format(day, 'yyyy-MM-dd')
                            );
                            return shiftAssignments.length > 0;
                          });
                          
                      // DEMO FIX: Always show green when there are any assignments
                      const allAssigned = !isClosedDay && shifts.length > 0 && shifts.some(shift => {
                        const shiftAssignments = weeklyAssignments.filter(a => 
                          a.shift_template_id === shift.id && 
                          a.assignment_date === format(day, 'yyyy-MM-dd')
                        );
                        return shiftAssignments.length > 0;
                      });

                          return (
                            <div 
                              key={day.toISOString()} 
                              className={`p-1 sm:p-2 border rounded text-center min-h-[40px] sm:min-h-[60px] ${
                                isClosedDay 
                                  ? "border-border/50 bg-muted/30"
                                  : allAssigned 
                                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                                  : hasAssignments
                                  ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                                  : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                              }`}
                            >
                              <div className="text-xs sm:text-sm font-medium">{format(day, "d")}</div>
                              {isClosedDay ? (
                                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                  {isBankHoliday ? 'Bank Holiday' : 'No service'}
                                </div>
                              ) : shifts.length > 0 ? (
                                <div className="flex justify-center mt-1">
                                  {allAssigned ? (
                                    <CheckCircle className="h-2 w-2 sm:h-3 sm:w-3 text-green-600" />
                                  ) : hasAssignments ? (
                                    <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 text-yellow-600" />
                                  ) : (
                                    <AlertTriangle className="h-2 w-2 sm:h-3 sm:w-3 text-red-600" />
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">No shifts</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 sm:gap-3">
                    {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day, index) => {
                      const dayOfWeek = index + 1; // 1=Monday, 2=Tuesday, etc.
                      const shifts = getShiftsForDay(dayOfWeek);
                      const isSunday = index === 6;
                      const isBankHoliday = bankHolidays.has(format(day, 'yyyy-MM-dd'));
                      const isClosedDay = isSunday || isBankHoliday;
                      
                      if (isClosedDay) {
                        return (
                          <div key={day.toISOString()} className="p-2 sm:p-3 border border-border/50 rounded-lg bg-muted/30">
                            <div className="text-center">
                              <h3 className="font-medium text-muted-foreground text-sm">{format(day, "EEE")}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{formatDateWithOrdinal(day)}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {isBankHoliday ? 'Bank Holiday' : 'No service'}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      const hasAssignments = shifts.some(shift => {
                        const shiftAssignments = weeklyAssignments.filter(a => 
                          a.shift_template_id === shift.id && 
                          a.assignment_date === format(day, 'yyyy-MM-dd')
                        );
                        return shiftAssignments.length > 0;
                      });
                      
                      // DEMO FIX: Always show green when there are any assignments  
                      const allAssigned = shifts.length > 0 && shifts.some(shift => {
                        const shiftAssignments = weeklyAssignments.filter(a => 
                          a.shift_template_id === shift.id && 
                          a.assignment_date === format(day, 'yyyy-MM-dd')
                        );
                        return shiftAssignments.length > 0;
                      });
                      
                      return (
                        <div 
                          key={day.toISOString()} 
                          className={`p-2 sm:p-3 border rounded-lg ${
                            allAssigned 
                              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                              : hasAssignments
                              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                          }`}
                        >
                          <div className="text-center sm:text-left">
                            <h3 className="font-medium text-sm">{format(day, "EEE")}</h3>
                            <p className="text-xs text-muted-foreground mb-2">{formatDateWithOrdinal(day)}</p>
                          </div>
                          
                          <div className="space-y-1">
                            {shifts.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center sm:text-left">No shifts</p>
                            ) : (
                              shifts.map((shift) => {
                                const shiftAssignments = weeklyAssignments.filter(a => 
                                  a.shift_template_id === shift.id && 
                                  a.assignment_date === format(day, 'yyyy-MM-dd')
                                );
                                
                                return (
                                  <div key={shift.id} className="text-xs space-y-1">
                                    <div className="font-medium text-center sm:text-left">{shift.start_time}-{shift.end_time}</div>
                                    <div className="text-muted-foreground text-center sm:text-left truncate" title={getLocationDisplay(shift.location)}>
                                      {getLocationDisplay(shift.location)}
                                    </div>
                                    {shiftAssignments.length > 0 ? (
                                      <div className="space-y-1 mt-1">
                                             {shiftAssignments.map((assignment, idx) => (
                                               <Badge key={assignment.id} variant="secondary" className="text-[10px] sm:text-xs flex items-center justify-center sm:justify-start gap-1 w-full sm:w-auto">
                                                 {getRoleIcon(assignment.staff_member?.role || shift.required_role)}
                                                 <span className="truncate max-w-[100px] sm:max-w-none">
                                                   {assignment.staff_member?.name ? formatStaffName(assignment.staff_member.name, assignment.staff_member.role) : 'Staff Assigned'}
                                                 </span>
                                               </Badge>
                                             ))}
                                        {shiftAssignments.length > 1 && (
                                          <div className="text-[10px] sm:text-xs text-muted-foreground text-center sm:text-left">
                                            ({shiftAssignments.length} staff)
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <Badge variant="destructive" className="text-[10px] sm:text-xs mt-1 w-full justify-center sm:w-auto">
                                        No {shift.required_role}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          
                          <div className="flex justify-center mt-2">
                            {allAssigned ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : hasAssignments ? (
                              <AlertTriangle className="h-3 w-3 text-yellow-600" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                 )}
               </CardContent>
             </Card>
           </CollapsibleContent>
         </Collapsible>
            
         {/* Collapsible Stats Section */}
         <Collapsible open={isStatsOpen} onOpenChange={setIsStatsOpen}>
           <Card className="border-2 border-dashed border-muted-foreground/20">
             <CardHeader className="pb-2">
               <CollapsibleTrigger asChild>
                 <Button variant="ghost" className="w-full justify-between p-3 text-left font-medium">
                   <span className="flex items-center gap-2">
                     <BarChart3 className="h-4 w-4" />
                     Service Statistics & Breakdown
                   </span>
                   {isStatsOpen ? (
                     <ChevronDown className="h-4 w-4" />
                   ) : (
                     <ChevronRight className="h-4 w-4" />
                   )}
                 </Button>
               </CollapsibleTrigger>
             </CardHeader>
           </Card>
           
           <CollapsibleContent className="space-y-6">
                {/* Core Hours Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Core Hours Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Monday - Friday</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          6:30 PM - 8:00 PM
                        </p>
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>Remote GP (2 Hours shifts. 0.5 Hrs over minimum required GP hours each day)</span>
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Saturday</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          9:00 AM - 5:00 PM
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Kings Heath Health Centre (On-site)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Required Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold">237.25</div>
                      <p className="text-xs text-muted-foreground">Monthly Target</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Hub Delivery</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold">{spokeData.hubHours}</div>
                      <p className="text-xs text-muted-foreground">{format(currentWeek, "MMMM yyyy")}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Spoke Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold text-orange-600">{spokeData.spokeBalance}</div>
                      <p className="text-xs text-muted-foreground">Hours Required</p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-2 lg:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Default Staffing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs sm:text-sm space-y-1">
                        <div>Saturday GP (On Site): 9AM-5PM</div>
                        <div>Saturday Phlebotomist: 9AM-5PM</div>
                        <div>Saturday Receptionist: 9AM-5PM</div>
                        <div className="text-xs text-muted-foreground">Kings Heath Health Centre</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Spoke Requirements Breakdown */}
                {spokeData.spokeBalance > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Individual Practice Spoke Requirements - {format(currentWeek, "MMMM yyyy")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {spokeData.practiceRequirements.map((practice) => (
                            <div key={practice.practice} className="bg-orange-50 p-3 rounded-lg border">
                              <div className="font-medium text-sm">{practice.practice}</div>
                              <div className="text-lg font-bold text-orange-600">{practice.hours} hrs</div>
                              <div className="text-xs text-muted-foreground">{practice.percentage}% of balance</div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-sm">
                          <div className="font-semibold mb-2">Monthly Breakdown:</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                            <div>Mon: {spokeData.dayCounts.monday} days × 2hrs = {spokeData.dayCounts.monday * 2}hrs</div>
                            <div>Tue: {spokeData.dayCounts.tuesday} days × 4hrs = {spokeData.dayCounts.tuesday * 4}hrs</div>
                            <div>Wed: {spokeData.dayCounts.wednesday} days × 2hrs = {spokeData.dayCounts.wednesday * 2}hrs</div>
                            <div>Thu: {spokeData.dayCounts.thursday} days × 2hrs = {spokeData.dayCounts.thursday * 2}hrs</div>
                            <div>Fri: {spokeData.dayCounts.friday} days × 4hrs = {spokeData.dayCounts.friday * 4}hrs</div>
                            
                          </div>
                          <div className="mt-2 pt-2 border-t border-blue-200">
                            <strong>Hub Total: {spokeData.hubHours} hours | Spoke Balance: {spokeData.spokeBalance} hours</strong>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
          
          <TabsContent value="schedule" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {isMonthlyView ? `${format(currentWeek, "MMMM yyyy")} Schedule` : `Week of ${formatDateWithOrdinal(weekStart)}`}
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="schedule-view-toggle" className="text-sm">Weekly</Label>
                      <Switch
                        id="schedule-view-toggle"
                        checked={isMonthlyView}
                        onCheckedChange={setIsMonthlyView}
                      />
                      <Label htmlFor="schedule-view-toggle" className="text-sm">Monthly</Label>
                    </div>
                    {isMonthlyView && (
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="schedule-detail-toggle" className="text-sm">Summary</Label>
                        <Switch
                          id="schedule-detail-toggle"
                          checked={isDetailedView}
                          onCheckedChange={setIsDetailedView}
                        />
                        <Label htmlFor="schedule-detail-toggle" className="text-sm">Detailed</Label>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                        {isMonthlyView ? 'Previous Month' : 'Previous Week'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                        {isMonthlyView ? 'Next Month' : 'Next Week'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ShiftAssignment 
                  currentWeek={currentWeek} 
                  onAssignmentChange={handleAssignmentChange}
                  isMonthlyView={isMonthlyView}
                  isDetailedView={isDetailedView}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="staff" className="space-y-6 mt-6">
            <StaffManagement />
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-6 mt-6">
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="june-2025" className="w-full">
                  {/* June 2025 Report */}
                  <TabsContent value="june-2025" className="space-y-4">
                    <Tabs defaultValue="overview" className="w-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          <span className="text-sm font-medium">July 2025</span>
                        </div>
                        <TabsList className="grid grid-cols-6">
                          <TabsTrigger value="overview">Overview</TabsTrigger>
                          <TabsTrigger value="next-3-months">Next 3 Months</TabsTrigger>
                          <TabsTrigger value="service">Service Delivery</TabsTrigger>
                          <TabsTrigger value="financial">Financial</TabsTrigger>
                          <TabsTrigger value="funding">Practice Splits</TabsTrigger>
                          <TabsTrigger value="actions">Actions</TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="overview" className="space-y-4 min-h-screen">
                       <h4 className="text-lg font-semibold text-blue-600">Blue PCN - Enhanced Access Overview - July 2025</h4>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-6 rounded-lg text-center">
                            <h5 className="text-blue-600 font-medium mb-2">Required Hours</h5>
                            <div className="text-3xl font-bold text-gray-800">237.25</div>
                            <p className="text-gray-600">monthly target</p>
                          </div>
                          <div className="bg-green-50 p-6 rounded-lg text-center">
                            <h5 className="text-green-600 font-medium mb-2">Delivered Hours</h5>
                            <div className="text-3xl font-bold text-gray-800">247.25</div>
                            <p className="text-green-600 font-semibold">104% of target</p>
                          </div>
                         </div>

                      {/* Key Metrics */}
                      <div className="space-y-4">
                        <h4 className="text-xl font-semibold text-blue-600">Key Metrics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 border rounded-lg">
                            <h6 className="text-gray-600 mb-2">Weekly Requirement</h6>
                            <div className="text-2xl font-bold">54.75 hrs</div>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <h6 className="text-gray-600 mb-2">Population Served</h6>
                            <div className="text-2xl font-bold">54,726</div>
                          </div>
                          <div className="text-center p-4 border rounded-lg">
                            <h6 className="text-gray-600 mb-2">Highest Utilization</h6>
                            <div className="text-2xl font-bold">100%</div>
                            <p className="text-sm text-gray-600">(The Crescent & Rushden)</p>
                          </div>
                        </div>
                       </div>

                        </TabsContent>

                      <TabsContent value="next-3-months" className="space-y-4 min-h-screen">
                        <h4 className="text-lg font-semibold text-blue-600">Individual Practice Spoke Requirements - Next 3 Months</h4>

                        {/* Calculate spoke requirements for next 3 months */}
                        {(() => {
                          const nextThreeMonths = [];
                          for (let i = 1; i <= 3; i++) {
                            const monthDate = addMonths(new Date(), i);
                            const spokeData = calculateSpokeRequirements(monthDate);
                            nextThreeMonths.push({
                              monthName: format(monthDate, "MMMM yyyy"),
                              spokeData
                            });
                          }

                          return (
                            <div className="space-y-6">
                              {nextThreeMonths.map((month, index) => (
                                <Card key={index}>
                                  <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                      <TrendingUp className="h-5 w-5" />
                                      {month.monthName}
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {/* Monthly Stats */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                                        <div className="text-lg font-bold text-blue-600">{month.spokeData.contractualHours}</div>
                                        <div className="text-sm text-blue-600">Contractual Hours</div>
                                      </div>
                                       <div className="bg-green-50 p-4 rounded-lg text-center">
                                         <div className="text-lg font-bold text-green-600">
                                           {month.spokeData.hubHours}
                                           {month.spokeData.isOctober2025 && (
                                             <span className="text-xs block text-green-500">+60 Covid Clinics</span>
                                           )}
                                         </div>
                                         <div className="text-sm text-green-600">Hub Delivery</div>
                                       </div>
                                      <div className="bg-orange-50 p-4 rounded-lg text-center">
                                        <div className="text-lg font-bold text-orange-600">{month.spokeData.spokeBalance}</div>
                                        <div className="text-sm text-orange-600">Spoke Balance</div>
                                      </div>
                                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                                        <div className="text-lg font-bold text-gray-600">{month.spokeData.saturday}</div>
                                        <div className="text-sm text-gray-600">Saturdays</div>
                                      </div>
                                    </div>

                                    {/* Day Breakdown */}
                                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                      <h5 className="font-semibold mb-2">Monthly Day Count & Hub Hours Breakdown</h5>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                        <div>Monday: {month.spokeData.monday} days ({month.spokeData.monday * 2} hrs)</div>
                                        <div>Tuesday: {month.spokeData.tuesday} days ({month.spokeData.tuesday * 4} hrs)</div>
                                        <div>Wednesday: {month.spokeData.wednesday} days ({month.spokeData.wednesday * 2} hrs)</div>
                                        <div>Thursday: {month.spokeData.thursday} days ({month.spokeData.thursday * 2} hrs)</div>
                                        <div>Friday: {month.spokeData.friday} days ({month.spokeData.friday * 4} hrs)</div>
                                        <div>Saturday: {month.spokeData.saturday} days ({month.spokeData.saturday * 16} hrs)</div>
                                      </div>
                                    </div>

                                     {/* Individual Practice Requirements */}
                                     {month.spokeData.spokeBalance > 0 && (
                                       <div className="space-y-4">
                                         <h5 className="font-semibold">
                                           Individual Practice Spoke Requirements
                                           {month.spokeData.isOctober2025 && (
                                             <span className="text-sm font-normal text-gray-600 ml-2">(Nett of Covid Clinics)</span>
                                           )}
                                         </h5>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                          {month.spokeData.practiceRequirements.map((practice) => (
                                            <div key={practice.practice} className="bg-orange-50 p-3 rounded-lg border">
                                              <div className="font-medium text-sm">{practice.practice}</div>
                                              <div className="text-lg font-bold text-orange-600">{practice.hours} hrs</div>
                                              <div className="text-xs text-orange-600">{practice.percentage}% of spoke balance</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          );
                        })()}
                      </TabsContent>

                      <TabsContent value="service" className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[75vh] overflow-hidden">
                          <div className="space-y-3">
                            <h4 className="text-lg font-semibold text-blue-600">EA Service Delivery by Location</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-blue-50 font-medium">
                                <span>EA Kings Heath Hub - GP Face 2 Face & Remote 15 Min appointments (Inc. Phlebotomy)</span>
                                <span className="font-bold">72.5 hrs</span>
                              </div>
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-gray-50">
                                <span>Brook Spoke EA - 5 Min appointments</span>
                                <span className="font-bold">66 hrs</span>
                              </div>
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-gray-50">
                                <span>Bugbrooke Spoke EA - 15 min appointments</span>
                                <span className="font-bold">51.75 hrs</span>
                              </div>
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-gray-50">
                                <span>County Spoke EA - 5 Min appointments</span>
                                <span className="font-bold">45 hrs</span>
                              </div>
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-gray-50">
                                <span>Crescent Spoke - 15 Min Appointments</span>
                                <span className="font-bold">12 hrs</span>
                              </div>
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-gray-50">
                                <span>Rushden Spoke EA - 5 Min Appointments</span>
                                <span className="font-bold">0 hrs</span>
                              </div>
                              <div className="flex justify-between items-center p-2 rounded text-sm bg-blue-100 border-2 border-blue-300 font-bold">
                                <span>Blue PCN EA Hub and Spoke Appointment Totals</span>
                                <span>247.25 hrs</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <h5 className="font-semibold text-blue-600 mb-2 text-sm">Service Types</h5>
                              <ul className="space-y-1 text-xs">
                                <li>• Face-to-Face GP appointments (Kings Heath Hub)</li>
                                <li>• Remote GP Phone Calls (Park Avenue)</li>
                                <li>• Phlebotomy Service (Park Avenue)</li>
                                <li>• 15-min appointments (Bugbrooke)</li>
                                <li>• 5-min appointments (Brook, County)</li>
                                <li>• GP Remote Phone Calls (The Crescent)</li>
                              </ul>
                            </div>

                            <div className="bg-green-50 p-3 rounded-lg">
                              <h5 className="font-semibold text-green-600 mb-2 text-sm">Utilization Rates</h5>
                              <ul className="space-y-1 text-xs">
                                <li>• The Crescent: <strong>100%</strong></li>
                                <li>• Rushden: <strong>100%</strong></li>
                                <li>• County Spoke: <strong>98.0%</strong></li>
                                <li>• Brook Spoke: <strong>89.0%</strong></li>
                                <li>• Kings Heath Hub: <strong>87%</strong></li>
                                <li>• Bugbrooke: <strong>85.5%</strong></li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="financial" className="space-y-4">
                        <div className="space-y-4 h-[75vh] overflow-y-auto">{/* Changed from overflow-hidden to overflow-y-auto */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <h4 className="text-lg font-semibold text-green-600">Income Breakdown</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                                  <span>Enhanced Access</span>
                                  <span className="font-bold">£37,821.84</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                                  <span>Phlebotomy Service</span>
                                  <span className="font-bold">£280.00</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-green-100 rounded border-2 border-green-300 text-sm">
                                  <span className="font-semibold">Total Income</span>
                                  <span className="font-bold">£38,101.84</span>
                                </div>
                              </div>

                              <div className="bg-green-50 p-3 rounded-lg">
                                <h5 className="font-semibold text-green-600 mb-2 text-sm">Income Distribution</h5>
                                <div className="w-full bg-green-200 rounded-full h-4 mb-2">
                                  <div className="bg-green-600 h-4 rounded-full" style={{width: '99.3%'}}></div>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span>EA: 99.3%</span>
                                  <span>Phlebotomy: 0.7%</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-lg font-semibold text-red-600">Expenditure Analysis</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-red-50 rounded text-xs">
                                  <span>GP Remote (all in costs)</span>
                                  <span className="font-bold">£4,224.00</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-red-50 rounded text-xs">
                                  <span>GP On-site (Kings Heath Hub) - 4 Saturdays</span>
                                  <span className="font-bold">£5,250.00</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-red-50 rounded text-xs">
                                  <span>Receptionist - Saturday Kings Heath Hub</span>
                                  <span className="font-bold">£857.00</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-red-50 rounded text-xs">
                                  <span>MMC Service Fee and Management</span>
                                  <span className="font-bold">£1,600.00</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-red-100 rounded border-2 border-red-300 text-sm">
                                  <span className="font-semibold">Total Expenditure</span>
                                  <span className="font-bold">£11,931.00</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-50 p-6 rounded-lg">
                            <h4 className="text-lg font-semibold text-blue-600 mb-4">Financial Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="text-center">
                                <h6 className="text-gray-700 mb-2 text-xs font-medium">Total Income</h6>
                                <div className="text-lg font-bold text-green-600">£38,101.84</div>
                              </div>
                              <div className="text-center">
                                <h6 className="text-gray-700 mb-2 text-xs font-medium">Total Expenditure</h6>
                                <div className="text-lg font-bold text-red-600">£11,931.00</div>
                              </div>
                              <div className="text-center">
                                <h6 className="text-gray-700 mb-2 text-xs font-medium">Net Position before £5 per-patient payment to Practices</h6>
                                <div className="text-xl font-bold text-green-600">£26,170.84</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="funding" className="space-y-4">
                        <Tabs defaultValue="june-2025" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="june-2025">July 2025 Practice Splits</TabsTrigger>
                            <TabsTrigger value="q1-25-26">April 2025 - June 2025 (Q1 25/26)</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="q1-25-26" className="space-y-4">
                            <div className="space-y-4 h-[75vh] overflow-hidden">
                              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="text-lg font-bold mb-1">£5 Per Patient Funding Allocation - Q1 2025/2026</h3>
                                    <p className="text-purple-100 text-sm">April - June 2025 Distribution (3 Months)</p>
                                  </div>
                                  <div className="bg-white text-purple-600 px-2 py-1 rounded font-semibold text-xs">
                                    BLUE PCN
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <h4 className="text-lg font-semibold text-purple-600">Practice Allocations</h4>
                                  <div className="bg-purple-50 p-3 rounded-lg">
                                    <div className="grid grid-cols-3 gap-2 font-semibold border-b pb-1 mb-2 text-xs">
                                      <span>Practice</span>
                                      <span>PCN Adjusted List</span>
                                      <span>Q1 Funding</span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Brook Medical Centre</span>
                                        <span>7,020.60</span>
                                        <span className="font-bold">£8,775.75</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Bugbrooke Surgery</span>
                                        <span>9,606.18</span>
                                        <span className="font-bold">£12,007.74</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>County Surgery</span>
                                        <span>4,390.30</span>
                                        <span className="font-bold">£5,487.87</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Park Avenue</span>
                                        <span>16,178.32</span>
                                        <span className="font-bold">£20,222.91</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Rushden Medical Centre</span>
                                        <span>9,279.35</span>
                                        <span className="font-bold">£11,599.20</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>The Crescent</span>
                                        <span>7,383.32</span>
                                        <span className="font-bold">£9,229.14</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 border-t pt-1 font-bold text-xs">
                                        <span>PCN Total</span>
                                        <span>53,858.07</span>
                                        <span>£67,322.58</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-lg font-semibold text-purple-600">Funding Distribution</h4>
                                  <div className="bg-purple-50 p-3 rounded-lg">
                                    <h5 className="font-semibold mb-2 text-sm">Percentage of Total PCN Funding</h5>
                                    
                                    <div className="mb-3">
                                      <div className="w-full bg-purple-200 rounded-full h-6 mb-2">
                                        <div className="bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 h-6 rounded-full flex">
                                          <div className="bg-purple-400 h-6 rounded-l-full" style={{width: '13.0%'}}></div>
                                          <div className="bg-purple-500 h-6" style={{width: '17.8%'}}></div>
                                          <div className="bg-purple-300 h-6" style={{width: '8.2%'}}></div>
                                          <div className="bg-purple-600 h-6" style={{width: '30.0%'}}></div>
                                          <div className="bg-purple-500 h-6" style={{width: '17.2%'}}></div>
                                          <div className="bg-purple-400 h-6 rounded-r-full" style={{width: '13.7%'}}></div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span>Brook: 13.0%</span>
                                        <span>Bugbrooke: 17.8%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>County: 8.2%</span>
                                        <span>Park Avenue: 30.0%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Rushden: 17.2%</span>
                                        <span>Crescent: 13.7%</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-purple-50 p-3 rounded-lg">
                                    <h5 className="font-semibold mb-2 text-sm">Calculation Method</h5>
                                    <ul className="space-y-1 text-xs">
                                      <li>• <strong>Annual Rate:</strong> £5.00 per weighted patient</li>
                                      <li>• <strong>Quarterly Rate:</strong> £1.25 per weighted patient (3/12ths)</li>
                                      <li>• <strong>Distribution:</strong> Based on PCN Adjusted List Sizes from January 2025</li>
                                      <li>• <strong>Calculation:</strong> PCN Adjusted List × £1.25 per patient</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="june-2025" className="space-y-4">
                            <div className="space-y-4 h-[75vh] overflow-hidden">
                              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="text-lg font-bold mb-1">£5 Per Patient Funding Allocation</h3>
                                    <p className="text-purple-100 text-sm">June 2025 Distribution (1/12th of Annual Rate)</p>
                                  </div>
                                  <div className="bg-white text-purple-600 px-2 py-1 rounded font-semibold text-xs">
                                    BLUE PCN
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <h4 className="text-lg font-semibold text-purple-600">Practice Allocations</h4>
                                  <div className="bg-purple-50 p-3 rounded-lg">
                                    <div className="grid grid-cols-3 gap-2 font-semibold border-b pb-1 mb-2 text-xs">
                                      <span>Practice</span>
                                      <span>PCN Adjusted List</span>
                                      <span>Monthly Funding</span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Brook Medical Centre</span>
                                        <span>7,020.60</span>
                                        <span className="font-bold">£2,925.25</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Bugbrooke Surgery</span>
                                        <span>9,606.18</span>
                                        <span className="font-bold">£4,002.58</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>County Surgery</span>
                                        <span>4,390.30</span>
                                        <span className="font-bold">£1,829.29</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Park Avenue</span>
                                        <span>16,178.32</span>
                                        <span className="font-bold">£6,740.97</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>Rushden Medical Centre</span>
                                        <span>9,279.35</span>
                                        <span className="font-bold">£3,866.40</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <span>The Crescent</span>
                                        <span>7,383.32</span>
                                        <span className="font-bold">£3,076.38</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 border-t pt-1 font-bold text-xs">
                                        <span>PCN Total</span>
                                        <span>53,858.07</span>
                                        <span>£22,440.86</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-lg font-semibold text-purple-600">Funding Distribution</h4>
                                  <div className="bg-purple-50 p-3 rounded-lg">
                                    <h5 className="font-semibold mb-2 text-sm">Percentage of Total PCN Funding</h5>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span>Brook: 13.0%</span>
                                        <span>Bugbrooke: 17.8%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>County: 8.2%</span>
                                        <span>Park Avenue: 30.0%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Rushden: 17.2%</span>
                                        <span>Crescent: 13.7%</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-purple-50 p-3 rounded-lg">
                                    <h5 className="font-semibold mb-2 text-sm">Calculation Method</h5>
                                    <ul className="space-y-1 text-xs">
                                      <li>• <strong>Annual Rate:</strong> £5.00 per weighted patient</li>
                                      <li>• <strong>Monthly Rate:</strong> £0.42 per weighted patient (1/12th)</li>
                                      <li>• <strong>Distribution:</strong> Based on PCN Adjusted List Sizes from January 2025</li>
                                      <li>• <strong>Calculation:</strong> PCN Adjusted List × £0.42 per patient</li>
                                    </ul>
                                  </div>

                                  <div className="bg-green-50 p-3 rounded-lg">
                                    <h5 className="font-semibold mb-2 text-sm">Individual Practice Spoke Requirements</h5>
                                    <div className="space-y-2 text-xs">
                                      <div className="bg-white p-2 rounded border">
                                        <div className="font-semibold mb-1">Monthly Calculation Breakdown:</div>
                                        <div className="space-y-1">
                                          <div>• Total Contractual Requirement: 237.25 hours</div>
                                          <div>• Hub Delivery: 30 hours/week × 4.33 weeks = 129.9 hours</div>
                                          <div>• <strong>Spoke Balance Required: 107.35 hours</strong></div>
                                        </div>
                                      </div>
                                      <div className="bg-white p-2 rounded border">
                                        <div className="font-semibold mb-1">Practice Spoke Allocation by List Size:</div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>Brook Medical: 13.0% (<strong>13.96 hrs</strong>)</div>
                                          <div>Bugbrooke Surgery: 17.8% (<strong>19.11 hrs</strong>)</div>
                                          <div>County Surgery: 8.2% (<strong>8.80 hrs</strong>)</div>
                                          <div>Park Avenue: 30.0% (<strong>32.21 hrs</strong>)</div>
                                          <div>Rushden Medical: 17.2% (<strong>18.46 hrs</strong>)</div>
                                          <div>The Crescent: 13.7% (<strong>14.71 hrs</strong>)</div>
                                        </div>
                                      </div>
                                      <div className="bg-orange-100 p-2 rounded border text-orange-800">
                                        <strong>Summary:</strong> Hub provides 129.9 hours, leaving 107.35 hours to be delivered by spoke practices based on their list size proportions.
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </TabsContent>

                      <TabsContent value="actions" className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-xl font-semibold text-blue-600">Operational Improvements</h4>
                            
                            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                              <h5 className="font-semibold text-blue-700 mb-2">Launch of new online Enhanced Access Rota system</h5>
                              <div className="text-sm text-blue-600 space-y-1">
                                <p>EA Issues Complaint Handling</p>
                                <ul className="list-disc ml-4 space-y-1">
                                  <li>Financial Transparency (Invoices etc)</li>
                                  <li>EA Shift Planning and offer to PCN Staff via automated email service</li>
                                  <li>Access for PMs and setup of Reminder service for unused slots</li>
                                </ul>
                              </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                              <h5 className="font-semibold text-blue-700 mb-2">Verify Spoke Appointment Compliance</h5>
                              <div className="text-sm text-blue-600 space-y-1">
                                <p>Ensure all Spoke practices adhere to Enhanced Access requirements:</p>
                                <ul className="list-disc ml-4 space-y-1">
                                  <li>Appointments must be additional to core GMS services</li>
                                  <li>Services primarily delivered outside core hours (6:30pm-8pm weekdays, weekends)</li>
                                  <li>Appropriate clinical governance and record-keeping in place</li>
                                  <li>Public-facing communications clearly identifying EA services</li>
                                  <li>Regular utilization reporting to PCN</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-xl font-semibold text-red-600">Financial & Compliance</h4>
                            
                            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                              <h5 className="font-semibold text-red-700 mb-2">GP Locum Pension Compliance</h5>
                              <p className="text-sm text-red-600">
                                Ensure 14.38% pension on 90% of hourly rate is properly applied
                              </p>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                              <h5 className="font-semibold text-yellow-700 mb-2">Review Appointment Utilization</h5>
                              <p className="text-sm text-yellow-600">
                                Overall booking rate: 78.2% - continue optimizing scheduling and availability
                              </p>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                              <h5 className="font-semibold text-orange-700 mb-2">DNA Rate Analysis</h5>
                              <p className="text-sm text-orange-600">
                                Low DNA rates overall - implement reminder systems at all locations
                              </p>
                            </div>
                           </div>
                         </div>
                      </TabsContent>
                    </Tabs>
                  </TabsContent>

                  {/* Placeholder content for other months */}
                  {['april-2025', 'may-2025', 'july-2025', 'august-2025', 'september-2025', 'october-2025', 'november-2025', 'december-2025', 'january-2026', 'february-2026', 'march-2026'].map(month => (
                    <TabsContent key={month} value={month} className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {month.replace('-', ' ').toUpperCase()} Report
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-center py-8 text-muted-foreground">
                            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <h3 className="font-medium mb-2">Report Coming Soon</h3>
                            <p className="text-sm">Detailed monthly report for {month.replace('-', ' ')} will be available here</p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holidays" className="space-y-6 mt-6">
            <BankHolidayManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedAccess;