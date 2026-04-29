Plan to fix GL code automation for NRES claims

I’ll update the claims workflow so GL codes are generated automatically from the claim type and staff role, with no manual entry required by practices.

What will change

1. Apply the requested GL code matrix

```text
Additional / New SDA:
- GP  = 5411
- ANP = 5412
- ACP = 5413

Buy-Back:
- GP  = 5421
- ANP = 5422
- ACP = 5423
```

The project already has a `src/utils/glCodes.ts` mapping with these values, so the implementation will focus on making every claim creation and invoice path use it consistently.

2. Treat New SDA as “Additional” for finance coding

When a staff line has `staff_category === 'new_sda'`, the claim will be created with:

```text
claim_type = additional
```

This ensures the line receives the 541x GL code range instead of the Buy-Back 542x range.

3. Keep Buy-Back as Buy-Back

When a staff line has `staff_category === 'buyback'`, the claim will be created with:

```text
claim_type = buyback
```

This ensures the line receives the 542x GL code range.

4. Update claim creation entry points

I’ll update the relevant claim creation calls in the NRES claim dashboard so they derive the claim type automatically from staff category:

```text
new_sda  -> additional
buyback  -> buyback
gp_locum -> additional, unless current business rules require otherwise
management / meeting -> no GL matrix change, keep existing management/meeting handling
```

For GP locum, I will align it with “Additional SDA Resource” because it is currently described in the code as additional sessional SDA capacity. If you want GP locum to use a different code, we can adjust separately.

5. Make invoices show the correct GL codes

The invoice PDF already reads each staff line’s `gl_code`, but I’ll harden it so if any older claim line is missing a GL code it recalculates from:

```text
claim.claim_type + staff_role
```

This protects both new claims and any draft/older claims where the GL code was not saved correctly.

6. Update GL subtotals on invoices

Invoice subtotal grouping will use the same resolved GL code, so totals are grouped under the correct 541x or 542x finance code.

7. Add safety for role naming variations

The GL code resolver already maps GP-like roles to GP. I’ll make sure common role values such as:

```text
GP
GP Partner
GP Standard
GP Remote
GP Locum
ANP
ACP
```

resolve correctly to the appropriate GP / ANP / ACP GL code.

Technical details

Files expected to change:

- `src/utils/glCodes.ts`
  - Strengthen role normalisation and fallback labels.

- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`
  - Pass `additional` when creating New SDA claims.
  - Avoid incorrectly defaulting all practice-dashboard claims to `buyback`.

- `src/utils/invoicePdfGenerator.ts`
  - Resolve missing GL codes from claim type and staff role.
  - Use resolved GL codes in the invoice line table and subtotals.

- Potentially `src/hooks/useNRESBuyBackClaims.ts`
  - Ensure stored `staff_details.gl_code` is recalculated using the claim type at creation time and remains consistent if staff lines are edited.

No database schema change is required because the claim already stores `claim_type` and each staff line already stores `gl_code` / `gl_category` in JSON.

Expected result

Practice managers will only select the claim/staff type and role. The app will automatically code invoices like this:

```text
New SDA + GP Partner  -> GL 5411
New SDA + ANP         -> GL 5412
New SDA + ACP         -> GL 5413
Buy-Back + GP         -> GL 5421
Buy-Back + ANP        -> GL 5422
Buy-Back + ACP        -> GL 5423
```

The generated invoice will show the correct line-level GL code and subtotal totals by GL code.