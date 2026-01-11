import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, Trash2, GripVertical, User, Calendar, Flag, Clock, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ActionItem } from '@/hooks/useActionItems';

const RECENT_ASSIGNEES_KEY = 'action-item-recent-assignees';
const MAX_RECENT_ASSIGNEES = 10;

const getRecentAssignees = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_ASSIGNEES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addRecentAssignee = (name: string) => {
  if (!name || name === 'TBC') return;
  
  const recent = getRecentAssignees();
  // Remove if already exists, then add to front
  const filtered = recent.filter(n => n.toLowerCase() !== name.toLowerCase());
  const updated = [name, ...filtered].slice(0, MAX_RECENT_ASSIGNEES);
  
  try {
    localStorage.setItem(RECENT_ASSIGNEES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
};

interface ActionItemRowProps {
  item: ActionItem;
  attendees: string[];
  currentUserName: string;
  chairName?: string;
  onUpdate: (id: string, updates: Partial<ActionItem>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onToggleStatus: (id: string) => Promise<boolean>;
}

const DUE_DATE_OPTIONS = [
  { value: 'TBC', label: 'TBC' },
  { value: 'ASAP', label: 'ASAP' },
  { value: 'End of Week', label: 'End of Week' },
  { value: 'End of Month', label: 'End of Month' },
  { value: 'End of Next Month', label: 'End of Next Month' },
  { value: 'By Next Meeting', label: 'By Next Meeting' },
];

const PRIORITY_CONFIG = {
  High: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: '🔴' },
  Medium: { color: 'bg-warning/10 text-warning border-warning/20', icon: '🟡' },
  Low: { color: 'bg-success/10 text-success border-success/20', icon: '🟢' },
};

export const ActionItemRow = ({
  item,
  attendees,
  currentUserName,
  chairName,
  onUpdate,
  onDelete,
  onToggleStatus,
}: ActionItemRowProps) => {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(item.action_text);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customAssigneeName, setCustomAssigneeName] = useState('');
  const [recentAssignees, setRecentAssignees] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const customNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingText && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingText]);

  // Load recent assignees when popover opens
  useEffect(() => {
    if (isAssigneeOpen) {
      setRecentAssignees(getRecentAssignees());
    }
  }, [isAssigneeOpen]);

  const handleTextSave = async () => {
    if (editText.trim() && editText !== item.action_text) {
      await onUpdate(item.id, { action_text: editText.trim() });
    }
    setIsEditingText(false);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTextSave();
    } else if (e.key === 'Escape') {
      setEditText(item.action_text);
      setIsEditingText(false);
    }
  };

  const handleAssigneeSelect = async (name: string, type: ActionItem['assignee_type']) => {
    addRecentAssignee(name);
    await onUpdate(item.id, { assignee_name: name, assignee_type: type });
    setIsAssigneeOpen(false);
    setCustomAssigneeName('');
  };

  const handleCustomNameSubmit = async () => {
    const name = customAssigneeName.trim();
    if (name) {
      await handleAssigneeSelect(name, 'custom');
    }
  };

  const handleCustomNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomNameSubmit();
    } else if (e.key === 'Escape') {
      setCustomAssigneeName('');
    }
  };

  const handleDueDateSelect = async (value: string) => {
    await onUpdate(item.id, { due_date: value });
    setIsDueDateOpen(false);
  };

  const handlePriorityChange = async (value: string) => {
    await onUpdate(item.id, { priority: value as ActionItem['priority'] });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(item.id);
  };

  const isCompleted = item.status === 'Completed';
  const priorityConfig = PRIORITY_CONFIG[item.priority];

  // Build quick pick assignees
  const quickPickAssignees: Array<{ name: string; type: ActionItem['assignee_type']; display: string }> = [
    { name: currentUserName || 'Me', type: 'me', display: currentUserName || 'Me' },
  ];
  
  if (chairName) {
    quickPickAssignees.push({ name: chairName, type: 'chair', display: `Chair - ${chairName}` });
  }
  
  // Filter recent assignees to exclude current user, chair, and attendees (to avoid duplicates)
  const excludeNames = new Set([
    currentUserName?.toLowerCase(),
    chairName?.toLowerCase(),
    ...attendees.map(a => a.toLowerCase()),
  ].filter(Boolean));
  
  const filteredRecentAssignees = recentAssignees.filter(
    name => !excludeNames.has(name.toLowerCase())
  );

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border transition-all',
        isCompleted 
          ? 'bg-muted/30 border-muted opacity-60' 
          : 'bg-card border-border hover:border-primary/30 hover:shadow-sm',
        isDeleting && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Drag handle */}
      <div className="opacity-0 group-hover:opacity-50 cursor-grab pt-0.5">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggleStatus(item.id)}
        className="mt-0.5"
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Action text */}
        {isEditingText ? (
          <Input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleTextSave}
            onKeyDown={handleTextKeyDown}
            className="h-7 text-sm"
          />
        ) : (
          <p
            onClick={() => setIsEditingText(true)}
            className={cn(
              'text-sm cursor-text hover:bg-muted/50 rounded px-1 -mx-1 py-0.5',
              isCompleted && 'line-through text-muted-foreground'
            )}
          >
            {item.action_text}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Assignee */}
          <Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-xs gap-1',
                  item.assignee_name === 'TBC' && 'text-muted-foreground'
                )}
              >
                <User className="h-3 w-3" />
                {item.assignee_name}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start" side="top" collisionPadding={16} avoidCollisions>
              <div className="space-y-1">
                {/* Custom name input */}
                <div className="px-1 pb-2">
                  <div className="flex gap-1">
                    <Input
                      ref={customNameInputRef}
                      value={customAssigneeName}
                      onChange={(e) => setCustomAssigneeName(e.target.value)}
                      onKeyDown={handleCustomNameKeyDown}
                      placeholder="Enter name..."
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 px-2"
                      disabled={!customAssigneeName.trim()}
                      onClick={handleCustomNameSubmit}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                
                <div className="border-t my-2" />
                
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Quick picks</p>
                {quickPickAssignees.map((assignee) => (
                  <Button
                    key={assignee.type}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-sm"
                    onClick={() => handleAssigneeSelect(assignee.name.replace(/^ME - /, ''), assignee.type)}
                  >
                    {assignee.display}
                  </Button>
                ))}
                
                {/* Recent assignees */}
                {filteredRecentAssignees.length > 0 && (
                  <>
                    <div className="border-t my-2" />
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Recent
                    </p>
                    {filteredRecentAssignees.slice(0, 5).map((name) => (
                      <Button
                        key={`recent-${name}`}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 text-sm"
                        onClick={() => handleAssigneeSelect(name, 'custom')}
                      >
                        {name}
                      </Button>
                    ))}
                  </>
                )}
                
                {attendees.length > 0 && (
                  <>
                    <div className="border-t my-2" />
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">From this meeting</p>
                    {attendees.slice(0, 5).map((name) => (
                      <Button
                        key={name}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 text-sm"
                        onClick={() => handleAssigneeSelect(name, 'attendee')}
                      >
                        {name}
                      </Button>
                    ))}
                  </>
                )}
                
                <div className="border-t my-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-sm text-muted-foreground"
                  onClick={() => handleAssigneeSelect('TBC', 'tbc')}
                >
                  Clear assignee
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Due date */}
          <Popover open={isDueDateOpen} onOpenChange={setIsDueDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-xs gap-1',
                  item.due_date === 'TBC' && 'text-muted-foreground',
                  item.due_date === 'ASAP' && 'text-destructive'
                )}
              >
                <Calendar className="h-3 w-3" />
                {item.due_date}
                {item.due_date_actual && (
                  <span className="text-muted-foreground">
                    ({new Date(item.due_date_actual).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start" side="top" collisionPadding={16} avoidCollisions>
              <div className="space-y-1">
                {DUE_DATE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={item.due_date === option.value ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start h-8 text-sm"
                    onClick={() => handleDueDateSelect(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
                
                <div className="border-t my-2" />
                <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Pick a date
                </p>
                <CalendarPicker
                  mode="single"
                  selected={item.due_date_actual ? new Date(item.due_date_actual) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const formatted = format(date, 'd MMM yyyy');
                      handleDueDateSelect(formatted);
                    }
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="pointer-events-auto"
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Priority */}
          <Select value={item.priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="h-6 w-auto px-2 text-xs border-0 bg-transparent hover:bg-muted/50">
              <Badge variant="outline" className={cn('h-5 text-xs', priorityConfig.color)}>
                <Flag className="h-2.5 w-2.5 mr-1" />
                {item.priority}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">
                <span className="flex items-center gap-2">🔴 High</span>
              </SelectItem>
              <SelectItem value="Medium">
                <span className="flex items-center gap-2">🟡 Medium</span>
              </SelectItem>
              <SelectItem value="Low">
                <span className="flex items-center gap-2">🟢 Low</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
