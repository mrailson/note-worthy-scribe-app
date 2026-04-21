import { Stethoscope, Building2, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AskAIRole = 'gp' | 'practice-manager' | 'ageing-well';

interface RoleToggleProps {
  selectedRole: AskAIRole;
  onRoleChange: (role: AskAIRole) => void;
}

const ROLES: { key: AskAIRole; label: string; shortLabel: string; icon: typeof Stethoscope }[] = [
  { key: 'gp', label: 'Clinical', shortLabel: 'GP', icon: Stethoscope },
  { key: 'practice-manager', label: 'Practice Manager', shortLabel: 'PM', icon: Building2 },
  { key: 'ageing-well', label: 'Ageing Well', shortLabel: 'AW', icon: HeartPulse },
];

export const RoleToggle = ({ selectedRole, onRoleChange }: RoleToggleProps) => {
  return (
    <div 
      className="relative inline-flex items-center bg-muted/60 rounded-full p-1 border border-border/50"
      role="radiogroup"
      aria-label="Select role"
    >
      {ROLES.map((role) => {
        const isSelected = selectedRole === role.key;
        return (
          <button
            key={role.key}
            onClick={() => onRoleChange(role.key)}
            role="radio"
            aria-checked={isSelected}
            className={cn(
              "relative z-10 flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-full text-xs sm:text-sm font-medium transition-all duration-200 mobile-touch-target",
              isSelected
                ? 'bg-background text-foreground shadow-sm border border-border/30'
                : 'text-muted-foreground hover:text-muted-foreground/80'
            )}
          >
            <role.icon className="h-4 w-4" />
            <span className="hidden xs:inline">{role.label}</span>
            <span className="xs:hidden">{role.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
};
