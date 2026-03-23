import React from 'react';
import { Mic, List } from 'lucide-react';

interface TabDropdownProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasNewMeetings?: boolean;
  meetingCount?: number;
}

const TAB_CONFIG = [
  { value: 'recorder', label: 'New recording', icon: Mic },
  { value: 'history', label: 'My meetings', icon: List },
];

export const TabDropdown: React.FC<TabDropdownProps> = ({
  activeTab,
  onTabChange,
  hasNewMeetings,
  meetingCount,
}) => {
  return (
    <div className="flex items-center gap-2">
      {TAB_CONFIG.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={`
              flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium
              transition-all duration-150 border cursor-pointer
              ${isActive
                ? 'bg-[#1D6EC1] text-white border-[#1D6EC1] shadow-sm'
                : 'bg-white text-muted-foreground border-border hover:bg-accent hover:text-foreground'
              }
            `}
          >
            <Icon className="h-4 w-4" />
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.value === 'history' && typeof meetingCount === 'number' && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none
                  ${isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-primary/10 text-primary'
                  }
                `}
              >
                {meetingCount}
              </span>
            )}
            {tab.value === 'history' && hasNewMeetings && typeof meetingCount !== 'number' && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
};
