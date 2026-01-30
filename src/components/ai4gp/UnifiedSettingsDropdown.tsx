import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { 
  Settings, 
  RotateCcw, 
  Type, 
  MessageSquare, 
  ArrowDownToLine, 
  Palette, 
  Maximize2,
  Plus,
  Sparkles,
  BookOpen,
  SlidersHorizontal,
  Zap
} from 'lucide-react';
import { ChatViewSettings, FONT_SIZE_LABELS, BUBBLE_STYLE_LABELS, CONTAINER_SIZE_LABELS } from '@/types/chatViewSettings';
import { useIsMobile, useDeviceInfo } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface UnifiedSettingsDropdownProps {
  // Chat View Settings
  chatViewSettings: ChatViewSettings;
  onUpdateChatViewSetting: <K extends keyof ChatViewSettings>(key: K, value: ChatViewSettings[K]) => void;
  onResetChatViewDefaults: () => void;
  // Quick Pick Actions
  onNewSearch: () => void;
  onShowGPGenie: () => void;
  onShowUserGuide: () => void;
  // Settings Modal
  onOpenSettings: () => void;
}

export const UnifiedSettingsDropdown: React.FC<UnifiedSettingsDropdownProps> = ({
  chatViewSettings,
  onUpdateChatViewSetting,
  onResetChatViewDefaults,
  onNewSearch,
  onShowGPGenie,
  onShowUserGuide,
  onOpenSettings,
}) => {
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceInfo();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5",
            deviceInfo.isIPhone ? "px-3 h-10 min-w-[44px]" : "h-8 px-2"
          )}
          title="Settings"
        >
          <Settings className={cn(
            deviceInfo.isIPhone ? "w-4 h-4" : "h-4 w-4"
          )} />
          {!isMobile && <span className="text-xs">Settings</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56">
        {/* Quick Actions Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2" openLeft>
            <span>Quick Actions</span>
            <Zap className="h-4 w-4 ml-auto" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent side="left">
            <DropdownMenuItem onClick={onNewSearch}>
              <Plus className="w-4 h-4 mr-2" />
              New Search
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowGPGenie}>
              <Sparkles className="w-4 h-4 mr-2" />
              GP Genie
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowUserGuide}>
              <BookOpen className="w-4 h-4 mr-2" />
              User Guide & Help
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* View Settings Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2" openLeft>
            <span>View</span>
            <SlidersHorizontal className="h-4 w-4 ml-auto" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56" side="left">
            {/* Text Size */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2" openLeft>
                <span>Text Size</span>
                <Type className="h-4 w-4 ml-auto" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent side="left">
                <DropdownMenuRadioGroup
                  value={chatViewSettings.fontSize}
                  onValueChange={(value) => onUpdateChatViewSetting('fontSize', value as ChatViewSettings['fontSize'])}
                >
                  {(Object.keys(FONT_SIZE_LABELS) as Array<ChatViewSettings['fontSize']>).map((size) => (
                    <DropdownMenuRadioItem key={size} value={size}>
                      {FONT_SIZE_LABELS[size]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Message Display */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2" openLeft>
                <span>Message Display</span>
                <MessageSquare className="h-4 w-4 ml-auto" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent side="left">
                <DropdownMenuCheckboxItem
                  checked={chatViewSettings.showUserMessages}
                  onCheckedChange={(checked) => onUpdateChatViewSetting('showUserMessages', checked)}
                >
                  Show my requests
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={chatViewSettings.autoCollapsePrompts}
                  onCheckedChange={(checked) => onUpdateChatViewSetting('autoCollapsePrompts', checked)}
                >
                  Auto-collapse my prompts
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={chatViewSettings.compactView}
                  onCheckedChange={(checked) => onUpdateChatViewSetting('compactView', checked)}
                >
                  Compact view
                </DropdownMenuCheckboxItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Auto-Scroll */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2" openLeft>
                <span>Auto-Scroll</span>
                <ArrowDownToLine className="h-4 w-4 ml-auto" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent side="left">
                <DropdownMenuCheckboxItem
                  checked={chatViewSettings.autoScrollNewMessages}
                  onCheckedChange={(checked) => onUpdateChatViewSetting('autoScrollNewMessages', checked)}
                >
                  Scroll to new messages
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={chatViewSettings.scrollDuringStreaming}
                  onCheckedChange={(checked) => onUpdateChatViewSetting('scrollDuringStreaming', checked)}
                >
                  Scroll during typing
                </DropdownMenuCheckboxItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Bubble Style */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2" openLeft>
                <span>Bubble Style</span>
                <Palette className="h-4 w-4 ml-auto" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent side="left">
                <DropdownMenuRadioGroup
                  value={chatViewSettings.bubbleStyle}
                  onValueChange={(value) => onUpdateChatViewSetting('bubbleStyle', value as ChatViewSettings['bubbleStyle'])}
                >
                  {(Object.keys(BUBBLE_STYLE_LABELS) as Array<ChatViewSettings['bubbleStyle']>).map((style) => (
                    <DropdownMenuRadioItem key={style} value={style}>
                      {BUBBLE_STYLE_LABELS[style]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Container Size */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2" openLeft>
                <span>Container Size</span>
                <Maximize2 className="h-4 w-4 ml-auto" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent side="left">
                <DropdownMenuRadioGroup
                  value={chatViewSettings.containerSize}
                  onValueChange={(value) => onUpdateChatViewSetting('containerSize', value as ChatViewSettings['containerSize'])}
                >
                  {(Object.keys(CONTAINER_SIZE_LABELS) as Array<ChatViewSettings['containerSize']>).map((size) => (
                    <DropdownMenuRadioItem key={size} value={size}>
                      {CONTAINER_SIZE_LABELS[size]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* Reset to Defaults */}
            <DropdownMenuItem onClick={onResetChatViewDefaults} className="gap-2">
              <span>Reset view defaults</span>
              <RotateCcw className="h-4 w-4 ml-auto" />
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Full Settings Modal */}
        <DropdownMenuItem onClick={onOpenSettings} className="gap-2">
          <span>All Settings...</span>
          <Settings className="h-4 w-4 ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
