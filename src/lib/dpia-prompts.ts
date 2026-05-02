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
You are a UK NHS information governance expert. Generate a comprehensive Data Protection Impact Assessment (DPIA) for the deployment of Notewell AI at the following GP practice. The document should be approximately 12–15 pages when printed and must satisfy an ICB IG review.

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
- MHRA Class I registered medical device (Manufacturer Self-Certification — registration confirmed)
- AI-powered clinical consultation transcription and note generation platform designed for NHS primary care
- Developed by PCN Services Ltd on a not-for-profit, self-funded basis
- Multi-engine transcription architecture: Whisper, AssemblyAI, Deepgram
- Hallucination detection (125+ pattern library) and speaker diarisation built in
- Best-of-Three merge pipeline for transcription accuracy
- Offline recording capability for mobile and desktop
- Clinical Safety Officer: Dr Simon Ellis (GP Partner, Clinical Director — NRES)
- DCB0129 v1.3 Clinical Risk Management — Manufacturer's safety case completed and signed off
- DCB0160 Clinical Risk Management — Health Organisation's deployment safety assessment completed and signed off by CSO Dr Simon Ellis
- DTAC (Digital Technology Assessment Criteria) completed — met in principle subject to go-live gating conditions
- ICB DDaT (Digital, Data and Technology) Delivery Group approved — 30-practice pilot commencing Q1 2026
- Data hosting: Supabase (EU region), AES-256 encryption at rest, TLS 1.3 in transit
- No patient data is used for AI model training — ever
- Audio recordings are automatically deleted within 7 days of transcription processing
- Role-based access control with NHS email authentication (nhs.net)
- Session timeouts: 5 hours (standard), 4 hours or less (PII-bearing sessions)
- 6-layer AI safety guardrail system: clinical safety monitoring, input security validation, rate limiting (30 req/min), offensive language filtering, hallucination detection, explicit user disclaimers
- Penetration testing: mandatory go-live gating requirement post-migration to NHS hosting
- Cyber Essentials: mandatory pre-go-live gating requirement
- The Practice is the Data Controller
- PCN Services Ltd (trading as Notewell AI) is the Data Processor
- A Data Processing Agreement (DPA) is in place between Data Controller and Data Processor
- Enterprise contractual assurances available where required

DATA PROCESSED:
- Audio recordings of clinical consultations (temporarily, auto-deleted after processing within 7 days)
- Transcribed consultation text
- AI-generated clinical notes (SOAP format and free-text)
- Patient demographics as present within the clinical narrative (name, date of birth, NHS number — as dictated by the clinician)
- Clinical notes and observations as dictated during consultations
- Consultation recordings (audio — transient)
- Clinician identifiers (name, role, NHS email)
- Patient identifiers are present only within the clinical narrative as dictated by the clinician
- No direct patient demographic data is collected or stored by Notewell AI separately from the consultation content
- Special category data (health data) processed under UK GDPR Article 9(2)(h)

LAWFUL BASIS:
- UK GDPR Article 6(1)(e) — processing necessary for the performance of a task carried out in the public interest (provision of NHS healthcare)
- UK GDPR Article 9(2)(h) — processing necessary for the provision of health care, subject to the conditions and safeguards referred to in Article 9(3)
- Common law duty of confidentiality is maintained — the clinician controls what is recorded and reviews all AI-generated output before it enters the patient record
- Data Protection Act 2018, Schedule 1, Part 1, Condition 2 — health or social care purposes

GENERATE THE FOLLOWING SECTIONS (number them exactly as shown):

1. DOCUMENT CONTROL
   - Document title: "Data Protection Impact Assessment — Notewell AI — ${practice.practice_name}"
   - Version: 1.0
   - Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
   - Author: Malcolm Railson, Digital & Transformation Lead, NRES Programme
   - Reviewers: ${practice.cg_name} (Caldicott Guardian), ${practice.dpo_name} (DPO), ${practice.pm_name} (Practice Manager)
   - Classification: Official — Sensitive
   - Include a version history table with at least 3 rows (drafts and current version)

