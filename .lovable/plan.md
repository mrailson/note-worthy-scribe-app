

## Current State

- **Ask AI** (`/ai4gp`): Shown in the navigation only when `isServiceVisible('ai4pm_service')` is true. No `requiredService` on the route — any logged-in user can access it directly via URL.
- **Ask AI V2** (`/ask-ai`): Already shown to **all logged-in users** unconditionally in both desktop and mobile navigation. The route is protected only by authentication (no service activation or visibility check).

**In short: every Notewell user who can log in already has access to Ask AI V2. No users are blocked from it.**

## Recommendation

To make Ask AI V2 consistent with Ask AI (so it respects the same `ai4pm_service` visibility toggle), wrap the Ask AI V2 menu item with the same `isServiceVisible('ai4pm_service')` check. This is a single-line change in `src/components/Header.tsx` (and the mobile drawer equivalent if present).

### What this affects
- **Zero database changes** required
- **All users** who currently see "Ask AI" in the menu will also see "Ask AI V2 (Beta)"
- Users who have hidden Ask AI via their service visibility settings will also not see Ask AI V2

### Change

**File: `src/components/Header.tsx`** — Wrap the Ask AI V2 `<DropdownMenuItem>` (line 236) with:
```jsx
{isServiceVisible('ai4pm_service') && (
  <DropdownMenuItem onClick={() => navigate('/ask-ai')} className="cursor-pointer py-3">
    <Sparkles className="h-4 w-4 mr-2" />
    Ask AI V2 (Beta)
  </DropdownMenuItem>
)}
```

This is the only change needed. One line wrapper, one file.

