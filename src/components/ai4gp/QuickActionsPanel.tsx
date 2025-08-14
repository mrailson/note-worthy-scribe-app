import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { quickActions } from '@/constants/quickActions';

interface QuickActionsPanelProps {
  showAllQuickActions: boolean;
  setShowAllQuickActions: (show: boolean) => void;
  setInput: (input: string) => void;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  showAllQuickActions,
  setShowAllQuickActions,
  setInput
}) => {
  const visibleActions = showAllQuickActions ? quickActions : quickActions.slice(0, 4);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visibleActions.map((action, index) => {
          const IconComponent = action.icon;
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="justify-start text-left h-auto py-2 px-3"
              onClick={() => setInput(action.prompt)}
            >
              <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">{action.label}</span>
            </Button>
          );
        })}
      </div>
      
      {quickActions.length > 4 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAllQuickActions(!showAllQuickActions)}
          className="w-full"
        >
          {showAllQuickActions ? (
            <>
              <Minus className="w-4 h-4 mr-2" />
              Show Less
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Show More ({quickActions.length - 4} more)
            </>
          )}
        </Button>
      )}
    </div>
  );
};