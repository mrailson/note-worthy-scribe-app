import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useResponsibilityInstances } from '@/hooks/useResponsibilityInstances';
import { useResponsibilities } from '@/hooks/useResponsibilities';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ListTodo,
  TrendingUp,
  CalendarDays
} from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

export function DashboardOverview() {
  const { 
    instances, 
    loading, 
    getOverdueInstances, 
    getPendingInstances, 
    getCompletedInstances,
    getCompletionRate,
    updateInstanceStatus
  } = useResponsibilityInstances();
  const { responsibilities } = useResponsibilities();

  const overdue = getOverdueInstances();
  const pending = getPendingInstances();
  const completed = getCompletedInstances();
  const completionRate = getCompletionRate();

  // Get upcoming tasks (due in next 7 days)
  const upcomingTasks = instances.filter(i => {
    if (i.status === 'completed' || i.status === 'not_applicable') return false;
    const dueDate = new Date(i.due_date);
    const nextWeek = addDays(new Date(), 7);
    return dueDate <= nextWeek && dueDate >= new Date();
  }).slice(0, 5);

  const getStatusColour = (status: string) => {
    switch (status) {
      case 'overdue': return 'bg-red-500';
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      default: return 'bg-amber-500';
    }
  };

  const getDueDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'd MMM yyyy');
  };

  const handleMarkComplete = async (instanceId: string) => {
    await updateInstanceStatus(instanceId, 'completed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={cn(overdue.length > 0 && "border-red-300 bg-red-50 dark:bg-red-950/20")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", overdue.length > 0 ? "text-red-500" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", overdue.length > 0 && "text-red-600")}>
              {overdue.length}
            </div>
            <p className="text-xs text-muted-foreground">tasks need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
            <p className="text-xs text-muted-foreground">tasks in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
            <p className="text-xs text-muted-foreground">tasks done</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all" 
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alert */}
      {overdue.length > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdue.slice(0, 5).map(instance => (
                <div key={instance.id} className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg border border-red-200">
                  <div>
                    <p className="font-medium">{instance.responsibility?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {format(new Date(instance.due_date), 'd MMM yyyy')}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleMarkComplete(instance.id)}
                  >
                    Mark Complete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Upcoming This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tasks due this week 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map(instance => (
                  <div key={instance.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", getStatusColour(instance.status))} />
                      <div>
                        <p className="font-medium">{instance.responsibility?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {getDueDateLabel(instance.due_date)}
                          {instance.assignment?.assigned_to_role && (
                            <span> • {instance.assignment.assigned_to_role}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant={instance.status === 'pending' ? 'secondary' : 'default'}>
                      {instance.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Responsibilities Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Responsibilities Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Responsibilities</span>
                <span className="font-bold">{responsibilities.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Mandatory</span>
                <span className="font-bold">{responsibilities.filter(r => r.is_mandatory).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Task Instances</span>
                <span className="font-bold">{instances.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
