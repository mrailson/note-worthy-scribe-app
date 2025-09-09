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