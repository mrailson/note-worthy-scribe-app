

## Updated Plan: Add SDA Evidence Requirements to Route 1 (New SDA Resource)

### What changed

Route 1 (New SDA Resource) now also requires supporting evidence — specifically the **SDA Slot Type Report** and **SDA Rota Report** — before a claim can be submitted. This aligns both routes on Part A evidence, while Route 2 (Buy-Back) additionally requires the two LTC (Part B) evidence documents.

### Updated Evidence Matrix

| Evidence Type | Route 1: New SDA | Route 2: Buy-Back |
|--------------|-----------------|-------------------|
| SDA Slot Type Report | **Required** | **Required** |
| SDA Rota Report | **Required** | **Required** |
| LTC Slot Type Report | Not required | **Required** |
| LTC Rota Report | Not required | **Required** |

### Updated Workflows

**Route 1 — New SDA Resource** (approval flow unchanged, evidence added):
```text
Draft (+ upload SDA evidence) --> Submitted --> Approved/Rejected by SNO
```
- Submit button blocked until mandatory SDA evidence is uploaded
- Still goes directly to Mark Gray — no intermediary verification step
- Declaration unchanged

**Route 2 — Buy-Back** (unchanged from previous plan):
```text
Draft (+ upload all 4 evidence docs) --> Submitted --> Verified --> Approved
```

### Implementation Changes vs Previous Plan

#### 1. `nres_claim_evidence_config` table — update seed data
- Change `applies_to` for SDA Slot Type and SDA Rota from `'buyback'` to `'all'`
- LTC Slot Type and LTC Rota remain `'buyback'` only

#### 2. `ClaimEvidencePanel.tsx` — show for both routes
- Currently planned for Buy-Back claims only
- Update to also render on New SDA claims, but only show the 2 SDA evidence slots (filter by `applies_to` matching the claim category)
- The panel queries `nres_claim_evidence_config` to determine which slots to display

#### 3. `BuyBackClaimsTab.tsx` — submission gating for both routes
- Apply the same "all mandatory evidence uploaded" check before enabling Submit, regardless of route
- For New SDA: 2 mandatory files (SDA slot type + rota)
- For Buy-Back: 4 mandatory files (SDA + LTC)

#### 4. Everything else remains the same
- Two-stage approval (Verified status) still only applies to Buy-Back
- New SDA claims still go Submitted → Approved directly by SNO
- Evidence config admin tab works for both — admins can toggle any evidence type on/off per route
- Storage bucket, evidence table schema, hooks — all unchanged

### Files affected (same as previous plan, no new files)

| File | Additional Change |
|------|------------------|
| `ClaimEvidencePanel.tsx` | Render for New SDA claims too; filter evidence slots by route |
| `BuyBackClaimsTab.tsx` | Apply evidence gating to New SDA submissions |
| Database seed data | Set SDA evidence `applies_to = 'all'` |

