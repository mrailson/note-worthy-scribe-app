

## Plan: Enable Excel File Uploads in Image Studio with Table-Preserving Processing

### What This Does
Allows Excel files (.xls, .xlsx) to be uploaded as supporting information in Image Studio's Context tab, with the extracted content preserving table structure (headers, rows, columns) so the AI can interpret data properly for infographic/chart generation.

### Current State
- The `ExcelProcessor` already exists and converts Excel to CSV format — but CSV loses structural context for AI prompts.
- The Image Studio `ContextTab.tsx` uses `react-dropzone` with its own accepted file types — Excel is **not currently listed** in its accept config.
- The `FileProcessorManager` already maps `.xls`/`.xlsx` to the `ExcelProcessor`.

### Changes Required

#### 1. Update `ExcelProcessor.ts` — Preserve table structure
- Enhance the output format to use **Markdown tables** instead of raw CSV, so the AI receives structured, readable tabular data.
- Each sheet will output a proper Markdown table with headers and aligned columns.
- This makes data immediately usable for infographic/chart generation prompts.

#### 2. Update `ContextTab.tsx` — Add Excel to accepted file types
- Add `application/vnd.ms-excel` (`.xls`) and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`.xlsx`) to the dropzone's `accept` configuration.
- Update the helper text from "PDF, Word, PowerPoint, Excel, Images" (it already mentions Excel but doesn't actually accept it) to ensure it works.

### Technical Detail

**ExcelProcessor enhanced output format:**
```
EXCEL SPREADSHEET DATA FROM: results.xlsx

=== Sheet 1: Patient Survey Results ===

| Question | Yes | No | Unsure |
|----------|-----|-----|--------|
| Satisfied with care | 85% | 10% | 5% |
| Would recommend | 90% | 5% | 5% |

Summary: 2 columns, 3 rows of data
```

This Markdown table format is directly interpretable by the AI models for generating charts, infographics, and data visualisations.

