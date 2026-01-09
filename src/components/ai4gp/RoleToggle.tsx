import { Stethoscope, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleToggleProps {
  selectedRole: 'gp' | 'practice-manager';
  onRoleChange: (role: 'gp' | 'practice-manager') => void;
}

export const RoleToggle = ({ selectedRole, onRoleChange }: RoleToggleProps) => {
  return (
    <div 
      className="relative inline-flex items-center bg-muted/60 rounded-full p-1 border border-border/50"
      role="radiogroup"
      aria-label="Select role"
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full bg-background shadow-sm border border-border/30 transition-transform duration-200 ease-out",
          selectedRole === 'practice-manager' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
        )}
      />
      
      {/* GP/Clinical option */}
      <button
        onClick={() => onRoleChange('gp')}
        role="radio"
        aria-checked={selectedRole === 'gp'}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200",
          selectedRole === 'gp'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden xs:inline">Clinical</span>
        <span className="xs:hidden">GP</span>
      </button>
      
      {/* Practice Manager option */}
      <button
        onClick={() => onRoleChange('practice-manager')}
        role="radio"
        aria-checked={selectedRole === 'practice-manager'}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200",
          selectedRole === 'practice-manager'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden xs:inline">Practice Manager</span>
        <span className="xs:hidden">PM</span>
      </button>
    </div>
  );
};
