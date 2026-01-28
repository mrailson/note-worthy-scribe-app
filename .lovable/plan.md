

## Import Patient Details Feature for Complaints

### Overview
Add a quick patient details import feature to the Submit New Complaint form, allowing clinicians to rapidly populate patient fields (name, DOB, NHS number, phone, email, address) from pasted text, screenshots, or uploaded files - following the same pattern used in the Scribe appointments import.

### What Will Change

**Two new components:**

1. **"Import Patient Details" button** - Positioned next to the existing "Import Complaint Data" button in the form header
2. **Patient import functionality** - Available both as a standalone discrete box AND within the existing Import Complaint Data modal

### User Experience

**Main Form Header:**
```text
┌─────────────────────────────────────────────────────────────────┐
│  Submit New Complaint                                           │
│  Record a new patient complaint following NHS procedures        │
│                                                                 │
│  [📋 Import Patient Details]  [📤 Import Complaint Data]       │
└─────────────────────────────────────────────────────────────────┘
```

**Supported Input Methods:**
- **Ctrl+V** - Paste a screenshot from clipboard (processed via OCR)
- **Drag & Drop** - Drop Word, Excel, PDF, image, or text files
- **File Upload** - Click to browse and upload
- **Paste Text** - Manually paste text containing patient details

### What Gets Extracted

The AI will identify and extract:
- Patient Name
- Date of Birth (DOB)
- NHS Number
- Contact Phone
- Contact Email
- Patient Address

### Technical Approach

**New Component: `PatientDetailsImportModal.tsx`**
- Located at `src/components/complaints/PatientDetailsImportModal.tsx`
- Uses `react-dropzone` for drag-and-drop (consistent with Scribe pattern)
- Listens for global paste events to capture clipboard screenshots
- Calls `extract-document-text` for file processing (Word, PDF)
- Calls a new lightweight AI function for patient detail extraction from text

**New Edge Function: `extract-patient-details-complaint/index.ts`**
- Focused AI prompt to extract just patient demographics from text
- Uses Lovable AI Gateway (Gemini) for fast, cost-effective processing
- Returns structured data: `{ patient_name, patient_dob, patient_nhs_number, patient_contact_phone, patient_contact_email, patient_address }`

**Integration Points:**
1. Button added in `ComplaintsSystem.tsx` header next to "Import Complaint Data"
2. Optional tab/section added within existing `ComplaintImport.tsx` modal for patient-only import
3. New state and handler `handlePatientImport` to populate only patient fields in the form

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/complaints/PatientDetailsImportModal.tsx` | New modal component for patient import |
| `supabase/functions/extract-patient-details-complaint/index.ts` | Lightweight AI extraction for patient demographics |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ComplaintsSystem.tsx` | Add Import Patient Details button, state, and handler |
| `src/components/ComplaintImport.tsx` | Add optional "Patient Only" tab within existing modal |

### Key Patterns Reused

From `AppointmentImportModal.tsx`:
- `react-dropzone` configuration for multi-format file support
- Global paste event listener for screenshot capture
- OCR processing via `extract-document-text`
- Tab-based UI (Paste Text / Upload File)
- Processing state and feedback

### Validation & Formatting

- NHS numbers will be validated using the existing `validateNHSNumber` utility
- DOB will accept flexible formats (DD/MM/YYYY, YYYY-MM-DD, or just year)
- Phone numbers will be normalised to UK format where possible

