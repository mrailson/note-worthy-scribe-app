import { Code2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteStyleToggleProps {
  style: 'shorthand' | 'standard';
  onStyleChange: (style: 'shorthand' | 'standard') => void;
}

export const NoteStyleToggle = ({ style, onStyleChange }: NoteStyleToggleProps) => {
  return (
    <div 
      className="relative inline-flex items-center bg-muted/60 rounded-full p-0.5 border border-border/50"
      role="radiogroup"
      aria-label="Select note style"
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-background shadow-sm border border-border/30 transition-transform duration-200 ease-out",
          style === 'standard' ? 'translate-x-[calc(100%+2px)]' : 'translate-x-0'
        )}
      />
      
      {/* GP Shorthand option */}
      <button
        onClick={() => onStyleChange('shorthand')}
        role="radio"
        aria-checked={style === 'shorthand'}
        className={cn(
          "relative z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200",
          style === 'shorthand'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Code2 className="h-3 w-3" />
        <span>Shorthand</span>
      </button>
      
      {/* Standard Notes option */}
      <button
        onClick={() => onStyleChange('standard')}
        role="radio"
        aria-checked={style === 'standard'}
        className={cn(
          "relative z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-200",
          style === 'standard'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <FileText className="h-3 w-3" />
        <span>Standard</span>
      </button>
    </div>
  );
};