2. INTRODUCTION AND PURPOSE
   - Why this DPIA has been conducted (reference UK GDPR Article 35 and ICO guidance on when a DPIA is required)
   - State that a DPIA is mandatory because the processing involves large-scale processing of special category health data and systematic monitoring of individuals
   - Scope: describe the types of personal data involved in detail — patient demographics (name, DOB, NHS number as dictated), clinical notes, consultation audio recordings, transcriptions, AI-generated clinical summaries, and clinician identifiers
   - Legal basis for processing: explain GDPR Article 6(1)(e) (public task — provision of NHS healthcare) and Article 9(2)(h) (health data processing for healthcare purposes under the management of a health professional) in full
   - Reference the Data Protection Act 2018 Schedule 1 Part 1 Condition 2
   - State the assessment covers all processing activities undertaken by Notewell AI at ${practice.practice_name}

   2.1 CONTEXT AND APPROACH
   Include the following subsection verbatim (do not paraphrase or shorten — reproduce this text in full as a distinct subsection):

   "Notewell AI is an unfunded, not-for-profit tool developed to support NHS primary care's transition from analogue to digital ways of working. It is built and maintained on a best-efforts basis by Malcolm Railson (Digital & Transformation Lead, Blue PCN) alongside his substantive NHS role, driven by a belief in what technology can do for practices and patients when developed responsibly.

   Despite being unfunded, Notewell AI has been developed with the same rigour expected of any digital health tool deployed in NHS settings. It holds MHRA Class I medical device registration, has completed clinical safety cases under both DCB0129 (manufacture) and DCB0160 (deployment) signed off by Dr Simon Ellis as Clinical Safety Officer, has undergone DTAC self-assessment, and has received formal approval from the NHS Northamptonshire ICB Digital, Data and Technology (DDaT) Board for a 30-practice pilot commencing Q1 2026. Data Sharing Agreements, Data Processing Agreements, and this DPIA are in place for every deploying practice. These governance milestones have been achieved voluntarily and at the developer's own cost and time, in order to meet the standards that NHS patients and staff deserve.

   Notewell AI is currently operating as a pilot platform. As such, it should not be relied upon as the sole tool for critical or business-essential clinical functions. Features may evolve, improve, or occasionally require maintenance as the platform develops. Practices are asked to approach the pilot in the spirit in which it is offered — as a pioneering and collaborative step forward in digital primary care, not a finished commercial product.

   This DPIA should be read in that context. The controls, mitigations, and safeguards described in this document are genuine and actively maintained. Practices participating in the pilot are partners in shaping what responsible, clinician-led digital innovation looks like in NHS primary care, and their engagement, patience, and feedback is valued and essential.

   For any concerns about this DPIA or the processing it describes, practices should contact their own Data Protection Officer in the first instance, or Malcolm Railson (malcolm.railson@nhs.net) for platform-specific queries."

3. SYSTEM COMPLIANCE AND ASSURANCE
   Write a detailed section covering:

   3.1 Clinical Safety (DCB0129)
   Notewell AI is a registered MHRA Class I medical device. PCN Services Ltd has completed a comprehensive Clinical Safety Case Report in accordance with the DCB0129 standard. Dr Simon Ellis (Clinical Safety Officer) has previously reviewed the manufacturer's safety case, ensuring that the software architecture — specifically the multi-engine transcription and hallucination detection — meets the rigorous safety standards required for clinical decision support tools. This has been done for the Pilot sites at NRES (7 Practices). For all other approvals, we are using the DDaT recent approvals for 30 practices in Northants to pilot the Notewell tool (Reference Kirstie Watson and Matthew Hutton at the ICB and Clare Mansfield (ICB CSO)).

   3.2 Deployment Safety (DCB0160)
   ${practice.practice_name} has fulfilled its obligations under DCB0160. A local Clinical Risk Management Plan has been established. Dr Simon Ellis, acting as the CSO for the deployment, has signed off the safety assessment, confirming that local process risks (such as clinician over-reliance) have been mitigated through training and mandatory review protocols.

   3.3 DDaT and ICB Approval
   The project has received formal approval from the NHS Northamptonshire ICB Digital, Data and Technology (DDaT) Delivery Group. This deployment is part of a 30-practice pilot commencing Q1 2026, intended to evaluate the impact of AI transcription on GP workflow and documentation quality.

   3.4 Regulatory Summary
   Include a TABLE with columns: Requirement | Status | Reference
   Rows:
   - MHRA Class I Registration | ✅ Completed | Medical Device Registration
   - DCB0129 Clinical Safety Case | ✅ Completed | Clinical Safety Case Report v1.3
   - DCB0160 Deployment Safety | ✅ Signed off | CSO: Dr Simon Ellis
   - ICB DDaT Board Approval | ✅ Approved | 30-practice pilot, Q1 2026
   - DPIA | ✅ This document | Practice-specific assessment
   - Data Sharing Agreement | ✅ Completed | DSA v1.1
   - DTAC Assessment | ✅ Met in principle | Subject to go-live gating conditions
   - Cyber Essentials | ⏳ Pre-go-live gate | Mandatory before deployment
   - DSPT | ⏳ Pre-go-live gate | Ownership to be confirmed by host NHS organisation

