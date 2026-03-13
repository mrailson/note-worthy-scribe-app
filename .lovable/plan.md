

## Add History Link to Setup Modal

**What**: Add a discreet "View History" text link in the footer of the `LiveTranslationSetupModal`, next to the Cancel button (left-aligned while Cancel/Start stay right-aligned).

**How**:

1. **`LiveTranslationSetupModal.tsx`**:
   - Add an optional `onShowHistory?: () => void` prop
   - In the footer (line 282), change the flex layout to `justify-between` and add a small text button on the left side with a History icon: `"View History"` — only shown when `onShowHistory` is provided
   - Style it as a ghost/link button with `text-xs text-muted-foreground` to keep it discreet

2. **Pass the callback from parent components**:
   - `TranslationServicePanel.tsx`: pass `onShowHistory={() => { setShowSetupModal(false); setShowHistory(true); }}`
   - `TranslatePanel.tsx`: same pattern
   - `DictationTranslationWrapper.tsx`: same pattern
   - `MobileReceptionTranslation.tsx`: pass it if history is accessible there, otherwise skip

**Footer layout sketch**:
```text
[📋 View History]                    [Cancel]  [Start Session]
```

