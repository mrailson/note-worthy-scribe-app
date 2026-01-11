import { useState, useEffect, useMemo } from 'react';
import { Plus, CheckSquare, Loader2, RefreshCw, LayoutGrid, Table2, Filter, Flag, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useActionItems } from '@/hooks/useActionItems';
import { ActionItemRow } from './ActionItemRow';
import { ActionItemsTableView } from './ActionItemsTableView';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MeetingActionItemsTabProps {
  meetingId: string;
  meetingAttendees?: string[];
  chairName?: string;
}

type ViewMode = 'cards' | 'table';
type PriorityFilter = 'all' | 'High' | 'Medium' | 'Low';
type DueDateFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'this-month';

export const MeetingActionItemsTab = ({
  meetingId,
  meetingAttendees = [],
  chairName,
}: MeetingActionItemsTabProps) => {
  const {
    actionItems,
    isLoading,
    isSaving,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    toggleStatus,
    clearAndReExtract,
  } = useActionItems(meetingId);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');

  // Get current user's name
  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        setCurrentUserName(profile?.full_name || user.email?.split('@')[0] || 'Me');
      }
    };
    fetchUserName();
  }, []);

  const handleAddNew = async () => {
    if (!newActionText.trim()) return;
    
    await addActionItem(newActionText.trim());
    setNewActionText('');
    setIsAddingNew(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNew();
    } else if (e.key === 'Escape') {
      setNewActionText('');
      setIsAddingNew(false);
    }
  };

  const handleReExtract = async () => {
    setIsReExtracting(true);
    await clearAndReExtract();
    setIsReExtracting(false);
  };

  // Filter logic
  const filteredItems = useMemo(() => {
    let items = actionItems;

    // Priority filter
    if (priorityFilter !== 'all') {
      items = items.filter(item => item.priority === priorityFilter);
    }

    // Due date filter
    if (dueDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);
      
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      items = items.filter(item => {
        if (!item.due_date_actual) return false;
        const dueDate = new Date(item.due_date_actual);

        switch (dueDateFilter) {
          case 'overdue':
            return dueDate < today && item.status !== 'Completed';
          case 'today':
            return dueDate >= today && dueDate <= endOfToday;
          case 'this-week':
            return dueDate >= today && dueDate <= endOfWeek;
          case 'this-month':
            return dueDate >= today && dueDate <= endOfMonth;
          default:
            return true;
        }
      });
    }

    return items;
  }, [actionItems, priorityFilter, dueDateFilter]);

  const openItems = filteredItems.filter(i => i.status !== 'Completed');
  const completedItems = filteredItems.filter(i => i.status === 'Completed');

  const hasActiveFilters = priorityFilter !== 'all' || dueDateFilter !== 'all';
  const totalOpenItems = actionItems.filter(i => i.status !== 'Completed').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Action Items</h3>
          {totalOpenItems > 0 && (
            <span className="text-sm text-muted-foreground">
              ({totalOpenItems} open)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}

          {/* View toggle */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/30">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('cards')}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                <span className="text-xs">Filter</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                    {(priorityFilter !== 'all' ? 1 : 0) + (dueDateFilter !== 'all' ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
                <Flag className="h-3 w-3" />
                Priority
              </DropdownMenuLabel>
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

              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3 w-3" />
                Due Date
              </DropdownMenuLabel>
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

              {hasActiveFilters && (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-muted-foreground"
                    onClick={() => {
                      setPriorityFilter('all');
                      setDueDateFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReExtract}
            disabled={isReExtracting}
            className="h-7 text-xs text-muted-foreground"
          >
            {isReExtracting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Re-extract
          </Button>
        </div>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {priorityFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1">
              Priority: {priorityFilter}
              <button
                onClick={() => setPriorityFilter('all')}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          {dueDateFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1">
              Due: {dueDateFilter.replace('-', ' ')}
              <button
                onClick={() => setDueDateFilter('all')}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            ({openItems.length} of {totalOpenItems} shown)
          </span>
        </div>
      )}

      {/* Action items list/table */}
      {viewMode === 'table' ? (
        <ActionItemsTableView
          openItems={openItems}
          completedItems={completedItems}
          attendees={meetingAttendees}
          currentUserName={currentUserName}
          chairName={chairName}
          onUpdate={updateActionItem}
          onDelete={deleteActionItem}
          onToggleStatus={toggleStatus}
        />
      ) : (
        <div className="space-y-2">
          {openItems.length === 0 && completedItems.length === 0 && !isAddingNew && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{hasActiveFilters ? 'No matching action items' : 'No action items yet'}</p>
              <p className="text-xs mt-1">
                {hasActiveFilters 
                  ? 'Try adjusting your filters'
                  : 'Add action items to track tasks from this meeting'
                }
              </p>
            </div>
          )}

          {/* Open items */}
          {openItems.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              attendees={meetingAttendees}
              currentUserName={currentUserName}
              chairName={chairName}
              onUpdate={updateActionItem}
              onDelete={deleteActionItem}
              onToggleStatus={toggleStatus}
            />
          ))}

          {/* New item input */}
          {isAddingNew && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/50 bg-primary/5">
              <Input
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter action item..."
                className="flex-1 h-8 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleAddNew} disabled={!newActionText.trim()}>
                Add
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setNewActionText('');
                  setIsAddingNew(false);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Add button */}
          {!isAddingNew && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setIsAddingNew(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Action Item
            </Button>
          )}

          {/* Completed items section */}
          {completedItems.length > 0 && (
            <div className="pt-4 border-t mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Completed ({completedItems.length})
              </p>
              <div className="space-y-2">
                {completedItems.map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    attendees={meetingAttendees}
                    currentUserName={currentUserName}
                    chairName={chairName}
                    onUpdate={updateActionItem}
                    onDelete={deleteActionItem}
                    onToggleStatus={toggleStatus}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};