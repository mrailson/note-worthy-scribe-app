import { Users, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeetingTypeToggleProps {
  meetingType: 'face-to-face' | 'teams';
  onMeetingTypeChange: (type: 'face-to-face' | 'teams') => void;
}

export const MeetingTypeToggle = ({ meetingType, onMeetingTypeChange }: MeetingTypeToggleProps) => {
  return (
    <div 
      className="relative inline-flex items-center bg-muted/60 rounded-full p-1 border border-border/50"
      role="radiogroup"
      aria-label="Select meeting type"
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full bg-background shadow-sm border border-border/30 transition-transform duration-200 ease-out",
          meetingType === 'teams' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
        )}
      />
      
      {/* Face to Face option */}
      <button
        onClick={() => onMeetingTypeChange('face-to-face')}
        role="radio"
        aria-checked={meetingType === 'face-to-face'}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200",
          meetingType === 'face-to-face'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden xs:inline">Face to Face</span>
        <span className="xs:hidden">F2F</span>
      </button>
      
      {/* Teams Meeting option */}
      <button
        onClick={() => onMeetingTypeChange('teams')}
        role="radio"
        aria-checked={meetingType === 'teams'}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200",
          meetingType === 'teams'
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-muted-foreground/80'
        )}
      >
        <Monitor className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden xs:inline">Teams Meeting</span>
        <span className="xs:hidden">Teams</span>
      </button>
    </div>
  );
};
