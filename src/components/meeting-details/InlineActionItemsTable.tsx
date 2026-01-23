import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, User, Calendar, Flag, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
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
import { parseMarkdownTable } from '@/lib/tableRenderer';

interface InlineActionItemsTableProps {
  meetingId: string;
}

// Inline editable cell component
const EditableCell = ({
  value,
  onSave,
  placeholder = '',
  className = '',
  multiline = false,
}: {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditing, multiline]);

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
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
    // For single-line input, Enter saves
    if (!multiline && e.key === 'Enter') {
      handleSave();
    }
    // For multiline, Ctrl/Cmd+Enter saves
    if (multiline && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  // Calculate rows based on content
  const getRowCount = () => {
    const lineCount = (value || '').split('\n').length;
    const estimatedWraps = Math.ceil((value || '').length / 60); // Estimate wraps at ~60 chars
    return Math.max(2, Math.min(6, Math.max(lineCount, estimatedWraps)));
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={getRowCount()}
          className="w-full text-sm p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          placeholder={placeholder}
        />
      );
    }
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
      <PopoverContent 
        className="w-auto p-0 z-[100]" 
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={20}
      >
        <div className="p-3">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            defaultMonth={selectedDate || new Date()}
            className="pointer-events-auto"
          />
          {dueDateActual && (
            <div className="pt-2 border-t mt-2">
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 hover:bg-muted rounded transition-colors"
                onClick={() => handleSelect(undefined)}
              >
                Clear date
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  High: { color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400', label: 'High' },
  Medium: { color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400', label: 'Medium' },
  Low: { color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-400', label: 'Low' },
};

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;

// Priority dropdown component
const PriorityDropdown = ({
  priority,
  onPriorityChange,
}: {
  priority: string;
  onPriorityChange: (newPriority: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (newPriority: string) => {
    if (newPriority !== priority) {
      onPriorityChange(newPriority);
    }
    setIsOpen(false);
  };

  const config = priorityConfig[priority] || priorityConfig.Medium;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="group flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
          title="Click to change priority"
        >
          <Badge variant="outline" className={cn('text-xs', config.color)}>
            <Flag className="h-2.5 w-2.5 mr-1" />
            {priority}
          </Badge>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1" align="start">
        <div className="space-y-0.5">
          {PRIORITY_OPTIONS.map((option) => {
            const optionConfig = priorityConfig[option];
            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2",
                  priority === option && "bg-muted font-medium"
                )}
              >
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  option === 'High' && "bg-red-500",
                  option === 'Medium' && "bg-amber-500",
                  option === 'Low' && "bg-green-500"
                )} />
                {option}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const STATUS_OPTIONS_OPEN = ['Open', 'In Progress', 'Completed'] as const;

// Status dropdown component
const StatusDropdown = ({
  status,
  onStatusChange,
  onDelete,
  isCompletedView,
}: {
  status: string;
  onStatusChange: (newStatus: string) => void;
  onDelete: () => void;
  isCompletedView: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (newStatus: string) => {
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
    setIsOpen(false);
  };

  const handleDelete = () => {
    setIsOpen(false);
    onDelete();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="group flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
          title="Click to change status"
        >
          <Badge variant={status === 'Completed' ? 'default' : 'outline'} className="text-xs">
            {status === 'Completed' ? '✓ ' : '○ '}{status}
          </Badge>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        <div className="space-y-0.5">
          {isCompletedView ? (
            // Completed view: show Reopen option
            <button
              onClick={() => handleSelect('Open')}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
            >
              ↩ Reopen
            </button>
          ) : (
            // Open view: show all status options
            STATUS_OPTIONS_OPEN.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors",
                  status === option && "bg-muted font-medium"
                )}
              >
                {option === 'Completed' ? '✓ ' : '○ '}{option}
              </button>
            ))
          )}
          <Separator className="my-1" />
          <button
            onClick={handleDelete}
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const InlineActionItemsTable = ({ meetingId }: InlineActionItemsTableProps) => {
  const { actionItems, isLoading, updateActionItem, deleteActionItem } = useActionItems(meetingId);
  const [viewMode, setViewMode] = useState<'open' | 'completed'>('open');

  const [fallbackTable, setFallbackTable] = useState<ReturnType<typeof parseMarkdownTable> | null>(null);
  const [isFallbackLoading, setIsFallbackLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const extractActionItemsTableMarkdown = (summary: string): string | null => {
      // Find the Action Items heading and capture until the next heading.
      const headingMatch = summary.match(/^#{1,4}\s*action\s+items?\s*$/im);
      if (!headingMatch?.index && headingMatch?.index !== 0) return null;

      const start = headingMatch.index + headingMatch[0].length;
      const afterHeading = summary.slice(start);

      const nextHeadingMatch = afterHeading.match(/^#{1,4}\s+/m);
      const sectionBody = nextHeadingMatch?.index != null
        ? afterHeading.slice(0, nextHeadingMatch.index)
        : afterHeading;

      // Find the first markdown table block inside the section.
      const lines = sectionBody.split('\n');
      const tableLines: string[] = [];
      let inTable = false;

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const looksLikeTableRow = /^\s*\|.*\|\s*$/.test(line);

        if (looksLikeTableRow) {
          inTable = true;
          tableLines.push(line);
          continue;
        }

        if (inTable) {
          // Stop at the first non-table line after we've started capturing.
          break;
        }
      }

      if (tableLines.length < 2) return null;
      return tableLines.join('\n');
    };

    const loadFallback = async () => {
      if (isLoading) return;
      if (actionItems.length > 0) return;
      if (fallbackTable) return;

      setIsFallbackLoading(true);
      try {
        const { data, error } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (error) throw error;
        const summary = data?.summary || '';
        if (!summary) return;

        const tableMarkdown = extractActionItemsTableMarkdown(summary);
        if (!tableMarkdown) return;

        const parsed = parseMarkdownTable(tableMarkdown);
        if (!parsed) return;

        if (!cancelled) {
          setFallbackTable(parsed);
        }
      } catch {
        // Silent fallback: if we can't parse, just render nothing (keeps UI clean).
      } finally {
        if (!cancelled) setIsFallbackLoading(false);
      }
    };

    loadFallback();
    return () => {
      cancelled = true;
    };
  }, [actionItems.length, fallbackTable, isLoading, meetingId]);

  if (isLoading || actionItems.length === 0) {
    // If the DB-backed table is empty, try to render a read-only fallback from the markdown summary.
    if (isLoading || isFallbackLoading || !fallbackTable) return null;

    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-primary px-4 py-2 flex items-center justify-between">
          <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Action Items
          </h3>
          <span className="text-xs text-primary-foreground/80">From notes</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {fallbackTable.headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fallbackTable.rows.map((row, idx) => (
              <TableRow key={idx}>
                {fallbackTable.headers.map((h) => (
                  <TableCell key={`${idx}-${h}`} className="align-top">
                    <span className="text-sm text-foreground">{row[h] ?? ''}</span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const completedCount = actionItems.filter(item => item.status === 'Completed').length;
  const openCount = actionItems.length - completedCount;
  
  const filteredItems = viewMode === 'completed'
    ? actionItems.filter(item => item.status === 'Completed')
    : actionItems.filter(item => item.status !== 'Completed');

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-primary px-4 py-2 flex items-center justify-between">
        <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Action Items
        </h3>
        <div className="flex rounded-md border border-primary-foreground/30 overflow-hidden">
          <button
            onClick={() => setViewMode('open')}
            className={cn(
              "px-3 py-1 text-xs font-medium transition-colors",
              viewMode === 'open'
                ? "bg-primary-foreground text-primary"
                : "bg-transparent hover:bg-primary-foreground/10 text-primary-foreground"
            )}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setViewMode('completed')}
            className={cn(
              "px-3 py-1 text-xs font-medium transition-colors border-l border-primary-foreground/30",
              viewMode === 'completed'
                ? "bg-primary-foreground text-primary"
                : "bg-transparent hover:bg-primary-foreground/10 text-primary-foreground"
            )}
          >
            Completed ({completedCount})
          </button>
        </div>
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
          {filteredItems.map((item) => (
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
                  multiline
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
                <PriorityDropdown
                  priority={item.priority}
                  onPriorityChange={(newPriority) => updateActionItem(item.id, { priority: newPriority as 'High' | 'Medium' | 'Low' })}
                />
              </TableCell>
              <TableCell>
                <StatusDropdown
                  status={item.status}
                  onStatusChange={(newStatus) => updateActionItem(item.id, { status: newStatus as 'Open' | 'In Progress' | 'Completed' })}
                  onDelete={() => deleteActionItem(item.id)}
                  isCompletedView={viewMode === 'completed'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
