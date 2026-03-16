

## Plan: Show "Generate Notes" Prompt When Meeting Has Transcript But No Notes

### Problem
When a meeting finishes, sometimes auto-generation fails silently, leaving the default "No overview available" card with no guidance for the user.

### Solution
When a meeting has 100+ words in the transcript but no overview and no summary, show a helpful banner in the Meeting Overview tab area with a clear "Generate Meeting Notes" button instead of just the empty "No overview available" message.

### Changes

#### 1. Update `MeetingDetailsTabs.tsx`
- Add new props: `wordCount`, `summaryExists`, `notesGenerationStatus`
- In the overview `TabsContent`, when `!currentOverview && !summaryExists && wordCount >= 100`:
  - Show an informational banner (light blue/amber background) with:
    - Icon + message: "This meeting has a transcript with X words but notes haven't been generated yet."
    - A prominent "Generate Meeting Notes" button using the same logic as `ManualNoteGenerationButton`
    - A subtle note: "This will generate an overview, summary, and key points from your transcript."
  - Still show the `TextOverviewEditor` below it (so manual edit remains available)
- When `notesGenerationStatus === 'generating' || notesGenerationStatus === 'queued'`, show a "Notes are being generated..." spinner state instead

#### 2. Update `MeetingHistoryList.tsx`
- Pass `wordCount`, `summaryExists`, and `notesGenerationStatus` props to `MeetingDetailsTabs`
- These values already exist on the `meeting` object (`meeting.word_count`, `meeting.summary_exists`, `meeting.notes_generation_status`)

#### 3. Also update `MeetingGridView.tsx` (if applicable)
- Same pass-through of props if grid view uses `MeetingDetailsTabs`

### UI Design
The banner will be a soft amber/blue card with:
- `AlertTriangle` or `Sparkles` icon
- Clear call-to-action button
- Dismissible after generation starts
- Shows generation progress status when in progress

### Files to Modify
- `src/components/meeting-details/MeetingDetailsTabs.tsx` — Add props, render banner + button
- `src/components/MeetingHistoryList.tsx` — Pass new props
- `src/components/meeting-history/MeetingGridView.tsx` — Pass new props if needed

