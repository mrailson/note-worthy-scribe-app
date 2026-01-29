
# Plan: Enhance Live Meeting Recording Experience

## Overview
This plan addresses the issues shown in the screenshots where:
1. The meeting title stays as "General Meeting" until the recording ends
2. The word count shows 0 throughout the meeting  
3. There's no indication that the meeting is live recording in the history view
4. Action items are only generated after the meeting ends

We will implement **live updates during recording** that show word count, generate a smart title, and extract action items - all while the meeting is still in progress.

## Current Architecture Understanding

### How Recordings Work Now
- Meeting record is created with `status: 'recording'` when recording starts
- `title` is set to "General Meeting" (default from `meetingSettings`)
- `word_count` field exists but is only updated when recording stops
- Title generation (`generate-meeting-title`) only runs at the end
- Action items are extracted post-recording via `auto-generate-meeting-notes`

### Key Components
| Component | Purpose |
|-----------|---------|
| `MeetingRecorder.tsx` | Main recording component with word count state |
| `MeetingHistoryList.tsx` | Shows meeting list, currently shows "(Recording Now)" badge |
| `live_meeting_notes` table | Stores live notes during recording |
| `meeting_action_items` table | Stores structured action items |
| `generate-meeting-title` | Edge function for smart titles |

## Implementation Approach

### 1. Live Word Count Updates to Database

**Problem:** Word count is tracked locally in `MeetingRecorder.tsx` via `wordCount` state, but never written to the `meetings` table until recording ends.

**Solution:** Periodically update the `meetings.word_count` field during recording.

**Changes:**
- Add a new `useEffect` in `MeetingRecorder.tsx` that triggers every 30 seconds during recording
- Update the `meetings` table with the current word count
- This allows Meeting History to show real-time word count

```
// Pseudocode for interval update
useEffect(() => {
  if (!isRecording) return;
  
  const interval = setInterval(async () => {
    const meetingId = sessionStorage.getItem('currentMeetingId');
    if (meetingId && wordCount > 0) {
      await supabase.from('meetings').update({ 
        word_count: wordCount,
        updated_at: new Date().toISOString()
      }).eq('id', meetingId);
    }
  }, 30000); // Every 30 seconds
  
  return () => clearInterval(interval);
}, [isRecording, wordCount]);
```

### 2. Live Title Generation (Periodic Smart Title)

**Problem:** Title stays as "General Meeting" until recording ends and `generate-meeting-title` runs.

**Solution:** Call `generate-meeting-title` periodically during recording after minimum transcript content is available.

**Trigger Conditions:**
- First call at 3 minutes or 200 words (whichever comes first)
- Subsequent updates every 5 minutes OR when word count increases by 500 words
- Throttle to prevent excessive API calls

**Changes:**
1. **New state in `MeetingRecorder.tsx`:**
   - `lastTitleGenerationWordCount` - tracks when title was last updated
   - `lastTitleGenerationTime` - tracks when title was last generated

2. **New periodic check in `MeetingRecorder.tsx`:**
   - Every 60 seconds, check if conditions are met for title regeneration
   - Call `generate-meeting-title` with current transcript
   - Update local `meetingSettings.title` and database

3. **Database update:**
   - Update `meetings.title` and `meetings.auto_generated_name` during recording

### 3. Live Action Items Extraction

**Problem:** Action items are only extracted after recording ends.

**Solution:** Create a new lightweight edge function that extracts just the title and action items during recording.

**New Edge Function: `extract-live-meeting-insights`**

Purpose: Quick extraction of meeting title and action items from transcript (runs during recording)

```
Input: {
  meetingId: string,
  transcript: string (last 3000 words for efficiency),
  currentTitle: string,
  existingActionItems: string[]
}

Output: {
  suggestedTitle: string,
  actionItems: [
    { action_text: string, assignee_name: string, due_date: string }
  ]
}
```

Key characteristics:
- Uses Gemini 2.5 Flash for speed (~1-2s response)
- Only processes last ~3000 words of transcript for efficiency
- Returns incremental action items (new ones only)
- Runs every 3-5 minutes during recording

