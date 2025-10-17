import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, FileText, Maximize2, ArrowLeftRight } from 'lucide-react';

export type ViewMode = 'quick' | 'standard' | 'detailed' | 'comparison';

interface ViewModeSelectorProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

const viewModes = [
  {
    id: 'quick' as const,
    label: 'Quick View',
    icon: Zap,
    description: 'Summary + shorthand'
  },
  {
    id: 'standard' as const,
    label: 'Standard',
    icon: FileText,
    description: 'Full SOAP notes'
  },
  {
    id: 'detailed' as const,
    label: 'Detailed',
    icon: Maximize2,
    description: 'Expanded view'
  },
  {
    id: 'comparison' as const,
    label: 'Compare',
    icon: ArrowLeftRight,
    description: 'Shorthand vs Standard'
  }
];

export const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({
  currentMode,
  onModeChange
}) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">View:</span>
      <div className="flex gap-1 rounded-lg border bg-background p-1">
        {viewModes.map(mode => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;
          
          return (
            <Button
              key={mode.id}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onModeChange(mode.id)}
              className="gap-2"
              title={mode.description}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{mode.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
