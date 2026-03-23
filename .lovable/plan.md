

# Move Agenda Input Above Meeting Format

## Change

In `src/components/recording-flow/PreMeetingSetup.tsx`, swap the order of the agenda input field (lines 634-640) and the meeting format selector (lines 607-632).

Currently the order is:
1. Agenda items list
2. Meeting Format selector
3. "Type agenda item + Enter..." input

After the change:
1. Agenda items list
2. "Type agenda item + Enter..." input
3. Meeting Format selector

### Implementation

Move lines 634-640 (the `<Input>` for agenda) to just before line 607 (the meeting format block). This is a simple cut-and-paste reorder within the same parent `<div>`.

### File
- `src/components/recording-flow/PreMeetingSetup.tsx` (lines 607-640)

