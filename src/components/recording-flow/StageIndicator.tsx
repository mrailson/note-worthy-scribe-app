import React from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { cn } from '@/lib/utils';

export const StageIndicator: React.FC = () => {
  const { stage } = useMeetingSetup();
  
  const stages = [
    { id: 'setup' as const, label: 'Prepare' },
    { id: 'recording' as const, label: 'Recording' },
    { id: 'done' as const, label: 'Complete' },
  ];

  const stageOrder = ['setup', 'recording', 'done'];
  const currentIdx = stageOrder.indexOf(stage);

  return (
    <div className="flex items-center gap-2 p-3 px-5 rounded-xl bg-card border border-border shadow-sm mb-5">
      <span className="text-lg font-extrabold text-amber-500">Notewell AI ✦</span>
      <div className="flex-1" />
      {stages.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && (
            <div
              className="w-5 h-px"
              style={{
                background: i <= currentIdx ? '#F59E0B' : 'hsl(var(--border))',
              }}
            />
          )}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-200',
              stage === s.id
                ? 'bg-amber-500/15 border-[1.5px] border-amber-500'
                : 'border-[1.5px] border-transparent'
            )}
          >
            <div
              className="w-[7px] h-[7px] rounded-full"
              style={{
                background:
                  stage === s.id ? '#F59E0B' :
                  i < currentIdx ? '#10B981' : 'hsl(var(--muted-foreground))',
              }}
            />
            <span
              className={cn(
                'text-[11px] font-bold capitalize',
                stage === s.id ? 'text-amber-500' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
