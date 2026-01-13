import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, User, Calendar, Flag, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useActionItems, ActionItem } from '@/hooks/useActionItems';

interface InlineActionItemsTableProps {
  meetingId: string;
}

// Inline editable cell component
const EditableCell = ({
  value,
  onSave,
  placeholder = '',
  className = '',
}: {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue.trim() !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 text-sm py-0"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 min-h-[28px]",
        className
      )}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      <span className="text-sm flex-1">{value || placeholder}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
    </div>
  );
};

// Date picker cell component
const DatePickerCell = ({
  dueDate,
  dueDateActual,
  onSave,
}: {
  dueDate: string;
  dueDateActual: string | null;
  onSave: (date: Date | undefined) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = dueDateActual ? new Date(dueDateActual) : undefined;

  const handleSelect = (date: Date | undefined) => {
    onSave(date);
    setIsOpen(false);
  };

  const displayDate = dueDateActual 
    ? format(new Date(dueDateActual), 'd MMM yyyy')
    : dueDate || 'TBC';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className="group flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 min-h-[28px]"
          title="Click to set date"
        >
          <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-sm">{displayDate}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

const priorityConfig: Record<string, { color: string }> = {
  High: { color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20' },
  Medium: { color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20' },
  Low: { color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20' },
};

export const InlineActionItemsTable = ({ meetingId }: InlineActionItemsTableProps) => {
  const { actionItems, isLoading, updateActionItem } = useActionItems(meetingId);

  if (isLoading || actionItems.length === 0) {
    return null;
  }

  const openItems = actionItems.filter(i => i.status !== 'Completed');
  const completedItems = actionItems.filter(i => i.status === 'Completed');

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-primary px-4 py-2">
        <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Action Items ({openItems.length} open, {completedItems.length} completed)
        </h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[40%]">Action</TableHead>
            <TableHead className="w-[15%]">Owner</TableHead>
            <TableHead className="w-[15%]">Deadline</TableHead>
            <TableHead className="w-[15%]">Priority</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actionItems.map((item) => (
            <TableRow 
              key={item.id} 
              className={item.status === 'Completed' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
            >
              <TableCell className={item.status === 'Completed' ? 'line-through text-muted-foreground' : ''}>
                <EditableCell
                  value={item.action_text}
                  onSave={(newValue) => updateActionItem(item.id, { action_text: newValue })}
                  placeholder="Enter action..."
                  className={item.status === 'Completed' ? 'line-through text-muted-foreground' : ''}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <EditableCell
                    value={item.assignee_name || 'TBC'}
                    onSave={(newValue) => updateActionItem(item.id, { 
                      assignee_name: newValue || 'TBC',
                      assignee_type: newValue && newValue !== 'TBC' ? 'custom' : 'tbc'
                    })}
                    placeholder="TBC"
                    className="text-xs"
                  />
                </div>
              </TableCell>
              <TableCell>
                <DatePickerCell
                  dueDate={item.due_date}
                  dueDateActual={item.due_date_actual}
                  onSave={(date) => {
                    if (date) {
                      const dateStr = format(date, 'd MMM yyyy');
                      updateActionItem(item.id, { 
                        due_date: dateStr,
                        due_date_actual: date.toISOString().split('T')[0]
                      });
                    } else {
                      updateActionItem(item.id, { 
                        due_date: 'TBC',
                        due_date_actual: null
                      });
                    }
                  }}
                />
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline" 
                  className={cn('text-xs', priorityConfig[item.priority]?.color)}
                >
                  <Flag className="h-2.5 w-2.5 mr-1" />
                  {item.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={item.status === 'Completed' ? 'default' : 'outline'} className="text-xs">
                  {item.status === 'Completed' ? '✓ ' : '○ '}{item.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
