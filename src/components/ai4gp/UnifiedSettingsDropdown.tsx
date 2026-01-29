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
      <DropdownMenuContent align="end" className="w-56">
        {/* Quick Actions Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Zap className="h-4 w-4" />
            <span>Quick Actions</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
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
          <DropdownMenuSubTrigger className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span>View</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {/* Text Size */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Type className="h-4 w-4" />
                <span>Text Size</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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
              <DropdownMenuSubTrigger className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>Message Display</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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
              <DropdownMenuSubTrigger className="gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                <span>Auto-Scroll</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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
              <DropdownMenuSubTrigger className="gap-2">
                <Palette className="h-4 w-4" />
                <span>Bubble Style</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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
              <DropdownMenuSubTrigger className="gap-2">
                <Maximize2 className="h-4 w-4" />
                <span>Container Size</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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
              <RotateCcw className="h-4 w-4" />
              <span>Reset view defaults</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Full Settings Modal */}
        <DropdownMenuItem onClick={onOpenSettings} className="gap-2">
          <Settings className="h-4 w-4" />
          <span>All Settings...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
