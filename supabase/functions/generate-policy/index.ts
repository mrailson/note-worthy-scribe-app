import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ---- Constants ----
const LEASE_DURATION_MS = 210_000; // 3.5 minutes (must exceed per-step model timeout)
const MAX_STEP_ATTEMPTS = 3;
const ANTHROPIC_TIMEOUT_MS = 130_000; // 130s per Anthropic call (safe margin under 150s edge limit)
const RETRY_BACKOFF_MS = [20_000, 45_000, 90_000];

/** Convert DD/MM/YYYY (en-GB) or other formats to ISO YYYY-MM-DD */
function toISODate(dateStr: string): string {
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
  // DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
}

// ---- Prompts ----
const ENHANCEMENT_SYSTEM_PROMPT = `You are an NHS primary care policy expert preparing GP practices for CQC inspection. Your task is to review and enhance generated policies to ensure full regulatory compliance.

## KNOWN GUIDANCE CHANGES — MANDATORY OVERRIDES (16 POINTS)
Apply these overrides to every policy where the relevant topic appears.

### CLINICAL

1. CERVICAL SCREENING (effective 1 July 2025)
- Ages 25-49, HPV negative: recall every FIVE YEARS (not three years)
- Ages 50-64, HPV negative: FIVE YEARS (unchanged)
- Pre-2019 cohort (no HPV result on record): maintain three-year recall until first HPV test obtained — this is the ONLY valid use of three years
- NHS App now used for invitations and reminders from June 2025
- Deferral protocol: include process for patients who request to defer screening, including maximum deferral period and re-invitation procedure
- Speculum and lubricant guidance: water-based lubricant is acceptable for LBC samples; state this explicitly
- Non-responder personal GP review: after 3 failed contacts, the patient's named/usual GP must be alerted to consider a personal approach at the next attendance
- Result turnaround monitoring: practice must monitor laboratory turnaround against the 14-day standard and escalate if breached
- Clinically suspicious cervix: if a clinician observes a clinically suspicious cervix regardless of screening result, immediate urgent referral pathway must be documented
- Test of Cure: patients discharged from colposcopy following treatment must have a mandatory 6-month HPV test of cure before returning to routine recall. Document this explicitly as a failsafe step.
- Ceasing screening criteria: include ALL valid reasons — total hysterectomy (with no history of CIN), pelvic radiotherapy, informed patient choice (with documented discussion), lack of capacity (with best interests documentation under the Mental Capacity Act 2005), and learning disability considerations (reasonable adjustments to support screening before ceasing is considered).
- Unexpected findings / corrected reports: document the procedure when a laboratory issues a corrected report, or a sample is lost or broken in transit. Must include immediate patient disclosure under the Duty of Candour, re-sampling within a defined timeframe, and significant event reporting.
- Cold chain / LBC storage: include an annex or subsection on storage temperature requirements for LBC vials — must be stored at room temperature (15–30°C), avoiding extreme heat, direct sunlight, and freezing, as these degrade the preservative fluid and compromise sample integrity.

2. CHAPERONE GUIDANCE
a) GMC Intimate Examinations and Chaperones: updated version effective 30 January 2024. Replace all references to "2013 guidance" with "2024".
b) NHS England "Improving Chaperone Practice in the NHS" published December 2025. Chaperone policies must: state that the policy is publicly available online in accessible formats; require accommodation of patient preferences for chaperone sex/background where possible; include proactive identification of patients with additional needs (learning disabilities, communication difficulties).
c) DBS requirements: Non-clinical staff acting as chaperones must hold an Enhanced DBS check with barred list check. State this explicitly in the recruitment/vetting section.
d) Physical environment: Examination rooms used for intimate examinations must have an accessible call system, alarm, or equivalent failsafe for chaperone/patient safety.
e) Red flag behaviours: Training section must include specific examples of behaviours a chaperone must intervene on and report — including unnecessary remarks, improper touch, and deviation from the explained procedure.
f) Red flag escalation: Must include an explicit immediate stop procedure — the steps a chaperone must take to halt an examination and escalate to the Practice Manager when a boundary violation occurs, including same-day reporting requirement.
g) Lone worker / home visits: Where intimate examinations are conducted during home visits, a formal risk assessment is required and a buddy check-in call to the practice must be mandated. Proceeding without a chaperone during home visits must require documented clinical justification.
h) Physical environment audit: Include a requirement for an annual audit of examination rooms used for intimate examinations, covering curtains/screens, door locks, alarm systems, and CCTV positioning to ensure privacy is maintained.

3. SAFEGUARDING CHILDREN (effective December 2023)
- "Working Together to Safeguard Children 2023" supersedes the 2018 version. Replace all references to "Working Together 2018" with "Working Together 2023".
- Key changes: strengthened focus on family help, multi-agency safeguarding arrangements (MASAs) replace LSCBs, increased emphasis on practitioner judgment.

4. SAFEGUARDING ADULTS (updated 2023)
- DHSC updated statutory guidance under the Care Act 2014 in 2023. Reference "Care and Support Statutory Guidance (updated 2023)", not the 2014 original.

5. SEPSIS (updated 2024)
- NICE Guideline NG51 updated 2024. Replace references to the 2016 version with 2024. NEWS2 remains the recommended early warning tool.

6. INFECTION PREVENTION AND CONTROL (updated 2023)
- UKHSA updated the "National Infection Prevention and Control Manual for England" in 2023. Replace references to PHE/2019 IPC guidance with UKHSA 2023. SICPs and TBPs framework unchanged.

7. ANTIMICROBIAL STEWARDSHIP (updated 2024)
- NHS England updated "Antimicrobial Stewardship: Start Smart then Focus" in 2024. NICE guideline NG15 also updated 2024. Reference the 2024 versions.

8. DNACPR / ReSPECT
- ReSPECT process is now the standard approach, replacing standalone DNACPR forms. Tracey v Cambridge University Hospitals [2014] EWCA Civ 822 remains binding. Reference ReSPECT rather than legacy DNACPR-only forms.

### HR / EMPLOYMENT

9. FLEXIBLE WORKING (effective 6 April 2024)
- Day-one right to request flexible working under Employment Relations (Flexible Working) Act 2023. Two requests per year. Employer must consult before refusing. Response time reduced to 2 months. Replace references to 26-week qualifying period with day-one right.

10. CARER'S LEAVE (effective 6 April 2024)
- Carer's Leave Act 2023: one week unpaid carer's leave per year from day one of employment. Applies to employees with a dependant with a long-term care need. No qualifying period. Cannot be carried over.

11. NEONATAL CARE LEAVE (effective 6 April 2025)
- Neonatal Care (Leave and Pay) Act 2023: up to 12 weeks of neonatal care leave and pay for parents of babies admitted to neonatal care within 28 days of birth and staying 7+ continuous days. Day-one right for leave (26 weeks for pay). All maternity, paternity and parental leave policies must include this.

12. SEXUAL HARASSMENT — EMPLOYER DUTY TO PREVENT (effective 26 October 2024)
- Worker Protection (Amendment of Equality Act 2010) Act 2023: proactive duty on employers to take reasonable steps to prevent sexual harassment. EHRC statutory code applies. All dignity at work, equality, and anti-harassment policies must state the proactive prevention duty explicitly and reference the Worker Protection Act 2023.

13. MENOPAUSE IN THE WORKPLACE (2024)
- EHRC guidance (2024) clarifies menopause symptoms can constitute a disability under the Equality Act 2010. HR and equality policies must reference reasonable adjustments for menopause-related symptoms.

### INFORMATION GOVERNANCE

14. DATA SECURITY AND PROTECTION TOOLKIT
- DSPT 2024/25 is the current version. Replace references to older versions (2022/23, 2023/24) with 2024/25.

15. SUBJECT ACCESS REQUESTS (updated 2023)
- ICO updated SAR guidance in 2023. "Manifestly unfounded or excessive" threshold applies to the request, not the requester. Response time remains one calendar month.

### GP CONTRACT

16. GP CONTRACT 2026/27 (effective April 2026)
- Same-day access requirements introduced. Funding shifts from PCN CAP to practice-level. Policies must not reference pre-2026 contract structures as current.

## OUTPUT FORMAT
CRITICAL: Preserve the EXACT document header structure. Do NOT restructure Document Control table, header fields, Equality Impact Assessment Statement, section numbering, or Version History table position (must remain section 11). Only enhance CONTENT within existing sections.

## SECTION 7 - RELATED POLICIES (MANDATORY)
Section 7 MUST contain a bulleted list of at least 10 specific, named policy titles relevant to the policy type. Do NOT leave this section as only a heading or short introductory sentence.

## SECTION 8.1 - KPI TABLE (MANDATORY)
Section 8.1 MUST contain a populated KPI table with at least 5 measurable Key Performance Indicators relevant to the specific policy type. Each KPI row must include: KPI Name, Target/Standard, Measurement Method, Frequency, and Responsible Person. Do NOT leave this section empty or with placeholder text.

## SECTION 11 - VERSION HISTORY (STRICT RULES)
Section 11 must contain ONLY a version history table with columns: Version | Date | Author | Summary. This table must ALWAYS be populated and must use exactly: Version = 1.0, Date = today's date in DD/MM/YYYY format, Author = the Practice Manager name from the practice details provided, Summary = "Initial issue". Do NOT output internal notes, compliance gap analyses, AI instructions, or enhancement commentary into section 11.

## PLACEHOLDER REPLACEMENT (MANDATORY - FINAL STEP)
Before returning the enhanced policy, you MUST replace every placeholder where the value is known from the practice profile data provided in the user prompt. Specifically:
- [Practice Name] -> the practice name provided
- [Practice Manager] or [Author] -> Practice Manager name provided
- [Lead GP] or [Approved By] -> Lead GP name provided
- [Practice Address] / [Address] -> practice address provided
- [Postcode] -> postcode provided
- [ODS Code] -> ODS code provided
- [Review Date] -> one year from today's date in DD/MM/YYYY format
- [SIRO] -> SIRO name if provided
- [Caldicott Guardian] -> Caldicott Guardian name if provided
- [DPO] / [Data Protection Officer] -> DPO name if provided
- [Safeguarding Lead] -> relevant safeguarding lead name if provided
- [Infection Control Lead] -> infection control lead name if provided
- [Complaints Lead] -> complaints lead name if provided
- [Health & Safety Lead] -> H&S lead name if provided
- [Fire Safety Officer] -> fire safety officer name if provided
Only leave a placeholder as [PRACTICE TO COMPLETE] if the value is genuinely not provided in the practice data.

## ABSOLUTE PROHIBITION — INTERNAL / META CONTENT
Never output any internal notes, gap analysis, compliance checklists, enhancement commentary, AI instructions, or meta-commentary anywhere in the document. This includes but is not limited to:
- "Table 16" or any table labelled as a compliance gap analysis, enhancement summary, or similar
- Sections titled "Critical Compliance Enhancements", "Practice Actions Required", or similar
- Any bullet list describing what the AI changed, verified, or enhanced
- Any content after the Version History table
If you feel the urge to output such content, suppress it entirely. The output must read as a clean, finalised policy document that a practice manager would issue directly.

Return the enhanced policy as a complete document with all mandatory sections, policy-specific requirements addressed, current references with years, clean finalised text without inline flags, a populated KPI table in section 8.1, a populated version history table in section 11, and ALL known placeholders replaced with actual values from the practice data.`;

const BASE_SYSTEM_PROMPT = `You are an NHS primary care policy specialist generating comprehensive, CQC-inspection-ready policies for UK General Practice. Generate professional, regulatory-compliant policies.

## KNOWN GUIDANCE CHANGES — MANDATORY OVERRIDES (16 POINTS)
Apply these overrides to every policy where the relevant topic appears. These are non-negotiable corrections.

### CLINICAL
1. CERVICAL SCREENING (effective 1 July 2025): Ages 25-49 HPV negative = FIVE YEARS recall (not three). Ages 50-64 HPV negative = FIVE YEARS. Pre-2019 cohort (no HPV result) = maintain 3-year recall until HPV test obtained. NHS App used for invitations from June 2025. Deferral protocol required (max deferral period + re-invitation). Water-based lubricant acceptable for LBC samples — state explicitly. After 3 failed contacts, named GP must be alerted for personal approach. Monitor lab turnaround against 14-day standard. Clinically suspicious cervix = immediate urgent referral regardless of screening result. Test of Cure: mandatory 6-month HPV test after colposcopy treatment before returning to routine recall. Ceasing criteria: total hysterectomy, pelvic radiotherapy, informed patient choice (documented discussion), lack of capacity (best interests under MCA 2005), learning disability considerations. Corrected reports / lost samples: immediate Duty of Candour disclosure, re-sampling, significant event report. Cold chain: LBC vials stored at 15–30°C, avoid extreme heat, sunlight, and freezing.
2. CHAPERONE: GMC guidance updated 30 January 2024 (not 2013). NHS England "Improving Chaperone Practice" published December 2025 — policy must be publicly available online, accommodate patient preferences for chaperone sex/background, proactively identify patients with additional needs. Non-clinical chaperones must hold Enhanced DBS with barred list check. Examination rooms must have accessible call system/alarm. Training must include red flag behaviours and explicit escalation/stop procedure with same-day reporting. Home visits requiring intimate examinations need formal risk assessment, buddy check-in call, and documented clinical justification if no chaperone. Annual examination room privacy audit required.
3. SAFEGUARDING CHILDREN: "Working Together to Safeguard Children 2023" supersedes 2018. MASAs replace LSCBs.
4. SAFEGUARDING ADULTS: Care and Support Statutory Guidance updated 2023, not the 2014 original.
5. SEPSIS: NICE NG51 updated 2024 (not 2016). NEWS2 remains recommended.
6. IPC: UKHSA 2023 National IPC Manual replaces PHE/2019 guidance.
7. ANTIMICROBIAL STEWARDSHIP: NHS England "Start Smart then Focus" updated 2024. NICE NG15 updated 2024.
8. DNACPR/ReSPECT: ReSPECT process is standard. Reference Tracey v Cambridge [2014] EWCA Civ 822.

### HR / EMPLOYMENT
9. FLEXIBLE WORKING (6 April 2024): Day-one right. Two requests/year. Employer must consult before refusing. 2-month response time. No 26-week qualifying period.
10. CARER'S LEAVE (6 April 2024): Carer's Leave Act 2023. One week unpaid/year from day one. No qualifying period.
11. NEONATAL CARE LEAVE (6 April 2025): Up to 12 weeks leave/pay. Day-one right for leave. Include in all parental leave policies.
12. SEXUAL HARASSMENT PREVENTION (26 October 2024): Worker Protection Act 2023. Proactive employer duty. EHRC code applies. State duty explicitly in all dignity/equality policies.
13. MENOPAUSE (2024): EHRC guidance — symptoms can constitute disability under Equality Act 2010. Include reasonable adjustments.

### INFORMATION GOVERNANCE
14. DSPT: Current version is 2024/25. Replace 2022/23 or 2023/24 references.
15. SAR: ICO 2023 guidance. "Manifestly unfounded or excessive" applies to the request, not the requester.

### GP CONTRACT
16. GP CONTRACT 2026/27: Same-day access requirements. PCN CAP funding shifted to practice-level. Do not reference pre-2026 contract structures as current.

### CROSS-CUTTING LEGAL REQUIREMENT (APPLIES TO ALL POLICIES)
17. DUTY OF CANDOUR: Every policy must reference Duty of Candour under Regulation 20 of the Health and Social Care Act 2008 (Regulated Activities) Regulations 2014. Include the obligation to be open and honest with patients (or their families) when things go wrong, including notifiable safety incidents. This applies even where the policy topic is not primarily clinical — operational failures that affect patient care still trigger the duty. Reference CQC Regulation 20 explicitly.

### CROSS-CUTTING MONITORING REQUIREMENT (APPLIES TO ALL POLICIES)
18. SIGNIFICANT EVENT ANALYSIS (SEA): All policies — clinical and non-clinical — must include a Significant Event Analysis (SEA) subsection within the Monitoring section (Section 8). This must describe how incidents, near misses, and failures related to the specific policy topic are reported, reviewed, and learned from at practice level. Include who leads the SEA review, the frequency of review, how learning is disseminated to the team, and how changes are tracked to demonstrate improvement. This applies equally to clinical policies (e.g. medication errors) and non-clinical policies (e.g. information security breaches, GDPR incidents).

IMPORTANT RULES:
- Use specific named individuals from practice details provided (not just role titles)
- Include current legislation with years
- Include specific SNOMED/Read codes where clinically relevant
- All phone number placeholders must use format: [PRACTICE TO COMPLETE - description]
- Never use dates as placeholder values for phone numbers
- Replace ALL placeholders with known values from practice data. Only use [PRACTICE TO COMPLETE] for genuinely unknown values.`;

