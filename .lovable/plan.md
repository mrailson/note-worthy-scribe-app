

## Plan: Email Compose Modal with Togglable Sections & Live Preview

### What This Does
Replaces the current direct-send flow in the Request Information panel with an intermediate **Email Compose Modal**. After selecting a staff member, the user clicks "Send Request" which opens a new modal showing the full email with toggle switches for each section, plus a live HTML preview that updates in real-time.

### Changes

#### 1. New Component: `src/components/complaints/EmailComposeModal.tsx`
A large modal (~max-w-5xl) with two columns:
- **Left column — Controls:**
  - **Sender name**: Pre-filled from logged-in user's `profiles.full_name`, editable
  - **Toggle switches** for four sections:
    - Complaint description (on by default)
    - Patient name (on by default)
    - Acknowledgement letter (on by default, if one exists)
    - Response deadline / important info (on by default)
  - Send / Cancel buttons
- **Right column — Live preview:**
  - Renders the email HTML in a sandboxed iframe, updating whenever toggles change
  - The email template mirrors the existing one in `send-complaint-notifications` but sections are conditionally included based on toggle state

The component receives complaint data, practice details, acknowledgement text, party info, and toggle states, then generates the HTML preview client-side.

#### 2. Update `src/components/RequestInformationPanel.tsx`
- Import `EmailComposeModal`
- Fetch the logged-in user's `full_name` from profiles on mount
- Fetch complaint details and acknowledgement data client-side (needed for preview)
- When the user clicks "Send Request", instead of calling the edge function directly, open the `EmailComposeModal` with all the data
- Pass selected toggle states and sender name through to the edge function call

#### 3. Update Edge Function: `supabase/functions/send-complaint-notifications/index.ts`
- Accept new optional fields in the request body:
  - `senderName: string` — used in the email sign-off instead of practice name
  - `includeDescription: boolean` (default true)
  - `includePatientName: boolean` (default true)
  - `includeAcknowledgement: boolean` (default true)
  - `includeDeadline: boolean` (default true)
- Conditionally include/exclude each section in the HTML template based on these flags
- Use `senderName` in the sign-off ("Kind regards, {senderName}")

### Technical Details
- The live preview generates HTML client-side using the same template structure as the edge function, wrapped in an iframe via `srcdoc`
- Toggle switches use the existing `Switch` component from `@radix-ui/react-switch`
- No database changes required
- Edge function redeployment required after changes

