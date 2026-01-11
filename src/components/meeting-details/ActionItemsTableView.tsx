import { useState, useMemo } from 'react';
import { Circle, CheckCircle2, Trash2, User, Calendar, Flag, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ActionItem } from '@/hooks/useActionItems';

interface ActionItemsTableViewProps {
  openItems: ActionItem[];
  completedItems: ActionItem[];
  attendees: string[];
  currentUserName: string;
  chairName?: string;
  onUpdate: (id: string, updates: Partial<ActionItem>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onToggleStatus: (id: string) => void;
}

const priorityConfig: Record<string, { color: string; emoji: string }> = {
  High: { color: 'text-red-600 bg-red-50 border-red-200', emoji: '🔴' },
  Medium: { color: 'text-amber-600 bg-amber-50 border-amber-200', emoji: '🟡' },
  Low: { color: 'text-green-600 bg-green-50 border-green-200', emoji: '🟢' },
};

type PriorityFilter = 'all' | 'High' | 'Medium' | 'Low';
type DueDateFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'this-month' | 'no-date';

export const ActionItemsTableView = ({
  openItems,
  completedItems,
  attendees,
  currentUserName,
  chairName,
  onUpdate,
  onDelete,
  onToggleStatus,
}: ActionItemsTableViewProps) => {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // Get unique assignees from all items
  const allItems = [...openItems, ...completedItems];
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    allItems.forEach(item => {
      if (item.assignee_name && item.assignee_name !== 'TBC') {
        assignees.add(item.assignee_name);
      }
    });
    return Array.from(assignees).sort();
  }, [allItems]);

  // Filter logic
  const filterItems = (items: ActionItem[]) => {
    return items.filter(item => {
      // Priority filter
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned') {
          if (item.assignee_name && item.assignee_name !== 'TBC') return false;
        } else if (item.assignee_name !== assigneeFilter) {
          return false;
        }
      }

      // Due date filter
      if (dueDateFilter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dueDateFilter === 'no-date') {
          if (item.due_date_actual) return false;
        } else if (!item.due_date_actual) {
          return false;
        } else {
          const dueDate = new Date(item.due_date_actual);
          const endOfToday = new Date(today);
          endOfToday.setHours(23, 59, 59, 999);
          
          const endOfWeek = new Date(today);
          endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
          endOfWeek.setHours(23, 59, 59, 999);
          
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);

          switch (dueDateFilter) {
            case 'overdue':
              if (!(dueDate < today && item.status !== 'Completed')) return false;
              break;
            case 'today':
              if (!(dueDate >= today && dueDate <= endOfToday)) return false;
              break;
            case 'this-week':
              if (!(dueDate >= today && dueDate <= endOfWeek)) return false;
              break;
            case 'this-month':
              if (!(dueDate >= today && dueDate <= endOfMonth)) return false;
              break;
          }
        }
      }

      return true;
    });
  };

  const filteredOpenItems = filterItems(openItems);
  const filteredCompletedItems = filterItems(completedItems);
  const hasActiveFilters = priorityFilter !== 'all' || dueDateFilter !== 'all' || assigneeFilter !== 'all';

  const clearAllFilters = () => {
    setPriorityFilter('all');
    setDueDateFilter('all');
    setAssigneeFilter('all');
  };

  if (allItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        <p className="text-sm">No action items to display</p>
      </div>
    );
  }

  const FilterableHeader = ({ 
    children, 
    className,
    hasFilter 
  }: { 
    children: React.ReactNode; 
    className?: string;
    hasFilter?: boolean;
  }) => (
    <div className={cn("flex items-center gap-1", className)}>
      {children}
      {hasFilter && (
        <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
          •
        </Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">Column filters:</span>
          {assigneeFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Assignee: {assigneeFilter === 'unassigned' ? 'Unassigned' : assigneeFilter}
              <button onClick={() => setAssigneeFilter('all')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {dueDateFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Due: {dueDateFilter.replace('-', ' ')}
              <button onClick={() => setDueDateFilter('all')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {priorityFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Priority: {priorityFilter}
              <button onClick={() => setPriorityFilter('all')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={clearAllFilters}>
            Clear all
          </Button>
          <span className="text-muted-foreground ml-auto">
            ({filteredOpenItems.length + filteredCompletedItems.length} of {allItems.length} shown)
          </span>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10"></TableHead>
              <TableHead className="min-w-[200px]">Action</TableHead>
              
              {/* Assignee column with filter */}
              <TableHead className="w-36">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-1 -ml-1 font-medium text-xs gap-1">
                      <FilterableHeader hasFilter={assigneeFilter !== 'all'}>
                        <User className="h-3 w-3" />
                        Assignee
                      </FilterableHeader>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 bg-popover">
                    <DropdownMenuCheckboxItem
                      checked={assigneeFilter === 'all'}
                      onCheckedChange={() => setAssigneeFilter('all')}
                    >
                      All assignees
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={assigneeFilter === 'unassigned'}
                      onCheckedChange={() => setAssigneeFilter(assigneeFilter === 'unassigned' ? 'all' : 'unassigned')}
                    >
                      Unassigned (TBC)
                    </DropdownMenuCheckboxItem>
                    {uniqueAssignees.map(name => (
                      <DropdownMenuCheckboxItem
                        key={name}
                        checked={assigneeFilter === name}
                        onCheckedChange={() => setAssigneeFilter(assigneeFilter === name ? 'all' : name)}
                      >
                        {name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              
              {/* Due Date column with filter */}
              <TableHead className="w-36">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-1 -ml-1 font-medium text-xs gap-1">
                      <FilterableHeader hasFilter={dueDateFilter !== 'all'}>
                        <Calendar className="h-3 w-3" />
                        Due Date
                      </FilterableHeader>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40 bg-popover">
                    <DropdownMenuCheckboxItem
                      checked={dueDateFilter === 'all'}
                      onCheckedChange={() => setDueDateFilter('all')}
                    >
                      All dates
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={dueDateFilter === 'overdue'}
                      onCheckedChange={() => setDueDateFilter(dueDateFilter === 'overdue' ? 'all' : 'overdue')}
                    >
                      ⚠️ Overdue
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={dueDateFilter === 'today'}
                      onCheckedChange={() => setDueDateFilter(dueDateFilter === 'today' ? 'all' : 'today')}
                    >
                      Today
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={dueDateFilter === 'this-week'}
                      onCheckedChange={() => setDueDateFilter(dueDateFilter === 'this-week' ? 'all' : 'this-week')}
                    >
                      This week
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={dueDateFilter === 'this-month'}
                      onCheckedChange={() => setDueDateFilter(dueDateFilter === 'this-month' ? 'all' : 'this-month')}
                    >
                      This month
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={dueDateFilter === 'no-date'}
                      onCheckedChange={() => setDueDateFilter(dueDateFilter === 'no-date' ? 'all' : 'no-date')}
                    >
                      No date set
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              
              {/* Priority column with filter */}
              <TableHead className="w-28">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-1 -ml-1 font-medium text-xs gap-1">
                      <FilterableHeader hasFilter={priorityFilter !== 'all'}>
                        <Flag className="h-3 w-3" />
                        Priority
                      </FilterableHeader>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36 bg-popover">
                    <DropdownMenuCheckboxItem
                      checked={priorityFilter === 'all'}
                      onCheckedChange={() => setPriorityFilter('all')}
                    >
                      All priorities
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={priorityFilter === 'High'}
                      onCheckedChange={() => setPriorityFilter(priorityFilter === 'High' ? 'all' : 'High')}
                    >
                      🔴 High
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={priorityFilter === 'Medium'}
                      onCheckedChange={() => setPriorityFilter(priorityFilter === 'Medium' ? 'all' : 'Medium')}
                    >
                      🟡 Medium
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={priorityFilter === 'Low'}
                      onCheckedChange={() => setPriorityFilter(priorityFilter === 'Low' ? 'all' : 'Low')}
                    >
                      🟢 Low
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOpenItems.length === 0 && filteredCompletedItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No matching action items</p>
                  <Button variant="link" size="sm" onClick={clearAllFilters} className="mt-1">
                    Clear filters
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {filteredOpenItems.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="py-2">
                  <button
                    onClick={() => onToggleStatus(item.id)}
                    className="text-muted-foreground/50 hover:text-green-600 dark:hover:text-green-500 transition-colors"
                    title="Mark as complete"
                  >
                    <Circle className="h-5 w-5" />
                  </button>
                </TableCell>
                <TableCell className="py-2">
                  <span className="text-sm">{item.action_text}</span>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{item.assignee_name || 'TBC'}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{item.due_date}</span>
                    {item.due_date_actual && (
                      <span className="text-muted-foreground/70">
                        ({new Date(item.due_date_actual).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <Badge 
                    variant="outline" 
                    className={cn('text-xs', priorityConfig[item.priority]?.color)}
                  >
                    <Flag className="h-2.5 w-2.5 mr-1" />
                    {item.priority}
                  </Badge>
                </TableCell>
                <TableCell className="py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {filteredCompletedItems.length > 0 && filteredOpenItems.length > 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-1 bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">
                    Completed ({filteredCompletedItems.length})
                  </span>
                </TableCell>
              </TableRow>
            )}

            {filteredCompletedItems.map((item) => (
              <TableRow key={item.id} className="opacity-60 hover:bg-muted/30">
                <TableCell className="py-2">
                  <button
                    onClick={() => onToggleStatus(item.id)}
                    className="text-green-600 dark:text-green-500 hover:scale-110 transition-transform"
                    title="Mark as incomplete"
                  >
                    <CheckCircle2 className="h-5 w-5 fill-current" />
                  </button>
                </TableCell>
                <TableCell className="py-2">
                  <span className="text-sm line-through text-muted-foreground">{item.action_text}</span>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{item.assignee_name || 'TBC'}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{item.due_date}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <Badge 
                    variant="outline" 
                    className={cn('text-xs', priorityConfig[item.priority]?.color)}
                  >
                    <Flag className="h-2.5 w-2.5 mr-1" />
                    {item.priority}
                  </Badge>
                </TableCell>
                <TableCell className="py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
