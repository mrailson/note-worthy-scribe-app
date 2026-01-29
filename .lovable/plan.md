# Plan: Enhance Live Meeting Recording Experience

## Status: ✅ COMPLETED

## Overview
This plan addressed the issues where:
1. ✅ The meeting title stays as "General Meeting" until the recording ends → Now updates live
2. ✅ The word count shows 0 throughout the meeting → Now syncs every 30 seconds
3. ✅ There's no indication that the meeting is live recording in the history view → Added pulsing LIVE indicator
4. ✅ Action items are only generated after the meeting ends → Now extracted during recording

## Implementation Summary

### Files Created
| File | Purpose |
|------|---------|
| `src/hooks/useLiveMeetingUpdates.ts` | Custom hook managing periodic word count sync and live insights extraction |
| `supabase/functions/extract-live-meeting-insights/index.ts` | Edge function for AI-powered title and action item extraction during recording |
| `src/components/meeting-history/LiveRecordingIndicator.tsx` | Visual component with pulsing red dot, LIVE badge, and word count |

### Files Modified
| File | Changes |
|------|---------|
| `src/components/MeetingRecorder.tsx` | Integrated `useLiveMeetingUpdates` hook |
| `src/components/MeetingHistoryList.tsx` | Replaced "(Recording Now)" text with `LiveRecordingIndicator` |
| `supabase/config.toml` | Added `extract-live-meeting-insights` function config |

## How It Works

### Word Count Sync (Every 30 seconds)
- The `useLiveMeetingUpdates` hook runs an interval during recording
- Updates `meetings.word_count` in the database
- Meeting History receives this via existing Supabase Realtime subscription

### Live Title & Action Items (Every 3 minutes, after 200+ words)
- Calls `extract-live-meeting-insights` edge function
- Sends last ~3000 words of transcript
- AI extracts a specific meeting title and any new action items
- Title updates in both local state and database
- Action items inserted to `meeting_action_items` table with `source: 'live_extraction'`

### Visual Indicator
- Pulsing red dot + animated "LIVE" badge
- Shows real-time word count
- Replaces the plain "(Recording Now)" text

## Update Intervals

| Update Type | Interval | Condition |
|-------------|----------|-----------|
| Word Count | 30 seconds | Always during recording |
| Insights | 3 minutes | After 200+ words, only if 500+ new words since last extraction |

## Expected User Experience

1. User starts recording
2. At ~30 seconds: Word count shows in history (instead of 0)
3. At ~3 minutes: Title may update from "General Meeting" to specific topic
4. Throughout: Meeting History shows pulsing LIVE indicator with word count
5. Action items appear in the Actions tab during recording
6. At end: Full notes generation runs as before (no change)

## Backwards Compatibility
- All changes are additive
- Existing stopRecording flow unchanged
- Post-meeting notes generation still runs
- Live action items will be alongside post-meeting extracted ones
