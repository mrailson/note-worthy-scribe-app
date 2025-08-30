export const quickPickConfig = {
  "quickPick": [
    {
      "id": "quality-safety",
      "label": "Quality & safety",
      "children": [
        {"id": "validate-citations", "label": "Validate with citations (NICE/BNF)"},
        {"id": "flag-wrong", "label": "Check this — I think it's wrong"},
        {"id": "flag-screen", "label": "Red/amber-flag screen"},
        {"id": "interaction-check", "label": "Interaction/contraindication check"},
        {"id": "confidence-what-to-verify", "label": "Confidence & what to verify"}
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
        {"id": "translate-chinese", "label": "Chinese 🇨🇳"},
        {
          "id": "more-languages",
          "label": "More Languages",
          "children": [
            {"id": "translate-hindi", "label": "Hindi 🇮🇳"},
            {"id": "translate-gujarati", "label": "Gujarati 🇮🇳"},
            {"id": "translate-punjabi", "label": "Punjabi 🇮🇳"},
            {"id": "translate-italian", "label": "Italian 🇮🇹"},
            {"id": "translate-german", "label": "German 🇩🇪"},
            {"id": "translate-russian", "label": "Russian 🇷🇺"},
            {"id": "translate-lithuanian", "label": "Lithuanian 🇱🇹"},
            {"id": "translate-latvian", "label": "Latvian 🇱🇻"},
            {"id": "translate-bulgarian", "label": "Bulgarian 🇧🇬"},
            {"id": "translate-hungarian", "label": "Hungarian 🇭🇺"},
            {"id": "translate-czech", "label": "Czech 🇨🇿"},
            {"id": "translate-slovak", "label": "Slovak 🇸🇰"},
            {"id": "translate-ukrainian", "label": "Ukrainian 🇺🇦"},
            {"id": "translate-somali", "label": "Somali 🇸🇴"},
            {"id": "translate-tigrinya", "label": "Tigrinya 🇪🇷"},
            {"id": "translate-amharic", "label": "Amharic 🇪🇹"},
            {"id": "translate-tamil", "label": "Tamil 🇮🇳"},
            {"id": "translate-telugu", "label": "Telugu 🇮🇳"},
            {"id": "translate-malayalam", "label": "Malayalam 🇮🇳"},
            {"id": "translate-farsi", "label": "Farsi/Persian 🇮🇷"}
          ]
        },
        {"id": "roundtrip-quality-check", "label": "Round-trip translation check…"}
      ]
    },
    {
      "id": "ai-enhance",
      "label": "AI Enhancement",
      "children": [
        {"id": "ai-make-professional", "label": "Make Professional"},
        {"id": "ai-make-concise", "label": "Make Concise"},
        {"id": "ai-add-action-items", "label": "Extract Action Items"},
        {"id": "ai-nhs-format", "label": "NHS Format"},
        {"id": "ai-board-ready", "label": "Board Ready"},
        {"id": "ai-custom-prompt", "label": "Custom AI Request..."}
      ]
    },
    {
      "id": "quick-formatting",
      "label": "Quick Formatting",
      "children": [
        {"id": "format-bold-titles", "label": "**Bold All Titles**"},
        {"id": "format-italic-emphasis", "label": "*Italic Emphasis*"},
        {"id": "format-bullet-points", "label": "• Convert to Bullets"},
        {"id": "format-numbered-list", "label": "1. Numbered Lists"},
        {"id": "format-headers", "label": "### Add Headers"},
        {"id": "format-table", "label": "Convert to Table"},
        {"id": "format-clean-spacing", "label": "Clean Up Spacing"},
        {"id": "format-remove-formatting", "label": "Remove All Formatting"}
      ]
    },
    {
      "id": "global-standardization",
      "label": "Global Standardization",
      "children": [
        {"id": "standardize-dates", "label": "Standardize All Dates"},
        {"id": "format-numbers", "label": "Format All Numbers"},
        {"id": "standardize-names", "label": "Standardize Names & Titles"},
        {"id": "format-timestamps", "label": "Fix Time Formats"},
        {"id": "clean-punctuation", "label": "Clean Punctuation & Spacing"},
        {"id": "standardize-abbreviations", "label": "Standardize Abbreviations"},
        {"id": "standardize-all", "label": "Apply All Standards"}
      ]
    },
    {
      "id": "professional-cleanup",
      "label": "Professional Cleanup",
      "children": [
        {"id": "remove-filler-words", "label": "Remove Filler Words"},
        {"id": "enhance-professional", "label": "Professional Tone"},
        {"id": "enhance-nhs-format", "label": "Apply NHS Style Guide"},
        {"id": "enhance-concise", "label": "Make More Concise"}
      ]
    },
    {
      "id": "improve-formatting",
      "label": "Improve Layout",
      "children": [
        {
          "id": "improve-layout-screen",
          "label": "Improve Layout on Screen"
        },
        {
          "id": "improve-layout-email",
          "label": "Improve Layout for Email"
        },
        {
          "id": "improve-layout-leaflet",
          "label": "Improve Layout for Leaflet"
        },
        {
          "id": "improve-layout-letter",
          "label": "Improve Layout for Letter"
        }
      ]
    }
  ]
};