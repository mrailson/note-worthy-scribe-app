import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Volume2, VolumeX } from 'lucide-react';

interface VolumeIndicatorProps {
  volume: number;
  isMuted: boolean;
}

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({
  volume,
  isMuted
}) => {
  const getVolumeLevel = (vol: number): string => {
    if (vol < 0.1) return 'Silent';
    if (vol < 0.3) return 'Low';
    if (vol < 0.7) return 'Medium';
    return 'High';
  };

  const getVolumeColor = (vol: number): string => {
    if (vol < 0.1) return 'text-muted-foreground';
    if (vol < 0.3) return 'text-yellow-500';
    if (vol < 0.7) return 'text-green-500';
    return 'text-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      {isMuted ? (
        <VolumeX className="h-4 w-4 text-red-500" />
      ) : (
        <Volume2 className={`h-4 w-4 ${getVolumeColor(volume)}`} />
      )}
      
      <Badge variant="outline" className="flex items-center gap-2">
        {isMuted ? 'Muted' : getVolumeLevel(volume)}
        
        {!isMuted && (
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-full ${
                  volume > i * 0.2 
                    ? 'bg-current' 
                    : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        )}
      </Badge>
    </div>
  );
};