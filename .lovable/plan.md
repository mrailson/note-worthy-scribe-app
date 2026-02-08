

# Fix: Navigate to Correspondence Tab After Outcome Letter Creation

## Problem
After the outcome letter is generated via the questionnaire modal, the modal closes and the user stays on their current tab (usually Investigation Evidence). The newly created outcome letter is only visible on the **Correspondence** tab, so the content appears to "go off the page" -- the user has no immediate visibility of what was just created.

## Solution
After the outcome letter is successfully generated:
1. Switch the active tab to **Correspondence** (the `workflow` tab)
2. Automatically open the outcome letter modal so the user can immediately review it
3. Scroll to the top of the page to ensure everything is visible

This gives the user an immediate, seamless view of both the acknowledgement and the new outcome letter.

## Changes

### File: `src/pages/ComplaintDetails.tsx`

**1. Update the `onSuccess` callback for `ComplaintOutcomeQuestionnaire`**

Currently (around line 3929):
```typescript
onSuccess={() => {
  fetchComplaintDetails();
  showToast.success('Outcome letter created successfully!', { section: 'complaints' });
}}
```

Will be updated to:
```typescript
onSuccess={() => {
  fetchComplaintDetails();
  showToast.success('Outcome letter created successfully!', { section: 'complaints' });
  // Navigate to Correspondence tab and open the outcome letter modal
  setActiveTab("workflow");
  // Small delay to allow data to load before opening modal
  setTimeout(() => {
    setShowOutcomeLetter(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 1500);
}}
```

This ensures:
- The tab switches to **Correspondence** where both the acknowledgement and outcome letter cards are shown
- The outcome letter modal opens automatically so the user can review, edit, or download it immediately
- The page scrolls to the top for a clean view
- A brief delay allows the refreshed data to load before the modal opens

## User Experience After Change

1. User completes the outcome questionnaire and clicks "Generate"
2. Questionnaire modal closes
3. Tab switches to **Correspondence**
4. Outcome letter modal opens automatically showing the generated letter
5. User can review, edit, email, or download the letter directly
6. When they close the modal, they see both the acknowledgement and outcome letter cards on the Correspondence tab

