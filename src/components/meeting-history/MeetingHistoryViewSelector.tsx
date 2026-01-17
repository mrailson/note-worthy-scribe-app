import { List, LayoutList, LayoutGrid, Table2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type HistoryViewMode = 'list' | 'compact' | 'grid' | 'table' | 'timeline';

interface ViewModeOption {
  id: HistoryViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const viewModes: ViewModeOption[] = [
  { id: 'list', label: 'List', icon: List, description: 'Full details with expanded cards' },
  { id: 'compact', label: 'Compact', icon: LayoutList, description: 'Condensed single-line rows' },
  { id: 'grid', label: 'Grid', icon: LayoutGrid, description: 'Card grid layout' },
  { id: 'table', label: 'Table', icon: Table2, description: 'Sortable data table' },
  { id: 'timeline', label: 'Timeline', icon: Calendar, description: 'Grouped by date' },
];

interface MeetingHistoryViewSelectorProps {
  viewMode: HistoryViewMode;
  onViewModeChange: (mode: HistoryViewMode) => void;
  className?: string;
}

export const MeetingHistoryViewSelector = ({
  viewMode,
  onViewModeChange,
  className
}: MeetingHistoryViewSelectorProps) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/50", className)}>
        {viewModes.map((mode) => {
          const Icon = mode.icon;
          const isActive = viewMode === mode.id;
          
          return (
            <Tooltip key={mode.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange(mode.id)}
                  className={cn(
                    "h-8 px-2 sm:px-3 transition-all",
                    isActive && "bg-background shadow-sm border border-border/50"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="hidden md:inline ml-2 text-xs font-medium">
                    {mode.label}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{mode.label}</p>
                <p className="text-muted-foreground">{mode.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
