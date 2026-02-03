
# BNF Quick Lookup Hub - Comprehensive Drug Reference for Clinicians

## Overview

This plan creates a **dedicated BNF screen** under the existing "BNF & Prescribing" category that serves as the single source of truth for drug guidance. The screen will feature:

1. **Top 10 NHS Prescribed Drugs** - Quick access badges based on national prescribing data
2. **Real-time Typeahead Search** - Instant filtering from 500+ drugs as you type
3. **Comprehensive BNF Detail Page** - Full drug monograph with indications, dosing, interactions, contraindications, and monitoring

---

## User Experience Flow

```text
+--------------------------------------------------+
|  BNF & Prescribing  (expanded subcategory)       |
+--------------------------------------------------+
|                                                  |
|  [Drug Lookup] [Interactions] [Dose Calc] ...    |
|       |                                          |
|       v                                          |
+--------------------------------------------------+
|  BNF QUICK LOOKUP HUB                            |
+--------------------------------------------------+
|                                                  |
|  Top 10 NHS Prescribed:                          |
|  [Omeprazole] [Amlodipine] [Atorvastatin] ...   |
|                                                  |
|  Search (typeahead):                             |
|  +--------------------------------------------+  |
|  |  🔍  Type drug name...              |  ▼  |  |
|  +--------------------------------------------+  |
|    Metformin                 [GREEN]             |
|    Methotrexate              [SPECIALIST]        |
|    Methylphenidate           [RED]               |
|                                                  |
+--------------------------------------------------+
        |
        v (click drug)
+--------------------------------------------------+
|  COMPREHENSIVE BNF PAGE                          |
+--------------------------------------------------+
|  Amlodipine                     [GREEN] [Back]   |
|  ------------------------------------------------|
|  INDICATIONS                                     |
|  • Hypertension                                  |
|  • Angina (chronic stable, Prinzmetal's)         |
|                                                  |
|  DOSING (Adult)                                  |
|  • Initial: 5mg once daily                       |
|  • Max: 10mg once daily                          |
|  • Elderly: Start 2.5mg                          |
|                                                  |
|  CONTRAINDICATIONS                               |
|  • Cardiogenic shock                             |
|  • Severe aortic stenosis                        |
|                                                  |
|  INTERACTIONS                                    |
|  • CYP3A4 inhibitors (↑ levels)                  |
|  • Simvastatin (limit to 20mg)                   |
|                                                  |
|  MONITORING                                      |
|  • BP at initiation and dose changes             |
|                                                  |
|  SIDE EFFECTS                                    |
|  • Common: Ankle oedema, flushing, headache      |
|  • Serious: Arrhythmias (rare)                   |
|                                                  |
|  [View Traffic Light] [Insert into Chat] [BNF]   |
+--------------------------------------------------+
```

---

## Technical Implementation

### 1. New Components

| Component | Purpose |
|-----------|---------|
| `BNFQuickLookupPanel.tsx` | Main container with Top 10 badges and search |
| `BNFDrugDetailPage.tsx` | Comprehensive drug monograph view |
| `TopPrescribedDrugs.tsx` | Static curated list of top NHS drugs |
| `BNFTypeaheadSearch.tsx` | Real-time fuzzy search with traffic light badges |

### 2. Edge Function Updates

**New function: `bnf-comprehensive-lookup`**

This function will:
- Accept a drug name
- Call the official BNF API or use AI with strict NHS safety guardrails to generate comprehensive BNF-style monograph
- Return structured data: indications, dosing, contraindications, interactions, monitoring, side effects
- Include NHS safety preamble and clinical verification

### 3. Top 10 NHS Prescribed Drugs (Static Curated List)

Based on NHS England prescribing data, the top prescribed drugs in primary care:

| Rank | Drug | Common Use |
|------|------|------------|
| 1 | Omeprazole | Acid reflux/GORD |
| 2 | Amlodipine | Hypertension |
| 3 | Atorvastatin | Cholesterol |
| 4 | Lansoprazole | Acid reflux |
| 5 | Ramipril | Hypertension/Heart failure |
| 6 | Metformin | Type 2 Diabetes |
| 7 | Paracetamol | Pain/Fever |
| 8 | Simvastatin | Cholesterol |
| 9 | Aspirin | Cardiovascular prevention |
| 10 | Levothyroxine | Hypothyroidism |

