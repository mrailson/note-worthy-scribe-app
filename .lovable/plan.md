

# Final NHS-Grade Refinements - Neighbourhoods Section & Pilot Context

## Overview
Implementing the final ChatGPT-recommended refinements to ensure the logged-out homepage is fully ICB/IG-safe. The current "Neighbourhoods Ready" section contains language that could be misinterpreted as claiming live cross-organisational data sharing.

---

## Changes Summary

### 1. Soften "Neighbourhoods Ready" Section Heading & Content
**File:** `src/components/ServiceOverview.tsx` (lines 295-333)

**Current heading:**
> "Neighbourhoods Ready: Multi-Agency Collaboration"

**New heading:**
> "Neighbourhoods Ready: Designed for Multi-Agency Working"

**Current paragraph (line 296-298):**
> "All systems have been developed to meet the needs of the impending Neighbourhoods with a multi-agency ready system to collaborate and share without the historic IT challenges."

**New paragraph:**
> "The platform has been designed to avoid the traditional technical constraints that have historically limited cross-organisational working, while remaining aligned with NHS information governance requirements."

---

### 2. Update the Three Feature Cards (lines 301-327)

| Current | New |
|---------|-----|
| **Seamless Integration** | **Collaboration-ready design** |
| "Built for multi-agency collaboration from the ground up" | "Built to support multi-agency workflows as Neighbourhood models mature" |
| **Unified Data Sharing** | **Standards-aligned architecture** |
| "Secure, standardized data exchange across organizations" | "Designed around secure, role-based information sharing principles" |
| **Future-Proof Design** | **Future-ready platform** |
| "Ready for tomorrow's healthcare collaboration models" | "Prepared for emerging Neighbourhood and ICS operating models" |

---

### 3. Remove "Breaking Down IT Barriers" Box
**File:** `src/components/ServiceOverview.tsx` (lines 329-333)

**Current:**
> "Breaking Down IT Barriers: Our platform eliminates the traditional IT silos that have historically hindered effective multi-agency collaboration, enabling truly integrated care delivery."

**Action:** Remove this entire block. The wording is too bold for a logged-out page and could trigger IG concerns about data sharing claims.

---

### 4. Add Pilot Phase Clarification Line
**File:** `src/components/ServiceOverview.tsx` (line 343)

**Current:**
> "Notewell AI is initially in controlled pilot use across GP practices in Northamptonshire, with clinical safety oversight and phased feature rollout."

**New (add one additional sentence):**
> "Notewell AI is initially in controlled pilot use across GP practices in Northamptonshire, with clinical safety oversight and phased feature rollout. Features and access vary by role and pilot phase."

**Why:** Pre-empts "Why can't I see X?" and "I heard another practice has Y" questions.

---

## Technical Implementation

### File to Modify
- `src/components/ServiceOverview.tsx`

### Line-by-Line Changes

**Lines 295-298 (heading + paragraph):**
```tsx
<h3 className="font-semibold text-lg">Neighbourhoods Ready: Designed for Multi-Agency Working</h3>
<p className="text-muted-foreground text-sm mt-2">
  The platform has been designed to avoid the traditional technical constraints that have historically limited cross-organisational working, while remaining aligned with NHS information governance requirements.
</p>
```

**Lines 305-308 (first card):**
```tsx
<h4 className="font-semibold text-xs">Collaboration-ready design</h4>
<p className="text-xs text-muted-foreground">
  Built to support multi-agency workflows as Neighbourhood models mature
</p>
```

**Lines 314-317 (second card):**
```tsx
<h4 className="font-semibold text-xs">Standards-aligned architecture</h4>
<p className="text-xs text-muted-foreground">
  Designed around secure, role-based information sharing principles
</p>
```

**Lines 323-326 (third card):**
```tsx
<h4 className="font-semibold text-xs">Future-ready platform</h4>
<p className="text-xs text-muted-foreground">
  Prepared for emerging Neighbourhood and ICS operating models
</p>
```

**Lines 329-333 (remove entire block):**
Delete the "Breaking Down IT Barriers" box entirely.

**Line 343 (pilot statement):**
Add additional sentence about feature/access variation.

---

## Summary of Changes

| Change | Location | Impact |
|--------|----------|--------|
| Heading: "Multi-Agency Collaboration" → "Designed for Multi-Agency Working" | Line 295 | Softer positioning |
| Paragraph: Claims → Design intent | Lines 296-298 | IG-safe language |
| Card 1: "Seamless Integration" → "Collaboration-ready design" | Lines 305-308 | Removes integration claims |
| Card 2: "Unified Data Sharing" → "Standards-aligned architecture" | Lines 314-317 | Removes data sharing claims |
| Card 3: "Future-Proof Design" → "Future-ready platform" | Lines 323-326 | Clearer positioning |
| Remove "Breaking Down IT Barriers" box | Lines 329-333 | Eliminates bold claims |
| Add pilot phase clarification | Line 343 | Pre-empts confusion |

All changes keep the ambition whilst removing any hint of "live data sharing right now".

