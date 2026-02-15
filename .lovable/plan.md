

# Add "Ageing Well" Output Type to Meeting Notes

## Overview
Add a new "Ageing Well" note type to the meeting notes output dropdown. This type generates a comprehensive clinical record following Tom's master prompt for Complex Ageing Well / Frailty Reviews, structured with only two sections: **History** and **Plan**.

## Changes

### 1. Constants: Add new note type definition
**File: `src/constants/meetingNoteTypes.ts`**
- Add `'Heart'` to the `iconName` union type
- Add a new entry for `ageing-well` with label "Ageing Well", description referencing CGA/frailty reviews, and the `Heart` icon

### 2. UI: Register the Heart icon
**File: `src/components/SafeModeNotesModal.tsx`**
- Add `Heart` to the lucide-react import
- Add a `'Heart'` case in the `getNoteTypeIcon` switch statement so the dropdown renders the correct icon

### 3. Backend: Add the Ageing Well prompt
**File: `supabase/functions/auto-generate-meeting-notes/index.ts`**
- Add an `'ageing-well'` entry to the `noteTypeInstructions` record containing the full master prompt provided by Tom, covering:
  - **Role and tone**: UK GP with specialist interest in Older Adults / Frailty, defensive CQC-ready notes, British English, NHS terminology
  - **Context assumptions**: Elderly, frail, multi-morbid patient; extended holistic review
  - **Structure**: Only two sections -- History (Medical History Review, Medication Review, Cognitive & Mental Health Assessment) and Plan (Management Plan, Patient & Carer Understanding, Time & Complexity Statement)
  - **Style rules**: Full clinical sentences, include negative findings, include clinical reasoning, no bullet-point minimalism
  - **Output format**: Two sections separated by blank lines only, no tables, no emojis, no markdown beyond headings, no summarisation, length uncapped

## Technical Details
- The `noteType` value `'ageing-well'` flows from the frontend Select dropdown through the Supabase edge function invocation body, where it is matched in the `noteTypeInstructions` record
- No database schema changes required -- `note_type` is stored as a string
- The edge function already falls back to `'standard'` for unrecognised types, so deployment order is flexible
