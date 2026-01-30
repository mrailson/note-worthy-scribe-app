
# Plan: Add AI Safety Guardrails Documentation to CSO Report

## Overview
This plan will add comprehensive documentation of the AI safety guardrails to the CSO Report, specifically within the Technical Security Posture section. This provides NHS stakeholders with clear visibility of the multi-layered protection against inappropriate AI use.

## Location in CSO Report
The content will be added as a new accordion item titled **"AI Safety Guardrails & Content Moderation"** within the existing "Application Security Controls" section (Section 4: Technical Security Posture), positioned after the existing "Application Security Controls" accordion item.

---

## Content to be Added

### New Accordion Section: AI Safety Guardrails & Content Moderation

The section will document the following **six-layer protection system**:

#### 1. Clinical Safety Monitoring
- 60+ monitored medical terms across blood tests, diagnoses, medications, and clinical measurements
- High-risk emergency keyword detection (cardiac arrest, stroke, overdose, etc.)
- Risk classification (low/medium/high) with appropriate action recommendations
- AI fabrication prevention for medical information
- **Source file:** `medicalSafety.ts`

#### 2. Input Security Validation
- SQL injection pattern detection and blocking
- Cross-site scripting (XSS) prevention
- Command injection protection
- Input length limits (10,000 characters maximum)
- HTML entity encoding for output safety
- File upload validation (type, size, extension checking)
- **Source file:** `securityValidation.ts`

#### 3. Rate Limiting & Brute-Force Protection
- API rate limiting: 30 requests per minute
- Authentication rate limiting: 5 attempts per 5 minutes
- VPN-friendly corporate network detection with adjusted limits
- Email-based rate limiting for additional protection
- **Source file:** `enhancedSecurityValidation.ts`

#### 4. Offensive Language Filtering
- **Blocked terms** (~30 severe terms): Translation/processing completely blocked
  - Severe profanity, racial slurs, hate speech, threats
- **Warning terms** (~30 mild terms): Processing continues with content warning
  - Mild profanity, insults
- Applied to translation service and content moderation
- **Source file:** `translate-text/index.ts`

#### 5. AI Hallucination Detection
- 125+ known hallucination phrases detected and filtered
  - "Thank you for watching" variations
  - Webinar/meeting closing loops
  - Call-to-action hallucinations
  - Fabricated name attributions
- Repetitive content detection (low unique word ratio)
- Fabricated URL detection with NHS/medical URL whitelist
- Repeated phrase pattern detection
- Confidence threshold checking
- **Source file:** `whisperHallucinationPatterns.ts`

#### 6. Clinical Disclaimers & User Acknowledgement
- Persistent micro-banner disclaimers on all AI outputs
- Modal terms of use requiring user acknowledgement
- Clear guidance on clinical responsibility
- Links to original sources (NICE, BNF, MHRA, NHS.uk)
- Audit trail text for clinical records
- **Source file:** `DisclaimerComponents.tsx`

---

## Technical Changes

### File to Modify
**`src/pages/CSOReport.tsx`**

### Changes
1. Add a new `AccordionItem` after the "Application Security Controls" accordion (around line 2645)
2. The new section will use the same styling as existing accordion items for consistency
3. Content structured with checkmarks and organised sub-sections

### Visual Structure
```text
Application Security Controls
  Monitoring & Audit
  Log Retention & Monitoring
  Cyber Essentials Roadmap
+ AI Safety Guardrails & Content Moderation  <-- NEW
```

---

## Summary
This addition provides NHS assurance reviewers with clear documentation of the comprehensive AI safety controls, demonstrating:
- Proactive clinical safety measures
- Multi-layered input validation
- Content moderation for healthcare appropriateness
- Hallucination prevention
- User responsibility acknowledgement

The documentation aligns with DCB0129 requirements for demonstrating safety controls are proportionate to the identified hazards.
