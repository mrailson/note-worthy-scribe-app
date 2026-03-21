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
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && (
            <div
              className="w-4 h-px"
              style={{
                background: i <= currentIdx ? '#F59E0B' : 'hsl(var(--border))',
              }}
            />
          )}
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-md transition-all duration-200',
              stage === s.id
                ? 'bg-amber-500/15 border border-amber-500'
                : 'border border-transparent'
            )}
          >
            <div
              className="w-[6px] h-[6px] rounded-full"
              style={{
                background:
                  stage === s.id ? '#F59E0B' :
                  i < currentIdx ? '#10B981' : 'hsl(var(--muted-foreground))',
              }}
            />
            <span
              className={cn(
                'text-[10px] font-bold capitalize',
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
