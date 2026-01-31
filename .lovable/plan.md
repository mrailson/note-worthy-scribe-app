

# Homepage Improvements Plan for NHS Stakeholders

## Overview
Implementing the ChatGPT-recommended changes to make the logged-out homepage clearer, more NHS-friendly, and reassuring for Practice Managers, GPs, and ICB stakeholders — whilst keeping the "Send Me a Magic Link" functionality intact.

---

## Changes Summary

### 1. Sharpen the "What is this?" Message (Above the Fold)
**Current:** "AI-Powered Primary Care Support" with "Revolutionary AI4GP and AI4PM services..."

**New:**
- **Headline:** "Notewell AI – Practical AI Tools for NHS Primary Care"
- **Sub-headline:** "Secure, clinician-led AI for meetings, complaints, practice management and GP support — designed for real NHS workflows, not experiments."

**File:** `src/components/ServiceOverview.tsx` (lines 117-123)

---

### 2. Add Safety Guardrail to AI4GP Service Card
Add a one-line guardrail under the AI4GP description on the homepage to reassure cautious NHS staff.

**New text below AI4GP card:**
> 🔒 Information support only · No patient data · GP-designed

**File:** `src/pages/Index.tsx` (lines 396-423, AI4GP service card)

---

### 3. Add "Who is this for?" Section
A horizontal strip helping non-tech users instantly self-identify.

**New section with three personas:**
| Persona | Description |
|---------|-------------|
| 🧑‍⚕️ GPs & Clinicians | Structured support, references, admin reduction |
| 🗂 Practice Managers | Complaints, meetings, governance |
| 🧩 PCNs & Neighbourhoods | Shared workflows, consistency, oversight |

**Location:** After the service cards, before the ServiceOverview component

**File:** `src/pages/Index.tsx`

---

### 4. Add Governance Trust Bar
Make security/compliance explicit but calm — essential for ICB conversations and PM WhatsApp groups.

**Trust badges (compact horizontal row):**
- ✅ NHS DSPT aligned
- ✅ UK-hosted & encrypted  
- ✅ No automatic EMIS/S1 write-back
- ✅ Human review required

**File:** `src/pages/Index.tsx` (new section) and/or `src/components/ServiceOverview.tsx`

---

### 5. Add Pilot Context Statement
Own the pilot status confidently and set expectations.

**New text:**
> "Notewell AI is currently in controlled pilot use across GP practices in Northamptonshire, with clinical safety oversight and phased feature rollout."

**Location:** Near the governance trust bar or call-to-action section

**File:** `src/components/ServiceOverview.tsx` (lines 341-353, CTA section)

---

### 6. Update Wording Throughout
High-impact micro-changes to reduce subconscious resistance:

| Current | New |
|---------|-----|
| "AI-Powered" | "AI-Supported" |
| "Revolutionary" | "Practical" / "Purpose-built" |
| "Instant clinical guidance" (if present) | "Structured information support" |

**Files affected:**
- `src/components/ServiceOverview.tsx` (line 119: "AI-Powered" → "AI-Supported", line 122: "Revolutionary" → "Practical")
- Check other references across service descriptions

---

### 7. Keep Login & Magic Link Intact
The LoginForm component with the "Send Me a Magic Link" button will remain completely unchanged. All improvements are additive to the welcome content area.

---

## Technical Implementation Details

### Files to Modify

1. **`src/pages/Index.tsx`**
   - Add safety guardrail text below AI4GP service card (~line 423)
   - Add new "Who is this for?" section after service cards (~line 453)
   - Add governance trust bar before ServiceOverview

2. **`src/components/ServiceOverview.tsx`**
   - Update headline from "AI-Powered Primary Care Support" to "Practical AI Tools for NHS Primary Care" (line 119)
   - Change "Revolutionary" to "Practical" (line 122)
   - Add pilot context statement in the CTA section (around line 346)
   - Update any remaining "AI-Powered" references to "AI-Supported"

### New UI Components/Sections

**Who is this for? Section:**
```
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-accent/30 rounded-lg border">
  <!-- 3 persona cards with icons and short descriptions -->
</div>
```

**Governance Trust Bar:**
```
<div className="flex flex-wrap justify-center gap-3">
  <!-- 4 compact badges with check icons -->
</div>
```

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                 │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │                     │  │     LOGIN FORM          │   │
│  │  WELCOME CONTENT    │  │  (unchanged, includes   │   │
│  │                     │  │   magic link button)    │   │
│  │  • Training Video   │  │                         │   │
│  │  • Complaints CMS   │  └─────────────────────────┘   │
│  │  • AI4GP + guardrail│                                │
│  │  • Meetings         │                                │
│  │                     │                                │
│  │  WHO IS THIS FOR?   │                                │
│  │  [GPs] [PMs] [PCNs] │                                │
│  │                     │                                │
│  │  TRUST BAR          │                                │
│  │  ✅ DSPT ✅ UK-hosted│                                │
│  └─────────────────────┘                                │
├─────────────────────────────────────────────────────────┤
│  SERVICE OVERVIEW (updated wording)                     │
│  • "Practical AI Tools for NHS Primary Care"            │
│  • Pilot context statement                              │
│  • Contact CTA                                          │
├─────────────────────────────────────────────────────────┤
│  NEWS TICKER                                            │
└─────────────────────────────────────────────────────────┘
```

---

## Summary of Changes

| Change | Impact | Effort |
|--------|--------|--------|
| Sharpen headline & sub-headline | High | Low |
| AI4GP safety guardrail | High | Low |
| "Who is this for?" section | Medium | Medium |
| Governance trust bar | High | Low |
| Pilot context statement | Medium | Low |
| Wording updates | Medium | Low |

All changes are additive and non-breaking. The login form and magic link functionality remain completely unchanged.

