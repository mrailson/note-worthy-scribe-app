
# Chat View Settings Dropdown

## Overview
Add a configurable chat view settings icon next to "My Meetings" that opens a dropdown menu with submenus for customising the chat bubble display. Settings will persist across sessions using localStorage to adapt to different screen resolutions.

## Location
The settings icon will appear in the CardHeader toolbar, positioned between the "My Meetings" dropdown and the "Quick Pick" dropdown.

## Proposed Settings Structure

### 1. Text Size (Submenu)
- **Smaller** - 0.875x scale
- **Default** - 1.0x scale  
- **Larger** - 1.125x scale
- **Largest** - 1.25x scale

*Note: This specifically controls chat bubble font size, separate from the global text size in Settings.*

### 2. Message Display (Submenu)
- **Show my requests** - Toggle to show/hide user messages
- **Auto-collapse my prompts** - Collapse user messages by default
- **Compact view** - Reduces padding and spacing in bubbles

### 3. Auto-Scroll Behaviour (Submenu)
- **Auto-scroll to new messages** - On/Off
- **Scroll during streaming** - On/Off (scrolls as AI types)

### 4. Bubble Style (Submenu)
- **Standard** - Current appearance
- **Minimal** - Less visual decoration
- **Cards** - More prominent card styling

---

## Technical Implementation

### New Files

#### 1. `src/types/chatViewSettings.ts`
Define the TypeScript interface for chat view settings:
```
interface ChatViewSettings {
  fontSize: 'smaller' | 'default' | 'larger' | 'largest';
  showUserMessages: boolean;
  autoCollapsePrompts: boolean;
  compactView: boolean;
  autoScrollNewMessages: boolean;
  scrollDuringStreaming: boolean;
  bubbleStyle: 'standard' | 'minimal' | 'cards';
}
```

#### 2. `src/hooks/useChatViewSettings.ts`
Custom hook managing settings state and localStorage persistence:
- Load settings on mount
- Persist changes immediately
- Provide getter/setter functions for each setting
- Export defaults for reset functionality

#### 3. `src/components/ai4gp/ChatViewSettingsDropdown.tsx`
New dropdown component with submenus:
- Uses `@radix-ui/react-dropdown-menu` (already installed)
- Settings icon trigger (`SlidersHorizontal` or `LayoutGrid` from lucide-react)
- Submenus for each category using `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`
- Radio items for exclusive options (font size, bubble style)
- Checkbox items for toggles (show messages, auto-scroll)

### Modified Files

#### 4. `src/components/AI4GPService.tsx`
- Import and use `useChatViewSettings` hook
- Add `ChatViewSettingsDropdown` to the toolbar after `MeetingsDropdown`
- Pass relevant settings down to `MessagesList`
- Wire up the `autoCollapsePrompts` setting to existing `autoCollapseUserPrompts` prop

#### 5. `src/components/ai4gp/MessagesList.tsx`
- Accept new props: `chatFontSize`, `showUserMessages`, `compactView`, `bubbleStyle`
- Apply font size scaling via CSS custom properties or inline styles
- Filter out user messages when `showUserMessages` is false
- Adjust padding/margins based on `compactView`
- Apply different styling classes based on `bubbleStyle`

#### 6. `src/components/MessageRenderer.tsx`
- Accept new props for chat-specific styling
- Apply font size class to message content wrapper
- Apply compact mode padding adjustments
- Apply bubble style variations (border, shadow, background)

---

## UI/UX Design

### Dropdown Icon
```
[Calendar] My Meetings    [SlidersHorizontal]    [MoreVertical] Quick Pick    [Settings]
```

The icon will be a simple `SlidersHorizontal` icon (representing view customisation) with no text label on mobile, and optionally "View" text on desktop.

### Menu Structure
```
+---------------------------+
| Text Size            ▶    |
| ├ Smaller                 |
| ├ Default            ✓    |
| ├ Larger                  |
| └ Largest                 |
+---------------------------+
| Message Display      ▶    |
| ├ ☑ Show my requests      |
| ├ ☐ Auto-collapse prompts |
| └ ☐ Compact view          |
+---------------------------+
| Auto-Scroll          ▶    |
| ├ ☑ Scroll to new msgs    |
| └ ☑ Scroll during typing  |
+---------------------------+
| Bubble Style         ▶    |
| ├ Standard           ✓    |
| ├ Minimal                 |
| └ Cards                   |
+---------------------------+
|  ↺ Reset to defaults      |
+---------------------------+
```

---

## Persistence Strategy
- **localStorage key**: `ai4gp-chat-view-settings`
- **Merge with defaults**: On load, merge stored settings with defaults to handle new options gracefully
- **Immediate save**: Changes persist immediately without requiring a "Save" action

---

## Integration with Existing Settings
The existing `autoCollapseUserPrompts` setting from the global Settings modal will:
1. Continue to work as before
2. Be synchronised with the new dropdown's "Auto-collapse my prompts" toggle
3. Both controls will update the same underlying state

---

## Responsive Considerations
- On mobile: Icon only, no text
- On desktop: Icon + "View" text
- Dropdown positions correctly via `align="end"` 
- Touch-friendly tap targets (min 44px height) on menu items

---

## Files Summary

| File | Action |
|------|--------|
| `src/types/chatViewSettings.ts` | Create |
| `src/hooks/useChatViewSettings.ts` | Create |
| `src/components/ai4gp/ChatViewSettingsDropdown.tsx` | Create |
| `src/components/AI4GPService.tsx` | Modify |
| `src/components/ai4gp/MessagesList.tsx` | Modify |
| `src/components/MessageRenderer.tsx` | Modify |

