

## Problem Analysis

The duplicate "Practice Manager" persists because the de-duplication check at line 453 is positioned **after** the `isAddressPattern` gate at line 430. Here's the flow for a raw "Practice Manager" line:

1. Line 430: `isAddressPattern` regex matches "practice" in "Practice Manager" → `true`
2. Line 432: `!isAddressPattern` is `false` → skips the name block (good)
3. Line 453: The job_title duplicate check **should** catch it, but it's placed after the address-pattern gate in a way that could be bypassed — specifically, the `isAddressPattern` check on line 430 feeds into the name block on 432, but the "Practice Manager" line also matches patterns like "practice" in the address regex, causing it to sometimes be rendered as an address/contact line at line 458 before the duplicate check can act.

The root cause: the job_title duplicate check is buried deep in conditional logic. It needs to be the **first** check after the consecutive-duplicate check, so it always fires regardless of other pattern matches.

## Plan

**File: `src/components/FormattedLetterContent.tsx`** (signature rendering, ~line 394-462)

Move the `signatoryProfile.job_title` duplicate check to immediately after the consecutive-duplicate check (line 403), before any other pattern matching:

```typescript
// After consecutive duplicate check (line 403), add:
// Skip any line that matches the injected job_title (already rendered under the name)
if (signatoryProfile?.job_title) {
  const cleanLine = trimmedLine.replace(/\*/g, '').trim().toLowerCase();
  const cleanTitle = signatoryProfile.job_title.trim().toLowerCase();
  if (cleanLine === cleanTitle || cleanLine.includes(cleanTitle)) {
    return null;
  }
}
```

Then remove the old duplicate check at line 453-455 since it's now redundant.

This ensures the job_title line from raw content is always filtered out, regardless of whether it matches address patterns or any other conditions downstream.