### 4. Real-time Typeahead Search

- Uses existing `useTrafficLightVocab` hook (261+ drugs already loaded)
- Fuse.js fuzzy matching with prefix boosting
- Shows traffic light badge inline with each result
- Minimum 2 characters to trigger search
- Maximum 15 results shown
- Debounced input (150ms)

### 5. Comprehensive BNF Detail Page

The detail page will include:

**Sections displayed:**
1. **Header**: Drug name, traffic light status, BNF chapter
2. **Indications**: Licensed uses
3. **Dosing**: Adult, elderly, renal adjustments, paediatric (if applicable)
4. **Contraindications & Cautions**: Absolute and relative
5. **Drug Interactions**: Clinically significant, severity levels
6. **Monitoring**: What to check and when
7. **Side Effects**: Common (>1%) and serious
8. **Pregnancy/Breastfeeding**: Safety information
9. **Patient Counselling**: Key points to discuss

**Actions:**
- **View Traffic Light Details**: Opens existing PolicyModal
- **Insert into Chat**: Adds summary to AI chat
- **Open BNF Online**: External link to bnf.nice.org.uk

### 6. NHS Safety Implementation

Following the 6-layer AI safety guardrail system documented in the CSO Report:

1. **Clinical Safety Monitoring**: All drug information cross-referenced
2. **Input Validation**: Sanitise drug name queries
3. **Rate Limiting**: Edge function protected
4. **Hallucination Detection**: Verify facts against BNF source
5. **User Disclaimers**: "Always verify with official BNF. Use clinical judgement."
6. **Source Attribution**: Link to official BNF for each drug

---

## Files to Create/Modify

### New Files

| File | Description |
|------|-------------|
| `src/components/bnf/BNFQuickLookupPanel.tsx` | Main panel with Top 10 and search |
| `src/components/bnf/BNFDrugDetailPage.tsx` | Comprehensive drug page |
| `src/components/bnf/TopPrescribedDrugs.tsx` | Top 10 badge grid |
| `src/components/bnf/BNFTypeaheadSearch.tsx` | Real-time search component |
| `supabase/functions/bnf-comprehensive-lookup/index.ts` | AI-powered BNF lookup |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/ai4gp/gpPromptCategories.ts` | Update BNF subcategory to show the new panel |
| `src/components/ai4gp/GPHomeScreen.tsx` | Handle opening BNF panel |
| `supabase/config.toml` | Add new edge function |

---

## Data Flow

```text
User clicks "Drug Lookup" in BNF category
              |
              v
    BNFQuickLookupPanel renders
              |
   +----------+----------+
   |                     |
   v                     v
Top 10 badges      Typeahead search
   |                     |
   +----------+----------+
              |
              v
     User selects drug
              |
              v
    bnf-comprehensive-lookup (edge function)
              |
              v
    BNFDrugDetailPage renders
              |
    +---------+---------+
    |         |         |
    v         v         v
Indications Dosing  Interactions...
```

---

## NHS Safety Compliance Checklist

- [ ] All drug information sourced from/verified against BNF
- [ ] Clinical safety disclaimer displayed prominently
- [ ] No AI hallucination risk (structured extraction, not free generation)
- [ ] Traffic light status always shown
- [ ] "Professional judgement required" warning
- [ ] Links to official BNF for verification
- [ ] MHRA alerts integration point (future)
- [ ] Rate limiting on edge function

---

## Implementation Order

1. Create static Top 10 component
2. Create typeahead search using existing vocab hook
3. Build BNF detail page structure
4. Create edge function with AI + safety guardrails
5. Wire up navigation from GPHomeScreen
6. Add NHS safety disclaimers
7. Test end-to-end flow

---

## Estimated Complexity

| Component | Effort |
|-----------|--------|
| Top 10 badges | Low |
| Typeahead search | Medium (reuse existing) |
| BNF detail page | Medium |
| Edge function | High (AI + safety) |
| Integration | Low |

**Total: Medium-High complexity**

