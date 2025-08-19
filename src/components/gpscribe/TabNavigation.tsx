import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveTab } from "@/types/gpscribe";
import { 
  Stethoscope, 
  Languages, 
  FileText, 
  Lightbulb, 
  Settings, 
  History,
  BookOpen
} from "lucide-react";

interface TabNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isMobile: boolean;
}

export const TabNavigation = ({ activeTab, onTabChange, isMobile }: TabNavigationProps) => {
  const tabs = [
    { id: "consultation" as ActiveTab, label: "Consultation", icon: Stethoscope },
    { id: "summary" as ActiveTab, label: "Summary", icon: FileText },
    { id: "examples" as ActiveTab, label: "Examples", icon: BookOpen },
    { id: "history" as ActiveTab, label: "History", icon: History }
  ];

  return (
    <div className="w-full">
      <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-1`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-2 py-2 text-xs font-medium
                ${isMobile ? 'flex-col min-h-[44px]' : 'flex-row'}
                touch-manipulation
              `}
            >
              <Icon className="h-4 w-4" />
              {isMobile ? (
                <span className="text-[10px] leading-none">{tab.label}</span>
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