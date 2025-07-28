import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { StaffManagement } from "@/components/StaffManagement";
import { ShiftAssignment } from "@/components/ShiftAssignment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, Users, AlertTriangle, CheckCircle, Settings, Stethoscope, Droplets, UserCheck } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ComplianceStats {
  total: number;
  compliant: number;
  percentage: number;
}

const EnhancedAccess = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [complianceStats, setComplianceStats] = useState<ComplianceStats>({ total: 0, compliant: 0, percentage: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [weeklyAssignments, setWeeklyAssignments] = useState<any[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  useEffect(() => {
    calculateComplianceStats();
    fetchWeeklyData();
  }, [currentWeek, refreshTrigger]);

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
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      // Get shift templates
      const { data: templates, error: templatesError } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week');

      if (templatesError) throw templatesError;

      // Get assignments for current week
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
      console.error('Error fetching weekly data:', error);
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
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
  };

  const handleAssignmentChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'doctor':
      case 'dr':
        return <Stethoscope className="h-3 w-3" />;
      case 'phlebotomist':
        return <Droplets className="h-3 w-3" />;
      case 'receptionist':
        return <UserCheck className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
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
            {/* Current Week View */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    This Week - {format(weekStart, "MMM d, yyyy")}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                      Next
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
                            <p className="text-xs text-muted-foreground mt-1">{format(day, "MMM d")}</p>
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
                        <p className="text-xs text-muted-foreground mb-2">{format(day, "MMM d")}</p>
                        
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
                                           {assignment.staff_member?.name || 'Assigned'}
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
            <div className="flex items-center gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                Previous Week
              </Button>
              <span className="text-sm font-medium px-3">
                Week of {format(weekStart, "MMM d, yyyy")}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                Next Week
              </Button>
            </div>
            <ShiftAssignment 
              currentWeek={currentWeek} 
              onAssignmentChange={handleAssignmentChange}
            />
          </TabsContent>
          
          <TabsContent value="staff" className="space-y-6 mt-6">
            <StaffManagement />
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Hours & Performance Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-medium mb-2">Coming Soon</h3>
                  <p className="text-sm">Detailed reports and analytics will be available here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedAccess;