

# Plan: Meeting Infographic - "What You Missed" Overview Style

## Summary

Transform the meeting infographic from an action-item-focused summary into a compelling **"What You Missed"** overview that emphasises:
- **Meeting Date** (prominently displayed as a hero element)
- **Key Discussion Points** (what was actually talked about)
- **Main Outcomes and Decisions** (what matters most)
- De-emphasise action items (optional/secondary)

This creates a visual "catch-up" card perfect for sharing with colleagues who missed the meeting.

---

## Current vs New Approach

| Current Focus | New "What You Missed" Focus |
|---------------|---------------------------|
| Action items as primary content | Key discussion points as primary |
| Date/time shown in small text | Date displayed PROMINENTLY (hero) |
| "X action items" as key statistic | "What happened" narrative |
| Task-oriented layout | Story-oriented layout |
| "Creating visual summary with X action items" | "Creating 'What You Missed' overview" |

---

## Visual Concept

The new infographic will follow this visual hierarchy:

```
┌────────────────────────────────────────┐
│  🗓️  WHAT YOU MISSED                   │
│  ═══════════════════                   │
│  📅 Monday 2nd February 2026           │  ← HERO DATE
│  ⏰ 15:00 GMT                          │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ MEETING TITLE                    │  │
│  │ "Take That Reunion: Robbie's     │  │
│  │  Return and Tour Reflections"    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  📝 THE MEETING IN BRIEF               │
│  • Summary paragraph from exec summary │
│                                        │
│  💡 KEY DISCUSSION POINTS              │
│  • Point 1 - what was discussed        │
│  • Point 2 - important topic           │
│  • Point 3 - key conversation          │
│                                        │
│  ✅ DECISIONS MADE                     │
│  • Decision 1                          │
│  • Decision 2                          │
│                                        │
│  📋 Action Items: 3 (optional small)   │
└────────────────────────────────────────┘
```

---

## Technical Changes

### File 1: `src/hooks/useMeetingInfographic.ts`

#### Change 1: Update `formatMeetingForInfographic` function (lines 64-132)

**Current behaviour**: Extracts action items prominently, counts them as key statistic.

**New behaviour**: 
- Create a "WHAT YOU MISSED" overview section
- Extract "Key Points" from the Discussion Summary section
- Extract "Discussion Topics" for what was talked about
- Move action items to a simple count at the bottom

```typescript
const formatMeetingForInfographic = (data: MeetingInfographicData): string => {
  const sections: string[] = [];

  // NEW: "What You Missed" header
  sections.push(`WHAT YOU MISSED`);
  sections.push(`─────────────────────────────────`);
  
  // PROMINENT DATE (hero element)
  if (data.meetingDate) {
    sections.push(`\n📅 ${data.meetingDate}`);
  }
  if (data.meetingTime) {
    sections.push(`⏰ ${data.meetingTime}`);
  }
  
  // Meeting Title
  sections.push(`\nMEETING: "${data.meetingTitle}"`);
  
  if (data.location) {
    sections.push(`📍 ${data.location}`);
  }

  // Executive summary as "THE MEETING IN BRIEF"
  const execMatch = data.notesContent.match(/(?:#|##)\s*EXECUTIVE SUMMARY[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
  if (execMatch) {
    sections.push('\n📝 THE MEETING IN BRIEF:');
    const summary = execMatch[1].trim();
    sections.push(summary.length > 400 ? summary.substring(0, 400) + '...' : summary);
  }

  // NEW: Extract Key Points from Discussion Summary
  const keyPointsMatch = data.notesContent.match(/(?:#|##)\s*(?:Key Points|KEY POINTS)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
  if (keyPointsMatch) {
    sections.push('\n💡 KEY DISCUSSION POINTS:');
    const keyPoints = keyPointsMatch[1].trim()
      .split('\n')
      .filter(l => l.trim())
      .slice(0, 5);
    sections.push(keyPoints.join('\n'));
  }

  // Key decisions
  const decisionsMatch = data.notesContent.match(/(?:#|##)\s*(?:KEY DECISIONS|DECISIONS)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
  if (decisionsMatch) {
    sections.push('\n✅ DECISIONS MADE:');
    const decisions = decisionsMatch[1].trim()
      .split('\n')
      .filter(l => l.trim())
      .slice(0, 4);
    sections.push(decisions.join('\n'));
  }

  // Action items - now SECONDARY (just a count or brief list)
  if (data.actionItems.length > 0) {
    sections.push(`\n📋 ${data.actionItems.length} action item${data.actionItems.length > 1 ? 's' : ''} assigned`);
  }

  return sections.join('\n');
};
```

#### Change 2: Update `customPrompt` (lines 169-194)

**Current**: Focuses on action items with owners/deadlines.

**New**: "What You Missed" overview style with date as hero.

```typescript
const customPrompt = `Create a HIGH QUALITY "WHAT YOU MISSED" meeting overview infographic.

MEETING: "${data.meetingTitle}"

CONCEPT: This is a visual catch-up for people who missed the meeting. 
Focus on WHAT HAPPENED, not just tasks.

VISUAL STYLE INSTRUCTIONS:
${styleInstruction}

CRITICAL CONTENT HIERARCHY (in order of visual prominence):

1. "WHAT YOU MISSED" - Bold header at top
2. DATE AND TIME - Display VERY PROMINENTLY as a HERO ELEMENT (large, styled)
   ${data.meetingDate ? `Date: ${data.meetingDate}` : ''}
   ${data.meetingTime ? `Time: ${data.meetingTime}` : ''}
3. MEETING TITLE - Clear and readable
4. THE MEETING IN BRIEF - Key summary paragraph (what this meeting was about)
5. KEY DISCUSSION POINTS - The main topics and conversations that took place
6. DECISIONS MADE - Important outcomes that were agreed
7. ACTION ITEMS - Small/optional section with just a count or brief mention

DESIGN REQUIREMENTS:
- "WHAT YOU MISSED" banner/badge styling at the top
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Professional GP practice/NHS styling
- British English spelling throughout
- A4 portrait format, suitable for printing or sharing digitally
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make it feel like catching up with a colleague, not a task list`;
```

### File 2: `src/components/meeting-details/MeetingInfographicModal.tsx`

#### Change 3: Update `GENERATION_TIPS` (lines 41-50)

```typescript
const GENERATION_TIPS = [
  "Designing 'What You Missed' overview...",
  "Creating visual date and time display...",
  "Extracting key discussion points...",
  "Formatting main decisions and outcomes...",
  "Adding professional NHS styling...",
  "Creating story-focused layout...",
  "Adding icons and visual elements...",
  "Almost ready! Finalising your overview...",
];
```

#### Change 4: Update progress message (line 254)

```typescript
// FROM:
<p className="text-xs text-muted-foreground/70">
  Creating visual summary with {meetingData.actionItems.length} action items
</p>

// TO:
<p className="text-xs text-muted-foreground/70">
  Creating "What You Missed" overview with key points and decisions
</p>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMeetingInfographic.ts` | Update content extraction and AI prompt |
| `src/components/meeting-details/MeetingInfographicModal.tsx` | Update UI tips and progress text |

---

## Expected Output

The new infographic will:

1. ✅ Feature the **date prominently** as a hero visual element
2. ✅ Focus on **key discussion points** (what was talked about)
3. ✅ Include **decisions made** (outcomes)
4. ✅ Show a brief **executive summary** (the meeting in brief)
5. ✅ De-emphasise action items (just a count, not detailed list)
6. ✅ Feel like a "catch-up card" for someone who missed the meeting
7. ✅ Use British English throughout

