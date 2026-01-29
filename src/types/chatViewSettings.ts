export interface ChatViewSettings {
  fontSize: 'smaller' | 'default' | 'larger' | 'largest';
  showUserMessages: boolean;
  autoCollapsePrompts: boolean;
  compactView: boolean;
  autoScrollNewMessages: boolean;
  scrollDuringStreaming: boolean;
  bubbleStyle: 'standard' | 'minimal' | 'cards';
  containerSize: 'normal' | 'wide' | 'full';
}

export const DEFAULT_CHAT_VIEW_SETTINGS: ChatViewSettings = {
  fontSize: 'default',
  showUserMessages: true,
  autoCollapsePrompts: false,
  compactView: false,
  autoScrollNewMessages: true,
  scrollDuringStreaming: true,
  bubbleStyle: 'standard',
  containerSize: 'normal',
};

export const FONT_SIZE_SCALE: Record<ChatViewSettings['fontSize'], number> = {
  smaller: 0.875,
  default: 1,
  larger: 1.125,
  largest: 1.25,
};

export const FONT_SIZE_LABELS: Record<ChatViewSettings['fontSize'], string> = {
  smaller: 'Smaller',
  default: 'Default',
  larger: 'Larger',
  largest: 'Largest',
};

export const BUBBLE_STYLE_LABELS: Record<ChatViewSettings['bubbleStyle'], string> = {
  standard: 'Standard',
  minimal: 'Minimal',
  cards: 'Cards',
};

export const CONTAINER_SIZE_LABELS: Record<ChatViewSettings['containerSize'], string> = {
  normal: 'Normal',
  wide: 'Wide',
  full: 'Full Width',
};
