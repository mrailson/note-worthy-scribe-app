

## Add 12 New Stock Image Categories for Primary Care

### Overview
Add 12 new GP-practice-specific stock image categories to the Stock Library, with prompts tailored to Northamptonshire NHS primary care settings. The category filter chips will be reorganised into logical groups to keep the UI tidy as the list grows from 10 to 22 categories.

### New Categories
1. **Health Promotion & Campaigns** — Flu jabs, cancer screening, smoking cessation, NHS campaign materials
2. **Signage & Wayfinding** — Door signs, directional arrows, room labels, accessibility symbols
3. **Patient Safety & Infection Control** — Hand hygiene, PPE, sharps disposal, clinical waste
4. **Pharmacy & Prescriptions** — Repeat prescriptions, pharmacy counters, electronic prescribing
5. **Mental Health & Wellbeing** — Calm spaces, counselling rooms, mindfulness, social prescribing
6. **Access & Inclusivity** — Wheelchair ramps, hearing loops, Easy Read materials, BSL
7. **Seasonal & Calendar Events** — Winter pressures, flu season, Christmas closures, bank holidays
8. **Self-Care & Prevention** — Patient education, healthy lifestyle, long-term condition management
9. **Urgent & Emergency Care** — Minor injuries, triage, 111 signposting, emergency equipment
10. **HR & Recruitment** — Job adverts, induction, staff wellbeing, appraisals
11. **Data & Digital Services** — Online access, NHS App, data dashboards, cyber security
12. **CQC & Compliance** — Inspection preparation, policy folders, ratings displays, governance

### UI Improvements — Grouped Category Display
Currently the 10 categories display as a flat row of badge chips which will become unwieldy at 22. The plan is to group them into labelled sections:

```text
[Clinical]
  Patients | Clinical Rooms | Patient Safety & Infection Control | Pharmacy & Prescriptions | Urgent & Emergency Care

[Practice & Facilities]
  Buildings | Reception & Waiting Areas | Signage & Wayfinding | Access & Inclusivity

[People & Culture]
  Staff & Teams | HR & Recruitment | Meetings & Training

[Health & Community]
  Community & Wellbeing | Mental Health & Wellbeing | Health Promotion & Campaigns | Self-Care & Prevention | Seasonal & Calendar Events

[Digital & Governance]
  Technology | Data & Digital Services | CQC & Compliance

[Design Assets]
  Branding & Logos | Infographic Elements
```

Each group heading will be a small muted label, with the badge chips beneath it. An "All (n)" chip remains at the top. Empty categories (zero images) are still hidden for non-admin users.

### Technical Changes

**1. `src/hooks/useStockImages.ts`**
- Expand `STOCK_IMAGE_CATEGORIES` array from 10 to 22 entries
- Add a new exported `CATEGORY_GROUPS` constant mapping group names to their categories, used by the UI for grouped display

**2. `src/components/ai4gp/studio/StockImageLibrary.tsx`**
- Replace the flat `flex-wrap` badge list with grouped sections using `CATEGORY_GROUPS`
- Each group has a small `text-[10px] uppercase text-muted-foreground` label followed by its category badges
- Keeps compact layout — groups separated by a thin divider or extra spacing

**3. `src/components/ai4gp/studio/StockImageUploader.tsx`**
- No structural changes needed — it already iterates `STOCK_IMAGE_CATEGORIES` for the dropdown, so the new categories appear automatically

**4. `supabase/functions/generate-stock-images/index.ts`**
- Add 12 new entries to `CATEGORY_PROMPTS` with 10 prompts each
- All prompts will be specific to GP practices with Northamptonshire context where practical (e.g. Northamptonshire village settings, local community references, East Midlands architecture)
- All prompts use British English and reference NHS/EMIS/SystmOne where relevant

### Prompt Style Examples

**Health Promotion & Campaigns:**
- "A GP surgery noticeboard displaying seasonal flu vaccination campaign posters, NHS branding, Northamptonshire ICB materials, colourful health promotion"
- "A practice nurse administering a flu jab to an elderly patient, NHS immunisation clinic, professional clinical setting"

**Signage & Wayfinding:**
- "A clear door sign for a GP consultation room reading 'Room 3 — Dr Patel', NHS blue, accessible font, Braille strip below"

**CQC & Compliance:**
- "A CQC 'Good' rating certificate displayed in a GP surgery reception area, NHS inspection results, professional framed display"

**Pharmacy & Prescriptions:**
- "A clinical pharmacist reviewing repeat prescriptions on EMIS Web in a GP practice dispensary, medication shelves, NHS"

### No Database or Schema Changes Required
The `stock_images` table already uses a free-text `category` column, so new categories work immediately without migration.