// ---- Policy-specific mandatory content ----
const POLICY_TOPIC_ADDITIONS: Record<string, string> = {
  'consent': `
POLICY-SPECIFIC MANDATORY CONTENT (CONSENT):
- MUST include Montgomery v Lanarkshire Health Board [2015] UKSC 11 ruling: the duty to disclose material risks — a risk is material if a reasonable person in the patient's position would attach significance to it, or if the clinician is (or should be) aware that the particular patient would attach significance to it.
- MUST include process for withdrawal of consent at any stage, including mid-procedure, and the documentation requirements when consent is withdrawn.
- Reference Mental Capacity Act 2005 for patients lacking capacity to consent.`,

  'dnacpr': `
POLICY-SPECIFIC MANDATORY CONTENT (DNACPR / ReSPECT):
- MUST include Human Rights Act 1998 Article 2 (right to life) as part of the legal framework — decisions must be compatible with the patient's right to life and must not be discriminatory.
- MUST include requirement for a second clinical opinion where the patient or family disagrees with a DNACPR/ReSPECT decision, including the process for arranging this and the timeframe.
- Reference Tracey v Cambridge University Hospitals [2014] EWCA Civ 822 on the duty to consult with patients/families before making DNACPR decisions.`,

  'safeguarding adults': `
POLICY-SPECIFIC MANDATORY CONTENT (SAFEGUARDING ADULTS):
- MUST explicitly reference CQC Regulation 13 (Safeguarding service users from abuse and improper treatment) under the Health and Social Care Act 2008 (Regulated Activities) Regulations 2014.
- MUST include the Making Safeguarding Personal (MSP) framework — the person-centred approach to safeguarding enquiries that ensures adults are involved in decisions about their safety and the outcomes they want.
- Reference the six safeguarding principles: empowerment, prevention, proportionality, protection, partnership, accountability.
- Include Care Act 2014 Section 42 enquiry duty and the local authority's role.
- MUST include a Significant Event Analysis (SEA) subsection covering how safeguarding-related incidents, near misses, and concerns are reviewed at practice level, including the frequency of review (e.g. quarterly or after each referral) and who leads the review (e.g. Safeguarding Lead, Practice Manager).`,

  'safeguarding children': `
POLICY-SPECIFIC MANDATORY CONTENT (SAFEGUARDING CHILDREN):
- MUST include FGM mandatory reporting duty: the legal obligation under the Female Genital Mutilation Act 2003 (as amended by the Serious Crime Act 2015) for regulated health professionals to report known cases of FGM in girls under 18 to the police. Include the reporting process, timeframe, and who is responsible at the practice.
- MUST include Serious Case Review / Child Safeguarding Practice Review (CSPR): reference the practice's duty to cooperate with any CSPR or Rapid Review initiated by the Local Safeguarding Children Partnership (LSCP), including how learning from reviews will be disseminated and embedded into practice procedures.
- MUST include Section 47 of the Children Act 1989: this is the legal basis for a local authority child protection enquiry when a child is suspected to be suffering, or likely to suffer, significant harm. The policy must describe the practice's role when a Section 47 enquiry is initiated, including cooperating with the investigating team (social workers, police, other agencies) and providing relevant clinical information in a timely manner.
- Reference "Working Together to Safeguard Children 2023" and the role of MASAs (Multi-Agency Safeguarding Arrangements).`,

  'chaperone': `
POLICY-SPECIFIC MANDATORY CONTENT (CHAPERONE):
- MUST include same-sex chaperone rights: patients must be informed of their right to request a same-sex chaperone, and the practice must make reasonable efforts to accommodate this request, including offering to reschedule the appointment if a same-sex chaperone is unavailable at the time.
- MUST include chilling effect warning: the policy must explicitly state that chaperones are offered, not mandatory — clinicians must not make a patient feel that declining a chaperone will affect the quality of their care or the clinician's willingness to proceed with the examination.
- Reference GMC guidance (updated January 2024) and NHS England "Improving Chaperone Practice" (December 2025).`,

  'medication error': `
POLICY-SPECIFIC MANDATORY CONTENT (MEDICATION ERRORS):
- MUST include patient notification procedure when a medication error reaches the patient — this is a Duty of Candour trigger under Regulation 20 of the Health and Social Care Act 2008 (Regulated Activities) Regulations 2014. The policy must describe: who notifies the patient/family, the timeframe for notification, what information must be disclosed, and how the notification is documented.
- MUST include staff wellbeing and second victim support following a serious medication error — covering immediate support (debrief, removal from clinical duties if appropriate), access to occupational health, peer support or mentoring, and how the practice ensures a just culture that distinguishes between human error and wilful negligence.`,

  'clinical governance': `
POLICY-SPECIFIC MANDATORY CONTENT (CLINICAL GOVERNANCE):
- MUST include reference to learning culture — how the practice embeds learning from incidents, significant events, clinical audits, and external reviews (e.g. CQC inspection findings, CSPR/SAR recommendations, coroner regulation 28 reports) into everyday practice. This should describe the mechanism for disseminating learning (e.g. practice meetings, newsletters, protected learning time), how changes are implemented, and how the practice monitors whether learning has led to sustained improvement.`,

  'sample handling': `
POLICY-SPECIFIC MANDATORY CONTENT (SAMPLE HANDLING):
- MUST include chain of custody process for tracking samples from collection to laboratory receipt — covering labelling requirements, request form completion, handover documentation, transport arrangements (including temperature requirements where applicable), and how the practice confirms laboratory receipt.
- MUST include procedure for rejected or unsuitable samples returned by the laboratory — covering patient notification, re-sampling arrangements, root cause analysis of rejection reasons, and recording of rejected samples for audit purposes.`,

  'minor surgery': `
POLICY-SPECIFIC MANDATORY CONTENT (MINOR SURGERY):
- MUST explicitly reference CQC Regulation 12 (Safe care and treatment) under the Health and Social Care Act 2008 (Regulated Activities) Regulations 2014 as the regulatory basis for safe surgical practice in primary care. The policy must demonstrate how the practice meets Regulation 12 requirements in the context of minor surgical procedures, including competency, equipment, infection control, and patient safety.`,

  'prescribing': `
POLICY-SPECIFIC MANDATORY CONTENT (PRESCRIBING):
- MUST include Non-Medical Prescriber (NMP) governance — covering clinical supervision arrangements, defined scope of practice for each NMP, prescribing limitations (e.g. controlled drugs, high-risk medicines), annual competency review, and how NMP prescribing is audited and monitored.
- MUST include FP10 prescription pad physical security — covering secure storage arrangements (locked facility), stock reconciliation procedures, process for reporting lost or stolen prescription pads (including notification to NHS England and the police), and audit trail for pad allocation and return.
- MUST include a subsection on MHRA Drug Safety Updates and Patient Safety Alerts — covering how alerts are received (e.g. CAS alerts, MHRA email subscription), who is responsible for reviewing them (e.g. Lead GP or Prescribing Lead), how relevant alerts are actioned and communicated to all prescribing staff (including locums and NMPs), the timeframe for action, and how compliance with each alert is recorded and audited.`,

  'end of life': `
POLICY-SPECIFIC MANDATORY CONTENT (END OF LIFE):
- MUST include palliative care / end of life register in SystmOne — covering how patients are added to the register (criteria and who can add), how the register is reviewed (frequency, e.g. monthly MDT or Gold Standards Framework meeting), how patients are removed from the register (e.g. death, recovery, patient choice), and how the register informs proactive care planning including anticipatory prescribing, advance care planning discussions, and coordination with community palliative care teams.`,

  'information security': `
POLICY-SPECIFIC MANDATORY CONTENT (INFORMATION SECURITY):
- MUST include a subsection on third party and supplier security obligations covering: data processing agreements (DPAs) with all suppliers who handle practice data, due diligence checks before onboarding new suppliers (including DSPT status, Cyber Essentials certification, and UK GDPR compliance), the practice's right to audit third party compliance with DSPT and UK GDPR requirements, and the process for reviewing supplier security arrangements on an annual basis or when contract terms change.`,

  'information sharing': `
POLICY-SPECIFIC MANDATORY CONTENT (INFORMATION SHARING):
- MUST explicitly reference Caldicott Principle 3 ("need to know") by name — information should only be shared with those who need it to perform their function, and only to the extent necessary. Include a practical example of how this principle is applied when responding to external information requests (e.g. a solicitor requesting patient records: verify legal basis, confirm identity, share only the minimum information relevant to the request, and document the decision and rationale).`,

  'confidentiality': `
POLICY-SPECIFIC MANDATORY CONTENT (CONFIDENTIALITY):
- MUST include a dedicated subsection on staff confidentiality obligations covering: the common law duty of confidence that applies to all employees, contractors, locums, and volunteers; the consequences of unauthorised disclosure (including disciplinary action, regulatory referral, and potential criminal liability under the Computer Misuse Act 1990 or Data Protection Act 2018); confidentiality clauses in employment contracts and honorary contracts; and the process for raising concerns about confidentiality breaches by colleagues (including whistleblowing protections under the Public Interest Disclosure Act 1998).`,

  'records management': `
POLICY-SPECIFIC MANDATORY CONTENT (RECORDS MANAGEMENT):
- MUST include a legal hold / litigation hold subsection covering: the obligation to suspend routine destruction of records when legal proceedings are anticipated or in progress (including complaints, claims, inquests, and regulatory investigations); who is responsible for issuing a legal hold notice (e.g. Practice Manager or Caldicott Guardian); how affected records are identified and preserved (including electronic and paper records); communication to staff about the hold; and when the hold can be lifted (written confirmation from the instructing solicitor or practice's legal adviser that proceedings have concluded).`,

  'email': `
POLICY-SPECIFIC MANDATORY CONTENT (EMAIL & ELECTRONIC COMMUNICATIONS):
- MUST include a personal and private use subsection — covering whether staff may use practice email systems for personal communications, any limits that apply (e.g. incidental personal use only, no commercial or political use), how personal use is monitored, and that staff should have no expectation of privacy when using practice systems.`,
};

// Step-specific system prompt additions
const PART1_SYSTEM_ADDITION = `
You are generating the FIRST PART of a policy document. Generate ONLY:
1. The full document header (title, practice details, document control table, equality impact assessment)
2. Section 1: PURPOSE
3. Section 2: SCOPE
4. Section 3: DEFINITIONS

MANDATORY HEADER FORMAT (use exactly this structure):
# [Policy Title]

**Practice:** [Practice Name]
**ODS Code:** [ODS Code]

| Field | Detail |
|---|---|
| **Document Title** | [Policy Title] |
| **Version** | 1.0 |
| **Effective Date** | [Today's Date] |
| **Review Date** | [One Year from Today] |
| **Author** | [Practice Manager Name], Practice Manager |
| **Approved By** | [Lead GP Name], Lead GP |
| **Practice** | [Practice Name] |
| **ODS Code** | [ODS Code] |

**Equality Impact Assessment Statement:** This policy has been assessed for its impact on equality in accordance with the Equality Act 2010. It applies equally to all patients and staff regardless of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, or sexual orientation.

---

Do NOT include sections 4-11. Do NOT include ===METADATA=== blocks. Output ONLY the header and sections 1-3 in markdown.`;

const PART2A_SYSTEM_ADDITION = `
You are generating the MIDDLE PART of a policy document. Sections 1-3 already exist and are provided for context.
Generate ONLY:
4. ROLES AND RESPONSIBILITIES
5. POLICY STATEMENT / PROCEDURE

CRITICAL: Section 5 must be COMPLETE. For clinical policies this includes ALL sub-sections — screening pathways, referral criteria, colposcopy referral pathways, HPV triage algorithms, follow-up protocols, etc. Do NOT truncate or abbreviate any sub-section. Complete every bullet point and every sub-heading fully before finishing.

MANDATORY CONTENT FOR SECTION 5 — ALL FULL-LENGTH POLICIES:
The following must be explicitly covered or a CQC inspection finding will result:

1. SNOMED CT CODES — Include a subsection listing the specific SNOMED CT codes used in SystmOne for: routine screening, HPV negative result, HPV positive result, inadequate sample, deferral, ceasing, and colposcopy referral.

2. HOME VISITS — Include a subsection covering cervical screening for housebound patients: eligibility assessment, how to request, which clinical staff can attend, equipment requirements, and documentation.

3. TRANS/NON-BINARY PATIENTS — Include a named subsection (not just a passing mention) covering: manual recall oversight in SystmOne for patients registered as male, clinician sensitivity training, and preferred terminology guidance.

4. FAILSAFE — Use the exact heading "Three-Contact Failsafe Protocol" for the escalation section (e.g. "### 5.X Three-Contact Failsafe Protocol").

5. HPV TRIAGE ALGORITHM — Include a subsection explicitly labelled "HPV Triage Algorithm" showing the decision pathway for all HPV result combinations (HPV negative, HPV positive/cytology normal, HPV positive/cytology abnormal, HPV positive/cytology inadequate), including recall intervals and referral triggers for each pathway.

Do NOT regenerate header or sections 1-3.
Do NOT include sections 6-11.
Do NOT include ===METADATA=== blocks.
Output ONLY sections 4-5 in markdown.`;

