

# Add Searchable Language Selector to Translation Setup Modal

## Overview
Replace the current static `Select` dropdown in the "Start Live Translation" modal with a searchable, filterable language selector. This will let reception staff quickly find a language by typing part of the name or language code, rather than scrolling through the full alphabetical list.

## Approach
Modify `src/components/admin-dictate/LiveTranslationSetupModal.tsx` to replace the Radix `Select` component with a `Popover` + search `Input` + `ScrollArea` pattern (similar to what already exists in `src/components/translation/LanguageSelector.tsx`).

## What Changes

**File: `src/components/admin-dictate/LiveTranslationSetupModal.tsx`**

1. Replace the `Select`/`SelectContent`/`SelectItem` imports with `Popover`, `PopoverTrigger`, `PopoverContent`, `Input`, `ScrollArea`, and `ChevronsUpDown` from lucide.
2. Add a `search` state variable for the filter text.
3. Compute `filteredLanguages` from `availableLanguages` by matching the search term against `lang.name` and `lang.code` (case-insensitive).
4. Render a `Popover` with:
   - A trigger button showing the selected language (flag + name) or placeholder text.
   - A content panel containing a search `Input` at the top and a `ScrollArea` listing the filtered languages below.
   - Each language item remains a clickable row showing flag, name, and voice quality indicator (green/amber tick).
   - Clicking a language sets the value, closes the popover, and clears the search.
5. Keep all existing functionality (voice quality legend, training mode, session creation) unchanged.

## Technical Details

- The search input filters on both `lang.name` (e.g. "Bulgarian") and `lang.code` (e.g. "bg"), matching anywhere in the string.
- The popover content uses `max-h-64` with `ScrollArea` to keep the dropdown a manageable height.
- The search field auto-focuses when the popover opens for quick typing.
- Background and z-index classes ensure the dropdown is opaque and visible above the dialog.

