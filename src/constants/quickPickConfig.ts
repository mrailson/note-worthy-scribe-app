export const quickPickConfig = {
  "quickPick": [
    {
      "id": "act-on-reply",
      "label": "Act on reply",
      "children": [
        {"id": "approve-save", "label": "Approve & save"},
        {"id": "reject-redo", "label": "Reject & redo…"},
        {"id": "ask-alternatives", "label": "Ask for 3 alternatives"},
        {"id": "mark-clinical-review", "label": "Mark for clinical review"}
      ]
    },
    {
      "id": "quality-safety",
      "label": "Quality & safety",
      "children": [
        {"id": "validate-citations", "label": "Validate with citations (NICE/BNF)"},
        {"id": "flag-wrong", "label": "Check this — I think it's wrong"},
        {"id": "flag-screen", "label": "Red/amber-flag screen"},
        {"id": "interaction-check", "label": "Interaction/contraindication check"},
        {"id": "confidence-what-to-verify", "label": "Confidence & what to verify"},
        {"id": "roundtrip-quality-check", "label": "Round-trip translation check…"}
      ]
    },
    {
      "id": "refine-content",
      "label": "Refine content",
      "children": [
        {"id": "expand-details", "label": "Expand with details & examples"},
        {"id": "summarise", "label": "Summarise…"},
        {"id": "plain-english", "label": "Plain-English rewrite"},
        {"id": "add-snomed-bnf", "label": "Add SNOMED/BNF summary"},
        {"id": "format-system", "label": "Format for EMIS / SystmOne…"},
        {"id": "add-formulary-prior-approval", "label": "Add local formulary / prior-approval note"}
      ]
    },
    {
      "id": "audience",
      "label": "Audience",
      "children": [
        {"id": "patient-leaflet", "label": "Patient leaflet…"},
        {"id": "patient-safetynetting", "label": "Add safety-netting"},
        {"id": "patient-letter", "label": "Patient Letter"},
        {"id": "patient-email", "label": "Patient Email"},
        {"id": "staff-training-pack", "label": "Staff training pack / SOP"},
        {"id": "manager-briefing", "label": "Manager/Board briefing slide"}
      ]
    },
    {
      "id": "export-share",
      "label": "Export & share",
      "children": [
        {"id": "copy-clipboard", "label": "Copy to clipboard"},
        {"id": "save-to-record", "label": "Save to record (EMIS/S1)"},
        {"id": "export-pdf", "label": "Export PDF"},
        {"id": "export-docx", "label": "Export Word (.docx)"},
        {"id": "export-email", "label": "Email (HTML)"},
        {"id": "print", "label": "Print"}
      ]
    },
    {
      "id": "practice-context",
      "label": "Practice context",
      "children": [
        {"id": "combine-practice-info", "label": "Combine with my practice info"},
        {"id": "insert-icb-links", "label": "Insert local referral forms / ICB links"},
        {"id": "prior-approval-modal", "label": "Open prior-approval modal"},
        {"id": "add-safetynetting-template", "label": "Add practice safety-netting template"}
      ]
    },
    {
      "id": "translate",
      "label": "Translate",
      "children": [
        {"id": "translate-polish", "label": "Polish 🇵🇱"},
        {"id": "translate-urdu", "label": "Urdu 🇵🇰"},
        {"id": "translate-arabic", "label": "Arabic 🇸🇦"},
        {"id": "translate-bengali", "label": "Bengali 🇧🇩"},
        {"id": "translate-romanian", "label": "Romanian 🇷🇴"},
        {"id": "translate-spanish", "label": "Spanish 🇪🇸"},
        {"id": "translate-portuguese", "label": "Portuguese 🇵🇹"},
        {"id": "translate-turkish", "label": "Turkish 🇹🇷"},
        {"id": "translate-french", "label": "French 🇫🇷"},
        {"id": "translate-chinese", "label": "Chinese 🇨🇳"}
      ]
    }
  ]
};