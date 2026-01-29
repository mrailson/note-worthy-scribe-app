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
import { SlidersHorizontal, RotateCcw, Type, MessageSquare, ArrowDownToLine, Palette } from 'lucide-react';
import { ChatViewSettings, FONT_SIZE_LABELS, BUBBLE_STYLE_LABELS } from '@/types/chatViewSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ChatViewSettingsDropdownProps {
  settings: ChatViewSettings;
  onUpdateSetting: <K extends keyof ChatViewSettings>(key: K, value: ChatViewSettings[K]) => void;
  onResetToDefaults: () => void;
}

export const ChatViewSettingsDropdown: React.FC<ChatViewSettingsDropdownProps> = ({
  settings,
  onUpdateSetting,
  onResetToDefaults,
}) => {
  const isMobile = useIsMobile();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 h-8 px-2",
            isMobile ? "min-w-[36px]" : ""
          )}
          title="Chat view settings"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {!isMobile && <span className="text-xs">View</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Text Size Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Type className="h-4 w-4" />
            <span>Text Size</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={settings.fontSize}
              onValueChange={(value) => onUpdateSetting('fontSize', value as ChatViewSettings['fontSize'])}
            >
              {(Object.keys(FONT_SIZE_LABELS) as Array<ChatViewSettings['fontSize']>).map((size) => (
                <DropdownMenuRadioItem key={size} value={size}>
                  {FONT_SIZE_LABELS[size]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Message Display Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Message Display</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuCheckboxItem
              checked={settings.showUserMessages}
              onCheckedChange={(checked) => onUpdateSetting('showUserMessages', checked)}
            >
              Show my requests
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.autoCollapsePrompts}
              onCheckedChange={(checked) => onUpdateSetting('autoCollapsePrompts', checked)}
            >
              Auto-collapse my prompts
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.compactView}
              onCheckedChange={(checked) => onUpdateSetting('compactView', checked)}
            >
              Compact view
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Auto-Scroll Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            <span>Auto-Scroll</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuCheckboxItem
              checked={settings.autoScrollNewMessages}
              onCheckedChange={(checked) => onUpdateSetting('autoScrollNewMessages', checked)}
            >
              Scroll to new messages
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={settings.scrollDuringStreaming}
              onCheckedChange={(checked) => onUpdateSetting('scrollDuringStreaming', checked)}
            >
              Scroll during typing
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Bubble Style Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Palette className="h-4 w-4" />
            <span>Bubble Style</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={settings.bubbleStyle}
              onValueChange={(value) => onUpdateSetting('bubbleStyle', value as ChatViewSettings['bubbleStyle'])}
            >
              {(Object.keys(BUBBLE_STYLE_LABELS) as Array<ChatViewSettings['bubbleStyle']>).map((style) => (
                <DropdownMenuRadioItem key={style} value={style}>
                  {BUBBLE_STYLE_LABELS[style]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Reset to Defaults */}
        <DropdownMenuItem onClick={onResetToDefaults} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          <span>Reset to defaults</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
