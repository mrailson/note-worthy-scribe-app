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
                  <TabsList className="grid w-full grid-cols-6 gap-1 mb-6">
                    <TabsTrigger value="october-2025" className="text-xs">Oct 2025</TabsTrigger>
                    <TabsTrigger value="november-2025" className="text-xs">Nov 2025</TabsTrigger>
                    <TabsTrigger value="december-2025" className="text-xs">Dec 2025</TabsTrigger>
                    <TabsTrigger value="january-2026" className="text-xs">Jan 2026</TabsTrigger>
                    <TabsTrigger value="february-2026" className="text-xs">Feb 2026</TabsTrigger>
                    <TabsTrigger value="march-2026" className="text-xs">Mar 2026</TabsTrigger>
                  </TabsList>

                  {/* June 2025 Report */}
                  <TabsContent value="june-2025" className="space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Key Metrics Card */}
                      <Card className="md:col-span-2 lg:col-span-3">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            June 2025 - Key Performance Metrics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">95%</div>
                              <div className="text-sm text-blue-700 dark:text-blue-300">Service Coverage</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg">
                              <div className="text-2xl font-bold text-green-600">1,247</div>
                              <div className="text-sm text-green-700 dark:text-green-300">Patient Consultations</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">8.7</div>
                              <div className="text-sm text-purple-700 dark:text-purple-300">Avg. Patient Rating</div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg">
                              <div className="text-2xl font-bold text-orange-600">12.3</div>
                              <div className="text-sm text-orange-700 dark:text-orange-300">Avg. Wait Time (min)</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Service Delivery Overview */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Service Delivery</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Morning Slots</span>
                              <Badge variant="secondary">89% Filled</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Evening Slots</span>
                              <Badge variant="secondary">92% Filled</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Weekend Slots</span>
                              <Badge variant="secondary">87% Filled</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Remote Consultations</span>
                              <Badge variant="secondary">34% of Total</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Staff Performance */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Staff Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">GP Utilization</span>
                              <Badge variant="default">94%</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Staff Satisfaction</span>
                              <Badge variant="default">8.2/10</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Training Hours</span>
                              <Badge variant="secondary">142 hrs</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Sick Leave Rate</span>
                              <Badge variant="outline">2.1%</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Financial Summary */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Total Revenue</span>
                              <span className="font-semibold">£47,320</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Operating Costs</span>
                              <span className="font-semibold">£31,890</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Net Margin</span>
                              <Badge variant="default">32.6%</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Cost per Consultation</span>
                              <span className="font-semibold">£25.56</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Quality Indicators */}
                      <Card className="md:col-span-2 lg:col-span-3">
                        <CardHeader>
                          <CardTitle className="text-lg">Quality Indicators & Compliance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm text-muted-foreground">Clinical Quality</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Same-day Availability</span>
                                  <Badge variant="default">91%</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">48hr Follow-up Rate</span>
                                  <Badge variant="default">97%</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Prescription Accuracy</span>
                                  <Badge variant="default">99.2%</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Patient Safety Incidents</span>
                                  <Badge variant="outline">0</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm text-muted-foreground">Regulatory Compliance</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">CQC Standards Met</span>
                                  <Badge variant="default">100%</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Data Protection Compliance</span>
                                  <Badge variant="default">100%</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Staff Training Compliance</span>
                                  <Badge variant="default">96%</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm">Documentation Complete</span>
                                  <Badge variant="default">98%</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Key Achievements */}
                      <Card className="md:col-span-2 lg:col-span-3">
                        <CardHeader>
                          <CardTitle className="text-lg">Key Achievements & Highlights</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Achieved 95% service coverage across all time slots</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Reduced average wait times by 18% compared to May</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Implemented new remote consultation platform</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Zero patient safety incidents reported</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Exceeded patient satisfaction targets</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Successfully completed CQC compliance audit</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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