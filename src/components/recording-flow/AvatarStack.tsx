import React from 'react';
import { SPEAKER_COLORS } from '@/types/contactTypes';

interface AvatarStackProps {
  members: Array<{ initials: string; name?: string }>;
  max?: number;
  size?: number;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({ members, max = 5, size = 24 }) => {
  const shown = members.slice(0, max);
  const extra = members.length - max;

  return (
    <div className="flex items-center">
      {shown.map((m, i) => {
        const color = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
        return (
          <div
            key={`${m.initials}-${i}`}
            className="rounded-full flex items-center justify-center font-bold flex-shrink-0 border-2 border-background"
            style={{
              width: size,
              height: size,
              background: `linear-gradient(135deg, ${color}22, ${color}44)`,
              borderColor: color,
              fontSize: size * 0.33,
              color,
              marginLeft: i === 0 ? 0 : -6,
              zIndex: max - i,
            }}
            title={m.name || m.initials}
          >
            {m.initials}
          </div>
        );
      })}
      {extra > 0 && (
        <div
          className="rounded-full flex items-center justify-center font-extrabold flex-shrink-0 bg-muted border-2 border-background text-muted-foreground"
          style={{
            width: size,
            height: size,
            marginLeft: -6,
            fontSize: 8,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};
