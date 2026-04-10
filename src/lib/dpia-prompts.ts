// src/lib/dpia-prompts.ts
// DPIA Generator AI Prompts for Notewell AI — NRES Programme

export interface DPIAPractice {
  practice_name: string;
  practice_address: string;
  ods_code: string;
  practice_tel: string;
  pm_name: string;
  pm_email: string;
  ico_reg: string;
  dspt_status: string;
  cg_name: string;
  cg_role: string;
  cg_email: string;
  dpo_name: string;
  dpo_org: string;
  dpo_email: string;
  dpo_tel: string;
}

/**
 * Extraction prompt — parses a completed DPIA Data Collection Template
 * and returns structured JSON with all practice details.
 */
export const DPIA_EXTRACT_PROMPT = (documentText: string): string => `
Extract practice details from this completed DPIA data collection form.

Return ONLY a valid JSON object with these exact keys — no markdown fences, no explanation, no preamble:

{
  "practiceName": "",
  "practiceAddress": "",
  "odsCode": "",
  "practiceTel": "",
  "pmName": "",
  "pmEmail": "",
  "icoReg": "",
  "dsptStatus": "",
  "cgName": "",
  "cgRole": "",
  "cgEmail": "",
  "dpoName": "",
  "dpoOrg": "",
  "dpoEmail": "",
  "dpoTel": "",
  "completedBy": "",
  "completedRole": "",
  "completedDate": ""
}

If a field is not present or empty in the document, use an empty string.
Ensure email addresses are correctly formatted.
For DSPT Status, normalise to one of: "Standards Met", "Standards Not Met", "Approaching Standards".

Document text:
${documentText}
`;

/**
 * DPIA generation prompt — creates a full, practice-specific DPIA document
 * for the deployment of Notewell AI. Returns clean HTML.
 */
