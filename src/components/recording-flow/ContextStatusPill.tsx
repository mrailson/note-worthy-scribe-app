import React from 'react';
import { cn } from '@/lib/utils';

interface ContextStatusPillProps {
  icon: string;
  label: string;
  value: string;
  color: string; // hex colour
  pulse?: boolean;
}

export const ContextStatusPill: React.FC<ContextStatusPillProps> = ({
  icon, label, value, color, pulse = false,
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] transition-all duration-300',
        pulse && 'animate-pill-pop'
      )}
      style={{
        background: `${color}18`,
        border: `1px solid ${color}4D`,
      }}
    >
      <span className="text-sm leading-none">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </span>
        <span
          className="text-[13px] font-extrabold leading-tight"
          style={{ color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
};
