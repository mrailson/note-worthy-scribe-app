import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionItems } from '@/hooks/useActionItems';
import { ActionItemRow } from './ActionItemRow';
import { supabase } from '@/integrations/supabase/client';

interface MeetingActionItemsTabProps {
  meetingId: string;
  meetingAttendees?: string[];
  chairName?: string;
}

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

  const openItems = actionItems.filter(i => i.status !== 'Completed');
  const completedItems = actionItems.filter(i => i.status === 'Completed');

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Action Items</h3>
          {openItems.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({openItems.length} open)
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
            Re-extract from notes
          </Button>
        </div>
      </div>

      {/* Action items list */}
      <div className="space-y-2">
        {openItems.length === 0 && completedItems.length === 0 && !isAddingNew && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No action items yet</p>
            <p className="text-xs mt-1">Add action items to track tasks from this meeting</p>
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
    </div>
  );
};
