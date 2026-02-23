

## Add Document Attachments to Risk Register

### Overview
Add the ability to attach documents (any format, multiple files, max 20MB each) to individual risks. Attached documents will display as small icons on the main risk register table row, and the Edit Risk modal will include a document management section.

### Changes Required

#### 1. Update `ProjectRisk` type (`src/components/sda/risk-register/projectRisksData.ts`)
- Add a `documents` array field to the `ProjectRisk` interface:
  - Each document: `{ id: string, name: string, size: number, type: string, file: File }`

#### 2. Update Edit Risk Dialog (`src/components/sda/risk-register/RiskEditDialog.tsx`)
- Add a **Documents** section below Assurance Indicators
- Include a file drop zone / file input button accepting any format
- Validate each file is under 20MB before adding
- List attached documents with name, size, and a delete button
- Pass documents through on save

#### 3. Update Main Table Row (`src/components/sda/SDARisksMitigation.tsx`)
- Add a small paperclip/file icon with a count badge on each risk row that has documents attached
- Clicking the icon could open the edit dialog or show a tooltip listing the files
- Record document additions/removals in the audit log

### Technical Details

**Document storage**: Since the risk register currently uses local React state (not Supabase), documents will be held in memory as `File` objects. This matches the existing pattern -- no database changes needed.

**File validation**: Max 20MB per file checked on selection, with a toast error if exceeded.

**UI on table row**: A `Paperclip` icon from lucide-react with a small count badge, shown only when documents exist. Keeps the table compact.

**Audit trail**: Document additions and removals will be tracked as changes (e.g. "Document added: report.pdf", "Document removed: notes.docx").

### Files to Modify
- `src/components/sda/risk-register/projectRisksData.ts` -- add `documents` to interface
- `src/components/sda/risk-register/RiskEditDialog.tsx` -- add document upload/management section
- `src/components/sda/SDARisksMitigation.tsx` -- show document icon on table rows, track in audit

