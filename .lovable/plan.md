

## Restrict NRES Submenu to SDA Pilot Dashboard Only

Currently, all NRES-activated users (except ICB members) can see five submenu items under NRES: SDA Pilot Dashboard, Results Dashboard, Proactive Complex Care, AI Phone Agents, and Comms Strategy. The change will restrict regular NRES users to only see **SDA Pilot Dashboard**, while system admins retain access to all items.

### What Changes

**File: `src/components/Header.tsx`** (lines ~318-351)

Replace the current `!isIcbMember` condition with `isSystemAdmin` so that only system admins see the additional submenu items:

- **Before**: `{!isIcbMember && ( ... )}` — hides extras only for ICB members
- **After**: `{isSystemAdmin && ( ... )}` — hides extras for everyone except system admins

This applies to both the desktop dropdown and the mobile drawer (if duplicated there).

The items affected:
- Results Dashboard (`/nres`)
- Proactive Complex Care (`/nres/complex-care`)
- AI Phone Agents (`/gp-genie`)
- Comms Strategy (`/nres/comms-strategy`)

All NRES users will still see "SDA Pilot Dashboard" as before. System admins will continue to see all five items. The routes themselves remain protected so even if someone navigates directly, the `ProtectedRoute` guard still applies.

