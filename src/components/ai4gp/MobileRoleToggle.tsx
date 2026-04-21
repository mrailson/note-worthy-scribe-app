import React, { useEffect, useState } from 'react';
import { Stethoscope, Building2, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AskAIRole } from './RoleToggle';

interface MobileRoleToggleProps {
  selectedRole: AskAIRole;
  onRoleChange: (role: AskAIRole) => void;
}

const STORAGE_KEY = 'mobile-ask-ai-role';

export const useMobileRolePreference = (): [AskAIRole, (role: AskAIRole) => void] => {
  const [role, setRoleState] = useState<AskAIRole>('gp');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'gp' || saved === 'practice-manager' || saved === 'ageing-well') {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: AskAIRole) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
  };

  return [role, setRole];
};

const MOBILE_ROLES: { key: AskAIRole; label: string; icon: typeof Stethoscope }[] = [
  { key: 'gp', label: 'GP', icon: Stethoscope },
  { key: 'practice-manager', label: 'PM', icon: Building2 },
  { key: 'ageing-well', label: 'AW', icon: HeartPulse },
];

export const MobileRoleToggle: React.FC<MobileRoleToggleProps> = ({
  selectedRole,
  onRoleChange,
}) => {
  return (
    <div 
      className="relative inline-flex items-center bg-muted/60 rounded-full p-0.5 border border-border/50"
      role="radiogroup"
      aria-label="Select role"
    >
      {MOBILE_ROLES.map((role) => {
        const isSelected = selectedRole === role.key;
        return (
          <button
            key={role.key}
            onClick={() => onRoleChange(role.key)}
            role="radio"
            aria-checked={isSelected}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[32px] min-w-[42px] rounded-full text-xs font-medium transition-colors duration-200",
              isSelected
                ? 'bg-background text-foreground shadow-sm border border-border/30'
                : 'text-muted-foreground hover:text-muted-foreground/80'
            )}
          >
            <role.icon className="h-3.5 w-3.5" />
            <span>{role.label}</span>
          </button>
        );
      })}
    </div>
  );
};
