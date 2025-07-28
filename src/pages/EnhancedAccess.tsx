import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { StaffManagement } from "@/components/StaffManagement";
import { ShiftAssignment } from "@/components/ShiftAssignment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Users, AlertTriangle, CheckCircle, Settings, Activity, Droplets, UserCheck, BarChart3, FileText, TrendingUp } from "lucide-react";
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
  const slides = ['Performance', 'Service Delivery', 'Financial', 'Funding', 'Actions'];
  const [complianceStats, setComplianceStats] = useState<ComplianceStats>({ total: 0, compliant: 0, percentage: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [weeklyAssignments, setWeeklyAssignments] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentWeek);
  const monthEnd = endOfMonth(currentWeek);

  useEffect(() => {
    calculateComplianceStats();
    fetchWeeklyData();
  }, [currentWeek, refreshTrigger, isMonthlyView]);

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
      const totalSlots = (templates || []).length * 6; // 6 working days (Mon-Sat)
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
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Enhanced Access Services</h1>
              <p className="text-muted-foreground mt-1">Manage staffing and compliance for extended GP services</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={complianceStats.percentage >= 80 ? "default" : "destructive"} className="text-sm">
                {complianceStats.compliant}/{complianceStats.total} Compliant ({complianceStats.percentage}%)
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* View Toggle */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {isMonthlyView ? `${format(currentWeek, "MMMM yyyy")}` : `This Week - ${formatDateWithOrdinal(weekStart)}`}
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="view-toggle" className="text-sm">Weekly</Label>
                      <Switch
                        id="view-toggle"
                        checked={isMonthlyView}
                        onCheckedChange={setIsMonthlyView}
                      />
                      <Label htmlFor="view-toggle" className="text-sm">Monthly</Label>
                    </div>
                    {isMonthlyView && (
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="detail-toggle" className="text-sm">Summary</Label>
                        <Switch
                          id="detail-toggle"
                          checked={isDetailedView}
                          onCheckedChange={setIsDetailedView}
                        />
                        <Label htmlFor="detail-toggle" className="text-sm">Detailed</Label>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                        {isMonthlyView ? 'Previous Month' : 'Previous'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                        {isMonthlyView ? 'Next Month' : 'Next'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                 {isMonthlyView ? (
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
                      
                      const hasAssignments = !isSunday && shifts.some(shift => {
                        const shiftAssignments = weeklyAssignments.filter(a => 
                          a.shift_template_id === shift.id && 
                          a.assignment_date === format(day, 'yyyy-MM-dd')
                        );
                        return shiftAssignments.length > 0;
                      });
                      
                      const allAssigned = !isSunday && shifts.length > 0 && shifts.every(shift => {
                        const shiftAssignments = weeklyAssignments.filter(a => 
                          a.shift_template_id === shift.id && 
                          a.assignment_date === format(day, 'yyyy-MM-dd')
                        );
                        return shiftAssignments.length > 0;
                      });

                      return (
                        <div 
                          key={day.toISOString()} 
                          className={`p-2 border rounded text-center ${
                            isDetailedView ? 'min-h-[120px]' : 'min-h-[60px]'
                          } ${
                            isSunday 
                              ? "border-border/50 bg-muted/30"
                              : allAssigned 
                              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                              : hasAssignments
                              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                          }`}
                        >
                          <div className="text-sm font-medium">{format(day, "d")}</div>
                          {isSunday ? (
                            <div className="text-xs text-muted-foreground mt-1">No service</div>
                          ) : isDetailedView ? (
                            <div className="mt-1 space-y-1">
                              {shifts.map(shift => {
                                const shiftAssignments = weeklyAssignments.filter(a => 
                                  a.shift_template_id === shift.id && 
                                  a.assignment_date === format(day, 'yyyy-MM-dd')
                                );
                                return (
                                  <div key={shift.id} className="text-xs">
                                    <div className="font-medium text-xs">{shift.start_time}</div>
                                    {shiftAssignments.length > 0 ? (
                                      shiftAssignments.map(assignment => (
                                        <div key={assignment.id} className="text-green-600 truncate">
                                          {formatStaffName(assignment.staff_member.name, assignment.staff_member.role)}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-red-600">Unassigned</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : shifts.length > 0 ? (
                            <div className="flex justify-center mt-1">
                              {allAssigned ? (
                                <CheckCircle className="h-3 w-3 text-green-600" />
                              ) : hasAssignments ? (
                                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground mt-1">No shifts</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-3">
                    {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day, index) => {
                      const dayOfWeek = index + 1; // 1=Monday, 2=Tuesday, etc.
                      const shifts = getShiftsForDay(dayOfWeek);
                      const isSunday = index === 6;
                      
                      if (isSunday) {
                        return (
                          <div key={day.toISOString()} className="p-3 border border-border/50 rounded-lg bg-muted/30">
                            <div className="text-center">
                              <h3 className="font-medium text-muted-foreground text-sm">{format(day, "EEE")}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{formatDateWithOrdinal(day)}</p>
                              <p className="text-xs text-muted-foreground mt-2">No service</p>
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
                      
                      const allAssigned = shifts.length > 0 && shifts.every(shift => {
                        const shiftAssignments = weeklyAssignments.filter(a => 
                          a.shift_template_id === shift.id && 
                          a.assignment_date === format(day, 'yyyy-MM-dd')
                        );
                        return shiftAssignments.length > 0;
                      });
                      
                      return (
                        <div 
                          key={day.toISOString()} 
                          className={`p-3 border rounded-lg text-center ${
                            allAssigned 
                              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                              : hasAssignments
                              ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                              : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                          }`}
                        >
                          <h3 className="font-medium text-sm">{format(day, "EEE")}</h3>
                          <p className="text-xs text-muted-foreground mb-2">{formatDateWithOrdinal(day)}</p>
                          
                          <div className="space-y-1">
                            {shifts.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No shifts</p>
                            ) : (
                              shifts.map((shift) => {
                                const shiftAssignments = weeklyAssignments.filter(a => 
                                  a.shift_template_id === shift.id && 
                                  a.assignment_date === format(day, 'yyyy-MM-dd')
                                );
                                
                                return (
                                  <div key={shift.id} className="text-xs">
                                    <div className="font-medium">{shift.start_time}-{shift.end_time}</div>
                                    <div className="text-muted-foreground">{getLocationDisplay(shift.location)}</div>
                                    {shiftAssignments.length > 0 ? (
                                      <div className="space-y-1 mt-1">
                                         {shiftAssignments.map((assignment, idx) => (
                                           <Badge key={assignment.id} variant="secondary" className="text-xs flex items-center gap-1">
                                             {getRoleIcon(assignment.staff_member?.role)}
                                             {formatStaffName(assignment.staff_member?.name || 'Assigned', assignment.staff_member?.role || '')}
                                           </Badge>
                                         ))}
                                        {shiftAssignments.length > 1 && (
                                          <div className="text-xs text-muted-foreground">
                                            ({shiftAssignments.length} staff assigned)
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <Badge variant="destructive" className="text-xs mt-1">
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
            
            {/* Core Hours Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Core Hours Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Monday - Friday</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      6:30 PM - 8:00 PM
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Remote (Default) or Various Practices
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
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complianceStats.compliant}/{complianceStats.total}</div>
                  <p className="text-xs text-muted-foreground">Shifts Assigned</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complianceStats.percentage}%</div>
                  <p className="text-xs text-muted-foreground">Coverage Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Default Staffing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <div>Saturday Phlebotomist: 9AM-5PM</div>
                    <div>Saturday Receptionist: 9AM-5PM</div>
                    <div className="text-xs text-muted-foreground">Kings Heath Health Centre</div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Monthly Reports (April 2025 - March 2026)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="june-2025" className="w-full">
                  <TabsList className="grid w-full grid-cols-6 gap-1 mb-6">
                    <TabsTrigger value="april-2025" className="text-xs">Apr 2025</TabsTrigger>
                    <TabsTrigger value="may-2025" className="text-xs">May 2025</TabsTrigger>
                    <TabsTrigger value="june-2025" className="text-xs">Jun 2025</TabsTrigger>
                    <TabsTrigger value="july-2025" className="text-xs">Jul 2025</TabsTrigger>
                    <TabsTrigger value="august-2025" className="text-xs">Aug 2025</TabsTrigger>
                    <TabsTrigger value="september-2025" className="text-xs">Sep 2025</TabsTrigger>
                  </TabsList>

                  {/* June 2025 Report */}
                  <TabsContent value="june-2025" className="space-y-4">
                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="grid w-full grid-cols-5 mb-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="service">Service Delivery</TabsTrigger>
                        <TabsTrigger value="financial">Financial</TabsTrigger>
                        <TabsTrigger value="funding">Funding</TabsTrigger>
                        <TabsTrigger value="actions">Actions</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-4">
                       <h4 className="text-lg font-semibold text-blue-600">Blue PCN - Enhanced Access Overview - June 2025</h4>

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

                      {/* Service Delivery */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold text-blue-600">Service Hours by Location</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                              <span className="font-medium">Kings Heath Hub</span>
                              <span className="font-bold">146 hrs</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span>Brook</span>
                              <span className="font-bold">44.5 hrs</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span>Bugbrooke</span>
                              <span className="font-bold">35.5 hrs</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span>County</span>
                              <span className="font-bold">18 hrs</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span>The Crescent</span>
                              <span className="font-bold">18 hrs</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span>Rushden</span>
                              <span className="font-bold">2 hrs</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 italic">
                            (GP F2F & Remote + Covid & Phlebotomy)
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h5 className="font-semibold text-blue-600 mb-3">Service Types</h5>
                            <ul className="space-y-2 text-sm">
                              <li>• Face-to-Face GP appointments (Kings Heath Hub)</li>
                              <li>• Remote GP Phone Calls (Park Avenue)</li>
                              <li>• Phlebotomy Service (Park Avenue)</li>
                              <li>• 15-min appointments (Bugbrooke)</li>
                              <li>• 5-min appointments (Brook, County)</li>
                              <li>• GP Remote Phone Calls (The Crescent)</li>
                            </ul>
                          </div>

                          <div className="bg-green-50 p-4 rounded-lg">
                            <h5 className="font-semibold text-green-600 mb-3">Utilization Rates</h5>
                            <ul className="space-y-2 text-sm">
                              <li>• The Crescent: <strong>100%</strong></li>
                              <li>• Rushden: <strong>100%</strong></li>
                              <li>• County Spoke: <strong>98.0%</strong></li>
                              <li>• Brook Spoke: <strong>89.0%</strong></li>
                              <li>• Kings Heath Hub: <strong>84.4%</strong></li>
                              <li>• Bugbrooke: <strong>64.5%</strong></li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Financial Analysis */}
                      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold mb-2">Income & Expenditure Analysis</h3>
                            <p className="text-green-100">Enhanced Access - June 2025</p>
                          </div>
                          <div className="bg-white text-green-600 px-3 py-2 rounded font-semibold text-sm">
                            BLUE PCN
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold text-green-600">Income Breakdown</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                              <span>Enhanced Access</span>
                              <span className="font-bold">£37,821.84</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                              <span>Phlebotomy Service</span>
                              <span className="font-bold">£280.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-green-100 rounded border-2 border-green-300">
                              <span className="font-semibold">Total Income</span>
                              <span className="font-bold text-lg">£38,101.84</span>
                            </div>
                          </div>

                          <div className="bg-green-50 p-4 rounded-lg">
                            <h5 className="font-semibold text-green-600 mb-2">Income Distribution</h5>
                            <div className="w-full bg-green-200 rounded-full h-4 mb-2">
                              <div className="bg-green-600 h-4 rounded-full" style={{width: '99.3%'}}></div>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>EA: 99.3%</span>
                              <span>Phlebotomy: 0.7%</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold text-red-600">Expenditure Analysis</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span>GP Remote (all in costs)</span>
                              <span className="font-bold">£4,224.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span>GP On-site (Kings Heath Hub) - 4 Saturdays</span>
                              <span className="font-bold">£5,250.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span>Receptionist - Saturday Kings Heath Hub</span>
                              <span className="font-bold">£857.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <span>MMC Service Fee and Management</span>
                              <span className="font-bold">£1,600.00</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-100 rounded border-2 border-red-300">
                              <span className="font-semibold">Total Expenditure</span>
                              <span className="font-bold text-lg">£11,931.00</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-6 rounded-lg">
                        <h4 className="text-xl font-semibold text-blue-600 mb-4">Financial Summary</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="text-center">
                            <h6 className="text-gray-600 mb-2">Total Income</h6>
                            <div className="text-2xl font-bold text-green-600">£38,101.84</div>
                          </div>
                          <div className="text-center">
                            <h6 className="text-gray-600 mb-2">Total Expenditure</h6>
                            <div className="text-2xl font-bold text-red-600">£11,931.00</div>
                          </div>
                          <div className="text-center">
                            <h6 className="text-gray-600 mb-2">Net Position before £5 per-patient payment to Practices</h6>
                            <div className="text-3xl font-bold text-green-600">£26,170.84</div>
                          </div>
                        </div>
                      </div>

                      {/* £5 Per Patient Funding */}
                      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold mb-2">£5 Per Patient Funding Allocation</h3>
                            <p className="text-purple-100">June 2025 Distribution (1/12th of Annual Rate)</p>
                          </div>
                          <div className="bg-white text-purple-600 px-3 py-2 rounded font-semibold text-sm">
                            BLUE PCN
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold text-purple-600">Practice Allocations</h4>
                          <div className="bg-purple-50 p-4 rounded-lg">
                            <div className="grid grid-cols-3 gap-4 font-semibold border-b pb-2 mb-4">
                              <span>Practice</span>
                              <span>PCN Adjusted List</span>
                              <span>Monthly Funding</span>
                            </div>
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-4">
                                <span>Brook Medical Centre</span>
                                <span>7,020.60</span>
                                <span className="font-bold">£2,925.25</span>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <span>Bugbrooke Surgery</span>
                                <span>9,606.18</span>
                                <span className="font-bold">£4,002.58</span>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <span>County Surgery</span>
                                <span>4,390.30</span>
                                <span className="font-bold">£1,829.29</span>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <span>Park Avenue</span>
                                <span>16,178.32</span>
                                <span className="font-bold">£6,740.97</span>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <span>Rushden Medical Centre</span>
                                <span>9,279.35</span>
                                <span className="font-bold">£3,866.40</span>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                <span>The Crescent</span>
                                <span>7,383.32</span>
                                <span className="font-bold">£3,076.38</span>
                              </div>
                              <div className="grid grid-cols-3 gap-4 border-t pt-2 font-bold">
                                <span>PCN Total</span>
                                <span>53,858.07</span>
                                <span>£22,440.86</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold text-purple-600">Funding Distribution</h4>
                          <div className="bg-purple-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3">Percentage of Total PCN Funding</h5>
                            <div className="space-y-2">
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

                          <div className="bg-purple-50 p-4 rounded-lg">
                            <h5 className="font-semibold mb-3">Calculation Method</h5>
                            <ul className="space-y-2 text-sm">
                              <li>• <strong>Annual Rate:</strong> £5.00 per weighted patient</li>
                              <li>• <strong>Monthly Rate:</strong> £0.42 per weighted patient (1/12th)</li>
                              <li>• <strong>Distribution:</strong> Based on PCN Adjusted List Sizes from January 2025</li>
                              <li>• <strong>Calculation:</strong> PCN Adjusted List × £0.42 per patient</li>
                            </ul>
                          </div>

                          <div className="bg-purple-100 p-4 rounded-lg border-2 border-purple-300">
                            <p className="text-sm font-medium">
                              <strong>BOTTOM LINE:</strong> Monthly £5 per patient funding totals £22,440.86, 
                              with Park Avenue receiving the largest share (30%) based on weighted list size
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Recommendations & Action Points */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold mb-2">Recommendations & Action Points</h3>
                            <p className="text-blue-100">June 2025</p>
                          </div>
                          <div className="bg-white text-blue-600 px-3 py-2 rounded font-semibold text-sm">
                            BLUE PCN
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-xl font-semibold text-blue-600">Operational Improvements</h4>
                          
                          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                            <h5 className="font-semibold text-green-700 mb-2">Excellent Performance Across Top Spokes</h5>
                            <p className="text-sm text-green-600">
                              Three spokes achieving 100% utilization (The Crescent, Rushden) and County at 98% - continue current approach
                            </p>
                          </div>

                          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                            <h5 className="font-semibold text-blue-700 mb-2">Launch of new online Enhanced Access Rota system</h5>
                            <p className="text-sm text-blue-600">Issue Feedback - Due Mid August</p>
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
                                <li>• Kings Heath Hub: <strong>84.4%</strong></li>
                                <li>• Bugbrooke: <strong>64.5%</strong></li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="financial" className="space-y-4">
                        <div className="space-y-4 h-[75vh] overflow-hidden">
                          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-lg font-bold mb-1">Income & Expenditure Analysis</h3>
                                <p className="text-green-100 text-sm">Enhanced Access - June 2025</p>
                              </div>
                              <div className="bg-white text-green-600 px-2 py-1 rounded font-semibold text-xs">
                                BLUE PCN
                              </div>
                            </div>
                          </div>

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

                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="text-lg font-semibold text-blue-600 mb-3">Financial Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="text-center">
                                <h6 className="text-gray-600 mb-1 text-xs">Total Income</h6>
                                <div className="text-lg font-bold text-green-600">£38,101.84</div>
                              </div>
                              <div className="text-center">
                                <h6 className="text-gray-600 mb-1 text-xs">Total Expenditure</h6>
                                <div className="text-lg font-bold text-red-600">£11,931.00</div>
                              </div>
                              <div className="text-center">
                                <h6 className="text-gray-600 mb-1 text-xs">Net Position before £5 per-patient payment to Practices</h6>
                                <div className="text-xl font-bold text-green-600">£26,170.84</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="funding" className="space-y-4">
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

                              <div className="bg-purple-100 p-3 rounded-lg border-2 border-purple-300">
                                <p className="text-xs font-medium">
                                  <strong>BOTTOM LINE:</strong> Monthly £5 per patient funding totals £22,440.86, 
                                  with Park Avenue receiving the largest share (30%) based on weighted list size
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="actions" className="space-y-4">
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Actions content coming soon</p>
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
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedAccess;