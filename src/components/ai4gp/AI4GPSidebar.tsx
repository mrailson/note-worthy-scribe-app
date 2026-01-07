import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  History, 
  Plus, 
  Settings, 
  Newspaper, 
  Calendar,
  Search,
  TestTube,
  Zap,
  Palette,
  ImageIcon,
  Languages,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Simple meeting type for sidebar display
interface SidebarMeeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
  duration_minutes: number;
  word_count: number;
  status: string;
}

interface AI4GPSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedRole: 'gp' | 'practice-manager';
  onNewSearch: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
  onShowNews: () => void;
  onShowBPCalculator: () => void;
  onShowTranslation: () => void;
  onShowQuickImageModal: () => void;
  onShowImageService: () => void;
  onShowQRCodeGenerator: () => void;
  onShowDocumentTranslate: () => void;
  onShowUserGuide: () => void;
  onShowAllQuickActions: () => void;
  meetings: SidebarMeeting[];
  meetingsLoading: boolean;
  onSelectMeeting: (meetingId: string) => void;
}

export const AI4GPSidebar: React.FC<AI4GPSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  selectedRole,
  onNewSearch,
  onShowHistory,
  onShowSettings,
  onShowNews,
  onShowBPCalculator,
  onShowTranslation,
  onShowQuickImageModal,
  onShowImageService,
  onShowQRCodeGenerator,
  onShowDocumentTranslate,
  onShowUserGuide,
  onShowAllQuickActions,
  meetings,
  meetingsLoading,
  onSelectMeeting
}) => {
  const navigate = useNavigate();

  const mainActions = [
    { icon: Plus, label: 'New Search', action: onNewSearch },
    { icon: History, label: 'Search History', action: onShowHistory },
    { icon: Settings, label: 'Settings', action: onShowSettings },
  ];

  const quickActions = [
    { icon: Newspaper, label: 'GP News', action: onShowNews },
    { icon: Activity, label: 'BP Average Service', action: onShowBPCalculator },
    { icon: Languages, label: 'Translation', action: onShowTranslation },
    { icon: ImageIcon, label: 'QR Code Generator', action: onShowQRCodeGenerator },
  ];

  const SidebarButton = ({ icon: Icon, label, action, className }: { 
    icon: React.ElementType; 
    label: string; 
    action: () => void;
    className?: string;
  }) => {
    if (isCollapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={action}
                className={cn("w-10 h-10 p-0 justify-center", className)}
              >
                <Icon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={action}
        className={cn("w-full justify-start gap-2 h-9", className)}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </Button>
    );
  };

  return (
    <div 
      className={cn(
        "hidden md:flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out flex-shrink-0",
        isCollapsed ? "w-14" : "w-56"
      )}
    >
      {/* Header with Toggle */}
      <div className={cn(
        "flex items-center border-b h-14 flex-shrink-0",
        isCollapsed ? "justify-center px-2" : "justify-between px-3"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="font-semibold text-sm truncate">
              {selectedRole === 'practice-manager' ? 'AI4PM' : 'AI4GP'}
            </span>
          </div>
        )}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="w-8 h-8 p-0"
              >
                {isCollapsed ? (
                  <PanelLeft className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className={cn("py-2", isCollapsed ? "px-2" : "px-2")}>
          {/* Main Actions */}
          <div className="space-y-1">
            {mainActions.map((item) => (
              <SidebarButton
                key={item.label}
                icon={item.icon}
                label={item.label}
                action={item.action}
              />
            ))}
          </div>

          <Separator className="my-3" />

          {/* Quick Actions */}
          {!isCollapsed && (
            <p className="text-xs text-muted-foreground px-2 mb-2 font-medium">Quick Actions</p>
          )}
          <div className="space-y-1">
            {quickActions.map((item) => (
              <SidebarButton
                key={item.label}
                icon={item.icon}
                label={item.label}
                action={item.action}
              />
            ))}
          </div>

          <Separator className="my-3" />

          {/* Recent Meetings */}
          {!isCollapsed && (
            <p className="text-xs text-muted-foreground px-2 mb-2 font-medium">My Recent Meetings</p>
          )}
          {isCollapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/meetings')}
                    className="w-10 h-10 p-0 justify-center"
                  >
                    <Calendar className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Meetings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="space-y-1">
              {meetingsLoading ? (
                <p className="text-xs text-muted-foreground px-2 py-2">Loading...</p>
              ) : meetings.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2">No recent meetings</p>
              ) : (
                meetings.slice(0, 5).map((meeting) => (
                  <Button
                    key={meeting.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectMeeting(meeting.id)}
                    className="w-full justify-start gap-2 h-8 text-xs"
                  >
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{meeting.title || 'Untitled'}</span>
                  </Button>
                ))
              )}
            </div>
          )}

          <Separator className="my-3" />

          {/* Help */}
          <SidebarButton
            icon={BookOpen}
            label="User Guide & Help"
            action={onShowUserGuide}
          />
        </div>
      </ScrollArea>
    </div>
  );
};
