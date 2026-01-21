import { cn } from '@/lib/utils';
import { SystmOneIcon } from '@/components/icons/SystmOneIcon';
import { EmisIcon } from '@/components/icons/EmisIcon';

interface EmrToggleProps {
  emr: 'systmone' | 'emis';
  onEmrChange: (emr: 'systmone' | 'emis') => void;
}

export const EmrToggle = ({ emr, onEmrChange }: EmrToggleProps) => {
  return (
    <div 
      className="relative inline-flex items-center bg-muted/60 rounded-full p-0.5 border border-border/50"
      role="radiogroup"
      aria-label="Select EMR format"
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-background shadow-sm border border-border/30 transition-transform duration-200 ease-out",
          emr === 'emis' ? 'translate-x-[calc(100%+2px)]' : 'translate-x-0'
        )}
      />
      
      {/* SystmOne option */}
      <button
        onClick={() => onEmrChange('systmone')}
        role="radio"
        aria-checked={emr === 'systmone'}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200",
          emr === 'systmone'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <SystmOneIcon size="sm" className="h-4 w-auto" />
        <span>SystmOne</span>
      </button>
      
      {/* EMIS option */}
      <button
        onClick={() => onEmrChange('emis')}
        role="radio"
        aria-checked={emr === 'emis'}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200",
          emr === 'emis'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <EmisIcon size="sm" className="h-4 w-auto" />
        <span>EMIS</span>
      </button>
    </div>
  );
};
