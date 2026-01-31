

# ChatGPT Refinements - Final Polish for NHS Homepage

## Overview
Implementing the final surgical tweaks recommended by ChatGPT to make the homepage feel properly "NHS-grade" rather than just a good pilot landing page.

---

## Changes Summary

### 1. Magic Link Wording - "instant" → "secure"
**File:** `src/components/LoginForm.tsx` (line 191)

**Current:**
> "New user or forgotten your password? Get instant access via a magic link sent to your NHS email."

**New:**
> "New user or forgotten your password? Request secure access via a magic link sent to your NHS email."

**Why:** "Instant access" can make governance people twitch. "Secure access" reads safer.

---

### 2. AI4GP Service - "Clinical decision support" → "Clinical information support"
**File:** `src/pages/Index.tsx` (line 420)

**Current:**
> "Clinical decision support"

**New:**
> "Clinical information support"

**Also update in:** `src/components/ServiceOverview.tsx` (line 32)

**Why:** "Clinical decision support" is a sensitive phrase in NHS land. This is a safer alternative that reduces regulatory concerns.

---

### 3. Reorder Governance Trust Bar (Lead with clinical safety)
**File:** `src/pages/Index.tsx` (lines 485-498)

**Current order:**
1. ✅ NHS DSPT aligned
2. ✅ UK-hosted & encrypted
3. ✅ No automatic EMIS/S1 write-back
4. ✅ Human review required

**New order:**
1. ✅ NHS DSPT aligned
2. ✅ No automatic EMIS/S1 write-back
3. ✅ Human review required
4. ✅ UK-hosted & encrypted

**Why:** Lead with clinical safety, not infrastructure. This mirrors how NHS people think.

---

### 4. Pilot Statement - "currently" → "initially"
**File:** `src/components/ServiceOverview.tsx` (line 343)

**Current:**
> "Notewell AI is currently in controlled pilot use across GP practices in Northamptonshire..."

**New:**
> "Notewell AI is initially in controlled pilot use across GP practices in Northamptonshire..."

**Why:** Sounds planned, not temporary. Implies direction of travel.

---

### 5. Remove News Ticker from Logged-out Homepage
**File:** `src/pages/Index.tsx` (lines 506-509)

The news feed at the bottom showing BBC Northamptonshire articles is identified as a "news feed leak" that undermines the polish. 

**Action:** Remove the NewsTicker component from the logged-out user view entirely.

Logged-out NHS landing pages should be:
- Calm
- Intentional
- Avoid anything that looks accidental

---

### 6. Contact Line - Add "Notewell Team" prefix
**File:** `src/components/ServiceOverview.tsx` (line 358)

**Current:**
> "Contact: Malcolm.Railson@nhs.net"

**New:**
> "Contact: Notewell Team · Malcolm.Railson@nhs.net"

**Why:** De-personalises risk while still keeping it human. Scales better beyond pilot phase.

---

## Summary of Changes

| Change | File | Impact |
|--------|------|--------|
| "instant" → "secure" access | LoginForm.tsx | Low effort, high governance safety |
| "Clinical decision support" → "Clinical information support" | Index.tsx, ServiceOverview.tsx | Low effort, reduces regulatory concerns |
| Reorder governance badges | Index.tsx | Low effort, psychology improvement |
| "currently" → "initially" | ServiceOverview.tsx | Low effort, professional framing |
| Remove News Ticker | Index.tsx | Low effort, cleaner logged-out experience |
| Add "Notewell Team ·" to contact | ServiceOverview.tsx | Low effort, professional scaling |

All changes are non-breaking micro-tweaks that improve NHS stakeholder perception.

