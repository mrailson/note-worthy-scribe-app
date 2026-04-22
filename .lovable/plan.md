

## Add Status Hover Card with Complaint Overview (Revised)

### What it does
Hovering over the status badge in the complaint list shows a compact pop-up card with a brief complaint summary and action progress — no patient-identifying data.

### Changes

**1. Add HoverCard around the status Badge** (`src/pages/ComplaintsSystem.tsx`)
- Import `HoverCard`, `HoverCardContent`, `HoverCardTrigger` from `@/components/ui/hover-card`
- Import `Separator` from `@/components/ui/separator`
- Wrap the status `Badge` at ~line 2018-2027 inside a `HoverCard` (openDelay 200ms)
- The HoverCardContent (width ~300px) displays:

```text
┌───────────────────────────────────┐
│ 📋 Complaint Overview             │
├───────────────────────────────────┤
│ Title:     [complaint_title]      │
│ Category:  [category label]       │
│ ────────────────────────────────  │
│ Summary:                          │
│ [complaint_description, truncated │
│  to ~150 chars]                   │
│ ────────────────────────────────  │
│ Acknowledgement: ✅ Sent / ⏳     │
│ Outcome Letter:  ✅ Sent / ⏳     │
│ Outcome Type:    [if closed]      │
└───────────────────────────────────┘
```

- **Included**: Title, category, short description summary, acknowledgement/outcome letter status
- **Excluded**: Patient name/DOB/phone/email/address, received date, days open, deadline, priority, staff mentioned, location
- Description truncated to ~150 characters with ellipsis for readability

### Files Changed
- `src/pages/ComplaintsSystem.tsx` — Import HoverCard + Separator, wrap status badge with hover content