4. DESCRIPTION OF PROCESSING
   - What personal data is processed — be thorough and specific
   - Categories of data subjects (patients, clinicians, practice staff)
   - Purpose of processing
   - Lawful basis (Article 6 and Article 9) — repeat in full for this section
   - Data retention periods (audio: auto-deleted within 7 days; transcripts and notes: configurable, aligned to NHS Records Management Code of Practice)
   - Data sharing (none — data stays within practice control; no data used for AI training)

5. NECESSITY AND PROPORTIONALITY
   - Why AI transcription is necessary (reduce clinician administrative burden, improve consultation documentation quality, support NHS digitalisation agenda)
   - How it is proportionate to the aim
   - Alternatives considered (manual note-taking, dictation services, third-party transcription services)
   - Data minimisation measures (audio auto-deletion, no separate patient demographic collection, role-based access)

6. DATA FLOW MAPPING
   Describe the complete data flow step by step:
   Step 1: Clinician initiates recording within Notewell AI during patient consultation
   Step 2: Audio captured locally on device (encrypted at rest using AES-256)
   Step 3: Audio transmitted to transcription engines via TLS 1.3 encrypted connection
   Step 4: Multi-engine transcription (Whisper, AssemblyAI, Deepgram, Gladia) processes audio in parallel
   Step 5: Best-of-Three merge pipeline selects optimal transcription with hallucination detection (125+ pattern library)
   Step 6: Speaker diarisation identifies clinician vs patient speech
   Step 7: AI generates structured clinical note (SOAP format) from merged transcription
   Step 8: 6-layer safety guardrail system validates output (clinical safety, input security, hallucination detection, disclaimers)
   Step 9: Clinician reviews, edits, and approves the AI-generated note
   Step 10: Approved note available for copy to clinical system (EMIS/SystmOne)
   Step 11: Audio recording auto-deleted within 7 days
   
   State clearly: All processing occurs within UK/EU-hosted infrastructure. No data is transferred outside the UK adequacy region. No patient data is used for AI model training.

7. IDENTIFICATION AND ASSESSMENT OF RISKS
   Present as a detailed TABLE with columns:
   | Ref | Risk | Description | Likelihood (1-5) | Impact (1-5) | Risk Score | Mitigation Measures | Residual Risk (Low/Medium/High) |

   Include these risks (minimum 10):
   R1 - Transcription inaccuracy: AI transcription contains errors or omissions affecting clinical accuracy
   R2 - AI hallucination: AI generates content not present in the original audio
   R3 - Data breach during transmission: Patient data intercepted during transfer to transcription engines
   R4 - Unauthorised access: Inappropriate access to consultation data by non-authorised staff
   R5 - Patient consent: Patient not informed or does not consent to AI-assisted recording
   R6 - Data retention: Data retained beyond necessary period or not deleted as required
   R7 - Third-party processor non-compliance: Supabase, OpenAI, or other processor fails to meet contractual data protection obligations
   R8 - Business continuity: System unavailability during clinical sessions affecting patient care
   R9 - Clinician over-reliance: Clinician fails to review AI output before clinical use
   R10 - Device loss or theft: Device containing cached audio data is lost or stolen
   R11 - Re-identification risk: Re-identification of individuals from pseudonymised or aggregated data
   R12 - Clinical error from AI output: AI-generated note contains clinical error that is not caught during review

   After the table, provide a brief risk summary paragraph stating the overall risk profile.

8. DATA PROCESSOR ASSESSMENT
   Present as a TABLE with columns:
   | Processor | Service | Data Processing Location | DPA in Place | Key Certifications |
   
    Include:
    - OpenAI — AI Note Generation / Whisper Transcription — USA (UK adequacy, Standard Contractual Clauses) — Yes — SOC 2 Type II, ISO 27001
    - Claude AI (Anthropic) — Transcription and LLM — UK — Yes — GDPR Compliant
    - AssemblyAI — Audio transcription — USA (UK adequacy, SCCs) — Yes — SOC 2 Type II, HIPAA
    - Supabase — Database and authentication — EU (Frankfurt/Germany) — Yes — ISO 27001
   
   Include a paragraph explaining international transfers: Transfers to EU-based processors (Supabase) are covered by the UK Adequacy Decision. Transfers to USA-based processors (OpenAI, AssemblyAI) are managed via Standard Contractual Clauses (SCCs) and Supplementary Measures including AES-256 encryption. Claude AI (Anthropic) processes data in the UK. PCN Services Ltd has provided contractual guarantees that patient data is never used for model training.

