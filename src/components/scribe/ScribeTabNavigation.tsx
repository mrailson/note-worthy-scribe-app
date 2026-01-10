import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScribeTab } from "@/types/scribe";
import { 
  Mic, 
  FileText, 
  Settings, 
  History
} from "lucide-react";

interface ScribeTabNavigationProps {
  activeTab: ScribeTab;
  onTabChange: (tab: ScribeTab) => void;
  isMobile: boolean;
}

export const ScribeTabNavigation = ({ activeTab, onTabChange, isMobile }: ScribeTabNavigationProps) => {
  const tabs = [
    { id: "recording" as ScribeTab, label: "Recording", icon: Mic },
    { id: "summary" as ScribeTab, label: "Summary", icon: FileText },
    { id: "history" as ScribeTab, label: "History", icon: History },
    { id: "settings" as ScribeTab, label: "Settings", icon: Settings }
  ];

  return (
    <div className="w-full">
      <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-1 ${isMobile ? 'h-auto' : ''}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 font-medium transition-all
                ${isMobile 
                  ? 'flex-col min-h-[52px] px-3 py-3 text-xs' 
                  : 'flex-row px-4 py-2 text-sm'
                }
                touch-manipulation active:scale-95
                hover:bg-primary/10 dark:hover:bg-primary/20
              `}
            >
              <Icon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
              {isMobile ? (
                <span className="text-[11px] leading-none font-medium">{tab.label}</span>
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