const PART2B_SYSTEM_ADDITION = `
You are generating section 6 of a policy document. Sections 1-5 already exist and are provided for context.
Generate ONLY:
6. TRAINING REQUIREMENTS

This section should cover mandatory and recommended training, competency frameworks, update frequencies, and record-keeping requirements relevant to this specific policy area.

Do NOT regenerate any previous sections.
Do NOT include sections 7-11.
Do NOT include ===METADATA=== blocks.
Output ONLY section 6 in markdown.`;

const PART3A_SYSTEM_ADDITION = `
You are generating sections 7-8 of a policy document. Sections 1-6 already exist and are provided for context. Generate ONLY:

7. RELATED POLICIES — You MUST output a bulleted list of at least 10 specific, named policies relevant to this policy type. Each bullet must be a policy title (not a sentence). For example, for a Cervical Screening policy you might list: Infection Prevention and Control Policy, Safeguarding Adults Policy, Consent Policy, Information Governance Policy, Chaperone Policy, Cold Chain Policy, etc. Do NOT leave this section as just a heading or introductory sentence.
8. MONITORING AND COMPLIANCE (Section 8.1 MUST contain a KPI table with at least 5 measurable KPIs: KPI Name | Target/Standard | Measurement Method | Frequency | Responsible Person)

CRITICAL: Section 8.1 KPI table is MANDATORY with 5+ rows. Complete every subsection. Never end mid-sentence.

MANDATORY CONTENT FOR SECTION 8 — EQUALITY MONITORING:
Section 8 must include an EQUALITY MONITORING subsection (e.g. "### 8.X Equality Monitoring") that specifies:
- How the practice will monitor screening uptake by protected characteristic (age, disability, ethnicity as minimum)
- How findings will be reviewed and acted upon (e.g. quarterly review at practice meeting)
- Frequency of equality reporting (minimum annual)
This is distinct from the Equality Impact Assessment in the document header and must contain actionable monitoring commitments.

Do NOT include sections 9-11. Do NOT include ===METADATA=== blocks. Output ONLY sections 7-8 in markdown.`;

const PART3B_SYSTEM_ADDITION = `
You are generating the FINAL sections of a policy document. Sections 1-8 already exist and are provided for context. Generate ONLY:

9. REFERENCES AND LEGISLATION — List ALL relevant references with full titles, years, and publishers. Complete every entry. Never truncate mid-reference.
10. APPENDICES — Include relevant appendices, quick-reference checklists, or supplementary tables appropriate to this policy type. If no appendices are needed, include a brief statement such as "No appendices required for this policy."
11. VERSION HISTORY (MUST contain only this populated version history table: Version = 1.0, Date = today's date DD/MM/YYYY, Author = Practice Manager, Summary = "Initial issue")

CRITICAL: You MUST generate ALL three sections (9, 10, and 11). Section 11 must ONLY contain the version history table - no notes or commentary. Complete every reference entry. Never end mid-sentence.

## ABSOLUTE PROHIBITION — INTERNAL / META CONTENT
Never output any internal notes, gap analysis, compliance checklists, enhancement commentary, AI instructions, or meta-commentary anywhere in the document. The output must read as a clean, finalised policy document.

At the END of your output, include this metadata block:
===METADATA===
Title: [policy title]
Version: 1.0
Effective Date: [today's date DD/MM/YYYY]
Review Date: [one year from today DD/MM/YYYY]
References: [comma-separated list of key references]
===END_METADATA===

Output sections 9-11 followed by the metadata block. Do NOT repeat sections 1-8 or the header.`;

// ---- Helpers ----
function getTopicAdditions(policyName: string): string {
  const normalised = policyName.toLowerCase().trim();
  for (const [key, addition] of Object.entries(POLICY_TOPIC_ADDITIONS)) {
    if (normalised.includes(key)) return addition;
  }
  return '';
}

function buildPracticeContext(jobPractice: any): string {
  const servicesOffered = jobPractice?.services_offered
    ? Object.entries(jobPractice.services_offered)
        .filter(([_, enabled]: [string, any]) => enabled)
        .map(([service]: [string, any]) => service.replace(/_/g, ' '))
        .join(', ')
    : 'Standard GP services';

  let branchSiteInfo = 'None';
  if (jobPractice?.has_branch_site && jobPractice?.branch_site_name) {
    branchSiteInfo = `${jobPractice.branch_site_name}`;
    if (jobPractice.branch_site_address) branchSiteInfo += `, ${jobPractice.branch_site_address}`;
    if (jobPractice.branch_site_postcode) branchSiteInfo += `, ${jobPractice.branch_site_postcode}`;
    if (jobPractice.branch_site_phone) branchSiteInfo += ` (Tel: ${jobPractice.branch_site_phone})`;
  }

  return `PRACTICE DETAILS:
- Practice Name: ${jobPractice?.practice_name || 'GP Practice'}
- Address: ${jobPractice?.address || 'Not specified'}, ${jobPractice?.postcode || ''}
- ODS Code: ${jobPractice?.ods_code || 'Not specified'}
- Clinical System: ${jobPractice?.clinical_system || 'Not specified'}
- Branch Site(s): ${branchSiteInfo}
- Practice Manager: ${jobPractice?.practice_manager_name || '[PRACTICE TO COMPLETE - Practice Manager name]'}
- Lead GP: ${jobPractice?.lead_gp_name || '[PRACTICE TO COMPLETE - Lead GP name]'}
- SIRO: ${jobPractice?.siro || '[PRACTICE TO COMPLETE - SIRO name]'}
- Caldicott Guardian: ${jobPractice?.caldicott_guardian || '[PRACTICE TO COMPLETE - Caldicott Guardian name]'}
- Data Protection Officer: ${jobPractice?.dpo_name || '[PRACTICE TO COMPLETE - DPO name]'}
- Safeguarding Lead (Adults): ${jobPractice?.safeguarding_lead_adults || '[PRACTICE TO COMPLETE - Adult Safeguarding Lead name]'}
- Safeguarding Lead (Children): ${jobPractice?.safeguarding_lead_children || '[PRACTICE TO COMPLETE - Children Safeguarding Lead name]'}
- Infection Control Lead: ${jobPractice?.infection_control_lead || '[PRACTICE TO COMPLETE - Infection Control Lead name]'}
- Complaints Lead: ${jobPractice?.complaints_lead || '[PRACTICE TO COMPLETE - Complaints Lead name]'}
- Health & Safety Lead: ${jobPractice?.health_safety_lead || '[PRACTICE TO COMPLETE - H&S Lead name]'}
- Fire Safety Officer: ${jobPractice?.fire_safety_officer || '[PRACTICE TO COMPLETE - Fire Safety Officer name]'}
- List Size: ${jobPractice?.list_size || 'Not specified'} patients
- Services Offered: ${servicesOffered}`;
}

async function callAnthropic(system: string, userContent: string, maxTokens: number, modelOverride?: string): Promise<string> {
  const modelId = modelOverride || 'claude-sonnet-4-6';
  
  // Route to the correct provider based on model ID
  if (modelId === 'gpt-4o-mini') {
    return callOpenAI(system, userContent, maxTokens, modelId);
  }
  if (modelId.startsWith('gemini-')) {
    return callGemini(system, userContent, maxTokens, modelId);
  }
  
  // Default: Anthropic (Claude models)
  return callAnthropicDirect(system, userContent, maxTokens, modelId);
}

