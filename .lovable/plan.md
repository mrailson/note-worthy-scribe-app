

## Add Buy-Back Scheme Guide Section to Buy-Back Claims Tab

### What this does
Adds a collapsible information panel at the top of the Buy-Back Claims tab that explains how the scheme works, key rules, and provides a direct link to the full explainer page. This gives users quick reference without leaving the claims workflow.

### Design
- A collapsible card at the top of the `BuyBackClaimsTab` component, collapsed by default
- Uses an `Info` icon with a clear title like "How the Buy-Back Scheme Works"
- Contains a brief summary of the scheme (SNO oversight, SDA vs LTC distinction, the Golden Rule)
- Lists the key steps in the claim process
- Includes a prominent button/link to open the full `/buyback-explainer` page in a new tab
- Uses existing `Collapsible` component pattern consistent with the rest of the Financials section

### Technical Details

**File modified:** `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`

1. Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from UI components
2. Import `ChevronDown`, `ChevronRight`, `Info`, `ExternalLink` from lucide-react
3. Add a new state `const [guideOpen, setGuideOpen] = useState(false)`
4. Insert a collapsible section at the top of the component's return JSX (before the Staff Management card) containing:
   - **Overview**: Brief paragraph explaining the neighbourhood buy-back scheme -- practices can claim reimbursement for staff time dedicated 100% to SDA (Part A) work
   - **Key Rules**: The "Golden Rule" -- staff must be working exclusively on SDA during funded hours, with no LTC (Part B) activity
   - **How to Claim**: Numbered steps (add staff, set allocations/rates, create monthly claim, confirm declaration, submit for approval)
   - **Approvals**: Brief note on who reviews and approves claims
   - **Link Button**: "View Full Explainer Guide" linking to `/buyback-explainer` in a new tab

No new files or dependencies required. Uses existing UI components (`Collapsible`, `Card`, `Button`) and follows the same collapsible pattern used for Expenses and Claimants sections.

