import { PIPELINE, STATUS_CONFIG, type ClaimStatus } from '@/hooks/useNRESClaims';

interface ClaimStatusPipelineProps {
  currentStatus: ClaimStatus;
}

export function ClaimStatusPipeline({ currentStatus }: ClaimStatusPipelineProps) {
  const idx = PIPELINE.indexOf(currentStatus);
  const isQueried = currentStatus === 'queried';

  return (
    <div className="flex items-center gap-0.5 py-2">
      {PIPELINE.map((s, i) => {
        const c = STATUS_CONFIG[s];
        const active = i <= idx && !isQueried;
        const current = s === currentStatus;
        return (
          <div key={s} className="flex items-center gap-0.5">
            <div
              title={c.label}
              className="rounded-full transition-all duration-200"
              style={{
                width: current ? 20 : 12,
                height: current ? 20 : 12,
                background: active ? c.color : '#e2e8f0',
                border: current ? `2px solid ${c.color}` : 'none',
                boxShadow: current ? `0 0 0 3px ${c.color}33` : 'none',
              }}
            />
            {i < PIPELINE.length - 1 && (
              <div
                className="h-0.5"
                style={{
                  width: 14,
                  background: i < idx && !isQueried ? c.color : '#e2e8f0',
                }}
              />
            )}
          </div>
        );
      })}
      {isQueried && (
        <div
          title="Queried"
          className="ml-2 w-5 h-5 rounded-full"
          style={{
            background: '#dc2626',
            border: '2px solid #dc2626',
            boxShadow: '0 0 0 3px #dc262633',
          }}
        />
      )}
    </div>
  );
}
