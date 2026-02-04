import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, MinusCircle, Ban } from 'lucide-react';
import { InspectionElement } from '@/hooks/useMockInspection';
import { cn } from '@/lib/utils';

interface StatusQuickPickProps {
  currentStatus: InspectionElement['status'];
  onStatusChange: (status: InspectionElement['status']) => void;
}

const STATUS_OPTIONS = [
  { 
    value: 'met' as const, 
    label: 'Met', 
    icon: CheckCircle2, 
    activeColor: 'bg-green-600 text-white hover:bg-green-700',
    inactiveColor: 'hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-600'
  },
  { 
    value: 'partially_met' as const, 
    label: 'Partially Met', 
    icon: MinusCircle, 
    activeColor: 'bg-amber-600 text-white hover:bg-amber-700',
    inactiveColor: 'hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600'
  },
  { 
    value: 'not_met' as const, 
    label: 'Not Met', 
    icon: AlertCircle, 
    activeColor: 'bg-red-600 text-white hover:bg-red-700',
    inactiveColor: 'hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600'
  },
  { 
    value: 'not_applicable' as const, 
    label: 'N/A', 
    icon: Ban, 
    activeColor: 'bg-muted-foreground text-white hover:bg-muted-foreground/90',
    inactiveColor: 'hover:bg-muted'
  }
];

export const StatusQuickPick = ({ currentStatus, onStatusChange }: StatusQuickPickProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_OPTIONS.map(option => {
        const Icon = option.icon;
        const isActive = currentStatus === option.value;
        
        return (
          <Button
            key={option.value}
            variant="outline"
            size="sm"
            onClick={() => onStatusChange(option.value)}
            className={cn(
              "flex items-center gap-2 transition-all",
              isActive ? option.activeColor : option.inactiveColor
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};