async function callAnthropicDirect(system: string, userContent: string, maxTokens: number, anthropicModel: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
  const controller = new AbortController();
  const STREAM_TOTAL_TIMEOUT_MS = 300_000;
  const timeout = setTimeout(() => controller.abort(), STREAM_TOTAL_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic ${response.status}: ${errText.substring(0, 300)}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text;
          }
        } catch {
          // Ignore parse errors for non-JSON lines
        }
      }
    }

    return fullContent;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Anthropic timeout after ${Math.floor(STREAM_TOTAL_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(system: string, userContent: string, maxTokens: number, model: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured. Add it to Supabase edge function secrets.');
  const controller = new AbortController();
  const STREAM_TOTAL_TIMEOUT_MS = 300_000;
  const timeout = setTimeout(() => controller.abort(), STREAM_TOTAL_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI ${response.status}: ${errText.substring(0, 300)}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullContent += content;
        } catch {
          // Ignore parse errors
        }
      }
    }

    return fullContent;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OpenAI timeout after ${Math.floor(STREAM_TOTAL_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(system: string, userContent: string, maxTokens: number, model: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured. Add it to Supabase edge function secrets.');
  const controller = new AbortController();
  const STREAM_TOTAL_TIMEOUT_MS = 300_000;
  const timeout = setTimeout(() => controller.abort(), STREAM_TOTAL_TIMEOUT_MS);

  // Map all Gemini model IDs to Lovable gateway model names
  const geminiModelMap: Record<string, string> = {
    'gemini-2.0-flash': 'google/gemini-2.5-flash',
    'gemini-2.0-flash-thinking-exp': 'google/gemini-2.5-flash',
    'gemini-2.0-flash-thinking-exp-01-21': 'google/gemini-2.5-flash',
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'gemini-2.5-pro': 'google/gemini-2.5-pro',
  };
  const gatewayModel = geminiModelMap[model] || 'google/gemini-2.5-flash';
  console.log(`[Gemini via Lovable] Requested model: ${model}; gateway model: ${gatewayModel}`);

  try {
    const response = await fetch(LOVABLE_AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: gatewayModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lovable AI gateway ${response.status}: ${errText.substring(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Lovable AI gateway returned empty content');
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Gemini timeout after ${Math.floor(STREAM_TOTAL_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateHeartbeat(serviceSupabase: any, jobId: string, step: string, progressPct: number) {
  await serviceSupabase
    .from('policy_generation_jobs')
    .update({
      heartbeat_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + LEASE_DURATION_MS).toISOString(),
      current_step: step,
      progress_pct: progressPct,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

function selfTrigger(targetUserId: string) {
  fetch(`${SUPABASE_URL}/functions/v1/generate-policy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ action: 'process-job', job_user_id: targetUserId }),
  }).catch(() => {});
}

function stripInternalQuoteLines(content: string): string {
  if (!content) return content;

  return content
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeForbiddenGapAnalysisTables(content: string): string {
  if (!content) return content;

  const lines = content.split('\n');
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];

    if (current.trim().startsWith('|')) {
      let end = i;
      while (end < lines.length && lines[end].trim().startsWith('|')) {
        end++;
      }

      const tableLines = lines.slice(i, end);
      const tableText = tableLines.join('\n').toLowerCase();
      const isForbiddenGapTable =
        /(gaps?|gap analysis)/.test(tableText) &&
        /(sections?\s*affected|section)/.test(tableText) &&
        /(actions?\s*required|required actions?)/.test(tableText);

      if (isForbiddenGapTable) {
        if (kept.length > 0) {
          const prev = kept[kept.length - 1];
          if (/gap analysis|sections?\s*affected|actions?\s*required/i.test(prev)) {
            kept.pop();
          }
        }
        i = end - 1;
        continue;
      }
    }

    kept.push(current);
  }

  return kept.join('\n');
}

interface Section11Details {
  practiceManagerName: string;
  practiceName: string;
  practiceAddress: string;
  leadGpName: string;
  reviewDate: string; // DD/MM/YYYY or similar
}

function enforceSection11ExactTable(content: string, details: Section11Details): string {
  if (!content) return content;

  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayFormatted = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const author = details.practiceManagerName || 'Practice Manager';
  const practiceName = details.practiceName || '[Practice Name]';
  const practiceAddress = details.practiceAddress || '[Practice Address]';
  const leadGpName = details.leadGpName || '[Lead GP]';
  const reviewDate = details.reviewDate || new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-GB');

  const exactTable = `| Version | Date | Author | Summary of Changes |
|---------|------|--------|--------------------|
| 1.0 | ${todayFormatted} | ${author} | Initial issue. New policy created for ${practiceName}. |`;

  const ownershipFooter = `*This policy is the property of ${practiceName}, ${practiceAddress}. It will be reviewed annually by ${author} and approved by ${leadGpName}. Next review due: ${reviewDate}.*`;

  const section11Block = `11. VERSION HISTORY\n\n${exactTable}\n\n${ownershipFooter}`;

  // Find and replace everything from Section 11 heading to end of document
  const headingRegex = /(?:^|\n)((?:#{1,6}\s*)?(?:(?:Section\s*)?11[.:]?\s*(?:[-–—]\s*)?)?VERSION\s*HISTORY[^\n]*)/i;
  const headingMatch = headingRegex.exec(content);

  if (headingMatch) {
    const sectionStart = (headingMatch.index ?? 0) + (headingMatch[0].startsWith('\n') ? 1 : 0);
    const beforeSection = content.slice(0, sectionStart).trimEnd();

    // Check if there's a section 12+ after (unlikely but safe)
    const afterSection11 = content.slice(sectionStart);
    const nextSectionMatch = afterSection11.match(/\n(?:#{1,6}\s*)?(1[2-9]|[2-9]\d)\.\s+[A-Z]/);
    const trailing = nextSectionMatch ? afterSection11.slice(nextSectionMatch.index!) : '';

    return `${beforeSection}\n\n${section11Block}${trailing}`;
  }

  return `${content.trim()}\n\n${section11Block}`;
}

function applyDeterministicOverrides(content: string): string {
  if (!content) return content;
  let text = content;

  // 3. Safeguarding Children: Working Together 2018 → 2023
  text = text.replace(/Working Together(?:\s+to Safeguard Children)?\s*(?:\(?\s*2018\s*\)?)/gi, 'Working Together to Safeguard Children 2023');

  // 14. DSPT: old versions → 2024/25
  text = text.replace(/DSPT\s+202[23]\/2[34]/gi, 'DSPT 2024/25');

  // 5. Sepsis NG51: 2016 → 2024
  text = text.replace(/NG51\s*\(\s*2016\s*\)/gi, 'NG51 (2024)');

  // 6. IPC: PHE → UKHSA (only when clearly referring to IPC/infection guidance body)
  text = text.replace(/\bPHE\b(\s+(?:infection|IPC|national infection))/gi, 'UKHSA$1');

  // 9. Flexible working: 26-week qualifying period → day-one right
  text = text.replace(/26[\-\s]week\s+qualifying\s+period/gi, 'day-one right (no qualifying period)');

  // 1. Cervical screening: "3 years"/"three years" for HPV-negative → "5 years"/"five years"
  // Careful: only replace when in context of HPV-negative/routine recall, not pre-2019 exception
  text = text.replace(/(HPV[\-\s]negative[^.]{0,80}?)\b3\s+years?\b/gi, '$1five years');
  text = text.replace(/(HPV[\-\s]negative[^.]{0,80}?)\bthree\s+years?\b/gi, '$1five years');
  text = text.replace(/(routine\s+recall[^.]{0,60}?)\b3\s+years?\b/gi, '$1five years');
  text = text.replace(/(routine\s+recall[^.]{0,60}?)\bthree\s+years?\b/gi, '$1five years');

  // 2. Chaperone: GMC 2013 → 2024
  text = text.replace(/GMC\s*\(?\s*2013\s*\)?(\s+(?:guidance|chaperone|intimate))/gi, 'GMC (2024)$1');

  return text;
}

function sanitisePolicyOutput(content: string, practiceManagerName: string, practiceDetails?: Section11Details): string {
  const withoutInternalQuoteLines = stripInternalQuoteLines(content);
  const withoutGapAnalysisTables = removeForbiddenGapAnalysisTables(withoutInternalQuoteLines);
  const withOverrides = applyDeterministicOverrides(withoutGapAnalysisTables);

  const s11Details: Section11Details = practiceDetails || {
    practiceManagerName,
    practiceName: '',
    practiceAddress: '',
    leadGpName: '',
    reviewDate: '',
  };
  const withExactVersionHistory = enforceSection11ExactTable(withOverrides, s11Details);

  return withExactVersionHistory.replace(/\n{3,}/g, '\n\n').trim();
}

// Helper: stream Anthropic response while sending keepalive pings to the client
async function streamAnthropicWithKeepalive(
  anthropicResponse: Response,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<string> {
  const reader = anthropicResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  const pingInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(`data: {"type":"ping"}\n\n`));
    } catch {
      // Writer closed
    }
  }, 10000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            await writer.write(encoder.encode(`data: {"type":"progress","chars":${fullContent.length}}\n\n`));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    clearInterval(pingInterval);
  }

  return fullContent;
}

function buildSection11Details(jobPractice: any, jobMetadata: any): Section11Details {
  const practiceManagerName = jobPractice?.practice_manager_name || jobPractice?.practice_manager || 'Practice Manager';
  const practiceName = jobPractice?.practice_name || '[Practice Name]';
  const addr = jobPractice?.address || jobPractice?.practice_address || '';
  const postcode = jobPractice?.postcode || '';
  const practiceAddress = [addr, postcode].filter(Boolean).join(', ') || '[Practice Address]';
  const leadGpName = jobPractice?.lead_gp_name || jobPractice?.lead_gp || '[Lead GP]';
  const reviewDate = jobMetadata?.review_date || new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-GB');
  return { practiceManagerName, practiceName, practiceAddress, leadGpName, reviewDate };
}

// ========== MAIN HANDLER ==========
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { policy_reference_id, practice_details, custom_instructions, generation_type, original_policy_text, gap_analysis, action, job_user_id } = body;

    // ========== CRON SAFETY NET: Re-trigger stalled queues ==========
    if (action === 'cron-check') {
      const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const now = new Date().toISOString();

      // Find all distinct users with pending jobs
      const { data: pendingUsers } = await serviceSupabase
        .from('policy_generation_jobs')
        .select('user_id')
        .eq('status', 'pending');

      // Find users with stale generating/enhancing jobs (lease expired > 5 mins ago)
      const { data: staleUsers } = await serviceSupabase
        .from('policy_generation_jobs')
        .select('user_id')
        .in('status', ['generating', 'enhancing', 'optimising'])
        .lt('lease_expires_at', now);

      // Also check for NULL lease (legacy)
      const { data: legacyUsers } = await serviceSupabase
        .from('policy_generation_jobs')
        .select('user_id')
        .in('status', ['generating', 'enhancing', 'optimising'])
        .is('lease_expires_at', null);

      // Deduplicate user IDs
      const allUsers = new Set<string>();
      for (const row of (pendingUsers || [])) allUsers.add(row.user_id);
      for (const row of (staleUsers || [])) allUsers.add(row.user_id);
      for (const row of (legacyUsers || [])) allUsers.add(row.user_id);

      // But skip users who have an active lease (someone is already processing their job)
      const { data: activeLeases } = await serviceSupabase
        .from('policy_generation_jobs')
        .select('user_id')
        .in('status', ['generating', 'enhancing', 'optimising'])
        .gt('lease_expires_at', now);

      const activeUserIds = new Set((activeLeases || []).map(r => r.user_id));

      let triggered = 0;
      for (const userId of allUsers) {
        if (activeUserIds.has(userId)) continue; // Already being processed
        selfTrigger(userId);
        triggered++;
      }

      console.log(`[Cron] Checked policy queue: ${allUsers.size} users with jobs, ${triggered} re-triggered, ${activeUserIds.size} already active`);

      return new Response(JSON.stringify({ 
        success: true, 
        checked: allUsers.size, 
        triggered, 
        alreadyActive: activeUserIds.size 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== BACKGROUND JOB QUEUE PROCESSOR (STEP PIPELINE) ==========
    if (action === 'process-job') {
      const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const targetUserId = job_user_id;

      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'job_user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Step 1: Find & claim next job ---
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const isRetryReady = (candidate: any) =>
        !candidate?.next_retry_at || new Date(candidate.next_retry_at).getTime() <= nowMs;

      let job: any = null;

      // First try pending jobs
      const { data: pendingJobs } = await serviceSupabase
        .from('policy_generation_jobs')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      job = (pendingJobs || []).find(isRetryReady) || null;

      // If no pending, look for stale generating/enhancing jobs (lease expired)
      if (!job) {
        const { data: staleJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('*')
          .eq('user_id', targetUserId)
          .in('status', ['generating', 'enhancing', 'optimising'])
          .lt('lease_expires_at', now)
          .order('created_at', { ascending: true })
          .limit(10);

        job = (staleJobs || []).find(isRetryReady) || null;
        if (job) {
          console.log(`[Recovery] Reclaiming stale job ${job.id} (step: ${job.current_step}, lease expired: ${job.lease_expires_at})`);
        }
      }

      // Also check for generating/enhancing jobs with NULL lease (legacy rows)
      if (!job) {
        const { data: legacyJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('*')
          .eq('user_id', targetUserId)
          .in('status', ['generating', 'enhancing', 'optimising'])
          .is('lease_expires_at', null)
          .order('created_at', { ascending: true })
          .limit(10);

        job = (legacyJobs || []).find(isRetryReady) || null;
        if (job) {
          console.log(`[Recovery] Reclaiming legacy job ${job.id} (no lease set)`);
        }
      }

      // Recovery path for recent transiently-failed jobs (post-timeout/abort)
      if (!job) {
        const { data: failedJobs } = await serviceSupabase
          .from('policy_generation_jobs')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('status', 'failed')
          .order('updated_at', { ascending: false })
          .limit(10);

        job = (failedJobs || []).find((candidate: any) => {
          const msg = String(candidate?.error_message || '').toLowerCase();
          const recentlyFailed = Date.now() - new Date(candidate.updated_at).getTime() < 30 * 60 * 1000;
          const retriableError = msg.includes('aborted') || msg.includes('timeout') || msg.includes('429') || msg.includes('50');
          const hasAttemptsLeft = (candidate?.attempt_count || 0) < MAX_STEP_ATTEMPTS;
          return recentlyFailed && retriableError && hasAttemptsLeft;
        }) || null;

        if (job) {
          console.log(`[Recovery] Requeueing transient failed job ${job.id} (step: ${job.current_step})`);
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: ['enhance', 'gap_check', 'finalise'].includes(job.current_step) ? 'enhancing' : (job.current_step?.startsWith('auto_quality') ? 'optimising' : 'pending'),
              lease_expires_at: null,
              next_retry_at: null,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          job.status = ['enhance', 'gap_check', 'finalise'].includes(job.current_step) ? 'enhancing' : (job.current_step?.startsWith('auto_quality') ? 'optimising' : 'pending');
        }
      }

      if (!job) {
        return new Response(JSON.stringify({ success: true, phase: 'idle', message: 'No jobs to process' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Claim the job with a lease
      const currentStep = job.current_step || 'generate_part_1';
      const attemptCount = (job.attempt_count || 0) + 1;

      const maxAttemptsForStep = (currentStep === 'gap_check' || currentStep.startsWith('auto_quality')) ? 1 : MAX_STEP_ATTEMPTS;
      if (attemptCount > maxAttemptsForStep) {
        // gap_check or auto_quality exceeded single attempt — skip to finalise
        if (currentStep === 'gap_check' || currentStep.startsWith('auto_quality')) {
          console.warn(`[${currentStep}] Single attempt exceeded, skipping to finalise for job ${job.id}`);
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              current_step: 'finalise',
              status: 'enhancing',
              progress_pct: 90,
              attempt_count: 0,
              lease_expires_at: null,
              next_retry_at: null,
              updated_at: now,
            })
            .eq('id', job.id);
          selfTrigger(targetUserId);
          return new Response(JSON.stringify({ success: true, phase: `${currentStep}_skipped`, jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Other steps - fail permanently
        await serviceSupabase
          .from('policy_generation_jobs')
          .update({
            status: 'failed',
            error_message: `Step ${currentStep} exceeded maximum retry attempts (${MAX_STEP_ATTEMPTS}). Please restart generation.`,
            lease_expires_at: null,
            next_retry_at: null,
            updated_at: now,
          })
          .eq('id', job.id);
        return new Response(JSON.stringify({ success: false, error: 'Max retries exceeded' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Set lease
      await serviceSupabase
        .from('policy_generation_jobs')
        .update({
           status: ['enhance', 'gap_check', 'finalise'].includes(currentStep) ? 'enhancing' : (currentStep.startsWith('auto_quality') ? 'optimising' : 'generating'),
          current_step: currentStep,
          heartbeat_at: now,
          lease_expires_at: new Date(Date.now() + LEASE_DURATION_MS).toISOString(),
          attempt_count: attemptCount,
          next_retry_at: null,
          updated_at: now,
        })
        .eq('id', job.id);

      console.log(`[Step: ${currentStep}] Job ${job.id} - ${job.policy_title} (attempt ${attemptCount})`);

      try {
        // Fetch policy reference
        const { data: policyRef } = await serviceSupabase
          .from('policy_reference_library')
          .select('*')
          .eq('id', job.policy_reference_id)
          .single();

        if (!policyRef) throw new Error('Policy reference not found');

        const jobPractice = job.practice_details;
        const practiceContext = buildPracticeContext(jobPractice);
        const jobMetadata: any = job.metadata || {};
        const generationModel = jobMetadata.generation_model || 'claude-sonnet-4-6';
        const policyLength = jobMetadata.policy_length || 'full'; // compact | concise | standard | full
        const lengthScale: Record<string, number> = { compact: 0.5, concise: 0.45, standard: 0.65, full: 1.0 };
        const scale = lengthScale[policyLength] || 1.0;
        // Hard-capped token map for compact mode (~8500 total ≈ 8-10 pages)
        const COMPACT_TOKEN_MAP: Record<string, number> = {
          generate_part_1: 1800,
          generate_part_2a: 2500,
          generate_part_2b: 1500,
          generate_part_3a: 1200,
          generate_part_3b: 1500,
        };
        const scaleTokens = (base: number, stepName?: string) => {
          if (policyLength === 'compact' && stepName && COMPACT_TOKEN_MAP[stepName]) {
            return COMPACT_TOKEN_MAP[stepName];
          }
          return Math.max(4000, Math.round(base * scale));
        };
        
        // Build length instruction for the system prompt
        const lengthLabels: Record<string, string> = {
          compact: 'COMPACT (~8 pages). Cover only the essential requirements, key responsibilities, and critical procedures. Omit extended examples, appendices, and supplementary detail. Be direct and concise. Each subsection should be 2-4 sentences maximum. Tables should have 3-5 rows maximum. Reference lists should contain the 10-15 most critical references only. You MUST complete every section listed. Do not truncate mid-sentence. If running low on space, reduce detail rather than omitting sections.',
          concise: 'CONCISE (~13 pages). Cover core requirements with essential detail but avoid extended examples, lengthy appendices, or supplementary commentary.',
          standard: 'STANDARD (~20 pages). Provide balanced coverage with good operational detail but avoid excessive elaboration or padding.',
          full: 'COMPREHENSIVE (~40 pages). Provide full regulatory detail suitable for CQC inspection.',
        };
        const lengthInstruction = policyLength !== 'full' 
          ? `\n\nDOCUMENT LENGTH TARGET: ${lengthLabels[policyLength] || lengthLabels.full}\nScale ALL sections proportionally to meet this target. Do not pad or repeat content to fill space.`
          : '';

        // Gemini-specific writing style instruction with dynamic word targets
        const geminiWordTargets: Record<string, string> = {
          compact: '1,500–2,500 words (~8 pages). Key essentials only — one bullet per requirement, no elaboration.',
          concise: '3,000–4,500 words (~13 pages). Core requirements with essential clinical detail.',
          standard: '5,000–7,000 words (~20 pages). Good coverage with procedural detail.',
          full: '7,000–9,000 words (~40 pages). Full regulatory detail, CQC inspection-ready.',
        };

        const geminiConciseInstruction = generationModel.startsWith('gemini-')
          ? `\n\nGEMINI WRITING STYLE:
- Write in direct, professional NHS policy style — no padding, filler phrases, or repetition.
- Prefer structured bullet lists over prose paragraphs where appropriate.
- Each procedural point should be one clear sentence unless clinical detail requires more.
- Target length: ${geminiWordTargets[policyLength] || geminiWordTargets['full']}
- CRITICAL: Do NOT omit any required sections or subsections regardless of length — brevity applies to prose style only, not content coverage.
- All sections 1–11 must be present and complete in every output.`
          : '';
        
        console.log(`Using model: ${generationModel}, length: ${policyLength} (scale: ${scale}) for job ${job.id}`);
        const policyName = policyRef.policy_name;
        const topicAdditions = getTopicAdditions(policyName);

        const regulatoryContext = `REGULATORY CONTEXT:
- CQC KLOE: ${policyRef.cqc_kloe}
- Category: ${policyRef.category}
- Priority: ${policyRef.priority}
- Primary Guidance Sources: ${JSON.stringify(policyRef.guidance_sources || [])}
- Generation Date: ${new Date().toLocaleDateString('en-GB')}`;

        const contactInstructions = `CRITICAL INSTRUCTIONS FOR CONTACT DETAILS:
- For any phone numbers not provided, use: [PRACTICE TO COMPLETE - description]
- NEVER use dates as placeholder values for phone numbers
- All placeholders must be in square brackets and start with "PRACTICE TO COMPLETE"`;

        // ---- STEP: generate_part_1 ----
        if (currentStep === 'generate_part_1') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_1', 10);

          const userPrompt = `Generate the first part of a ${policyName} policy for:

${practiceContext}

${regulatoryContext}

${contactInstructions}
${topicAdditions}
${job.custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${job.custom_instructions}` : ''}

Generate the complete header and sections 1-3 only. IMPORTANT: Complete every subsection. Never end mid-sentence.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + lengthInstruction + geminiConciseInstruction + PART1_SYSTEM_ADDITION,
            userPrompt,
            scaleTokens(5200, 'generate_part_1'),
            generationModel
          );

          if (!content || content.length < 150) {
            throw new Error('Generation part 1 returned insufficient content');
          }

          // Store partial content and advance step
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: { ...jobMetadata, partial_sections_1_3: content },
              current_step: 'generate_part_2a',
              progress_pct: 15,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null, // Release lease before self-trigger
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_1] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_1', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_2a (sections 4-5) ----
        // Also handles legacy 'generate_part_2' jobs
        if (currentStep === 'generate_part_2a' || currentStep === 'generate_part_2') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_2a', 25);

          const part1Content = jobMetadata.partial_sections_1_3 || '';
          if (!part1Content) {
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_1',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_1' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here is the first part of the ${policyName} policy (header + sections 1-3) that has already been generated:

---FIRST PART---
${part1Content}
---END FIRST PART---

${practiceContext}

${regulatoryContext}

${contactInstructions}
${topicAdditions}
Now generate sections 4-5 only. Section 5 must be COMPLETE with all sub-sections fully written out. IMPORTANT: Complete every subsection. Never end mid-sentence. If space is limited, shorten content rather than omitting subsections.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + lengthInstruction + geminiConciseInstruction + PART2A_SYSTEM_ADDITION,
            userPrompt,
            scaleTokens(10000, 'generate_part_2a'),
            generationModel
          );

          if (!content || content.length < 150) {
            throw new Error('Generation part 2a returned insufficient content');
          }

          const sections1to5 = `${part1Content.trim()}\n\n${content.trim()}`;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: {
                ...jobMetadata,
                partial_sections_1_3: part1Content,
                partial_sections_1_5: sections1to5,
              },
              current_step: 'generate_part_2b',
              progress_pct: 35,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_2a] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_2a', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_2b (section 6) ----
        if (currentStep === 'generate_part_2b') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_2b', 45);

          const sections1to5 = jobMetadata.partial_sections_1_5 || '';
          if (!sections1to5) {
            // Missing part 2a, go back
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_2a',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_2a' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here are sections 1-5 of the ${policyName} policy (already generated):

---SECTIONS 1-5---
${sections1to5}
---END SECTIONS 1-5---

${practiceContext}

${regulatoryContext}

${contactInstructions}

Now generate section 6 (Training Requirements) only. You MUST complete ALL subsections of section 6 including 6.3 and any further subsections. Finish every sentence. IMPORTANT: Complete every subsection. Never end mid-sentence. If space is limited, shorten content rather than omitting subsections.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + lengthInstruction + geminiConciseInstruction + PART2B_SYSTEM_ADDITION,
            userPrompt,
            scaleTokens(4000, 'generate_part_2b'),
            generationModel
          );

          if (!content || content.length < 100) {
            throw new Error('Generation part 2b returned insufficient content');
          }

          const sections1to6 = `${sections1to5.trim()}\n\n${content.trim()}`;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: {
                ...jobMetadata,
                partial_sections_1_3: jobMetadata.partial_sections_1_3,
                partial_sections_1_5: sections1to5,
                partial_sections_1_6: sections1to6,
              },
              current_step: 'generate_part_3a',
              progress_pct: 50,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_2b] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_2b', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_3a (sections 7-8) ----
        if (currentStep === 'generate_part_3a' || currentStep === 'generate_part_3') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_3a', 55);

          const sections1to6 = jobMetadata.partial_sections_1_6 || '';
          if (!sections1to6) {
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_1',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_1' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here are sections 1-6 of the ${policyName} policy (already generated):

---SECTIONS 1-6---
${sections1to6}
---END SECTIONS 1-6---

${practiceContext}

${regulatoryContext}

${contactInstructions}

Now generate sections 7-8 only. IMPORTANT: Complete every subsection. Never end mid-sentence. If space is limited, shorten content rather than omitting subsections.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + lengthInstruction + geminiConciseInstruction + PART3A_SYSTEM_ADDITION,
            userPrompt,
            scaleTokens(4000, 'generate_part_3a'),
            generationModel
          );

          if (!content || content.length < 150) {
            throw new Error('Generation part 3a returned insufficient content');
          }

          const sections1to8 = `${sections1to6.trim()}\n\n${content.trim()}`;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              metadata: {
                ...jobMetadata,
                partial_sections_1_3: jobMetadata.partial_sections_1_3,
                partial_sections_1_5: jobMetadata.partial_sections_1_5,
                partial_sections_1_6: sections1to6,
                partial_sections_1_8: sections1to8,
              },
              current_step: 'generate_part_3b',
              progress_pct: 60,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_3a] Job ${job.id} - ${content.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_3a', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: generate_part_3b (sections 9-11) ----
        if (currentStep === 'generate_part_3b') {
          await updateHeartbeat(serviceSupabase, job.id, 'generate_part_3b', 70);

          const sections1to8 = jobMetadata.partial_sections_1_8 || '';
          if (!sections1to8) {
            await serviceSupabase
              .from('policy_generation_jobs')
              .update({
                current_step: 'generate_part_3a',
                attempt_count: 0,
                lease_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id);
            selfTrigger(targetUserId);
            return new Response(JSON.stringify({ success: true, phase: 'retry_part_3a' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const userPrompt = `Here are sections 1-8 of the ${policyName} policy (already generated):

---SECTIONS 1-8---
${sections1to8}
---END SECTIONS 1-8---

${practiceContext}

${regulatoryContext}

${contactInstructions}

Now generate sections 9-11 to complete this policy, followed by the ===METADATA=== block. IMPORTANT: Complete every reference entry. Never end mid-sentence. You MUST include Section 10 (Appendices) and Section 11 (Version History). If space is limited, shorten content rather than omitting sections.`;

          const content = await callAnthropic(
            BASE_SYSTEM_PROMPT + lengthInstruction + geminiConciseInstruction + PART3B_SYSTEM_ADDITION,
            userPrompt,
            scaleTokens(5000, 'generate_part_3b'),
            generationModel
          );

          if (!content || content.length < 100) {
            throw new Error('Generation part 3b returned insufficient content');
          }

          const metadataMatch = content.match(/===METADATA===([\s\S]*?)(?:===END_METADATA===|$)/);
          const sectionsContent = content.replace(/===METADATA===[\s\S]*$/, '').trim();

          const metadata: any = {
            title: policyName,
            version: '1.0',
            effective_date: new Date().toLocaleDateString('en-GB'),
            review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
            references: [],
          };

          if (metadataMatch) {
            const metadataText = metadataMatch[1];
            const titleMatch = metadataText.match(/Title:\s*(.+)/);
            const versionMatch = metadataText.match(/Version:\s*(.+)/);
            const effectiveDateMatch = metadataText.match(/Effective Date:\s*(.+)/);
            const reviewDateMatch = metadataText.match(/Review Date:\s*(.+)/);
            const referencesMatch = metadataText.match(/References:\s*(.+)/);
            if (titleMatch) metadata.title = titleMatch[1].trim();
            if (versionMatch) metadata.version = versionMatch[1].trim();
            if (effectiveDateMatch) metadata.effective_date = effectiveDateMatch[1].trim();
            if (reviewDateMatch) metadata.review_date = reviewDateMatch[1].trim();
            if (referencesMatch) metadata.references = referencesMatch[1].split(',').map((r: string) => r.trim());
          }

          const fullContent = `${sections1to8.trim()}\n\n${sectionsContent}`;

          // Determine next step: compact and budget models skip enhance & gap_check
          // EXCEPT: specific policy types always run gap_check (unless compact)
          const gapCheckPolicyTypes = ['safeguarding-children', 'safeguarding-adults'];
          const normalisedPolicyName = policyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const runGapCheck = gapCheckPolicyTypes.some(t => normalisedPolicyName.includes(t)) && policyLength !== 'compact';
          const isCompact = policyLength === 'compact';
          const autoQualityLoop = jobMetadata.auto_quality_loop === true;
          
          const budgetModels = ['claude-haiku-4-5', 'gpt-4o-mini', 'gemini-2.0-flash', 'gemini-2.0-flash-thinking-exp', 'gemini-2.5-flash', 'gemini-2.5-pro'];
          const isBudget = budgetModels.includes(generationModel);
          const skipEnhance = isCompact || isBudget;
          let nextStep = runGapCheck ? 'gap_check' : (skipEnhance ? 'finalise' : 'enhance');
          // If skipping straight to finalise but auto quality loop is on, go to auto_quality_1 instead
          if (nextStep === 'finalise' && autoQualityLoop) {
            nextStep = 'auto_quality_1';
          }
          const nextStatus = ['finalise', 'gap_check', 'auto_quality_1'].includes(nextStep) ? 'generating' : 'enhancing';
          const nextProgress = nextStep === 'finalise' ? 90 : (nextStep === 'auto_quality_1' ? 91 : (nextStep === 'gap_check' ? 82 : 80));
          if (skipEnhance && !runGapCheck) {
            console.log(`[Step: generate_part_3b] Skipping enhance & gap_check (compact=${isCompact}, model=${generationModel})`);
          }
          if (runGapCheck) {
            console.log(`[Step: generate_part_3b] Policy-type gap_check enabled for "${policyName}" — skipping enhance, running gap_check for job ${job.id}`);
          }

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: nextStatus,
              generated_content: fullContent,
              metadata: {
                ...metadata,
                generation_model: generationModel,
                policy_length: policyLength,
                partial_sections_1_3: undefined,
                partial_sections_1_5: undefined,
                partial_sections_1_6: undefined,
                partial_sections_1_8: undefined,
              },
              current_step: nextStep,
              progress_pct: nextProgress,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: generate_part_3b] Job ${job.id} - combined ${fullContent.length} chars`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'generate_part_3b', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: enhance ----
        if (currentStep === 'enhance') {
          await updateHeartbeat(serviceSupabase, job.id, 'enhance', 65);

          let policyContent = job.generated_content || '';
          const enhanceRetries = jobMetadata.enhance_retries || 0;
          const practiceManagerName = (jobPractice as any)?.practice_manager_name || (jobPractice as any)?.practice_manager || 'Practice Manager';

          if (enhanceRetries >= 2 || policyContent.length > 18000) {
            console.log(`[Step: enhance] Skipping enhancement (retries: ${enhanceRetries}, length: ${policyContent.length})`);
          } else {
            const enhancePrompt = `Please review and enhance the following ${policyName} policy for ${(jobPractice as any)?.practice_name || '[PRACTICE NAME]'} (ODS: ${(jobPractice as any)?.ods_code || '[ODS CODE]'}).

MANDATORY ENHANCEMENT CHECKLIST:
1. Review and improve clinical and compliance accuracy throughout
2. Apply all known guidance changes (cervical screening 5-year intervals, safeguarding 2023, flexible working day-one right, etc.)
3. Complete any missing or incomplete sections
4. Replace ALL [PRACTICE TO COMPLETE] placeholders where values are known from the practice data below
5. Section 7 (Related Policies) MUST contain a bulleted list of at least 10 specific, named policy titles relevant to this policy type. If it is missing or incomplete, generate it now.
6. Section 11 MUST contain ONLY a version history table — no internal notes, no gap analysis
7. Remove any lines beginning with > (blockquote markers used for internal notes)
8. Never output internal notes, gap analysis, compliance checklists, or AI instructions anywhere

FINAL OUTPUT VERIFICATION (do this before returning the document):
A) Check Section 7 (Related Policies): Does it contain a bulleted list of at least 10 named policy titles? If NOT, generate it now. Example format:
- Infection Prevention and Control Policy
- Safeguarding Adults Policy
- Safeguarding Children Policy
- Health and Safety Policy
- Information Governance Policy
- Confidentiality Policy
- Equality and Diversity Policy
- Staff Training and Development Policy
- Risk Management Policy
- Clinical Governance Policy
Replace these examples with titles specifically relevant to this ${policyName} policy.

B) Check Section 11 (Version History): Section 11 must contain ONLY this exact table (no extra text before or after):
| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | ${new Date().toLocaleDateString('en-GB')} | ${practiceManagerName} | Initial issue |

C) Check the entire document for any gap-analysis table listing gaps, sections affected, and actions required. If found anywhere, delete that table entirely before returning.

If any check fails, you MUST fix it before returning. Do not skip this step.

PRACTICE DATA FOR PLACEHOLDER REPLACEMENT:
${practiceContext}

POLICY TO ENHANCE:
${policyContent}`;

            try {
              const enhanced = await callAnthropic(ENHANCEMENT_SYSTEM_PROMPT, enhancePrompt, 16384, generationModel);
              if (enhanced && enhanced.length > 500) {
                policyContent = sanitisePolicyOutput(enhanced, practiceManagerName, buildSection11Details(jobPractice, jobMetadata));
                console.log(`[Step: enhance] Enhancement succeeded - ${policyContent.length} chars (fully sanitised)`);
              } else {
                console.warn(`[Step: enhance] Enhancement returned insufficient content, using original`);
              }
            } catch (enhErr) {
              console.error(`[Step: enhance] Enhancement failed, using generated content:`, enhErr);
              // Store retry count but continue to finalise
              await serviceSupabase
                .from('policy_generation_jobs')
                .update({
                  metadata: { ...jobMetadata, enhance_retries: enhanceRetries + 1 },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', job.id);
            }
          }

          policyContent = sanitisePolicyOutput(policyContent, practiceManagerName, buildSection11Details(jobPractice, jobMetadata));

          // Advance to gap_check
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              generated_content: policyContent,
              current_step: 'gap_check',
              progress_pct: 82,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: enhance] Job ${job.id} → gap_check`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'enhance', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: gap_check (non-blocking — failures skip to finalise) ----
        if (currentStep === 'gap_check') {
          await updateHeartbeat(serviceSupabase, job.id, 'gap_check', 85);

          const policyContent = job.generated_content || '';
          const practiceManagerName = (jobPractice as any)?.practice_manager_name || (jobPractice as any)?.practice_manager || 'Practice Manager';
          let finalContent = policyContent;

          try {
            // Pass the full document text (up to 200k chars) — matches the user-facing analyse-policy-gaps function
            const maxLength = 200000;
            const documentText = policyContent.length > maxLength
              ? policyContent.substring(0, maxLength) + '\n\n[Content truncated due to length]'
              : policyContent;

            const GAP_CHECK_SYSTEM = `You are an expert NHS policy analyst. You are given the FULL TEXT of a GP practice policy. Analyse for genuine compliance gaps and return ONLY valid JSON:
{
  "gaps": ["array of genuine compliance gaps found — max 8"],
  "has_material_gaps": true/false
}

SEVERITY FILTER — only flag:
1. CLINICAL / LEGAL RISK: incorrect clinical intervals, superseded legislation cited as current, missing mandatory legal rights or statutory duties.
2. CQC INSPECTION RISK: a materially missing section a CQC inspector would specifically look for evidence of.
3. PATIENT SAFETY / OPERATIONAL RISK: a process gap that could directly lead to patient harm or significant operational failure.

SCOPE FILTERING — CRITICAL:
Before reporting any gap, ask: does this gap belong directly within the scope of THIS specific policy type, or does it belong to a separate policy that should merely be cross-referenced?
Do NOT report gaps that belong to these separate policies:
- Business Continuity / SystmOne downtime procedures
- Controlled Drugs Accountable Officer details
- Whistleblowing / Freedom to Speak Up
- HR / employment policies
- Any other distinct policy with its own dedicated document
For these topics, a cross-reference is sufficient — do not penalise their absence.

Do NOT penalise or flag placeholder values including:
- "Oak Lane Medical Practice", "Dr John Smith", "Malcolm Railson", "123 High Street"
- Any similar template placeholders — these are intentional and will be replaced by the practice.

PSIRF NOTE: The Patient Safety Incident Response Framework (PSIRF) replaced the Serious Incident Framework in 2023 for NHS providers. For PRIMARY CARE / GP PRACTICES, reference to PSIRF is best practice but not yet mandated — flag as a recommendation, not a Clinical/Legal gap.

NEVER FLAG: minor wording, style, fax mentions, current DSPT versions, vendor names, case law that remains good law, anything covered elsewhere in the document.
CRITICAL: Before flagging any gap, confirm the content is genuinely absent from the ENTIRE document — not just the expected section. If the substance is covered anywhere in the document, do not flag it.
STRICT DEDUPLICATION: Each issue must appear exactly once across the entire output. Before returning, compare all gap descriptions — if two items refer to the same underlying gap (even worded differently), keep only the one under the most appropriate category and discard the other. Never list the same issue under both "gaps" and any other grouping.
Set has_material_gaps to true ONLY if you find genuine issues. If the policy is broadly compliant, return has_material_gaps: false with an empty gaps array.`;

            let shouldRemediate = false;
            let gapsList: string[] = [];

            const gapResponse = await callAnthropic(GAP_CHECK_SYSTEM, `Analyse this policy document IN FULL. You MUST read and consider every section — do not skip or skim any part.\n\n---POLICY DOCUMENT START---\n${documentText}\n---POLICY DOCUMENT END---`, 8192, generationModel);
            const jsonMatch = gapResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.has_material_gaps && Array.isArray(parsed.gaps) && parsed.gaps.length > 0) {
                shouldRemediate = true;
                gapsList = parsed.gaps.map((g: any) => typeof g === 'string' ? g : (g.issue || JSON.stringify(g)));
                console.log(`[gap_check] Found ${gapsList.length} material gaps for job ${job.id}`);
              } else {
                console.log(`[gap_check] No material gaps found for job ${job.id}`);
              }
            }

            if (shouldRemediate) {
              try {
                const remediationPrompt = `The following ${policyName} policy has been reviewed and these compliance gaps were identified:

${gapsList.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Please address EACH gap by adding or correcting the relevant content within the existing document structure. Do NOT restructure the document, do NOT add internal notes or gap analysis tables. Simply fix each issue in-place within the appropriate section.

PRACTICE DATA:
${practiceContext}

POLICY TO FIX:
${finalContent}`;

                // Use higher token limit for policy-type gap_check to prevent truncation
                const remediationTokens = 32768;
                const remediated = await callAnthropic(ENHANCEMENT_SYSTEM_PROMPT, remediationPrompt, remediationTokens, generationModel);
                if (remediated && remediated.length > 500) {
                  finalContent = sanitisePolicyOutput(remediated, practiceManagerName, buildSection11Details(jobPractice, jobMetadata));
                  console.log(`[gap_check] Remediation succeeded - ${finalContent.length} chars`);
                } else {
                  console.warn(`[gap_check] Remediation returned insufficient content, using original`);
                }
              } catch (remErr) {
                console.error(`[gap_check] Remediation failed, using original:`, remErr);
              }
            }
          } catch (gapErr) {
            console.error(`[gap_check] Gap check failed entirely, skipping to finalise with original document:`, gapErr);
            // finalContent remains the pre-gap-check policyContent — no changes lost
          }

          // Advance to finalise (or auto_quality_1 if loop enabled)
          const autoQualityLoop = jobMetadata.auto_quality_loop === true;
          const gapNextStep = autoQualityLoop ? 'auto_quality_1' : 'finalise';
          const gapNextStatus = autoQualityLoop ? 'optimising' : 'enhancing';
          const gapNextProgress = autoQualityLoop ? 91 : 90;

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              generated_content: finalContent,
              current_step: gapNextStep,
              status: gapNextStatus,
              progress_pct: gapNextProgress,
              attempt_count: 0,
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Step done: gap_check] Job ${job.id} → ${gapNextStep}`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: 'gap_check', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: auto_quality_1/2/3 (Auto Quality Loop — opt-in) ----
        if (currentStep.startsWith('auto_quality_')) {
          const attemptNum = parseInt(currentStep.split('_')[2]) || 1;
          await updateHeartbeat(serviceSupabase, job.id, currentStep, 91 + attemptNum);

          const policyContent = job.generated_content || '';
          const practiceManagerName = (jobPractice as any)?.practice_manager_name || (jobPractice as any)?.practice_manager || 'Practice Manager';
          let improvedContent = policyContent;
          let complianceScore = 100;
          let scoreSummary = '';

          try {
            // Run gap analysis with scoring
            const maxLength = 200000;
            const documentText = policyContent.length > maxLength
              ? policyContent.substring(0, maxLength) + '\n\n[Content truncated due to length]'
              : policyContent;

            const AUTO_QUALITY_GAP_SYSTEM = `You are an expert NHS policy analyst specialising in GP practice policy compliance. Analyse this GP practice policy and return ONLY valid JSON:
{
  "gaps": [{ "description": "string", "severity": "Clinical/Legal|CQC Inspection|Patient Safety", "section": "string" }],
  "has_material_gaps": true/false,
  "compliance_score": number_0_to_100,
  "score_summary": "one sentence summary"
}

SEVERITY FILTER — only flag:
1. CLINICAL / LEGAL RISK: incorrect clinical intervals or thresholds, superseded legislation cited as current, missing mandatory legal rights, missing statutory duties.
   Flag if: incorrect clinical intervals or thresholds, superseded legislation cited as current, missing mandatory legal rights (e.g. right to erasure), missing statutory duties (e.g. safeguarding referral obligations).
   Do NOT flag: case law that remains good law even if old, minor wording preferences, references that are technically superseded but still valid.
2. CQC INSPECTION RISK: a materially missing section a CQC inspector would specifically look for evidence of. Only flag if the gap is material — a missing heading is not the same as missing content.
   Do NOT flag: absence of nice-to-have sections, vendor neutrality preferences, stylistic observations.
3. PATIENT SAFETY / OPERATIONAL RISK: a process gap that could directly lead to patient harm or significant operational failure (e.g. no failsafe process, no escalation pathway for abnormal results).
   Do NOT flag: theoretical risks, minor process improvements, observations about best practice that are not required.

NEVER FLAG:
- Single word mentions of outdated technology (e.g. "fax" in a list)
- Case law that remains binding even if older
- DSPT or guidance version numbers that are correct for the current cycle
- Vendor-specific system names (SystmOne, EMIS) in single-system practices
- Style or formatting observations
- Anything that would be fixed at the next annual review rather than now
- Issues already covered adequately elsewhere in the document

SCOPE FILTERING — CRITICAL:
Before reporting any gap, ask: does this gap belong directly within the scope of THIS specific policy type, or does it belong to a separate policy that should merely be cross-referenced?
Do NOT report gaps that belong to these separate policies:
- Business Continuity / SystmOne downtime procedures
- Controlled Drugs Accountable Officer details
- Whistleblowing / Freedom to Speak Up
- HR / employment policies
- Any other distinct policy with its own dedicated document
For these topics, a cross-reference is sufficient — do not penalise their absence.

Do NOT penalise or flag placeholder values including:
- "Oak Lane Medical Practice", "Dr John Smith", "Malcolm Railson", "123 High Street"
- Any similar template placeholders — these are intentional and will be replaced by the practice.

PSIRF NOTE: The Patient Safety Incident Response Framework (PSIRF) replaced the Serious Incident Framework in 2023 for NHS providers. For PRIMARY CARE / GP PRACTICES, reference to PSIRF is best practice but not yet mandated — flag as a recommendation, not a Clinical/Legal gap.

CERVICAL SCREENING NON-RESPONDER FOLLOW-UP: If this policy relates to Sample Handling, Cervical Screening, or references cervical screening processes, you MUST check for non-responder follow-up. The NHS Cervical Screening Programme requires:
- Follow-up of non-responders within 8-12 weeks of first invitation
- A defined timeline for each follow-up contact attempt
- Escalation to the patient's named/usual GP after 3 failed contacts for a personal approach at next attendance
If the policy references cervical screening but does not include a non-responder follow-up process with a SPECIFIC timeline (e.g. "8-12 weeks"), flag as a Patient Safety gap with severity "Patient Safety". Do not accept vague wording like "timely follow-up" — the 8-12 week timeframe must be explicitly stated.

CRITICAL: Before flagging any gap, you MUST confirm the content is genuinely absent from the ENTIRE document — not just the expected section heading. Read the full document body. If the substance is covered anywhere in the document, do not flag it as a gap. A gap is only valid if the content is completely absent from the entire policy.

CQC COMPLIANCE SCORING:
Start at 110 and cap at 100 (this is a Notewell-generated policy — the +10 baseline bonus reflects structural and governance standards already met).
Deduct points based on identified issues using the severity from each gap:
- Each Clinical/Legal gap: -8 points
- Each CQC Inspection gap: -5 points
- Each Patient Safety gap: -6 points
- Incomplete document (truncated): -20 points
- No named responsible person: -5 points
- No review date: -5 points
- No version history: -3 points
Floor: 0. Maximum: 100.

IMPORTANT: Do NOT automatically score 100. You must genuinely assess the document. If there are gaps, the score MUST reflect the deductions. A score of 100 means zero gaps were found — if you listed any gaps, the score must be lower than 100.

STRICT DEDUPLICATION: max 8 issues. Each issue must appear exactly once across the entire output.`;

            const gapResponse = await callAnthropic(AUTO_QUALITY_GAP_SYSTEM, `Analyse this policy document IN FULL.\n\n---POLICY DOCUMENT START---\n${documentText}\n---POLICY DOCUMENT END---`, 8192, generationModel);
            const jsonMatch = gapResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              complianceScore = typeof parsed.compliance_score === 'number' ? Math.max(0, Math.min(100, parsed.compliance_score)) : 100;
              scoreSummary = parsed.score_summary || '';

              console.log(`[auto_quality_${attemptNum}] Score: ${complianceScore}/100 for job ${job.id}`);

              // If score >= 90, we're done
              if (complianceScore >= 90) {
                console.log(`[auto_quality_${attemptNum}] Target reached (${complianceScore}/100), advancing to finalise`);
              } else if (attemptNum < 3 && parsed.has_material_gaps && Array.isArray(parsed.gaps) && parsed.gaps.length > 0) {
                // Filter to actionable gaps
                const actionableGaps = parsed.gaps
                  .filter((g: any) => {
                    const sev = (g.severity || '').toLowerCase();
                    return sev.includes('clinical') || sev.includes('legal') || sev.includes('cqc');
                  })
                  .filter((g: any) => {
                    const d = (g.description || '').toLowerCase();
                    return !d.includes('business continuity') &&
                           !d.includes('accountable officer') &&
                           !d.includes('whistleblow') &&
                           !d.includes('placeholder') &&
                           !d.includes('practice-specific') &&
                           !d.includes('oak lane') &&
                           !d.includes('unpopulated');
                  });

                if (actionableGaps.length > 0) {
                  // Run remediation
                  const gapsList = actionableGaps.map((g: any) => typeof g === 'string' ? g : (g.description || g.issue || JSON.stringify(g)));
                  console.log(`[auto_quality_${attemptNum}] Remediating ${gapsList.length} actionable gaps: ${gapsList.join(' | ')}`);
                  const remediationPrompt = `TASK: You MUST fix the following ${gapsList.length} compliance gaps in this ${policyName} policy. For each gap listed below, you MUST ADD the missing content directly into the appropriate section of the policy. Do not merely acknowledge the gaps — actually write the missing paragraphs, procedures, or subsections.

COMPLIANCE GAPS TO FIX (each one MUST be addressed with new content):
${gapsList.map((g: string, i: number) => `${i + 1}. ${g}`).join('\n')}

INSTRUCTIONS:
- For each gap above, ADD a new subsection or paragraph in the most appropriate section of the policy
- Include specific procedural detail, named responsibilities, and timeframes where relevant
- Do NOT remove or restructure any existing content
- Do NOT add meta-commentary, gap analysis tables, or notes about what was changed
- Output the COMPLETE policy document with all existing content PLUS the new additions

PRACTICE DATA:
${practiceContext}

COMPLETE POLICY TO UPDATE:
${policyContent}`;

                  const remediated = await callAnthropic(ENHANCEMENT_SYSTEM_PROMPT, remediationPrompt, 32768, generationModel);
                  if (remediated && remediated.length > 500) {
                    improvedContent = sanitisePolicyOutput(remediated, practiceManagerName, buildSection11Details(jobPractice, jobMetadata));
                    console.log(`[auto_quality_${attemptNum}] Remediation succeeded - ${improvedContent.length} chars, advancing to attempt ${attemptNum + 1}`);

                    // Advance to next auto_quality attempt
                    await serviceSupabase
                      .from('policy_generation_jobs')
                      .update({
                        generated_content: improvedContent,
                        current_step: `auto_quality_${attemptNum + 1}`,
                        status: 'optimising',
                        progress_pct: 91 + attemptNum + 1,
                        attempt_count: 0,
                        metadata: { ...jobMetadata, auto_quality_last_score: complianceScore, auto_quality_last_summary: scoreSummary },
                        next_retry_at: null,
                        heartbeat_at: new Date().toISOString(),
                        lease_expires_at: null,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', job.id);

                    selfTrigger(targetUserId);
                    return new Response(JSON.stringify({ success: true, phase: currentStep, jobId: job.id, score: complianceScore }), {
                      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                  }
                }
              }
            }
          } catch (aqErr) {
            console.error(`[auto_quality_${attemptNum}] Error, advancing to finalise:`, aqErr);
          }

          // Done (either score >= 90, max attempts, no actionable gaps, or error) — advance to finalise
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              generated_content: improvedContent,
              current_step: 'finalise',
              status: 'enhancing',
              progress_pct: 95,
              attempt_count: 0,
              metadata: {
                ...jobMetadata,
                auto_quality_score: complianceScore,
                auto_quality_attempts: attemptNum,
                auto_quality_reached_target: complianceScore >= 90,
                auto_quality_summary: scoreSummary,
              },
              next_retry_at: null,
              heartbeat_at: new Date().toISOString(),
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[auto_quality_${attemptNum}] Done (score: ${complianceScore}/100), advancing to finalise for job ${job.id}`);
          selfTrigger(targetUserId);

          return new Response(JSON.stringify({ success: true, phase: currentStep, jobId: job.id, finalScore: complianceScore }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ---- STEP: finalise ----
        if (currentStep === 'finalise') {
          await updateHeartbeat(serviceSupabase, job.id, 'finalise', 90);

          const rawPolicyContent = job.generated_content || '';
          const practiceManagerName = (jobPractice as any)?.practice_manager_name || (jobPractice as any)?.practice_manager || 'Practice Manager';
          const s11Details = buildSection11Details(jobPractice, jobMetadata);
          const policyContent = sanitisePolicyOutput(rawPolicyContent, practiceManagerName, s11Details);

          // Save to policy_completions
          try {
            const today = new Date().toISOString().split('T')[0];
            const reviewDate = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
          // Calculate generation duration
          const createdAt = new Date(job.created_at).getTime();
          const generationDurationSeconds = Math.round((Date.now() - createdAt) / 1000);
          const completionMetadata = {
            ...jobMetadata,
            policy_length: policyLength,
            generation_duration_seconds: generationDurationSeconds,
            generation_model: jobMetadata.generation_model || 'claude-sonnet-4-6',
            policy_source: 'notewell',
          };

          // Check if a completion already exists for this policy_reference_id + user
          const { data: existingCompletion } = await serviceSupabase
            .from('policy_completions')
            .select('id, version')
            .eq('user_id', job.user_id)
            .eq('policy_reference_id', job.policy_reference_id)
            .limit(1)
            .maybeSingle();

          if (existingCompletion) {
            // --- Auto-version: bump version and create version history entry ---
            // Get the latest active version number
            const { data: latestVersion } = await serviceSupabase
              .from('policy_versions')
              .select('version_number')
              .eq('policy_id', existingCompletion.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const currentVersion = latestVersion?.version_number || existingCompletion.version || '1.0';
            // Minor bump for regeneration (e.g., 1.0 -> 1.1, 1.1 -> 1.2)
            const vParts = currentVersion.split('.');
            const majorV = parseInt(vParts[0]) || 1;
            const minorV = parseInt(vParts[1]) || 0;
            const newVersion = `${majorV}.${minorV + 1}`;

            // Update the version in the generated content itself
            const versionedContent = policyContent
              .replace(/\|\s*\*\*Version\*\*\s*\|\s*[\d.]+\s*\|/g, `| **Version** | ${newVersion} |`)
              .replace(/^(\*\*Version:\*\*\s*)[\d.]+/m, `$1${newVersion}`);

            // Also update metadata
            completionMetadata.version = newVersion;

            // Supersede old active versions
            await serviceSupabase
              .from('policy_versions')
              .update({ status: 'superseded', superseded_at: new Date().toISOString() })
              .eq('policy_id', existingCompletion.id)
              .eq('status', 'active');

            // Get user email for created_by
            const { data: userData } = await serviceSupabase.auth.admin.getUserById(job.user_id);
            const userEmail = userData?.user?.email || 'system';

            // Create new version entry
            await serviceSupabase.from('policy_versions').insert({
              policy_id: existingCompletion.id,
              version_number: newVersion,
              status: 'active',
              content: { policy_content: versionedContent, metadata: completionMetadata },
              change_type: 'content_change',
              change_summary: 'Policy regenerated with latest content',
              created_by: userEmail,
              next_review_date: toISODate(jobMetadata.review_date || reviewDate),
              user_id: job.user_id,
            });

            // Update existing card with new content and version
            await serviceSupabase.from('policy_completions')
              .update({
                policy_title: policyName,
                policy_content: versionedContent,
                metadata: completionMetadata,
                version: newVersion,
                status: 'completed',
                effective_date: toISODate(jobMetadata.effective_date || today),
                review_date: toISODate(jobMetadata.review_date || reviewDate),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingCompletion.id);
            console.log(`[Finalise] Updated existing completion ${existingCompletion.id} to v${newVersion}`);
          } else {
            // Create new card
            await serviceSupabase.from('policy_completions').insert({
              user_id: job.user_id,
              policy_reference_id: job.policy_reference_id,
              policy_title: policyName,
              policy_content: policyContent,
              metadata: completionMetadata,
              version: jobMetadata.version || '1.0',
              status: 'completed',
              effective_date: toISODate(jobMetadata.effective_date || today),
              review_date: toISODate(jobMetadata.review_date || reviewDate),
            });
            console.log(`[Finalise] Created new completion for ${policyName}`);
          }
          } catch (saveErr) {
            console.error(`[Finalise] Failed to save completion:`, saveErr);
          }

          // Mark completed
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'completed',
              generated_content: policyContent,
              completed_at: new Date().toISOString(),
              progress_pct: 100,
              current_step: 'done',
              attempt_count: 0,
              lease_expires_at: null,
              next_retry_at: null,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          console.log(`[Finalise] Job ${job.id} completed`);

          // Send email if requested
          if (job.email_when_ready) {
            try {
              const { data: userData } = await serviceSupabase.auth.admin.getUserById(job.user_id);
              const userEmail = userData?.user?.email;
              if (userEmail) {
                // Generate Word attachment
                let wordAttachment = null;
                try {
                  const policyTitle = jobMetadata.title || policyName;
                  const jobPracticeDetails = job.practice_details as any;

                  // Fetch practice logo
                  let logoUrl: string | null = null;
                  try {
                    const { data: pdRow } = await serviceSupabase
                      .from('practice_details')
                      .select('logo_url, practice_logo_url')
                      .eq('user_id', job.user_id)
                      .order('is_default', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    if (pdRow) logoUrl = pdRow.practice_logo_url || pdRow.logo_url || null;
                  } catch (logoErr) {
                    console.warn('Could not fetch practice logo:', logoErr);
                  }

                  // Fetch and base64 the logo
                  let logoBase64 = '';
                  let logoMime = 'image/png';
                  if (logoUrl) {
                    try {
                      const logoResp = await fetch(logoUrl);
                      if (logoResp.ok) {
                        const logoBuffer = await logoResp.arrayBuffer();
                        const logoBytes = new Uint8Array(logoBuffer);
                        let logoBinary = '';
                        for (let i = 0; i < logoBytes.length; i++) {
                          logoBinary += String.fromCharCode(logoBytes[i]);
                        }
                        logoBase64 = btoa(logoBinary);
                        const ct = logoResp.headers.get('content-type');
                        if (ct) logoMime = ct.split(';')[0].trim();
                      }
                    } catch (imgErr) {
                      console.warn('Could not fetch logo image:', imgErr);
                    }
                  }

                  // Convert markdown to Word-compatible HTML with professional formatting
                  const mdToHtml = (md: string): string => {
                    const lines = md.split('\n');
                    const output: string[] = [];
                    let inTable = false;
                    let tableRows: string[][] = [];
                    let inList = false;
                    let listItems: string[] = [];

                    const flushTable = () => {
                      if (tableRows.length === 0) return;
                      let t = '<table style="border-collapse:collapse;width:100%;margin:10pt 0;mso-table-lspace:0;mso-table-rspace:0;">';
                      tableRows.forEach((cells, idx) => {
                        const isHeader = idx === 0;
                        const bg = isHeader ? 'background-color:#EFF6FF;' : '';
                        const fw = isHeader ? 'font-weight:bold;' : '';
                        t += '<tr>';
                        cells.forEach(c => {
                          const tag = isHeader ? 'td' : 'td';
                          t += `<${tag} style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;${bg}${fw}vertical-align:top;">${c.trim()}</${tag}>`;
                        });
                        t += '</tr>';
                      });
                      t += '</table>';
                      output.push(t);
                      tableRows = [];
                    };

                    const flushList = () => {
                      if (listItems.length === 0) return;
                      output.push('<ul style="margin:4pt 0 8pt 24pt;padding:0;">');
                      listItems.forEach(li => {
                        output.push(`<li style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;margin-bottom:3pt;">${li}</li>`);
                      });
                      output.push('</ul>');
                      listItems = [];
                    };

                    const inlineFormat = (text: string): string => {
                      return text
                        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>');
                    };

                    for (const rawLine of lines) {
                      const line = rawLine.trimEnd();

                      // Separator rows in tables
                      if (/^\|[\s\-:|]+\|$/.test(line)) continue;

                      // Table row
                      if (line.startsWith('|') && line.endsWith('|')) {
                        if (!inTable) { flushList(); inTable = true; }
                        const cells = line.slice(1, -1).split('|').map(c => inlineFormat(c.trim()));
                        tableRows.push(cells);
                        continue;
                      } else if (inTable) {
                        inTable = false;
                        flushTable();
                      }

                      // Headings
                      const h3 = line.match(/^### (.+)$/);
                      if (h3) { flushList(); output.push(`<h3 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:13pt;margin-top:14pt;margin-bottom:4pt;mso-style-name:'Heading 3';">${inlineFormat(h3[1])}</h3>`); continue; }

                      const h2 = line.match(/^## (.+)$/);
                      if (h2) { flushList(); output.push(`<h2 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:15pt;margin-top:20pt;margin-bottom:6pt;mso-style-name:'Heading 2';">${inlineFormat(h2[1])}</h2>`); continue; }

                      const h1 = line.match(/^# (.+)$/);
                      if (h1) { flushList(); output.push(`<h1 style="color:#003087;font-family:Calibri,Arial,sans-serif;font-size:20pt;margin-top:0;margin-bottom:10pt;mso-style-name:'Heading 1';">${inlineFormat(h1[1])}</h1>`); continue; }

                      // Numbered section headings like "1. PURPOSE" or "10. REFERENCES"
                      const numHeading = line.match(/^(\d+)\.\s+([A-Z][A-Z\s&/,-]+)$/);
                      if (numHeading) { flushList(); output.push(`<h2 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:14pt;font-weight:bold;margin-top:20pt;margin-bottom:6pt;">${numHeading[1]}. ${numHeading[2]}</h2>`); continue; }

                      // Sub-numbered headings like "1.1" or "2.3 Heading Text"
                      const subHeading = line.match(/^(\d+\.\d+)\s+(.+)$/);
                      if (subHeading) { flushList(); output.push(`<h3 style="color:#005EB8;font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:bold;margin-top:12pt;margin-bottom:4pt;">${subHeading[1]} ${inlineFormat(subHeading[2])}</h3>`); continue; }

                      // Bullet points
                      const bullet = line.match(/^[\s]*[-*]\s+(.+)$/);
                      if (bullet) { if (!inList) inList = true; listItems.push(inlineFormat(bullet[1])); continue; }
                      if (inList) { inList = false; flushList(); }

                      // Empty line
                      if (line.trim() === '') { output.push(''); continue; }

                      // Regular paragraph
                      output.push(`<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;margin:0 0 6pt 0;mso-line-height-rule:exactly;">${inlineFormat(line)}</p>`);
                    }

                    // Flush remaining
                    if (inTable) flushTable();
                    if (inList) flushList();

                    return output.join('\n');
                  };

                  const htmlBody = mdToHtml(policyContent);
                  const nowDate = new Date();
                  const dateStr = nowDate.toLocaleDateString('en-GB');
                  const timeStr = nowDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                  const practiceName = jobPracticeDetails?.practice_name || '';
                  const practiceAddr = jobPracticeDetails?.address || '';
                  const practicePostcode = jobPracticeDetails?.postcode || '';
                  const practicePhone = jobPracticeDetails?.phone || '';
                  const odsCode = jobPracticeDetails?.ods_code || '';

                  // Document control table
                  const version = jobMetadata.version || '1.0';
                  const effectiveDate = jobMetadata.effective_date || dateStr;
                  const reviewDate = jobMetadata.review_date || '';
                  const author = jobMetadata.author || practiceName || '';
                  const approvedBy = jobMetadata.approved_by || '';

                  const docControlTable = `
<table style="border-collapse:collapse;width:100%;margin:12pt 0 18pt 0;">
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;width:35%;">Version</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${version}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Effective Date</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${effectiveDate}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Review Date</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${reviewDate}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Author</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${author}</td></tr>
  <tr><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;background-color:#EFF6FF;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;">Approved By</td><td style="border:1pt solid #CBD5E1;padding:6pt 10pt;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${approvedBy}</td></tr>
</table>`;

                  // Header with fixed-size logo
                  let headerHtml = '<div style="border-bottom:2pt solid #005EB8;padding-bottom:12pt;margin-bottom:6pt;">';
                  headerHtml += '<table style="width:100%;border:none;"><tr>';
                  if (logoBase64) {
                    headerHtml += `<td style="width:90px;vertical-align:middle;border:none;padding:0 12pt 0 0;">
                      <img src="data:${logoMime};base64,${logoBase64}" width="80" height="60" style="width:80px;height:60px;object-fit:contain;" alt="Practice logo" />
                    </td>`;
                  }
                  headerHtml += '<td style="vertical-align:middle;border:none;padding:0;">';
                  if (practiceName) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:14pt;font-weight:bold;color:#003087;margin:0 0 4pt 0;">${practiceName}</p>`;
                  const addressParts = [practiceAddr, practicePostcode].filter(Boolean).join(', ');
                  if (addressParts) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#666;margin:0 0 2pt 0;">${addressParts}</p>`;
                  if (practicePhone) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#666;margin:0 0 2pt 0;">Tel: ${practicePhone}</p>`;
                  if (odsCode) headerHtml += `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#666;margin:0;">ODS Code: ${odsCode}</p>`;
                  headerHtml += '</td></tr></table></div>';

                  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${policyTitle}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { margin: 2.54cm; }
  body {
    font-family: Calibri, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #374151;
    mso-line-height-rule: exactly;
    mso-default-props: yes;
  }
  h1, h2, h3 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
  p { mso-style-parent: ""; margin: 0 0 6pt 0; }
</style>
</head><body>
${headerHtml}
${docControlTable}
${htmlBody}
<br style="page-break-before:auto;"/>
<hr style="margin-top:30pt;border:none;border-top:1pt solid #CBD5E1;"/>
<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#64748B;text-align:center;margin-top:6pt;">${practiceName ? practiceName + ' | ' : ''}Generated by Notewell AI on ${dateStr} at ${timeStr}</p>
</body></html>`;

                  const enc = new TextEncoder();
                  const uint8 = enc.encode(wordHtml);
                  let binary = '';
                  for (let i = 0; i < uint8.length; i++) {
                    binary += String.fromCharCode(uint8[i]);
                  }
                  const base64Content = btoa(binary);

                  const safeFilename = policyTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 60);
                  wordAttachment = {
                    filename: `${safeFilename}.doc`,
                    content: base64Content,
                    type: 'application/msword'
                  };
                } catch (docErr) {
                  console.warn('Word document generation failed:', docErr);
                }

                await fetch(`${SUPABASE_URL}/functions/v1/send-email-resend`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  },
                  body: JSON.stringify({
                    to_email: userEmail,
                    subject: `Your policy is ready: ${jobMetadata.title || policyName}`,
                    html_content: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a365d;">Your Policy is Ready</h2>
                        <p>Hi,</p>
                        <p>Your policy <strong>${jobMetadata.title || policyName}</strong> has been generated and enhanced successfully.</p>
                        <p>You can view and download it from your <a href="https://gpnotewell.co.uk/policy-service/my-policies" style="color: #2563eb;">My Policies</a> page.</p>
                        ${wordAttachment ? '<p>The policy document is attached to this email as a Word file.</p>' : ''}
                        <div style="margin: 24px 0; padding: 16px; background-color: #f0f9ff; border-radius: 8px;">
                          <p style="margin: 0; font-size: 14px; color: #64748b;">
                            <strong>Version:</strong> ${jobMetadata.version || '1.0'}<br/>
                            <strong>Effective Date:</strong> ${jobMetadata.effective_date}<br/>
                            <strong>Review Date:</strong> ${jobMetadata.review_date}
                          </p>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">This is an automated notification from Notewell AI.</p>
                      </div>
                    `,
                    attachments: wordAttachment ? [wordAttachment] : undefined,
                  }),
                });
                console.log(`Email sent to ${userEmail} for job ${job.id}`);
              }
            } catch (emailErr) {
              console.error('Failed to send email:', emailErr);
            }
          }

          // Check for more jobs
          const { data: moreJobs } = await serviceSupabase
            .from('policy_generation_jobs')
            .select('id')
            .eq('user_id', targetUserId)
            .in('status', ['pending'])
            .limit(1);

          if (moreJobs && moreJobs.length > 0) {
            selfTrigger(targetUserId);
          }

          return new Response(JSON.stringify({ success: true, phase: 'finalise', jobId: job.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Unknown step - reset to part 1
        console.warn(`[Unknown step: ${currentStep}] Resetting job ${job.id}`);
        await serviceSupabase
          .from('policy_generation_jobs')
          .update({ current_step: 'generate_part_1', lease_expires_at: null, updated_at: new Date().toISOString() })
          .eq('id', job.id);
        selfTrigger(targetUserId);

        return new Response(JSON.stringify({ success: true, phase: 'reset' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (stepError) {
        const errMsg = stepError instanceof Error ? stepError.message : 'Unknown error';
        const normalisedError = errMsg.toLowerCase();
        const isTransient =
          normalisedError.includes('abort') ||
          normalisedError.includes('timeout') ||
          normalisedError.includes('429') ||
          normalisedError.includes('500') ||
          normalisedError.includes('502') ||
          normalisedError.includes('503') ||
          normalisedError.includes('504') ||
          normalisedError.includes('network');

        console.error(`[Step failed: ${currentStep}] Job ${job.id}:`, errMsg);

        if (isTransient && attemptCount < MAX_STEP_ATTEMPTS) {
          // Transient failure - release lease and retry with backoff
          const backoffMs = RETRY_BACKOFF_MS[Math.min(attemptCount - 1, RETRY_BACKOFF_MS.length - 1)];
          const retryAt = new Date(Date.now() + backoffMs).toISOString();

          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: ['enhance', 'gap_check', 'finalise'].includes(currentStep) ? 'enhancing' : (currentStep.startsWith('auto_quality') ? 'optimising' : 'generating'),
              lease_expires_at: retryAt,
              next_retry_at: retryAt,
              error_message: `Step ${currentStep} failed (attempt ${attemptCount}/${MAX_STEP_ATTEMPTS}): ${errMsg}. Retrying...`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // Schedule retry
          setTimeout(() => selfTrigger(targetUserId), backoffMs);
        } else {
          // Permanent failure
          await serviceSupabase
            .from('policy_generation_jobs')
            .update({
              status: 'failed',
              error_message: `Step ${currentStep} failed permanently: ${errMsg}`,
              lease_expires_at: null,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        }

        return new Response(JSON.stringify({ success: false, error: errMsg }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========== SSE STREAMING PATH (synchronous generation) ==========
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    let practiceId: string | null = null;
    if (practice_details?.ods_code) {
      const { data: practiceRecord } = await supabase
        .from('gp_practices')
        .select('id')
        .eq('ods_code', practice_details.ods_code)
        .maybeSingle();
      practiceId = practiceRecord?.id || null;
    }

    const systemPrompt = BASE_SYSTEM_PROMPT + `

MANDATORY HEADER FORMAT (use exactly this structure):
# [Policy Title]

**Practice:** [Practice Name]
**ODS Code:** [ODS Code]

| Field | Detail |
|---|---|
| **Document Title** | [Policy Title] |
| **Version** | 1.0 |
| **Effective Date** | [Today's Date] |
| **Review Date** | [One Year from Today] |
| **Author** | [Practice Manager Name], Practice Manager |
| **Approved By** | [Lead GP Name], Lead GP |
| **Practice** | [Practice Name] |
| **ODS Code** | [ODS Code] |

**Equality Impact Assessment Statement:** This policy has been assessed for its impact on equality in accordance with the Equality Act 2010. It applies equally to all patients and staff regardless of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, or sexual orientation.

---

MANDATORY SECTIONS (in this exact order):
1. PURPOSE
2. SCOPE
3. DEFINITIONS
4. ROLES AND RESPONSIBILITIES
5. POLICY STATEMENT / PROCEDURE
6. TRAINING REQUIREMENTS
7. RELATED POLICIES
8. MONITORING AND COMPLIANCE (8.1 must contain KPI table with 5+ KPIs)
9. REFERENCES AND LEGISLATION
10. APPENDICES
11. VERSION HISTORY (must contain populated version history table)

OUTPUT FORMAT:
===METADATA===
Title: [policy title]
Version: 1.0
Effective Date: [today's date DD/MM/YYYY]
Review Date: [one year from today DD/MM/YYYY]
References: [comma-separated list of key references]
===POLICY_CONTENT===
[full policy document in markdown]`;

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const processPolicy = async () => {
      try {
        let userPrompt: string;
        let defaultTitle: string;
        let genType: string;
        let extraInsertFields: Record<string, any> = {};

        if (generation_type === 'update') {
          if (!original_policy_text || !gap_analysis) {
            throw new Error('original_policy_text and gap_analysis are required for update generation');
          }

          userPrompt = `You are updating an existing NHS practice policy. Here is the original policy:

---ORIGINAL POLICY---
${original_policy_text}
---END ORIGINAL POLICY---

The following gaps and issues have been identified:
- Policy Type: ${gap_analysis.policy_type}
- Gaps Found: ${gap_analysis.gaps?.join(', ') || 'None'}
- Outdated References: ${gap_analysis.outdated_references?.join(', ') || 'None'}
- Missing Sections: ${gap_analysis.missing_sections?.join(', ') || 'None'}
- Last Review Date: ${gap_analysis.last_review_date || 'Unknown'}

Please generate an updated version of this policy that:
1. Addresses all identified gaps
2. Updates any outdated references to current guidance
3. Adds any missing sections
4. Maintains the original structure where appropriate
5. Updates the version number and dates
6. Includes a summary of changes made

Today's date is ${new Date().toLocaleDateString('en-GB')}.`;

          defaultTitle = 'Updated Policy';
          genType = 'update';
          extraInsertFields = { gap_analysis };
        } else {
          if (!policy_reference_id || !practice_details) {
            throw new Error('policy_reference_id and practice_details are required');
          }

          const { data: policyRef, error: policyRefError } = await supabase
            .from('policy_reference_library')
            .select('*')
            .eq('id', policy_reference_id)
            .single();

          if (policyRefError || !policyRef) {
            throw new Error('Policy reference not found');
          }

          const servicesOffered = practice_details.services_offered
            ? Object.entries(practice_details.services_offered)
                .filter(([_, enabled]) => enabled)
                .map(([service]) => service.replace(/_/g, ' '))
                .join(', ')
            : 'Standard GP services';

          let branchSiteInfo = 'None';
          if (practice_details.has_branch_site && practice_details.branch_site_name) {
            branchSiteInfo = `${practice_details.branch_site_name}`;
            if (practice_details.branch_site_address) branchSiteInfo += `, ${practice_details.branch_site_address}`;
            if (practice_details.branch_site_postcode) branchSiteInfo += `, ${practice_details.branch_site_postcode}`;
            if (practice_details.branch_site_phone) branchSiteInfo += ` (Tel: ${practice_details.branch_site_phone})`;
          }

          userPrompt = `Generate a ${policyRef.policy_name} policy for:

PRACTICE DETAILS:
- Practice Name: ${practice_details.practice_name || 'GP Practice'}
- Address: ${practice_details.address || 'Not specified'}, ${practice_details.postcode || ''}
- ODS Code: ${practice_details.ods_code || 'Not specified'}
- Clinical System: ${practice_details.clinical_system || 'Not specified'}
- Branch Site(s): ${branchSiteInfo}
- Practice Manager: ${practice_details.practice_manager_name || '[PRACTICE TO COMPLETE - Practice Manager name]'}
- Lead GP: ${practice_details.lead_gp_name || '[PRACTICE TO COMPLETE - Lead GP name]'}
- SIRO: ${practice_details.siro || '[PRACTICE TO COMPLETE - SIRO name]'}
- Caldicott Guardian: ${practice_details.caldicott_guardian || '[PRACTICE TO COMPLETE - Caldicott Guardian name]'}
- Data Protection Officer: ${practice_details.dpo_name || '[PRACTICE TO COMPLETE - DPO name]'}
- Safeguarding Lead (Adults): ${practice_details.safeguarding_lead_adults || '[PRACTICE TO COMPLETE - Adult Safeguarding Lead name]'}
- Safeguarding Lead (Children): ${practice_details.safeguarding_lead_children || '[PRACTICE TO COMPLETE - Children Safeguarding Lead name]'}
- Infection Control Lead: ${practice_details.infection_control_lead || '[PRACTICE TO COMPLETE - Infection Control Lead name]'}
- Complaints Lead: ${practice_details.complaints_lead || '[PRACTICE TO COMPLETE - Complaints Lead name]'}
- Health & Safety Lead: ${practice_details.health_safety_lead || '[PRACTICE TO COMPLETE - H&S Lead name]'}
- Fire Safety Officer: ${practice_details.fire_safety_officer || '[PRACTICE TO COMPLETE - Fire Safety Officer name]'}
- List Size: ${practice_details.list_size || 'Not specified'} patients
- Services Offered: ${servicesOffered}

REGULATORY CONTEXT:
- CQC KLOE: ${policyRef.cqc_kloe}
- Category: ${policyRef.category}
- Priority: ${policyRef.priority}
- Primary Guidance Sources: ${JSON.stringify(policyRef.guidance_sources || [])}
- Generation Date: ${new Date().toLocaleDateString('en-GB')}

CRITICAL INSTRUCTIONS FOR CONTACT DETAILS:
- For any phone numbers not provided, use: [PRACTICE TO COMPLETE - description]
- NEVER use dates as placeholder values for phone numbers
- All placeholders must be in square brackets and start with "PRACTICE TO COMPLETE"

${custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${custom_instructions}` : ''}

Please generate a complete, professional policy document that meets all regulatory requirements.`;

          console.log('Generating policy:', policyRef.policy_name);
          defaultTitle = policyRef.policy_name;
          genType = 'new';
          extraInsertFields = { policy_reference_id };
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            stream: true,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Anthropic API error:', response.status, errorText);
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const aiContent = await streamAnthropicWithKeepalive(response, writer, encoder);

        const metadataMatch = aiContent.match(/===METADATA===([\s\S]*?)===POLICY_CONTENT===/);
        const contentMatch = aiContent.match(/===POLICY_CONTENT===([\s\S]*)/);

        const metadata: any = {
          title: defaultTitle,
          version: genType === 'update' ? '2.0' : '1.0',
          effective_date: new Date().toLocaleDateString('en-GB'),
          review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
          references: [],
        };
        if (genType === 'update' && gap_analysis) {
          metadata.changes_summary = gap_analysis.gaps || [];
        }

        if (metadataMatch) {
          const metadataText = metadataMatch[1];
          const titleMatch = metadataText.match(/Title:\s*(.+)/);
          const versionMatch = metadataText.match(/Version:\s*(.+)/);
          const effectiveDateMatch = metadataText.match(/Effective Date:\s*(.+)/);
          const reviewDateMatch = metadataText.match(/Review Date:\s*(.+)/);
          const referencesMatch = metadataText.match(/References:\s*(.+)/);

          if (titleMatch) metadata.title = titleMatch[1].trim();
          if (versionMatch) metadata.version = versionMatch[1].trim();
          if (effectiveDateMatch) metadata.effective_date = effectiveDateMatch[1].trim();
          if (reviewDateMatch) metadata.review_date = reviewDateMatch[1].trim();
          if (referencesMatch) metadata.references = referencesMatch[1].split(',').map((r: string) => r.trim());
        }

        const rawPolicyContent = contentMatch ? contentMatch[1].trim() : aiContent;
        const policyContent = stripInternalQuoteLines(rawPolicyContent);

        const { data: generationRecord, error: insertError } = await supabase
          .from('policy_generations')
          .insert({
            user_id: userId,
            practice_id: practiceId,
            policy_name: metadata?.title || defaultTitle,
            generation_type: genType,
            generated_content: policyContent,
            metadata,
            ...extraInsertFields,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Failed to save generation record:', insertError);
        }

        console.log('Policy generated successfully:', metadata.title);

        const result = JSON.stringify({
          success: true,
          content: policyContent,
          metadata,
          generation_id: generationRecord?.id,
        });
        await writer.write(encoder.encode(`data: {"type":"result","data":${result}}\n\n`));
      } catch (error) {
        console.error('generate-policy error:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        await writer.write(encoder.encode(`data: {"type":"error","error":"${errMsg.replace(/"/g, '\\"')}"}\n\n`));
      } finally {
        await writer.close();
      }
    };

    processPolicy();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('generate-policy error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
