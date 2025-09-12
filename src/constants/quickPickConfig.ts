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
      "id": "format-style",
      "label": "Format & Style",
      "children": [
        {"id": "convert-bullets-to-dashes", "label": "Convert bullets (•) to dashes (-)"},
        {"id": "convert-bullets-to-numbers", "label": "Convert bullets to numbers (1, 2, 3)"},
        {"id": "convert-dashes-to-bullets", "label": "Convert dashes (-) to bullets (•)"},
        {"id": "format-bold-titles", "label": "Add/remove bold formatting"},
        {"id": "format-italic-emphasis", "label": "Add/remove italic formatting"},
        {"id": "format-headers", "label": "Add/remove headers (###)"},
        {"id": "format-bullet-points", "label": "Convert text to bullet lists"},
        {"id": "format-numbered-list", "label": "Convert text to numbered lists"},
        {"id": "format-table", "label": "Convert to table format"},
        {"id": "format-clean-spacing", "label": "Clean up spacing & structure"},
        {"id": "format-remove-formatting", "label": "Remove all formatting (plain text)"}
      ]
    },
    {
      "id": "text-operations", 
      "label": "Text Operations",
      "children": [
        {"id": "convert-uppercase", "label": "Convert to UPPERCASE"},
        {"id": "convert-lowercase", "label": "Convert to lowercase"},
        {"id": "convert-title-case", "label": "Convert to Title Case"},
        {"id": "remove-filler-words", "label": "Remove filler words (um, uh, etc.)"},
        {"id": "standardize-dates", "label": "Standardise dates (DD/MM/YYYY)"},
        {"id": "format-timestamps", "label": "Standardise times (24-hour format)"},
        {"id": "clean-punctuation", "label": "Clean up punctuation"},
        {"id": "format-numbers", "label": "Format numbers with commas"},
        {"id": "standardize-all", "label": "Apply all standardisation"}
      ]
    },
    {
      "id": "smart-replacements",
      "label": "Smart Replacements", 
      "children": [
        {"id": "standardize-abbreviations", "label": "Standardise NHS abbreviations"},
        {"id": "expand-medical-terms", "label": "Expand medical abbreviations"},
        {"id": "standardize-drug-names", "label": "Standardise drug names"},
        {"id": "nhs-terminology-check", "label": "Convert to NHS terminology"},
        {"id": "custom-find-replace", "label": "Custom find & replace..."}
      ]
    },
    {
      "id": "ai-custom-enhance",
      "label": "AI Custom Enhancement",
      "children": [
        {"id": "ai-make-longer", "label": "Make it longer"},
        {"id": "ai-make-shorter", "label": "Make it shorter"},  
        {"id": "ai-simplify-language", "label": "Simplify language"},
        {"id": "ai-make-technical", "label": "Make more technical"},
        {"id": "ai-add-detail", "label": "Add more detail"},
        {"id": "ai-remove-detail", "label": "Remove unnecessary detail"},
        {"id": "ai-plain-english-medical", "label": "Replace jargon with plain English"},
        {"id": "ai-add-safety-warnings", "label": "Add patient safety warnings"},
        {"id": "ai-custom-prompt", "label": "Custom AI request..."}
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
        {"id": "translate-document", "label": "📷 Translate Document Image"},
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