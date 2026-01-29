import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { useResponsibilityInstances } from '@/hooks/useResponsibilityInstances';
import { useResponsibilities } from '@/hooks/useResponsibilities';
import { cn } from '@/lib/utils';
import type { ResponsibilityInstance } from '@/types/responsibilityTypes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function PracticeCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedInstance, setSelectedInstance] = useState<ResponsibilityInstance | null>(null);
  
  const { instances, loading, updateInstanceStatus } = useResponsibilityInstances();
  const { categories } = useResponsibilities();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getInstancesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return instances.filter(i => i.due_date === dateStr);
  };

  const getCategoryColour = (categoryId: string | null | undefined) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return 'bg-gray-400';
    switch (cat.colour) {
      case 'blue': return 'bg-blue-500';
      case 'green': return 'bg-green-500';
      case 'purple': return 'bg-purple-500';
      case 'amber': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      case 'teal': return 'bg-teal-500';
      case 'pink': return 'bg-pink-500';
      case 'indigo': return 'bg-indigo-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'completed': return 'ring-2 ring-green-500';
      case 'overdue': return 'ring-2 ring-red-500';
      case 'in_progress': return 'ring-2 ring-blue-500';
      default: return '';
    }
  };

  const handleMarkComplete = async () => {
    if (selectedInstance) {
      await updateInstanceStatus(selectedInstance.id, 'completed');
      setSelectedInstance(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[200px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dayInstances = getInstancesForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] p-2 border rounded-lg transition-colors",
                    isCurrentMonth ? "bg-background" : "bg-muted/30",
                    isToday(day) && "border-primary border-2",
                    !isCurrentMonth && "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isToday(day) && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayInstances.slice(0, 3).map(instance => (
                      <button
                        key={instance.id}
                        onClick={() => setSelectedInstance(instance)}
                        className={cn(
                          "w-full text-left text-xs p-1 rounded truncate text-white",
                          getCategoryColour(instance.responsibility?.category_id),
                          getStatusIndicator(instance.status),
                          "hover:opacity-80 transition-opacity"
                        )}
                        title={instance.responsibility?.title}
                      >
                        {instance.status === 'completed' && (
                          <CheckCircle2 className="inline h-3 w-3 mr-1" />
                        )}
                        {instance.responsibility?.title}
                      </button>
                    ))}
                    {dayInstances.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayInstances.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-green-500"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-red-500"></div>
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-blue-500"></div>
              <span>In Progress</span>
            </div>
            <span className="text-muted-foreground">|</span>
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2">
                <div className={cn("w-4 h-4 rounded", getCategoryColour(cat.id))}></div>
                <span>{cat.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instance Detail Dialog */}
      <Dialog open={!!selectedInstance} onOpenChange={() => setSelectedInstance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedInstance?.responsibility?.title}</DialogTitle>
          </DialogHeader>
          {selectedInstance && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Due Date:</span>
                  <p className="font-medium">{format(new Date(selectedInstance.due_date), 'd MMMM yyyy')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge 
                    variant={
                      selectedInstance.status === 'completed' ? 'default' :
                      selectedInstance.status === 'overdue' ? 'destructive' : 'secondary'
                    }
                    className="ml-2"
                  >
                    {selectedInstance.status}
                  </Badge>
                </div>
                {selectedInstance.assignment?.assigned_to_role && (
                  <div>
                    <span className="text-muted-foreground">Assigned to:</span>
                    <p className="font-medium">{selectedInstance.assignment.assigned_to_role}</p>
                  </div>
                )}
                {selectedInstance.responsibility?.category && (
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-medium">{selectedInstance.responsibility.category.name}</p>
                  </div>
                )}
              </div>
              
              {selectedInstance.responsibility?.description && (
                <div>
                  <span className="text-muted-foreground text-sm">Description:</span>
                  <p className="text-sm mt-1">{selectedInstance.responsibility.description}</p>
                </div>
              )}

              {selectedInstance.status !== 'completed' && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedInstance(null)}>
                    Close
                  </Button>
                  <Button onClick={handleMarkComplete}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