9. TECHNICAL AND ORGANISATIONAL MEASURES
   - Encryption (AES-256 at rest, TLS 1.3 in transit)
   - Access controls (RBAC, NHS email authentication, MFA where available)
   - Session timeouts (5 hours standard, 4 hours PII-bearing)
   - Audit logging (comprehensive access and action logging)
   - Data minimisation (audio auto-deletion, no separate demographics collection)
   - 6-layer AI safety guardrail system (describe briefly)
   - Staff training requirements (mandatory before access granted)
   - Incident response procedures (reference NHS DSPT incident reporting)
   - Regular review schedule (DPIA reviewed annually or on material change)
   - DCB0129/DCB0160 compliance
   - DTAC compliance
   - Penetration testing (mandatory go-live gating requirement)
   - Cyber Essentials (mandatory pre-go-live requirement)

10. DATA SUBJECT RIGHTS
    How each right under UK GDPR is addressed within Notewell AI:
    - Right of access (Subject Access Request — patients can request copies of any data held; practice responds within 1 calendar month)
    - Right to rectification (clinician can edit AI-generated notes before and after saving; patients can request corrections via the practice)
    - Right to erasure (audio auto-deleted within 7 days; clinical notes can be deleted at practice discretion in line with records management obligations)
    - Right to restrict processing (patient can request their consultations are not recorded; clinician simply does not activate recording)
    - Right to data portability (data can be exported in standard formats on request)
    - Right to object (patients can object to AI-assisted recording at any point; the clinician controls whether recording is initiated)
    - Right not to be subject to automated decision-making (no automated clinical decisions are made — all AI output must be reviewed by a clinician before use)
    
    Include: how patients are informed (updated Privacy Notice displayed in the practice and on the practice website), contact details for exercising rights (practice email and DPO contact).

11. CONSULTATION
    - Consultation with Caldicott Guardian: ${practice.cg_name}
    - Consultation with DPO: ${practice.dpo_name} (${practice.dpo_org})
    - Staff consultation and training plan
    - Patient communication via updated Privacy Notice
    - ICB DDaT approval obtained
    - Clinical Safety Officer sign-off obtained (Dr Simon Ellis)

12. DPIA OUTCOME AND RECOMMENDATION
    - Summary of findings
    - Overall risk assessment (state that residual risks are acceptable with mitigations in place)
    - Recommendation to proceed with deployment, subject to:
      * DSPT ownership confirmed
      * Cyber Essentials achieved
      * Penetration testing completed post-migration to NHS hosting
      * All staff training completed
    - State: "This DPIA has been prepared in accordance with the requirements of the UK General Data Protection Regulation and the Data Protection Act 2018."

13. REVIEW SCHEDULE
    - State the DPIA will be reviewed annually, or sooner if there are material changes to processing activities, new data processors, changes in legislation, or significant security incidents
    - Next scheduled review: ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
    - State that the review will be coordinated by the Practice Manager and DPO
    - Include a review trigger list: change of processor, new data category, security incident, regulatory change, ICO guidance update

14. SIGN-OFF
    Present as a TABLE with explicit column widths using colgroup: Role 20%, Name 25%, Signature 35%, Date 20%. Use <colgroup><col style="width:20%"><col style="width:25%"><col style="width:35%"><col style="width:20%"></colgroup>.
    | Role | Name | Signature | Date |
    | Practice Manager | ${practice.pm_name} | _________________ | __________ |
    | Caldicott Guardian | ${practice.cg_name} | _________________ | __________ |
    | Digital & Transformation Lead | Malcolm Railson | _________________ | __________ |

    Include a declaration statement above the table: "We, the undersigned, confirm that we have reviewed this Data Protection Impact Assessment and are satisfied that the risks identified have been appropriately assessed and mitigated. We approve the deployment of Notewell AI at ${practice.practice_name} subject to the conditions stated in Section 12."

    Below the sign-off table, add a note: "For any data protection queries or concerns relating to this DPIA, please contact your Practice Data Protection Officer in the first instance. A list of practice DPOs is available from the NRES Programme Office."

FORMAT INSTRUCTIONS:
- Output clean HTML only — no markdown fences, no preamble, no explanation
- Use <h1> for the document title, <h2> for numbered sections, <h3> for subsections
- Use color #005EB8 for h1 and h2 elements
- Use color #003087 for h3 elements
- All tables must have border-collapse: collapse, 1px solid #999 borders, and header row with background #005EB8 and white text
- Use ✅ and ⏳ emoji in the regulatory summary table Status column
- Font: Arial, 11pt equivalent
- Include generous spacing between sections
- The document should be professional, thorough, and ready for ICB IG review and sign-off without further editing
- Include the practice name prominently throughout
- Aim for 12–15 pages of content when printed
- Use British English throughout (organisation, summarise, recognised, etc.)
`;
