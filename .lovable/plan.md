

## Investigation Report: Two Bugs in Complaint Management

### Bug 1: Editing outcome letter doesn't save

**Root Cause**: The `saveOutcomeLetterToDatabase` function in `InvestigationDecisionAndLearning.tsx` has a critical path issue. When `existingOutcome` is populated (line 362), it updates via `.eq('id', existingOutcome.id)`. However, `existingOutcome` is fetched once on component mount (line 58) and **never refreshed after the initial AI generation**. 

Looking at lines 307-339: when the letter is first generated, `saveOutcomeLetterToDatabase` is called with the new letter. If `existingOutcome` was null at that point, it takes the INSERT branch (line 408-425) which calls `setExistingOutcome(data)`. This part works.

The actual problem is more subtle: the UPDATE RLS policy on `complaint_outcomes` (migration `20251109091223`) requires `is_system_admin`, `practice_manager` role, `complaints_manager` role, OR that the complaint belongs to the user's practice. If Nicola's user doesn't match any of these conditions, the UPDATE silently returns zero rows (Supabase doesn't throw on RLS-blocked updates), the function doesn't check for this, and the toast never fires because the error path isn't hit — the update just silently does nothing.

**Fix**: After the `.update()` call, check if any rows were actually affected. If not, surface an error. Additionally, add a `.select()` after update to confirm it succeeded.

### Bug 2: "Bucket not found" for communication-files

**Root Cause**: The `communication-files` bucket was created as **private** (`public: false`) in migration `20251108154108`. However, `ComplaintDetails.tsx` (lines 2344-2360) uses `getPublicUrl()` to generate download/view links for complaint documents. `getPublicUrl()` constructs a URL like `/storage/v1/object/public/communication-files/...` which returns 404 "Bucket not found" for private buckets.

**Fix**: Replace `getPublicUrl()` calls with `createSignedUrl()` for the `communication-files` bucket in `ComplaintDetails.tsx` (and `FileUpload.tsx` line 50-52). Signed URLs work with private buckets and expire after a set time, which is more secure for complaint documents.

### Proposed Changes

**1. `src/components/InvestigationDecisionAndLearning.tsx`** — Fix silent update failure:
- In `saveOutcomeLetterToDatabase`, after the `.update()` call on `complaint_outcomes`, add `.select().single()` to confirm the row was updated. If no data returned, throw an error.

**2. `src/pages/ComplaintDetails.tsx`** — Fix bucket not found:
- Replace `getPublicUrl` on lines 2344-2347 and 2357-2360 with `createSignedUrl` (async, 1-hour expiry).

**3. `src/components/FileUpload.tsx`** — Fix bucket not found:
- Replace `getPublicUrl` on line 50-52 with `createSignedUrl`.

