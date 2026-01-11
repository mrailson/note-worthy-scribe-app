import { Circle, CheckCircle2, Trash2, User, Calendar, Flag } from 'lucide-react';
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
  const allItems = [...openItems, ...completedItems];

  if (allItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
        <p className="text-sm">No action items to display</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-10"></TableHead>
            <TableHead className="min-w-[200px]">Action</TableHead>
            <TableHead className="w-32">Assignee</TableHead>
            <TableHead className="w-32">Due Date</TableHead>
            <TableHead className="w-24">Priority</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {openItems.map((item) => (
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

          {completedItems.length > 0 && openItems.length > 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-1 bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">
                  Completed ({completedItems.length})
                </span>
              </TableCell>
            </TableRow>
          )}

          {completedItems.map((item) => (
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
  );
};