**Changes:**
1. Create `supabase/functions/extract-live-meeting-insights/index.ts`
2. Add call logic in `MeetingRecorder.tsx` 
3. Insert new action items to `meeting_action_items` table during recording
4. Update meeting title if AI suggests a better one

### 4. Meeting History Live Updates

**Problem:** Meeting History shows stale data during recording.

**Solution:** Use Supabase Realtime to subscribe to `meetings` table changes.

**Changes in `MeetingHistoryList.tsx`:**
1. Subscribe to realtime updates for meetings with `status: 'recording'`
2. Automatically refresh the specific meeting row when word_count or title changes
3. Add visual indicator showing live updates are occurring

### 5. Enhanced Recording Indicator in History

**Current:** Shows "(Recording Now)" text badge
**Enhanced:** 
- Animated pulsing red dot next to title
- Live word count that updates in real-time
- "Live" badge that pulses

## Technical Details

### New Edge Function: `extract-live-meeting-insights`

```typescript
// Core prompt structure
const systemPrompt = `You extract meeting insights from a live transcript.

Return JSON only:
{
  "suggestedTitle": "Specific descriptive title (4-12 words)",
  "actionItems": [
    {
      "action_text": "Clear action description",
      "assignee_name": "Name or TBC",
      "due_date": "Date mentioned or TBC"
    }
  ]
}

Rules:
- Title must be specific (never "General Meeting" or "Team Update")
- Only include NEW action items not in existingActionItems
- Use British English
- Focus on the most recent discussion`;
```

### Update Intervals During Recording

| Update Type | Interval | Condition |
|-------------|----------|-----------|
| Word Count | 30 seconds | Always during recording |
| Title Generation | 5 minutes | After 200+ words, only if 500+ new words |
| Action Items | 3 minutes | After 300+ words |

### Performance Considerations

1. **Throttling:** All periodic updates are throttled to prevent API spam
2. **Transcript Truncation:** Only send last 3000 words for live insights
3. **Debouncing:** Word count updates debounced to 30s
4. **Conditional Updates:** Skip updates if transcript hasn't grown significantly

### State Management

New refs in `MeetingRecorder.tsx`:
```typescript
const lastLiveUpdateRef = useRef<{
  wordCountSync: number;
  titleGeneration: number;
  actionItemsExtraction: number;
  lastTitleWordCount: number;
}>({
  wordCountSync: 0,
  titleGeneration: 0,
  actionItemsExtraction: 0,
  lastTitleWordCount: 0
});
```

## Implementation Order

1. **Phase 1: Word Count Sync** (Quick win)
   - Add 30-second interval to sync word count to database
   - Update Meeting History to show live count

2. **Phase 2: Live Title Generation**
   - Add periodic title generation logic
   - Update database and local state

3. **Phase 3: Edge Function + Action Items**
   - Create `extract-live-meeting-insights` edge function
   - Add call logic during recording
   - Insert action items to database

4. **Phase 4: Realtime Subscription**
   - Add Supabase Realtime subscription for live updates
   - Enhance visual indicators

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/MeetingRecorder.tsx` | Add periodic update logic, new refs, live insight calls |
| `src/components/MeetingHistoryList.tsx` | Add Realtime subscription, enhanced recording indicator |
| `supabase/functions/extract-live-meeting-insights/index.ts` | New edge function |

## Expected User Experience After Implementation

1. User starts recording
2. At ~30 seconds: Word count shows "15 words" in history (instead of 0)
3. At ~3 minutes: Title updates from "General Meeting" to e.g., "Primary Care Network Pharmacy Integration Discussion"
4. At ~4 minutes: First action items appear in the Actions tab
5. Throughout: Meeting History shows live updating word count
6. At end: Full notes generation runs as before (no change)

## Backwards Compatibility

- All changes are additive
- Existing stopRecording flow unchanged
- Post-meeting notes generation still runs
- Action items from live extraction are deduplicated against post-meeting extraction
