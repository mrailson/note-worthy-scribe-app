

## Problem

Key points are currently capped at 8 regardless of meeting length. For longer meetings (30 min – 3 hours), this can miss important points.

## Plan

### 1. Dynamic key points limit based on duration (MobileMeetingDetail.tsx)

Update the `useMemo` that computes `summaryParagraph` and `keyPoints` (line ~207) to use `meeting.duration_minutes` for the slice limit:

- **< 30 min**: keep current cap of 8
- **30–180 min**: allow up to 10
- Sort/keep order as-is (AI already generates most important first)

Change line 207 from:
```ts
return { summaryParagraph: summary, keyPoints: points.slice(0, 8) };
```
to:
```ts
const maxPoints = (meeting?.duration_minutes && meeting.duration_minutes >= 30) ? 10 : 8;
return { summaryParagraph: summary, keyPoints