

## Plan: Improve Acknowledgement Letter View, Default Toggles Off, Editable Email Preview

### Changes

#### 1. Acknowledgement Letter — Better View
The current acknowledgement letter modal already uses `FormattedLetterContent` with a clean white card layout. Based on the screenshot, the inline acknowledgement view (in the workflow tab) uses a basic `<pre>` tag with `bg-gray-50`. I'll improve the inline view to render formatted HTML content consistently, matching the modal's quality.

In `ComplaintDetails.tsx`:
- The inline collapsible view (if present) will use `FormattedLetterContent` instead of `<pre>` tags
- Ensure the modal view renders the letter on a clean white background with proper padding and shadow, consistent with a professional NHS letter format

#### 2. Toggle Switches Default to Off
In `EmailComposeModal.tsx`, the toggles currently default to `true` (all on). Change the initial state and the `useEffect` reset so all four toggles (`includeDescription`, `includePatientName`, `includeAcknowledgement`, `includeDeadline`) default to **off** (`false`).

**File**: `src/components/complaints/EmailComposeModal.tsx`
- Lines 156-161: Change default values to `false`
- Lines 166-171: Change reset values to `false`

#### 3. Editable Email Preview
Currently the email preview is a read-only `<iframe>` with `srcDoc`. I'll replace this with a mode toggle that allows the user to:
- **Preview mode** (default): Shows the rendered HTML email as it is now
- **Edit mode**: Shows the raw HTML in a `<Textarea>` that the user can modify, with the preview updating live

The edited HTML will be stored in local state and passed through to `onSend` so the final email reflects user changes.

**File**: `src/components/complaints/EmailComposeModal.tsx`
- Add `customHtml` state initialised from `generateEmailHtml()`
- Add Edit/Preview toggle buttons above the preview pane
- In edit mode, show a `<Textarea>` with the HTML; in preview mode, show the iframe
- Update `onSend` to also pass the final HTML content
- Update the `EmailComposeModalProps` interface and parent to accept custom HTML

### Technical Details
- `EmailComposeModal`: Add `onSend` signature update to include `customHtml?: string`
- `EmailToggles` changes will still regenerate the base HTML, but user edits will override
- A "Reset to default" button will regenerate from toggles, discarding manual edits
- The parent (`RequestInformationPanel.tsx`) will need to accept and use the custom HTML when sending