export const DPIA_GENERATE_PROMPT = (practice: DPIAPractice): string => `
You are a UK NHS information governance expert. Generate a comprehensive Data Protection Impact Assessment (DPIA) for the deployment of Notewell AI at the following GP practice.

PRACTICE DETAILS:
- Practice Name: ${practice.practice_name}
- Practice Address: ${practice.practice_address}
- ODS Code: ${practice.ods_code}
- Practice Telephone: ${practice.practice_tel}
- Practice Manager: ${practice.pm_name} (${practice.pm_email})
- ICO Registration Number: ${practice.ico_reg}
- DSPT Status: ${practice.dspt_status}
- Caldicott Guardian: ${practice.cg_name} (${practice.cg_role}) — ${practice.cg_email}
- Data Protection Officer: ${practice.dpo_name} (${practice.dpo_org}) — ${practice.dpo_email} — ${practice.dpo_tel}

ABOUT NOTEWELL AI:
- MHRA Class I registered medical device (registration confirmed)
- AI-powered clinical consultation transcription and note generation platform designed for NHS primary care
- Developed by PCN Services Ltd on a not-for-profit, self-funded basis
- Multi-engine transcription architecture: Whisper, AssemblyAI, Deepgram, Gladia
- Hallucination detection and speaker diarisation built in
- Best-of-Three merge pipeline for transcription accuracy
- Offline recording capability for mobile and desktop
- Clinical Safety Officer: Dr Simon Ellis
- DCB0129 v1.3 Clinical Risk Management — Manufacturer's safety case completed
- DCB0160 Clinical Risk Management — Health Organisation's safety case completed
- DTAC (Digital Technology Assessment Criteria) completed
- ICB DDaT (Digital, Data and Technology) Delivery Group approved — rollout to 40 practices authorised
- Data hosting: Supabase (EU region), AES-256 encryption at rest, TLS 1.3 in transit
- No patient data is used for AI model training — ever
- Audio recordings are deleted immediately after transcription processing
- Role-based access control with NHS email authentication (nhs.net)
- The Practice is the Data Controller
- PCN Services Ltd (trading as Notewell AI) is the Data Processor
- A Data Processing Agreement is in place between Data Controller and Data Processor

DATA PROCESSED:
- Audio recordings of clinical consultations (temporarily, deleted after processing)
- Transcribed consultation text
- AI-generated clinical notes (SOAP format and free-text)
- Clinician identifiers (name, role, NHS email)
- Patient identifiers are present only within the clinical narrative as dictated by the clinician
- No direct patient demographic data is collected or stored by Notewell AI separately from the consultation content
- Special category data (health data) processed under UK GDPR Article 9(2)(h) — processing necessary for health care purposes

LAWFUL BASIS:
- UK GDPR Article 6(1)(e) — processing necessary for the performance of a task carried out in the public interest (provision of NHS healthcare)
- UK GDPR Article 9(2)(h) — processing necessary for the provision of health care, subject to the conditions and safeguards referred to in Article 9(3)
- Common law duty of confidentiality is maintained — the clinician controls what is recorded and reviews all AI-generated output before it enters the patient record

GENERATE THE FOLLOWING SECTIONS:

1. DOCUMENT CONTROL
   - Document title: "Data Protection Impact Assessment — Notewell AI — ${practice.practice_name}"
   - Version: 1.0
   - Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
   - Author: Malcolm Railson, Digital & Transformation Lead, NRES Programme
   - Reviewers: ${practice.cg_name} (Caldicott Guardian), ${practice.dpo_name} (DPO), ${practice.pm_name} (Practice Manager)
   - Classification: Confidential
   - Include a version history table

2. INTRODUCTION AND PURPOSE
   - Why this DPIA has been conducted
   - Reference to UK GDPR Article 35 and ICO guidance
   - Scope of the assessment

3. DESCRIPTION OF PROCESSING
   - What personal data is processed
   - Categories of data subjects (patients, clinicians)
   - Purpose of processing
   - Lawful basis (Article 6 and Article 9)
   - Data retention periods
   - Data sharing (none — data stays within practice control)

4. NECESSITY AND PROPORTIONALITY
   - Why AI transcription is necessary
   - How it is proportionate to the aim
   - Alternatives considered
   - Data minimisation measures

5. DATA FLOW MAPPING
   - Step-by-step flow: Clinician initiates recording → Audio captured (encrypted) → Audio sent to transcription engine(s) → Transcription returned → Best-of-Three merge → AI generates clinical note → Clinician reviews and approves → Note available for copy to patient record → Audio deleted
   - Describe each stage with data state and encryption status

6. IDENTIFICATION AND ASSESSMENT OF RISKS
   Present as a TABLE with columns:
   | Risk | Description | Likelihood (Low/Medium/High) | Severity (Low/Medium/High) | Overall Risk | Mitigation Measures | Residual Risk |
   
   Include at minimum these risks:
   - Unauthorised access to consultation audio
   - Transcription inaccuracy / hallucination
   - Data breach during transmission
   - Inappropriate access by unauthorised staff
   - AI-generated note contains clinical error
   - Loss of audio before transcription completes
   - Third-party processor (Supabase) data breach
   - Re-identification from anonymised/pseudonymised data
   - Clinician fails to review AI output before use
   - Device loss/theft with cached data

7. TECHNICAL AND ORGANISATIONAL MEASURES
   - Encryption (at rest and in transit)
   - Access controls (RBAC, NHS email auth)
   - Audit logging
   - Data minimisation
   - Staff training requirements
   - Incident response procedures
   - Regular review schedule
   - DCB0129/DCB0160 compliance
   - DTAC compliance

8. DATA SUBJECT RIGHTS
   - How each right under UK GDPR is addressed:
     - Right of access (SAR)
     - Right to rectification
     - Right to erasure
     - Right to restrict processing
     - Right to data portability
     - Right to object
   - How patients are informed (Privacy Notice update)
   - Contact details for exercising rights

9. CONSULTATION
   - Consultation with Caldicott Guardian: ${practice.cg_name}
   - Consultation with DPO: ${practice.dpo_name} (${practice.dpo_org})
   - Staff consultation and training plan
   - Patient communication via updated Privacy Notice
   - ICB approval obtained

10. DPIA OUTCOME AND RECOMMENDATION
    - Summary of findings
    - Overall risk assessment
    - Recommendation to proceed (with conditions if applicable)
    - Review date (6 months from today)

11. SIGN-OFF
    Present as a TABLE:
    | Role | Name | Signature | Date |
    | Caldicott Guardian | ${practice.cg_name} | | |
    | Data Protection Officer | ${practice.dpo_name} | | |
    | Practice Manager | ${practice.pm_name} | | |
    | Digital & Transformation Lead | Malcolm Railson | | |

FORMAT INSTRUCTIONS:
- Output clean HTML only — no markdown fences, no preamble, no explanation
- Use <h1> for the document title, <h2> for numbered sections, <h3> for subsections
- Use color #005EB8 for h1 and h2 elements
- Use color #003087 for h3 elements
- All tables must have border-collapse: collapse, 1px solid #999 borders, and header row with background #005EB8 and white text
- Font: Arial, 11pt equivalent
- The document should be professional, thorough, and ready for sign-off without further editing
- Include the practice name prominently throughout
`;
