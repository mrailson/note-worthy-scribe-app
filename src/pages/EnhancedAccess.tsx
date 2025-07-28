import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Calendar, Clock, MapPin, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

interface StaffingSlot {
  day: string;
  timeSlot: string;
  location: string;
  gpAssigned: string | null;
  isCompliant: boolean;
}

const EnhancedAccess = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  // Core hours configuration
  const coreHours = {
    weekdays: { start: "18:30", end: "20:00", location: "Various Practices" },
    saturday: { start: "09:00", end: "17:00", location: "Kings Heath Health Centre" }
  };

  // Mock staffing data - in real app this would come from database
  const [staffingData, setStaffingData] = useState<StaffingSlot[]>([
    { day: "Monday", timeSlot: "18:30-20:00", location: "Various Practices", gpAssigned: "Dr. Smith", isCompliant: true },
    { day: "Tuesday", timeSlot: "18:30-20:00", location: "Various Practices", gpAssigned: null, isCompliant: false },
    { day: "Wednesday", timeSlot: "18:30-20:00", location: "Various Practices", gpAssigned: "Dr. Johnson", isCompliant: true },
    { day: "Thursday", timeSlot: "18:30-20:00", location: "Various Practices", gpAssigned: "Dr. Brown", isCompliant: true },
    { day: "Friday", timeSlot: "18:30-20:00", location: "Various Practices", gpAssigned: null, isCompliant: false },
    { day: "Saturday", timeSlot: "09:00-17:00", location: "Kings Heath Health Centre", gpAssigned: "Dr. Wilson", isCompliant: true },
  ]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getStaffingForDay = (day: Date) => {
    const dayName = format(day, "EEEE");
    return staffingData.find(slot => slot.day === dayName);
  };

  const getComplianceStats = () => {
    const total = staffingData.length;
    const compliant = staffingData.filter(slot => slot.isCompliant).length;
    return { compliant, total, percentage: Math.round((compliant / total) * 100) };
  };

  const stats = getComplianceStats();

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
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
              <Badge variant={stats.percentage >= 80 ? "default" : "destructive"} className="text-sm">
                {stats.compliant}/{stats.total} Compliant ({stats.percentage}%)
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
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
                  Various Practices (Remote/On-site)
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
                  Kings Heath Health Centre
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Navigation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Staffing Calendar
              </CardTitle>
              <div className="flex items-center gap-2">
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
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((day, index) => {
                const dayName = format(day, "EEEE");
                const isWeekend = index === 5 || index === 6; // Saturday = 5, Sunday = 6
                const isSaturday = index === 5;
                const isSunday = index === 6;
                const staffing = getStaffingForDay(day);
                
                // Skip Sunday as it's not a core day
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

                const isCompliant = staffing?.isCompliant ?? false;
                const hasGP = staffing?.gpAssigned;

                return (
                  <div 
                    key={day.toISOString()} 
                    className={`p-4 border rounded-lg transition-colors ${
                      isCompliant 
                        ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20" 
                        : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="text-center">
                        <h3 className="font-medium">{format(day, "EEE")}</h3>
                        <p className="text-xs text-muted-foreground">{format(day, "MMM d")}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-xs">
                          <p className="font-medium">
                            {isSaturday ? "9:00 AM - 5:00 PM" : "6:30 PM - 8:00 PM"}
                          </p>
                          <p className="text-muted-foreground">
                            {isSaturday ? "Kings Heath HC" : "Various Practices"}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-center">
                          {isCompliant ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        
                        <div className="text-center">
                          {hasGP ? (
                            <Badge variant="secondary" className="text-xs">
                              {hasGP}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              No GP assigned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staffing Actions Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {staffingData
                .filter(slot => !slot.isCompliant)
                .map((slot, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50/50 dark:border-red-800 dark:bg-red-900/20">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="font-medium text-sm">{slot.day} {slot.timeSlot}</p>
                        <p className="text-xs text-muted-foreground">{slot.location}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Assign GP
                    </Button>
                  </div>
                ))}
              {staffingData.every(slot => slot.isCompliant) && (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  All core hours are fully staffed
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedAccess;