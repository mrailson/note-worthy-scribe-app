import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, FileText, Mic, History } from 'lucide-react';

interface DocumentEmailTabsProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
  isMobile: boolean;
}

export const DocumentEmailTabs = ({ activeSubTab, onSubTabChange, isMobile }: DocumentEmailTabsProps) => {
  const subTabs = [
    { id: "text-email", label: "Text & Email", icon: Mail },
    { id: "history", label: "History", icon: History },
    { id: "voice-conversation", label: "Voice Conversation", icon: Mic },
    { id: "documents-images", label: "Documents & Images", icon: FileText }
  ];

  return (
    <div className="w-full mb-6">
      <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-1 ${isMobile ? 'h-auto' : ''}`}>
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => onSubTabChange(tab.id)}
              className={`
                flex items-center gap-2 font-medium transition-all
                ${isMobile 
                  ? 'flex-col min-h-[52px] px-3 py-3 text-xs' 
                  : 'flex-row px-4 py-2 text-sm'
                }
                touch-manipulation active:scale-95
                hover:bg-blue-100/80 dark:hover:bg-blue-900/80
              `}
            >
              <Icon className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
              {isMobile ? (
                <span className="text-[10px] leading-none font-medium text-center">{tab.label}</span>
              ) : (
                <span>{tab.label}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
};