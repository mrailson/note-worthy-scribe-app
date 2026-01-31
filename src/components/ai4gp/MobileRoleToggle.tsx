import React, { useEffect, useState } from 'react';
import { Stethoscope, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileRole = 'gp' | 'practice-manager';

interface MobileRoleToggleProps {
  selectedRole: MobileRole;
  onRoleChange: (role: MobileRole) => void;
}

const STORAGE_KEY = 'mobile-ask-ai-role';

export const useMobileRolePreference = (): [MobileRole, (role: MobileRole) => void] => {
  const [role, setRoleState] = useState<MobileRole>('gp');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'gp' || saved === 'practice-manager') {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: MobileRole) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
  };

  return [role, setRole];
};

export const MobileRoleToggle: React.FC<MobileRoleToggleProps> = ({
  selectedRole,
  onRoleChange,
}) => {
  return (
    <div 
      className="inline-flex items-center bg-muted/60 rounded-full p-0.5 border border-border/50"
      role="radiogroup"
      aria-label="Select role"
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute h-7 w-[42px] rounded-full bg-background shadow-sm border border-border/30 transition-transform duration-200 ease-out",
          selectedRole === 'practice-manager' ? 'translate-x-[44px]' : 'translate-x-0'
        )}
        style={{ position: 'absolute' }}
      />
      
      {/* GP option */}
      <button
        onClick={() => onRoleChange('gp')}
        role="radio"
        aria-checked={selectedRole === 'gp'}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[32px] min-w-[42px] rounded-full text-xs font-medium transition-colors duration-200",
          selectedRole === 'gp'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Stethoscope className="h-3.5 w-3.5" />
        <span>GP</span>
      </button>
      
      {/* PM option */}
      <button
        onClick={() => onRoleChange('practice-manager')}
        role="radio"
        aria-checked={selectedRole === 'practice-manager'}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1 px-2.5 py-1.5 min-h-[32px] min-w-[42px] rounded-full text-xs font-medium transition-colors duration-200",
          selectedRole === 'practice-manager'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>PM</span>
      </button>
    </div>
  );
};
