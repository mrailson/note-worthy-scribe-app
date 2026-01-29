import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Clock, AlertTriangle, User } from 'lucide-react';
import { format } from 'date-fns';
import { useResponsibilityInstances } from '@/hooks/useResponsibilityInstances';
import { useResponsibilityAssignments } from '@/hooks/useResponsibilityAssignments';
import { useResponsibilities } from '@/hooks/useResponsibilities';
import { PRACTICE_ROLES } from '@/types/responsibilityTypes';
import { cn } from '@/lib/utils';

export function RoleFilteredView() {
  const [selectedRole, setSelectedRole] = useState<string>('');
  
  const { instances, updateInstanceStatus } = useResponsibilityInstances();
  const { assignments, getAssignmentsByRole } = useResponsibilityAssignments();
  const { categories } = useResponsibilities();

  // Get unique roles that have assignments
  const rolesWithAssignments = [...new Set(
    assignments
      .filter(a => a.assigned_to_role)
      .map(a => a.assigned_to_role!)
  )];

  // Filter instances by selected role
  const filteredInstances = selectedRole
    ? instances.filter(i => i.assignment?.assigned_to_role === selectedRole)
    : instances;

  const roleAssignments = selectedRole ? getAssignmentsByRole(selectedRole) : [];

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

  const handleMarkComplete = async (instanceId: string) => {
    await updateInstanceStatus(instanceId, 'completed');
  };

  // Group instances by status
  const overdueInstances = filteredInstances.filter(i => i.status === 'overdue');
  const pendingInstances = filteredInstances.filter(i => i.status === 'pending' || i.status === 'in_progress');
  const completedInstances = filteredInstances.filter(i => i.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Role Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Filter by Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a role to view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                {PRACTICE_ROLES.map(role => (
                  <SelectItem key={role} value={role}>
                    {role}
                    {rolesWithAssignments.includes(role) && (
                      <span className="ml-2 text-muted-foreground">
                        ({getAssignmentsByRole(role).length})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedRole && (
              <Button variant="outline" onClick={() => setSelectedRole('')}>
                Clear Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedRole && (
        <>
          {/* Role Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={cn(overdueInstances.length > 0 && "border-red-300")}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cn(
                    "h-5 w-5",
                    overdueInstances.length > 0 ? "text-red-500" : "text-muted-foreground"
                  )} />
                  <span className="text-2xl font-bold">{overdueInstances.length}</span>
                  <span className="text-muted-foreground">Overdue</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold">{pendingInstances.length}</span>
                  <span className="text-muted-foreground">Pending</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{completedInstances.length}</span>
                  <span className="text-muted-foreground">Completed</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Responsibilities for this role */}
          <Card>
            <CardHeader>
              <CardTitle>Responsibilities for {selectedRole}</CardTitle>
            </CardHeader>
            <CardContent>
              {roleAssignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No responsibilities assigned to this role yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {roleAssignments.map(assignment => (
                    <div 
                      key={assignment.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          getCategoryColour(assignment.responsibility?.category_id)
                        )} />
                        <div>
                          <p className="font-medium">{assignment.responsibility?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.responsibility?.frequency_type}
                            {assignment.notes && ` • ${assignment.notes}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {assignment.responsibility?.category?.name || 'Uncategorised'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Instances */}
          {filteredInstances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredInstances.map(instance => (
                    <div 
                      key={instance.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        instance.status === 'overdue' && "border-red-300 bg-red-50 dark:bg-red-950/20",
                        instance.status === 'completed' && "border-green-300 bg-green-50 dark:bg-green-950/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          getCategoryColour(instance.responsibility?.category_id)
                        )} />
                        <div>
                          <p className="font-medium">{instance.responsibility?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Due: {format(new Date(instance.due_date), 'd MMM yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            instance.status === 'completed' ? 'default' :
                            instance.status === 'overdue' ? 'destructive' : 'secondary'
                          }
                        >
                          {instance.status}
                        </Badge>
                        {instance.status !== 'completed' && (
                          <Button 
                            size="sm"
                            onClick={() => handleMarkComplete(instance.id)}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedRole && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select a role above to view their responsibilities and tasks
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
