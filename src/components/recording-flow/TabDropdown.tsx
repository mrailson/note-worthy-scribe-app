import React from 'react';
import { Mic, FileText, History, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TabDropdownProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasNewMeetings?: boolean;
}

const TAB_CONFIG = [
  { value: 'recorder', label: 'Meeting Recorder', shortLabel: 'Recorder', icon: Mic },
  { value: 'transcript', label: 'Meeting Transcript', shortLabel: 'Transcript', icon: FileText },
  { value: 'history', label: 'My Meeting History', shortLabel: 'History', icon: History },
];

export const TabDropdown: React.FC<TabDropdownProps> = ({ activeTab, onTabChange, hasNewMeetings }) => {
  const currentTabConfig = TAB_CONFIG.find(t => t.value === activeTab) || TAB_CONFIG[0];
  const CurrentIcon = currentTabConfig.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer flex-shrink-0">
          <CurrentIcon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[12px] font-bold text-primary hidden sm:inline">{currentTabConfig.label}</span>
          <span className="text-[12px] font-bold text-primary sm:hidden">{currentTabConfig.shortLabel}</span>
          <ChevronDown className="h-3 w-3 text-primary/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          return (
            <DropdownMenuItem
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={activeTab === tab.value ? 'bg-primary/10 text-primary font-bold' : ''}
            >
              <Icon className="h-4 w-4 mr-2" />
              {tab.label}
              {tab.value === 'history' && hasNewMeetings && (
                <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] px-1.5 py-0 h-4 ml-auto">
                  New
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
