

# Save & Browse Meeting Infographics

## Overview
When an infographic is generated for a meeting, persist it to Supabase Storage and record it in a new database table. Show a badge count next to the Infographic tab in Export Studio. Selecting the tab shows saved infographics as thumbnail cards with preview, download, fullscreen view, and delete options.

## Database & Storage Changes

**New table: `meeting_infographics`**
```sql
create table public.meeting_infographics (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  style text,
  orientation text default 'landscape',
  created_at timestamptz default now()
);
alter table public.meeting_infographics enable row level security;
create policy "Users manage own infographics"
  on public.meeting_infographics for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**Storage**: Use existing `complaint-infographics` bucket (or create `meeting-infographics` bucket). Upload each generated infographic as `{meetingId}/{timestamp}.png`.

## Code Changes

### 1. Save infographic after generation (`MeetingExportStudioModal.tsx`)
After `handleGenerateInfographic` succeeds and `result.imageUrl` is set:
- Convert the image (base64 data URL or fetched blob) to a Blob
- Upload to Supabase Storage under `meeting-infographics/{meetingId}/{timestamp}.png`
- Insert a row into `meeting_infographics` with the public URL, style, orientation, meeting_id, user_id
- Refresh the saved infographics list

### 2. New hook: `useMeetingInfographicHistory.ts`
- Fetches all rows from `meeting_infographics` where `meeting_id` matches
- Returns `{ infographics, loading, refresh, deleteInfographic }`
- `deleteInfographic` removes from both Storage and the table

### 3. UI changes in `MeetingExportStudioModal.tsx`

**Badge on Infographic tab**: Show a small count badge (e.g., `3`) next to the Infographic tab icon when saved infographics exist for this meeting.

**Saved infographics gallery** (shown above or below the generation controls when `selectedExport === 'infographic'`):
- Horizontal scrollable row of thumbnail cards
- Each card shows: thumbnail image, style label, date, and number (e.g., "#1", "#2")
- Click → opens `InfographicFullscreen` with that image
- Download button on each card
- Delete button (with confirmation) on each card
- If no saved infographics, show nothing (just the generation controls)

### 4. Fullscreen viewer reuse
Reuse the existing `InfographicFullscreen` component. Set `infographicUrl` to the selected saved infographic's URL and open `infographicFullscreen = true`.

## UI Layout (Infographic tab when expanded)

```text
┌─────────────────────────────────────────────┐
│ Saved Infographics (3)                      │
│ ┌────┐ ┌────┐ ┌────┐                       │
│ │ #1 │ │ #2 │ │ #3 │  ← scrollable thumbs  │
│ │    │ │    │ │    │                         │
│ └────┘ └────┘ └────┘                         │
│  Pro   Gov    Safety   ← style labels       │
│                                             │
│ [Landscape/Portrait] [Logo] [Generate]      │
│ Style thumbnails row...                     │
└─────────────────────────────────────────────┘
```

## File Summary
| File | Change |
|------|--------|
| SQL migration | Create `meeting_infographics` table + RLS |
| `src/hooks/useMeetingInfographicHistory.ts` | New hook: fetch/delete saved infographics |
| `src/components/meeting-details/MeetingExportStudioModal.tsx` | Save after generation, show gallery + badge count |
| Storage bucket | Create `meeting-infographics` bucket (or reuse existing) |

