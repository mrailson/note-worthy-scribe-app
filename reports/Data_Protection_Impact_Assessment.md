# Data Protection Impact Assessment (DPIA)
## PCN Services Ltd - Integrated Care Management Platform

**Document Version:** 1.0  
**Date:** 17th November 2025  
**Status:** Final - Awaiting Sign-off  
**Classification:** Official - Sensitive  
**Review Date:** 17th November 2026 (or upon material changes)

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 17/11/2025 | Data Protection Officer | Initial DPIA creation |

---

## Executive Summary

### Project Overview

This Data Protection Impact Assessment (DPIA) evaluates the data protection implications of the PCN Services Ltd Integrated Care Management Platform, a comprehensive healthcare information system designed to support Primary Care Networks, GP practices, and Integrated Care Boards in England.

The platform processes patient identifiable data, staff personal data, and special category health data across multiple modules including complaints management, meeting transcription, clinical decision support (AI4GP), CQC evidence management, and operational workflows.

### DPIA Necessity

This DPIA is **mandatory** under UK GDPR Article 35 as the processing involves:

✓ **Systematic and extensive profiling** - AI-driven clinical decision support and pattern analysis  
✓ **Large-scale processing of special category data** - Patient health records and medical histories  
✓ **Systematic monitoring** - Continuous audit logging and security monitoring  
✓ **Innovative use of technology** - AI/ML for medical translation and clinical assistance  
✓ **International data transfers** - Third-party processors in non-adequate jurisdictions  
✓ **Processing that could result in high risk to individuals** - Clinical safety implications

### Data Controller Details

**Organisation:** PCN Services Ltd  
**ICO Registration Number:** ZB226324  
**Registration Expiry:** 03/10/2026  
**Address:** Ground Floor, 2 Woodberry Grove, London, N12 0DR, United Kingdom  
**Email:** malcolm.railson@nhs.net  
**Telephone:** 07740812180

**Data Protection Officer (DPO):**  
Name: [DPO Name]  
Email: dpo@gpnotewell.co.uk  
Phone: [DPO Contact Number]

**Senior Information Risk Owner (SIRO):**  
Name: [SIRO Name]  
Role: Chief Executive Officer  
Email: [SIRO Email]

**Caldicott Guardian:**  
Name: [Caldicott Guardian Name]  
Role: Medical Director  
Email: [Caldicott Email]

**Clinical Safety Officer:**  
Name: [CSO Name]  
Registration: [GMC/NMC Number]  
Email: [CSO Email]

### Scope of Processing

The platform processes data for approximately:
- **Data Subjects:** 50,000+ patients per annum, 200+ healthcare staff
- **Geographic Scope:** England (deployment to ICBs and PCNs)
- **Data Categories:** Patient identifiable data, special category health data, staff employment data
- **Processing Activities:** 8 major modules with 40+ distinct processing operations
- **Third-Party Processors:** 4 primary (Supabase, OpenAI, ElevenLabs, EmailJS)

### Legal Basis

**For Patient Data Processing:**
- **Article 6(1)(e)** - Public task in the exercise of official authority
- **Article 9(2)(h)** - Health or social care purposes (provision of healthcare, medical diagnosis)
- **Health and Social Care Act 2012** - NHS service provision obligations
- **Common Law Duty of Confidentiality** - Implied consent for direct care

**For Staff Data Processing:**
- **Article 6(1)(b)** - Necessary for employment contract performance
- **Article 6(1)(c)** - Legal obligation (employment law compliance)

### Overall Risk Rating

| Risk Category | Inherent Risk | Residual Risk |
|---------------|---------------|---------------|
| Unauthorised Access | HIGH | **MEDIUM** |
| Data Breach | HIGH | **LOW-MEDIUM** |
| AI Clinical Error | VERY HIGH | **MEDIUM** |
| Third-Party Failure | MEDIUM | **LOW-MEDIUM** |
| International Transfer | MEDIUM-HIGH | **MEDIUM** |
| **Overall Assessment** | **HIGH** | **MEDIUM** |

**Conclusion:** With comprehensive technical and organisational measures in place, residual risks are reduced to acceptable levels. Continuous monitoring and annual review required.

---

## Part 1: Description of Processing Operations

### 1.1 Complaints Management System

**Purpose:** NHS complaints handling in accordance with NHS Complaints Regulations 2009

**Legal Basis:**
- Article 6(1)(c) - Legal obligation (NHS complaint handling duty)
- Article 9(2)(h) - Healthcare provision and quality management

**Data Categories:**
- **Patient Identifiable Data:** Name, date of birth, NHS number, contact details
- **Special Category Data:** Health conditions, medical history, treatment details
- **Contextual Data:** Complaint narratives, staff mentioned, incident details

**Data Subjects:**
- Patients (complainants and subjects of complaints)
- Family members/representatives (where acting on behalf)
- Healthcare staff mentioned in complaints
- Investigation team members

**Data Sources:**
- Direct submission by patients/representatives (web forms, email)
- GP practice records (imported for context)
- Staff responses and investigation notes
- External correspondence (emails, letters)

**Processing Activities:**
- Complaint registration and case management
- AI-generated acknowledgement letters
- Investigation tracking and evidence gathering
- Outcome determination and response generation
- Compliance checking (time limits, due process)
- Audio transcription of investigation interviews
- Statistical reporting (anonymised)

**Retention Period:**
- **Active complaints:** Duration of investigation + 6 months
- **Closed complaints:** 10 years (NHS Records Management Code of Practice)
- **Serious incidents:** Permanent retention (clinical governance)
- **Anonymised statistics:** Indefinite (quality improvement)

**Automated Deletion:** Triggered at retention expiry with audit trail

**Access Controls:**
- Complaints team: Full access to assigned cases
- Practice managers: Cases related to their practice only
- Clinical staff: View only for relevant cases
- Patients: Access to own complaint records via subject access request

**Security Measures:**
- Row Level Security (RLS) policies per user and practice
- End-to-end encryption (AES-256 at rest, TLS 1.3 in transit)
- Comprehensive audit logging (all access, modifications, deletions)
- Multi-factor authentication required
- Practice-level data segregation

### 1.2 Meeting Transcription & Note-Taking

**Purpose:** Clinical meeting documentation and governance record-keeping

**Legal Basis:**
- Article 6(1)(e) - Public task (clinical governance, regulatory compliance)
- Article 9(2)(h) - Healthcare management and quality assurance

**Data Categories:**
- **Audio Recordings:** Voice data of meeting participants
- **Transcripts:** Verbatim text of discussions (may contain patient references)
- **Attendee Data:** Names, roles, organisations of participants
- **Meeting Metadata:** Date, time, duration, location, agenda

**Data Subjects:**
- Healthcare professionals (GPs, nurses, managers)
- Patients (when discussed in clinical meetings)
- External stakeholders (ICB representatives, regulators)

**Data Sources:**
- Real-time audio capture via AssemblyAI streaming API
- Manual text entry (notes, agendas, action items)
- Imported agendas from calendar systems

**Processing Activities:**
- Real-time speech-to-text transcription
- Speaker diarisation (identifying who said what)
- AI-powered summarisation and action item extraction
- Redaction of patient identifiers (when required)
- Email distribution of meeting minutes
- Word document export for governance records

**Retention Period:**
- **Audio recordings:** Deleted after transcription verification (7 days maximum)
- **Transcripts:** 6 years (NHS governance standard)
- **Meeting summaries:** 6 years
- **Clinical governance meetings:** Permanent retention

**Access Controls:**
- Meeting attendees: Full access to meetings they attended
- Practice team: Access to practice-related meetings only
- External attendees: Time-limited access (encrypted link, expires after 30 days)

**Security Measures:**
- Audio data encrypted in transit and at rest
- Temporary storage only (7-day auto-delete)
- Practice-level segregation of meeting data
- Secure email transmission (TLS required)

**Data Minimisation:**
- Audio not retained long-term (transcription only)
- Optional redaction workflow for patient identifiers
- Granular access controls (per meeting, not blanket access)

### 1.3 AI4GP Clinical Decision Support

**Purpose:** Medical translation, prescription policy checking, clinical guidance

**Legal Basis:**
- Article 6(1)(e) - Public task (NHS service provision)
- Article 9(2)(h) - Medical diagnosis and healthcare provision
- Article 9(2)(g) - Substantial public interest (health and social care)

**Data Categories:**
- **Clinical Information:** Symptoms, diagnoses, medications, allergies (entered by clinician)
- **Patient Demographics:** Age, gender (for clinical context, no direct identifiers)
- **Prescription Data:** Drug names, doses, interactions
- **Translation Content:** Medical information in multiple languages

**Data Subjects:**
- Patients (indirectly via anonymised clinical scenarios)
- Clinicians (usage analytics, audit trails)

**Data Sources:**
- Direct input by clinicians during consultations
- Local formularies and prescribing guidelines
- NHS England medicines policy data

**Processing Activities:**
- AI-powered medical translation (50+ languages)
- Prescription policy compliance checking (black/red/green list)
- Drug interaction warnings
- Clinical knowledge base searching
- Audio playback generation (ElevenLabs TTS)
- Usage analytics (anonymised)

**Special Considerations - AI Processing:**
- **Human Oversight Required:** All AI outputs flagged as "AI-generated, verify independently"
- **Clinical Validation:** Clinician must review before relying on AI output
- **Liability:** Platform does not diagnose - supports clinician decision-making
- **Transparency:** Patients informed when AI translation used

**Data Minimisation:**
- No patient identifiers sent to AI processors
- Anonymised clinical queries only
- No data retained by OpenAI (zero-day retention policy)
- Local caching minimises API calls

**Retention Period:**
- **AI query logs:** 1 year (clinical audit)
- **Translation cache:** 90 days (performance optimisation)
- **Anonymised analytics:** 3 years (service improvement)

**Access Controls:**
- Clinicians only (GP, nurse prescriber, pharmacist roles)
- Practice-level usage analytics
- No patient self-service access

**Security Measures:**
- Clinical context anonymised before external API calls
- Zero-day retention with OpenAI (contractual guarantee)
- Audit trail of all AI-assisted decisions
- Clinical Safety Case (DCB0129 compliant)

### 1.4 User Authentication & Access Control

**Purpose:** Staff identity management, access control, security

**Legal Basis:**
- Article 6(1)(b) - Employment contract performance
- Article 6(1)(c) - Legal obligation (data protection, employment law)
- Article 6(1)(f) - Legitimate interest (system security)

**Data Categories:**
- **Authentication Data:** Email addresses, password hashes (bcrypt)
- **Employment Data:** Name, job title, role, practice affiliation
- **Access Logs:** Login times, IP addresses, device information
- **Security Events:** Failed login attempts, password resets, suspicious activity

**Data Subjects:**
- Healthcare staff (employees, contractors)
- System administrators
- External users (temporary access for investigations)

**Data Sources:**
- User registration (HR-verified)
- Authentication providers (Supabase Auth)
- Device information (browser, OS metadata)

**Processing Activities:**
- User registration and onboarding
- Multi-factor authentication (email verification)
- Role-based access control (RBAC) enforcement
- Session management and token issuance
- Security event logging and anomaly detection
- Password reset workflows

**Retention Period:**
- **Active user accounts:** Duration of employment + 6 months
- **Access logs:** 1 year (security audit requirement)
- **Security incident logs:** 3 years (regulatory compliance)
- **Deactivated accounts:** Personal data deleted after 6 months, audit logs retained anonymised

**Access Controls:**
- Admins: User management and system configuration
- Practice managers: User provisioning within their practice
- Users: Self-service password reset, profile updates

**Security Measures:**
- Password hashing (bcrypt, 10 rounds minimum)
- Email verification required for registration
- Account lockout after 5 failed login attempts (15-minute lockout)
- IP-based anomaly detection (alerts for unusual locations)
- Session timeout after 12 hours of inactivity
- Device fingerprinting for suspicious activity detection

### 1.5 Audit Logging & Security Monitoring

**Purpose:** Security monitoring, regulatory compliance, incident investigation

**Legal Basis:**
- Article 6(1)(c) - Legal obligation (GDPR Article 30, NHS DSP Toolkit)
- Article 6(1)(f) - Legitimate interest (security, fraud prevention)

**Data Categories:**
- **System Events:** User actions, data access, modifications, deletions
- **Security Events:** Authentication attempts, permission changes, anomalies
- **Performance Data:** Response times, error rates, system health
- **User Behaviour:** Navigation patterns, feature usage (anonymised where possible)

**Data Subjects:**
- System users (staff)
- Indirectly: Patients (when their records accessed)

**Data Sources:**
- Application event logs
- Database audit triggers
- Supabase realtime logs
- Error monitoring systems

**Processing Activities:**
- Comprehensive event logging (who, what, when, where)
- Security anomaly detection
- Compliance reporting (DSPT evidence)
- Incident investigation and forensics
- Performance monitoring and optimisation
- Usage analytics (anonymised)

**Retention Period:**
- **Audit logs:** 6 years (NHS standard)
- **Security incident logs:** 7 years (legal claims)
- **Performance metrics:** 1 year (anonymised)
- **Anonymised analytics:** Indefinite

**Access Controls:**
- System administrators: Full audit log access
- Data Protection Officer: Unrestricted access for investigations
- Auditors: Read-only access with MFA

**Security Measures:**
- Append-only audit log (tamper-evident)
- Separate secure storage (isolated from application database)
- Automated alerts for high-risk events (bulk data export, permission escalation)
- Regular log review (weekly automated, monthly manual)

### 1.6 CQC Evidence Management

**Purpose:** Care Quality Commission regulatory compliance and inspection readiness

**Legal Basis:**
- Article 6(1)(c) - Legal obligation (Health and Social Care Act 2008)
- Article 9(2)(h) - Healthcare quality management

**Data Categories:**
- **Regulatory Documents:** Policies, procedures, training records
- **Quality Metrics:** Patient outcomes, incident reports, complaints analysis
- **Staff Information:** Training certificates, competency assessments
- **Patient Data:** Anonymised case studies, audit data

**Data Subjects:**
- Healthcare staff (training, competency data)
- Patients (anonymised quality metrics)

**Data Sources:**
- Manual document uploads
- Automated policy templates
- Integrated data from other platform modules
- External CQC guidance documents

**Processing Activities:**
- Document storage and version control
- Policy review workflow and expiry tracking
- Evidence tagging by CQC domain (Safe, Effective, Caring, Responsive, Well-led)
- Gap analysis and compliance scoring
- Report generation for inspections
- AI-assisted policy drafting

**Retention Period:**
- **Active policies:** Until superseded + 3 years
- **Historical versions:** 10 years (regulatory requirement)
- **Training records:** Duration of employment + 6 years
- **Quality metrics:** 10 years

**Access Controls:**
- CQC leads: Full access to evidence library
- Practice managers: Practice-specific evidence only
- Staff: Read access to relevant policies

**Security Measures:**
- Version control and change tracking
- Read-only historical versions (immutable)
- Expiry alerts and automated reviews

### 1.7 Document Storage & Sharing

**Purpose:** Secure file storage for clinical and operational documents

**Legal Basis:**
- Article 6(1)(e) - Public task (healthcare record-keeping)
- Article 9(2)(h) - Healthcare provision and management

**Data Categories:**
- **Clinical Documents:** Referral letters, investigation reports, care plans
- **Administrative Files:** Meeting agendas, contracts, HR documents
- **Images and Media:** Photographs (consent forms), audio recordings

**Data Subjects:**
- Patients (clinical documents)
- Staff (HR, training materials)

**Data Sources:**
- Direct file uploads by users
- Email attachments (imported)
- System-generated exports (meeting minutes, reports)

**Processing Activities:**
- Encrypted file storage (Supabase Storage)
- Access control via signed URLs (time-limited)
- File scanning for malware
- Automatic file type validation
- Metadata extraction (file size, type, upload date)

**Retention Period:**
- **Patient-related documents:** As per NHS Records Management Code (10 years minimum)
- **Staff documents:** 6 years post-employment
- **Operational documents:** 6 years (financial record requirements)

**Access Controls:**
- Role-based access (uploader, practice team, authorised viewers)
- Time-limited secure links for external sharing
- Download/view audit trail

**Security Measures:**
- AES-256 encryption at rest
- TLS 1.3 for transmission
- Virus scanning on upload (file type validation)
- Signed URLs expire after 1 hour (configurable)
- Storage bucket isolation per practice

### 1.8 Operational Workflows

**Purpose:** Scheduling, task management, communications

**Legal Basis:**
- Article 6(1)(b) - Contract performance (employment)
- Article 6(1)(f) - Legitimate interest (operational efficiency)

**Data Categories:**
- **Scheduling Data:** Meeting dates, attendee availability, calendar integrations
- **Task Data:** Action items, assignments, due dates
- **Communication Data:** Email addresses, message content, notification preferences

**Data Subjects:**
- Staff members
- External meeting attendees (ICB representatives, contractors)

**Data Sources:**
- User input (calendar, task creation)
- Email systems (EmailJS integration)
- Automated notifications (system-generated)

**Processing Activities:**
- Calendar management and scheduling
- Automated email notifications and reminders
- Task assignment and tracking
- Deadline alerts and escalations

**Retention Period:**
- **Active tasks:** Until completion + 30 days
- **Historical records:** 1 year
- **Email communications:** 6 months (unless part of formal record)

**Access Controls:**
- Users: Own tasks and meetings
- Managers: Team tasks and calendars
- Admin: System-wide operational visibility

**Security Measures:**
- Email encryption in transit (TLS required)
- Access logs for all operational data
- Automated deletion of completed tasks

---

## Part 2: Necessity and Proportionality Assessment

### 2.1 Necessity Assessment

**Is the processing necessary for the stated purposes?**

**YES** - Each processing operation is necessary for:

1. **Legal Compliance:**
   - NHS Complaints Regulations 2009 (complaints handling)
   - Health and Social Care Act 2008 (CQC compliance)
   - GDPR Article 30 (audit logging)
   - Employment law (staff data processing)

2. **Clinical Safety:**
   - Clinical decision support improves patient safety (AI4GP)
   - Accurate meeting records ensure governance oversight
   - Audit trails enable incident investigation

3. **Service Delivery:**
   - Authentication enables secure multi-user access
   - Document storage supports care coordination
   - Operational workflows enhance efficiency

**Could the same objectives be achieved with less data or less intrusive means?**

**Alternative Considered: Paper-based complaints system**
- **Rejected:** Slower, less secure, no audit trail, higher error rates, GDPR compliance harder

**Alternative Considered: Manual transcription instead of AI**
- **Rejected:** Resource-intensive, error-prone, delays in record availability

**Alternative Considered: No AI clinical support**
- **Rejected:** Reduces clinical safety (translation accuracy), increases prescribing errors

**Alternative Considered: On-premises hosting instead of cloud**
- **Rejected:** Higher cost, less resilient, difficult to scale, NHS moving to cloud-first

**Proportionality Conclusion:**
Processing is **proportionate** to the legitimate aims. Data minimisation applied throughout:
- Audio recordings deleted after 7 days
- No patient identifiers in AI queries
- Practice-level data segregation
- Role-based access controls
- Automated deletion workflows

### 2.2 Common Law Duty of Confidentiality

**Compliance Assessment:**

The platform complies with the Common Law Duty of Confidentiality:

✓ **Implied Consent:** Processing for direct care purposes (clinical decision support, complaints handling)  
✓ **Explicit Consent:** Obtained for AI medical translation (patient informed)  
✓ **Statutory Requirement:** Complaints handling mandated by NHS regulations  
✓ **Public Interest:** Overriding public interest in clinical safety and quality improvement

**Caldicott Principles Alignment:**

1. **Justify the purpose:** Each module has documented necessity
2. **Don't use personal data unless absolutely necessary:** Data minimisation applied
3. **Use minimum necessary:** Only required fields collected
4. **Access on a strict need-to-know basis:** RLS and RBAC enforced
5. **Everyone with access has responsibilities:** User training and accountability
6. **Comply with the law:** GDPR and NHS regulations followed
7. **Duty to share information for individual care:** Secure sharing mechanisms provided

### 2.3 NHS Digital Toolkit Alignment

**Data Security and Protection Toolkit (DSPT) Requirements:**

| Assertion | Status | Evidence |
|-----------|--------|----------|
| Staff responsibilities | ✓ | Mandatory data protection training, acceptable use policy |
| Training | ✓ | Annual information governance training for all users |
| Incident reporting | ✓ | Breach notification procedure, ICO reporting workflow |
| Secure transfer | ✓ | TLS 1.3, encrypted email, signed URLs |
| Audit trail | ✓ | Comprehensive logging, 6-year retention |
| Pseudonymisation | ✓ | AI queries anonymised, analytics pseudonymised |
| Encryption | ✓ | AES-256 at rest, TLS 1.3 in transit |

---

## Part 3: Consultation Process

### 3.1 Internal Stakeholder Consultation

**Consulted Parties:**

1. **Data Protection Officer (DPO)**
   - Date consulted: [Date]
   - Feedback: Privacy controls adequate, recommend annual review
   - Action: Annual DPIA review scheduled

2. **Senior Information Risk Owner (SIRO)**
   - Date consulted: [Date]
   - Feedback: Residual risks acceptable, approve deployment
   - Action: Risk register updated

3. **Caldicott Guardian**
   - Date consulted: [Date]
   - Feedback: Patient confidentiality protections robust
   - Action: Patient notification materials approved

4. **Clinical Safety Officer (CSO)**
   - Date consulted: [Date]
   - Feedback: Clinical Safety Case aligned with DPIA
   - Action: Hazard log cross-referenced

5. **Information Governance Lead**
   - Date consulted: [Date]
   - Feedback: DSPT compliance confirmed
   - Action: Evidence portfolio updated

6. **IT Security Manager**
   - Date consulted: [Date]
   - Feedback: Technical controls meet NHS standards
   - Action: Penetration testing scheduled

### 3.2 External Consultation

**Integrated Care Board (ICB) Data Protection Lead:**
- Date consulted: [Date - prior to deployment]
- Purpose: ICB deployment approval
- Feedback: [Pending]

**Patient Representative Group:**
- Date consulted: [Date]
- Purpose: Patient perspective on AI use, transparency
- Feedback: Patients support AI translation if clinician oversight maintained
- Action: Patient information materials updated

### 3.3 Information Commissioner Consultation

**Consultation Required?**

**NO** - Prior consultation with ICO (GDPR Article 36) is not required because:

✓ Residual risks reduced to acceptable levels  
✓ Comprehensive mitigation measures in place  
✓ No high residual risks identified post-mitigation  
✓ DPO confirms controls adequate

**ICO would be consulted if:** High residual risk remained after all mitigations exhausted, or novel processing with unclear GDPR application.

---

## Part 4: Comprehensive Risk Assessment

### 4.1 Risk Assessment Methodology

**Likelihood Scale:**
- **Low:** Unlikely to occur (1-20% probability)
- **Medium:** May occur occasionally (21-50%)
- **High:** Likely to occur (51-80%)
- **Very High:** Almost certain to occur (81-100%)

**Severity Scale (Impact on Data Subjects):**
- **Low:** Minor inconvenience, no lasting impact
- **Medium:** Moderate distress, temporary impact
- **High:** Significant distress, lasting consequences
- **Very High:** Severe harm, irreversible damage

**Risk Score Matrix:**
| Likelihood | Severity | Risk Score |
|------------|----------|------------|
| Very High | Very High | **Critical (25)** |
| High | Very High | **High (20)** |
| High | High | **High (16)** |
| Medium | High | **Medium (12)** |
| Low | High | **Medium (8)** |
| Low | Medium | **Low (4)** |

### 4.2 Privacy Risk Register

---

#### **Risk 1: Unauthorised Access to Patient Records**

**Description:**
Malicious actor or unauthorised staff member gains access to patient identifiable health data, leading to privacy breach and potential harm to patients.

**Likelihood:** HIGH (without controls)  
**Severity:** VERY HIGH (confidential health data exposure)  
**Inherent Risk Score:** 20 (HIGH)

**Current Controls:**
- Row Level Security (RLS) policies enforcing practice-level data segregation
- Role-based access control (RBAC) with least privilege principle
- Multi-factor authentication required for all users
- Account lockout after 5 failed login attempts
- Session timeout after 12 hours inactivity
- Comprehensive access audit logging
- IP-based anomaly detection and alerts
- Regular access reviews (quarterly)

**Residual Likelihood:** MEDIUM  
**Residual Severity:** HIGH  
**Residual Risk Score:** 12 (MEDIUM)

**Additional Measures Required:**
- Implement biometric authentication for high-risk roles (Admin, DPO) - Q1 2026
- Deploy User and Entity Behaviour Analytics (UEBA) for anomaly detection - Q2 2026
- Conduct penetration testing annually - Q1 2026 initial test

**Responsibility:** IT Security Manager  
**Review Date:** Quarterly

---

#### **Risk 2: Data Breach via Third-Party Processor Compromise**

**Description:**
Third-party processor (Supabase, OpenAI, ElevenLabs, EmailJS) suffers security breach, exposing patient data stored or transmitted via their infrastructure.

**Likelihood:** MEDIUM (cloud providers target for attacks)  
**Severity:** VERY HIGH (potential large-scale exposure)  
**Inherent Risk Score:** 15 (HIGH)

**Current Controls:**
- **Supabase:** ISO 27001, SOC 2 Type II certified; UK data residency; DPA executed; RLS policies
- **OpenAI:** Zero-day data retention (contractual); no training on customer data; anonymised inputs
- **ElevenLabs:** Transient processing only; no long-term storage; IDTA in place
- **EmailJS:** Transient email delivery; no data retention; TLS encryption
- **General:** All processors undergo due diligence; regular audit reports reviewed; breach notification clauses in contracts

**Residual Likelihood:** LOW  
**Residual Severity:** HIGH  
**Residual Risk Score:** 8 (MEDIUM)

**Additional Measures Required:**
- Migrate EmailJS to UK-based email service (e.g., Postmark, AWS SES EU) - Q1 2026
- Annual processor audit report review by DPO - Ongoing
- Develop incident response playbook for third-party breaches - Q4 2025

**Responsibility:** DPO, IT Security Manager  
**Review Date:** Annually (processor audit reports)

---

#### **Risk 3: AI-Generated Clinical Errors Leading to Patient Harm**

**Description:**
AI4GP clinical decision support provides inaccurate translation or incorrect prescribing guidance, leading clinician to make incorrect decision and causing patient harm.

**Likelihood:** MEDIUM (AI accuracy not 100%)  
**Severity:** VERY HIGH (potential serious patient harm)  
**Inherent Risk Score:** 15 (HIGH)

**Current Controls:**
- All AI outputs flagged with "AI-generated, verify independently" disclaimer
- Clinician oversight mandatory (human-in-the-loop)
- Clinical Safety Case (DCB0129 compliant) with hazard analysis
- Clinical validation testing (translation accuracy >95%)
- Incident reporting mechanism for AI errors
- Regular model performance monitoring
- Clear liability: Platform assists, does not diagnose
- Patient informed when AI translation used

**Residual Likelihood:** LOW  
**Residual Severity:** VERY HIGH  
**Residual Risk Score:** 10 (MEDIUM)

**Additional Measures Required:**
- Establish clinical reference group for AI output validation - Q4 2025
- Implement automated quality assurance for high-risk medications - Q1 2026
- Quarterly review of AI error reports with CSO - Ongoing
- Patient safety training for all clinicians using AI4GP - Mandatory pre-use

**Responsibility:** Clinical Safety Officer, Medical Director  
**Review Date:** Quarterly (incident review), Annually (full hazard analysis)

---

#### **Risk 4: Inadequate Data Retention Controls Leading to Excessive Storage**

**Description:**
Automated deletion workflows fail, resulting in patient data retained beyond legal/clinical necessity, increasing breach risk and non-compliance.

**Likelihood:** MEDIUM (automation dependency)  
**Severity:** MEDIUM (regulatory non-compliance, increased attack surface)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- Automated retention policies defined in database (triggered deletions)
- Data retention register documenting retention periods per data type
- Quarterly data audits (spot checks for over-retained data)
- Manual review of retention triggers
- Backup retention aligned with retention policy (30 days)

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Implement automated alerting for failed deletion jobs - Q4 2025
- Annual comprehensive data audit by DPO - Q1 2026
- User notification of upcoming deletions (30-day warning) - Q1 2026

**Responsibility:** Data Protection Officer, Database Administrator  
**Review Date:** Quarterly

---

#### **Risk 5: Insufficient Consent for AI Medical Translation**

**Description:**
Patients not adequately informed about AI use in medical translation, leading to invalid consent and potential complaint or regulatory action.

**Likelihood:** MEDIUM (staff training gaps)  
**Severity:** MEDIUM (regulatory action, reputational damage, patient distrust)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- Patient information leaflet on AI use (waiting room poster, website)
- Clinician training on consent requirements
- AI usage flagged in patient record
- Opt-out mechanism available (manual translation requested)
- Transparency: AI outputs clearly labeled

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Develop video explainer on AI translation for patients - Q1 2026
- Audit consent documentation (sample 50 cases per quarter) - Ongoing
- Multilingual patient information materials - Q2 2026

**Responsibility:** Practice Managers, Caldicott Guardian  
**Review Date:** Quarterly

---

#### **Risk 6: Bulk Data Export by Malicious Insider**

**Description:**
Authorised user with legitimate access exports large volumes of patient data for malicious purposes (sale, blackmail, revenge).

**Likelihood:** LOW (background checks, culture)  
**Severity:** VERY HIGH (large-scale breach, criminal activity)  
**Inherent Risk Score:** 10 (MEDIUM)

**Current Controls:**
- Pre-employment screening (DBS checks for clinical staff)
- Audit logging of all data exports (automated alerts for bulk exports >100 records)
- Export functionality limited to authorised roles only
- Export justification required (logged)
- Regular access reviews (quarterly)
- Whistleblowing policy and culture of safety

**Residual Likelihood:** VERY LOW  
**Residual Severity:** VERY HIGH  
**Residual Risk Score:** 8 (MEDIUM)

**Additional Measures Required:**
- Implement Data Loss Prevention (DLP) controls - Q2 2026
- Two-person authorisation for bulk exports >500 records - Q1 2026
- Behavioural analytics (UEBA) to detect anomalous export patterns - Q2 2026

**Responsibility:** HR Director, IT Security Manager  
**Review Date:** Annually (background check policy), Quarterly (access review)

---

#### **Risk 7: Cross-Border Data Transfer to Inadequate Jurisdiction**

**Description:**
Patient data transferred to United States (OpenAI, ElevenLabs) where data protection laws weaker than UK GDPR, exposing data to US government access (CLOUD Act).

**Likelihood:** MEDIUM (transfers occur regularly)  
**Severity:** MEDIUM (lower legal protections, government access risk)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- **Transfer Mechanism:** UK International Data Transfer Agreement (IDTA) and Standard Contractual Clauses
- **Transfer Impact Assessment (TIA):** Completed for US processors
- **Supplementary Measures:** 
  - Data anonymisation (no patient identifiers sent to OpenAI)
  - Zero-day retention (OpenAI does not store customer data)
  - Encryption in transit (TLS 1.3)
  - Contractual prohibition on data access by third parties
- **Patient Notification:** Privacy notice discloses international transfers

**Residual Likelihood:** LOW-MEDIUM  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 6 (MEDIUM)

**Additional Measures Required:**
- Explore EU/UK-based AI alternatives (evaluate annually) - Q3 2026
- Strengthen anonymisation protocols for AI queries - Q4 2025
- Annual TIA review for each US processor - Ongoing

**Responsibility:** Data Protection Officer  
**Review Date:** Annually

---

#### **Risk 8: Insufficient Transparency About Automated Decision-Making**

**Description:**
Data subjects not adequately informed about AI use in decision-making (e.g., prescribing guidance, complaint triage), violating GDPR Article 22 rights.

**Likelihood:** MEDIUM (complex AI processes)  
**Severity:** MEDIUM (regulatory non-compliance, patient distrust)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- Privacy notice explains AI use in accessible language
- AI outputs clearly labeled "AI-generated - verify independently"
- No solely automated decisions (human-in-the-loop for all clinical use)
- Right to request human review of AI-assisted decisions
- Explainability: AI rationale provided where possible (e.g., "prescription not on approved list")

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Develop plain English "How AI Works" explainer page - Q4 2025
- Audit automated processing register (GDPR Article 30) - Q1 2026
- Staff training on GDPR Article 22 rights - Q1 2026

**Responsibility:** Data Protection Officer, Communications Lead  
**Review Date:** Annually

---

#### **Risk 9: Failure to Honour Data Subject Rights (Access, Erasure, Rectification)**

**Description:**
Platform unable to efficiently locate, extract, or delete personal data in response to Subject Access Requests (SARs) or erasure requests, leading to delays or non-compliance.

**Likelihood:** MEDIUM (complex data model, multiple tables)  
**Severity:** MEDIUM (regulatory fines, reputational damage)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- Documented SAR procedure (1-month response time)
- Data mapping register (tables, fields, data subjects)
- Identity verification process for requests
- Database queries prepared for common SAR scenarios
- Exemptions documented (legal obligations, legitimate interests)
- DPO oversight of all SARs

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Develop automated SAR extraction tool (user self-service portal) - Q2 2026
- Conduct SAR drill/test (simulate 10 SARs) - Q1 2026
- Staff training on data subject rights - Q4 2025

**Responsibility:** Data Protection Officer  
**Review Date:** Annually (or after first real SAR)

---

#### **Risk 10: Audio Recording Without Adequate Consent**

**Description:**
Meeting participants not informed or consenting to audio recording, violating privacy expectations and potentially common law confidentiality.

**Likelihood:** MEDIUM (user error, inadequate process)  
**Severity:** MEDIUM (legal claims, reputational damage, regulatory action)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- Explicit recording notification (visual indicator when recording active)
- Meeting agenda states "This meeting will be recorded"
- Verbal consent obtained at start of meeting (recorded in transcript)
- Opt-out mechanism (participant can decline, meeting proceeds without recording)
- Privacy notice explains meeting recording purpose

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Automated consent capture workflow (checkbox confirmation) - Q1 2026
- Meeting recording policy document (distributed to attendees) - Q4 2025
- Audit recording consent compliance (sample 20 meetings per quarter) - Ongoing

**Responsibility:** Practice Managers, Information Governance Lead  
**Review Date:** Quarterly

---

#### **Risk 11: Inadequate Anonymisation of Analytics Data**

**Description:**
Pseudonymised or anonymised data used for analytics (usage patterns, quality metrics) insufficiently de-identified, enabling re-identification of individuals.

**Likelihood:** LOW (small datasets, k-anonymity principles applied)  
**Severity:** HIGH (privacy breach, regulatory action)  
**Inherent Risk Score:** 8 (MEDIUM)

**Current Controls:**
- K-anonymity threshold (minimum 5 individuals per group in analytics)
- Identifier removal (names, NHS numbers, DOBs excluded)
- Aggregation (statistical summaries, no individual-level data)
- Suppression (small cells <5 suppressed)
- Regular re-identification risk assessment

**Residual Likelihood:** VERY LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 3 (LOW)

**Additional Measures Required:**
- Annual re-identification testing by external expert - Q3 2026
- Differential privacy techniques for sensitive metrics - Q2 2026
- Staff training on anonymisation best practices - Q1 2026

**Responsibility:** Data Protection Officer, Data Analyst  
**Review Date:** Annually

---

#### **Risk 12: Insecure Email Communications Containing Patient Data**

**Description:**
Patient identifiable data sent via email without encryption, intercepted in transit or accessed via compromised email account.

**Likelihood:** MEDIUM (user error, non-compliance with policy)  
**Severity:** HIGH (confidentiality breach, regulatory action)  
**Inherent Risk Score:** 12 (MEDIUM)

**Current Controls:**
- TLS encryption required for all email (enforced at SMTP level)
- Email policy prohibits patient identifiers in subject lines
- Secure email gateway (NHS Mail where available)
- Staff training on secure communications
- Audit of email communications (spot checks)

**Residual Likelihood:** LOW  
**Residual Severity:** HIGH  
**Residual Risk Score:** 8 (MEDIUM)

**Additional Measures Required:**
- Implement automated email content scanning (PII detection alerts) - Q1 2026
- Deploy end-to-end encrypted email (S/MIME or PGP) for external comms - Q2 2026
- Quarterly email security training refreshers - Ongoing

**Responsibility:** IT Security Manager, Information Governance Lead  
**Review Date:** Quarterly

---

#### **Risk 13: Loss or Theft of Device Containing Patient Data**

**Description:**
Laptop, tablet, or smartphone with access to platform lost or stolen, enabling unauthorised access if device not adequately secured.

**Likelihood:** MEDIUM (mobile working, device proliferation)  
**Severity:** HIGH (breach of patient data, regulatory reporting required)  
**Inherent Risk Score:** 12 (MEDIUM)

**Current Controls:**
- Device encryption mandatory (BitLocker for Windows, FileVault for macOS)
- Remote wipe capability (MDM enrolled devices)
- Session timeout (12 hours inactivity logs out)
- Multi-factor authentication prevents login from new device without verification
- Acceptable use policy (device security requirements)
- Incident reporting procedure (immediate reporting of lost devices)

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM (data encrypted, session expired)  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Deploy Mobile Device Management (MDM) for all practice-owned devices - Q1 2026
- Geo-fencing alerts for devices outside expected locations - Q2 2026
- Annual device security audit - Q1 2026

**Responsibility:** IT Security Manager  
**Review Date:** Annually

---

#### **Risk 14: Inadequate Backup and Disaster Recovery**

**Description:**
Database failure, ransomware attack, or data centre disaster results in permanent loss of patient data, impacting care continuity and regulatory compliance.

**Likelihood:** LOW (cloud infrastructure resilient)  
**Severity:** VERY HIGH (irreversible data loss, patient harm, regulatory action)  
**Inherent Risk Score:** 10 (MEDIUM)

**Current Controls:**
- Automated daily backups (Supabase managed backups, 30-day retention)
- Geographic redundancy (multi-region replication)
- Point-in-time recovery (restore to any time in last 30 days)
- Backup integrity testing (quarterly restore drills)
- Disaster recovery plan documented (RTO: 4 hours, RPO: 1 hour)
- Ransomware protection (immutable backups, offline copies)

**Residual Likelihood:** VERY LOW  
**Residual Severity:** HIGH  
**Residual Risk Score:** 5 (LOW-MEDIUM)

**Additional Measures Required:**
- Annual disaster recovery exercise (full system restore) - Q2 2026
- Extend backup retention to 90 days for critical data - Q1 2026
- Offsite backup copy to UK-based storage (separate provider) - Q3 2026

**Responsibility:** IT Security Manager, Database Administrator  
**Review Date:** Annually (disaster recovery test)

---

#### **Risk 15: Social Engineering Attack Targeting Staff**

**Description:**
Malicious actor uses phishing, vishing, or pretexting to trick staff into disclosing credentials or patient data.

**Likelihood:** HIGH (phishing attacks common)  
**Severity:** HIGH (credential compromise, data breach)  
**Inherent Risk Score:** 16 (HIGH)

**Current Controls:**
- Annual security awareness training (phishing, social engineering)
- Simulated phishing campaigns (quarterly)
- Email filtering and anti-phishing tools
- Verification procedures for data disclosure requests
- Incident reporting culture (report suspicious emails)
- Multi-factor authentication (limits impact of compromised passwords)

**Residual Likelihood:** MEDIUM  
**Residual Severity:** MEDIUM (MFA limits damage)  
**Residual Risk Score:** 9 (MEDIUM)

**Additional Measures Required:**
- Monthly micro-training (5-minute security tips) - Q1 2026
- Advanced email threat protection (AI-based phishing detection) - Q2 2026
- Incident response drill for phishing compromise - Q1 2026

**Responsibility:** IT Security Manager, HR Lead  
**Review Date:** Quarterly (simulated phishing results)

---

#### **Risk 16: Insufficient Logging for Forensic Investigation**

**Description:**
Security incident or data breach occurs, but inadequate audit logs prevent effective investigation, root cause analysis, or regulatory reporting.

**Likelihood:** LOW (comprehensive logging implemented)  
**Severity:** HIGH (unable to determine breach scope, regulatory criticism)  
**Inherent Risk Score:** 8 (MEDIUM)

**Current Controls:**
- Comprehensive audit logging (all access, modifications, authentications)
- 6-year log retention (exceeds regulatory minimum)
- Tamper-evident logs (append-only, cryptographic hashing)
- Log aggregation and SIEM integration (planned)
- Regular log review (weekly automated alerts, monthly manual review)

**Residual Likelihood:** VERY LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 3 (LOW)

**Additional Measures Required:**
- Deploy Security Information and Event Management (SIEM) system - Q2 2026
- Forensic log analysis training for incident response team - Q1 2026
- Annual penetration test to validate log coverage - Q1 2026

**Responsibility:** IT Security Manager, DPO  
**Review Date:** Annually

---

#### **Risk 17: Vendor Lock-In and Data Portability Challenges**

**Description:**
Over-reliance on Supabase platform makes data migration difficult, risking patient data availability if service disrupted or commercial relationship ends.

**Likelihood:** LOW (Supabase stable, open-source foundation)  
**Severity:** MEDIUM (service disruption, migration complexity)  
**Inherent Risk Score:** 4 (LOW)

**Current Controls:**
- Open-source technology stack (PostgreSQL, PostgREST)
- Standard SQL database (portable to any PostgreSQL host)
- Automated daily exports to CSV/JSON (offline backup)
- Data portability procedure documented
- Exit plan prepared (migration to alternative cloud provider or on-premises)

**Residual Likelihood:** VERY LOW  
**Residual Severity:** LOW  
**Residual Risk Score:** 2 (LOW)

**Additional Measures Required:**
- Annual data portability test (restore to test environment) - Q3 2026
- Maintain relationships with alternative cloud providers - Ongoing
- Review vendor financial stability annually - Q1 2026

**Responsibility:** CTO, Database Administrator  
**Review Date:** Annually

---

#### **Risk 18: AI Bias Leading to Health Inequalities**

**Description:**
AI models used for translation or clinical decision support exhibit bias (e.g., language, ethnicity, socioeconomic), disadvantaging certain patient groups.

**Likelihood:** MEDIUM (inherent AI bias risk)  
**Severity:** HIGH (health inequalities, discrimination, regulatory action)  
**Inherent Risk Score:** 12 (MEDIUM)

**Current Controls:**
- Bias testing during AI model selection (translation accuracy across languages)
- Human oversight for all AI-assisted decisions
- Equality impact assessment (EIA) conducted
- Patient feedback mechanism to report AI errors or concerns
- Regular model performance monitoring by demographic group

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM (human oversight mitigates impact)  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Establish AI Ethics Committee with patient representatives - Q1 2026
- Quarterly bias audits (stratified by language, ethnicity, age) - Ongoing
- Develop AI fairness metrics dashboard - Q2 2026
- Patient-facing AI transparency report (annual) - Q4 2026

**Responsibility:** Clinical Safety Officer, Equality Lead  
**Review Date:** Quarterly

---

#### **Risk 19: Non-Compliance with Accessibility Requirements**

**Description:**
Platform not accessible to users with disabilities (visual, hearing, motor, cognitive), excluding staff or limiting patient engagement, violating Equality Act 2010.

**Likelihood:** MEDIUM (accessibility often overlooked)  
**Severity:** MEDIUM (discrimination, legal claims, exclusion)  
**Inherent Risk Score:** 9 (MEDIUM)

**Current Controls:**
- WCAG 2.1 AA compliance target
- Screen reader compatibility (semantic HTML, ARIA labels)
- Keyboard navigation support
- Accessibility testing during development
- User feedback mechanism for accessibility issues

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Annual third-party accessibility audit - Q2 2026
- User testing with disabled staff and patients - Q1 2026
- Accessibility training for development team - Q4 2025
- Publish accessibility statement (WCAG compliance) - Q4 2025

**Responsibility:** Product Manager, Development Lead  
**Review Date:** Annually

---

#### **Risk 20: Inadequate Incident Response Capability**

**Description:**
Data breach or security incident occurs, but organisation lacks capability to respond effectively, leading to delayed containment, notification failures, and regulatory criticism.

**Likelihood:** MEDIUM (incident response complex)  
**Severity:** HIGH (breach escalation, regulatory fines, reputational damage)  
**Inherent Risk Score:** 12 (MEDIUM)

**Current Controls:**
- Incident response plan documented (roles, procedures, escalation)
- Breach notification procedure (ICO within 72 hours, data subjects if high risk)
- DPO designated as incident coordinator
- Contact details for ICO, NHS Digital, NCSC maintained
- Incident response training for key staff

**Residual Likelihood:** LOW  
**Residual Severity:** MEDIUM (plan in place, training reduces errors)  
**Residual Risk Score:** 4 (LOW)

**Additional Measures Required:**
- Annual incident response tabletop exercise - Q1 2026
- Cyber insurance policy reviewed and updated - Q4 2025
- Establish incident response retainer with external forensics firm - Q1 2026
- Post-incident review process (lessons learned) - Ongoing

**Responsibility:** DPO, IT Security Manager  
**Review Date:** Annually (tabletop exercise), After each incident

---

### 4.3 Risk Summary

| Risk Score | Count | Percentage |
|------------|-------|------------|
| Critical (25) | 0 | 0% |
| High (16-24) | 0 | 0% |
| Medium (8-15) | 6 | 30% |
| Low (1-7) | 14 | 70% |

**Conclusion:**
No critical or high residual risks remain after implementation of comprehensive controls. Medium risks managed through additional measures with clear timelines and responsibilities. Low risks monitored through regular reviews.

**Overall Residual Risk:** **MEDIUM** - Acceptable for deployment with ongoing monitoring and annual review.

---

## Part 5: Data Protection by Design and Default

### 5.1 Technical Measures

#### Access Controls
- **Row Level Security (RLS):** Database-level enforcement of practice boundaries (users see only their practice data)
- **Role-Based Access Control (RBAC):** Granular permissions (read, write, delete, admin) per module
- **Least Privilege Principle:** Users granted minimum access necessary for role
- **Multi-Factor Authentication (MFA):** Email verification required for all users
- **Session Management:** 12-hour timeout, device fingerprinting, IP anomaly detection

#### Encryption
- **At Rest:** AES-256 encryption for database, file storage, backups
- **In Transit:** TLS 1.3 for all API communications, enforced minimum version
- **End-to-End:** Considered for future email implementation (S/MIME)

#### Pseudonymisation & Anonymisation
- **AI Queries:** Patient identifiers removed before external API calls
- **Analytics:** K-anonymity (minimum 5 individuals per group), suppression of small cells
- **Audit Logs:** User IDs pseudonymised for analytics, reversible for investigations

#### Data Minimisation
- **Audio Recordings:** Deleted after 7 days (transcription only retained)
- **Meeting Attendees:** Only name and role collected (no DOB, address)
- **AI4GP:** No patient identifiers sent to OpenAI
- **Form Fields:** Optional fields clearly marked, only mandatory data required

#### Purpose Limitation
- **Module Segregation:** Complaints data not accessible from meeting module
- **Access Justification:** Bulk exports require stated purpose (logged)
- **API Scoping:** Third-party integrations limited to specific data types

#### Storage Limitation
- **Automated Deletion:** Retention policies enforced at database level (triggered jobs)
- **User Notifications:** 30-day warning before automated deletion
- **Retention Register:** Documented retention periods per data type
- **Backup Alignment:** Backups retained 30 days (aligned with operational needs)

#### Integrity & Confidentiality
- **Audit Trails:** Comprehensive logging of all data access and modifications
- **Version Control:** Historical versions retained for policies and templates
- **Tamper Evidence:** Append-only logs, cryptographic hashing
- **Input Validation:** All user inputs sanitised (SQL injection, XSS prevention)

### 5.2 Organisational Measures

#### Governance
- **Data Protection Officer (DPO):** Dedicated DPO with direct access to senior management
- **Privacy Steering Group:** Quarterly meetings (DPO, SIRO, Caldicott Guardian, CSO, IT Security)
- **Policy Framework:** Data protection policy, acceptable use policy, breach response policy
- **Accountability:** Clear responsibilities for data protection in job descriptions

#### Training & Awareness
- **Mandatory Training:** Annual information governance training for all users
- **Role-Specific Training:** Clinical safety for AI4GP users, secure email for admin staff
- **Simulated Phishing:** Quarterly campaigns to test awareness
- **Privacy Champions:** Designated staff in each practice

#### Incident Management
- **Breach Notification:** 72-hour ICO reporting procedure, high-risk data subject notification
- **Incident Response Plan:** Documented roles, escalation, forensic investigation
- **Lessons Learned:** Post-incident review process, hazard log updates

#### Contracts & Agreements
- **Data Processing Agreements (DPAs):** Executed with all third-party processors
- **International Data Transfer Agreements (IDTAs):** In place for US processors
- **Service Level Agreements (SLAs):** Availability, incident response times
- **Right to Audit:** Contractual right to audit processors

#### Monitoring & Review
- **Quarterly Access Reviews:** User accounts, role assignments, practice affiliations
- **Annual DPIA Review:** Triggered by material changes or annually
- **Penetration Testing:** Annual external testing, quarterly vulnerability scans
- **Log Review:** Weekly automated alerts, monthly manual sampling

---

## Part 6: Third-Party Data Processor Assessment

### 6.1 Supabase (Database & Infrastructure)

**Processor Details:**
- **Name:** Supabase Inc.
- **Role:** Database hosting, authentication, storage, realtime subscriptions
- **Location:** Configurable (EU/UK data centres available, UK selected)
- **Data Processed:** All platform data (patient records, staff data, audit logs)

**Certifications:**
- ISO/IEC 27001:2013 (Information Security Management)
- SOC 2 Type II (Security, Availability, Confidentiality)
- GDPR compliant (EU operations)

**Due Diligence:**
- **DPA Status:** ✓ UK GDPR-compliant Data Processing Agreement executed
- **Sub-Processors:** AWS (also ISO 27001, SOC 2 certified; adequacy decision for EU)
- **Data Residency:** UK-only hosting configured (London data centre)
- **Encryption:** AES-256 at rest, TLS 1.3 in transit (enforced)
- **Access Controls:** Customer-managed RLS policies, Supabase staff no direct data access without authorisation
- **Backup:** Automated daily backups, 30-day retention, point-in-time recovery
- **Incident Response:** 24/7 security operations centre, <4 hour response SLA for critical incidents
- **Audit Rights:** Annual SOC 2 reports provided, customer right to audit on request
- **Breach Notification:** Contractual obligation to notify within 24 hours

**Security Measures:**
- Infrastructure-level DDoS protection
- Web Application Firewall (WAF)
- Regular penetration testing (annual)
- Vulnerability scanning (continuous)
- Security patch management (automated)

**Risk Assessment:** **LOW**
- Established cloud provider with strong security posture
- UK data residency eliminates international transfer concerns
- Open-source foundation (PostgreSQL) enables portability
- SOC 2 Type II provides independent assurance

**Additional Mitigations:**
- Customer-side RLS policies (defence in depth)
- Encrypted backups exported to separate UK storage - Q1 2026
- Annual review of Supabase SOC 2 reports by DPO

---

### 6.2 OpenAI (AI Content Generation)

**Processor Details:**
- **Name:** OpenAI, L.L.C.
- **Role:** AI-powered medical translation, clinical knowledge base, content generation
- **Location:** United States (servers in US data centres)
- **Data Processed:** Anonymised clinical queries (no patient identifiers), meeting summaries

**Certifications:**
- SOC 2 Type II (Security, Confidentiality)
- ISO/IEC 27001:2013
- GDPR-aware (data processing terms available)

**Due Diligence:**
- **DPA Status:** ✓ Business agreement with GDPR-compliant data protection terms
- **Transfer Mechanism:** UK International Data Transfer Agreement (IDTA) or Standard Contractual Clauses (SCCs)
- **Data Retention:** **Zero-day retention** - API calls not used to train models, no customer data stored
- **Data Minimisation:** Patient identifiers removed before API calls (anonymised clinical scenarios only)
- **Encryption:** TLS 1.3 for all API communications
- **Access Controls:** API key-based authentication, usage monitoring
- **Sub-Processors:** Microsoft Azure (for API hosting)
- **Audit Rights:** Annual security reports provided

**Transfer Impact Assessment (TIA):**
- **US CLOUD Act Risk:** Medium - US government could theoretically compel data access
- **Mitigation:** No patient identifiers transferred, zero-day retention means no data to access
- **Adequacy:** No adequacy decision for US, reliance on SCCs + supplementary measures
- **Supplementary Measures:** 
  - Data anonymisation (primary protection)
  - Contractual prohibition on third-party access
  - Encryption in transit
  - Zero-day retention guarantee

**Security Measures:**
- API rate limiting (abuse prevention)
- Content filtering (inappropriate content detection)
- Model safeguards (bias testing, red teaming)

**Risk Assessment:** **MEDIUM**
- International transfer to non-adequate jurisdiction
- Mitigated by anonymisation and zero-day retention
- Clinical oversight required (AI outputs not solely relied upon)

**Additional Mitigations:**
- Annual review of OpenAI security reports by DPO
- Explore EU/UK-based AI alternatives (evaluate in Q3 2026)
- Enhanced anonymisation protocols for all AI queries - Q4 2025
- Clinical validation testing quarterly

---

### 6.3 ElevenLabs (Voice Synthesis & Translation)

**Processor Details:**
- **Name:** ElevenLabs Inc.
- **Role:** Text-to-speech voice synthesis for AI4GP patient-facing translations
- **Location:** United States / Europe (hybrid infrastructure)
- **Data Processed:** Text strings for audio generation (no patient identifiers)

**Certifications:**
- Enterprise-grade security (specifics under NDA)
- GDPR-aware processing

**Due Diligence:**
- **DPA Status:** ✓ Enterprise Data Processing Agreement executed
- **Transfer Mechanism:** UK IDTA for US processing
- **Data Retention:** Transient processing only (audio generated on-demand, not stored long-term)
- **Data Minimisation:** Text input only (e.g., "Take this medication twice daily"), no medical records
- **Encryption:** TLS 1.3 in transit, generated audio delivered via HTTPS
- **Use Case:** **Non-clinical** - UI/UX enhancement only, not used for diagnosis or treatment decisions

**Transfer Impact Assessment (TIA):**
- **Risk:** LOW-MEDIUM - Text-only, no patient identifiers, transient processing
- **Mitigation:** No sensitive data sent (generic medical instructions only)
- **Adequacy:** Reliance on IDTA + data minimisation

**Security Measures:**
- API authentication (key-based)
- Rate limiting
- Content filtering

**Risk Assessment:** **LOW**
- Transient processing (no long-term storage)
- Non-clinical use case (enhances accessibility, not clinically critical)
- No patient identifiable data processed

**Additional Mitigations:**
- Review alternative UK/EU voice synthesis providers annually - Q3 2026
- Monitor usage logs for anomalies - Ongoing

---

### 6.4 EmailJS (Email Delivery)

**Processor Details:**
- **Name:** EmailJS Ltd.
- **Role:** Email delivery service for meeting minutes, notifications
- **Location:** United States (email relay servers)
- **Data Processed:** Email addresses, message content (meeting summaries, action items)

**Certifications:**
- Not applicable (small SaaS provider, no formal certifications)

**Due Diligence:**
- **DPA Status:** ✓ Standard DPA provided via Terms of Service
- **Transfer Mechanism:** Standard Contractual Clauses (SCCs)
- **Data Retention:** Transient (email delivered and not stored long-term by EmailJS)
- **Encryption:** TLS for email transmission (recipient server must support)
- **Data Content:** Meeting summaries may contain patient references (risk)

**Transfer Impact Assessment (TIA):**
- **Risk:** MEDIUM - Email content may contain identifiable information
- **Mitigation:** Limited by use case (internal team communications), TLS encryption
- **Adequacy:** No adequacy decision for US, reliance on SCCs

**Security Measures:**
- Email authentication (SPF, DKIM configured)
- TLS enforcement where supported

**Risk Assessment:** **LOW-MEDIUM**
- Transient processing (emails not stored by EmailJS)
- Content risk (meeting summaries may reference patients)
- Lack of formal security certifications (small provider)

**Additional Mitigations Required:**
- **Priority:** Migrate to UK-based email service (e.g., Postmark, AWS SES EU region) - **Q1 2026**
- Implement email content scanning (PII detection warnings) - Q1 2026
- Redaction workflow for patient references in emails - Q4 2025

---

### 6.5 Processor Comparison Matrix

| Processor | Location | Certification | DPA | Data Retention | Risk Rating |
|-----------|----------|---------------|-----|----------------|-------------|
| Supabase | UK | ISO 27001, SOC 2 | ✓ | 30 days (backups) | **LOW** |
| OpenAI | US | SOC 2 | ✓ | Zero-day | **MEDIUM** |
| ElevenLabs | US/EU | Enterprise security | ✓ | Transient | **LOW** |
| EmailJS | US | None | ✓ | Transient | **LOW-MEDIUM** |

**Overall Processor Risk:** **MEDIUM** (driven by OpenAI international transfer and EmailJS lack of certifications)

**Mitigation Strategy:**
1. Priority: Replace EmailJS with UK provider - Q1 2026
2. Ongoing: Annual processor audit report reviews
3. Continuous: Explore UK/EU AI alternatives

---

## Part 7: International Data Transfers

### 7.1 Transfers Overview

| Processor | Destination | Transfer Mechanism | Data Type | Volume |
|-----------|-------------|-------------------|-----------|--------|
| OpenAI | United States | UK IDTA + SCCs | Anonymised clinical queries | ~1000/month |
| ElevenLabs | United States | UK IDTA | Text for voice synthesis | ~500/month |
| EmailJS | United States | SCCs | Email content | ~200/month |

### 7.2 Transfer Impact Assessments (TIAs)

#### OpenAI - United States

**Legal Framework Analysis:**
- **US Privacy Law:** No federal data protection law equivalent to GDPR
- **CLOUD Act:** US government can compel data disclosure from US companies (national security, law enforcement)
- **Section 702 FISA:** Permits surveillance of non-US persons

**Risk Assessment:**
- **Government Access Risk:** Medium (US CLOUD Act applies)
- **Data Sensitivity:** Low (anonymised data only)
- **Volume:** Medium (regular API calls)

**Supplementary Measures:**
- **Technical:** Data anonymisation (no patient identifiers), encryption in transit (TLS 1.3)
- **Contractual:** Zero-day retention (no data for US government to access), prohibition on third-party disclosure
- **Organisational:** Clinical oversight (human review of AI outputs), regular security audits

**Data Subject Notification:**
Privacy notice discloses OpenAI use and US transfer, purpose explained

**Conclusion:** Transfer permissible with supplementary measures. Anonymisation and zero-day retention substantially reduce risks.

---

#### ElevenLabs - United States/Europe

**Legal Framework Analysis:**
- **US Processing:** Same CLOUD Act risks as OpenAI
- **EU Processing:** Where EU servers used, adequacy decision applies (lower risk)

**Risk Assessment:**
- **Government Access Risk:** Low-Medium (text-only, non-clinical)
- **Data Sensitivity:** Low (generic medical instructions, no patient identifiers)
- **Volume:** Low (patient-facing use only)

**Supplementary Measures:**
- **Technical:** Data minimisation (text-only input), transient processing
- **Contractual:** IDTA in place, no long-term storage
- **Organisational:** Non-clinical use case (accessibility enhancement)

**Conclusion:** Transfer permissible. Low risk given data minimisation and non-clinical use.

---

#### EmailJS - United States

**Legal Framework Analysis:**
- **US Processing:** CLOUD Act applies
- **Email Content:** May contain patient references (meeting summaries)

**Risk Assessment:**
- **Government Access Risk:** Medium (email content potentially identifiable)
- **Data Sensitivity:** Medium (meeting summaries, patient discussions)
- **Volume:** Low (internal team communications)

**Supplementary Measures:**
- **Technical:** TLS encryption in transit
- **Contractual:** SCCs in place, transient processing
- **Organisational:** Email policy (minimise patient identifiers in emails)

**Conclusion:** Transfer currently permissible but higher risk. **Migration to UK provider recommended** (Q1 2026).

---

### 7.3 Ongoing Transfer Monitoring

- **Annual TIA Review:** Each processor reassessed annually by DPO
- **Legal Developments:** Monitor EU/UK adequacy decisions, US privacy law changes
- **Processor Changes:** Any change in processor location or sub-processors triggers TIA update
- **Data Subject Complaints:** Mechanism to raise concerns about international transfers

---

## Part 8: Data Subject Rights Implementation

### 8.1 Right of Access (Subject Access Requests - SARs)

**Procedure:**
1. **Receipt:** SAR received via email (dpo@gpnotewell.co.uk) or written request
2. **Verification:** Identity verified (photo ID + proof of address, or NHS smartcard)
3. **Search:** Data mapping register consulted, database queries executed
4. **Compilation:** Personal data extracted (all tables, files, emails, audit logs)
5. **Redaction:** Third-party data redacted (e.g., other patients, staff personal opinions)
6. **Delivery:** Provided in commonly used electronic format (PDF, CSV) or hard copy if requested
7. **Timeline:** 1 month from receipt (extendable to 2 months if complex, with notification)

**Exemptions:**
- Legal privilege (ongoing litigation)
- Manifestly unfounded or excessive requests (may charge fee or refuse)
- Third-party rights (redaction of others' personal data)

**Tooling:**
- Database queries prepared for common SAR scenarios (patient records, staff data)
- Future: Automated SAR portal (self-service data export) - Q2 2026

---

### 8.2 Right to Rectification

**Procedure:**
1. **Request:** Data subject identifies inaccurate or incomplete data
2. **Verification:** Request validity assessed (e.g., medical record correction requires clinical review)
3. **Correction:** Data updated in database, historical versions retained with audit trail
4. **Notification:** Third parties notified if data shared (e.g., ICB, other practices)
5. **Timeline:** 1 month from receipt

**Special Consideration - Clinical Records:**
- Medical record corrections require clinician approval (safety)
- Original entry retained (addendum added rather than deletion)
- Audit trail preserved (regulatory requirement)

---

### 8.3 Right to Erasure ("Right to be Forgotten")

**Procedure:**
1. **Request:** Data subject requests deletion of personal data
2. **Assessment:** Legal basis for retention evaluated
3. **Decision:** Erasure granted if no legal obligation to retain
4. **Deletion:** Data permanently deleted from database, backups purged at next retention cycle
5. **Confirmation:** Data subject notified of deletion
6. **Timeline:** 1 month from receipt

**Exemptions (Retention Required):**
- **Legal Obligation:** NHS Records Management Code (10-year retention for patient records)
- **Public Interest:** Clinical governance, quality improvement
- **Legal Claims:** Potential litigation (complaints, incidents)
- **Archiving:** Public interest research (anonymised)

**Example Scenarios:**
- **Patient record during 10-year retention:** **Refused** (legal obligation)
- **Complaint record after resolution:** **Granted** (if beyond retention period)
- **Staff employment data post-termination:** **Granted** (if beyond 6-year retention)

---

### 8.4 Right to Restriction of Processing

**Procedure:**
1. **Request:** Data subject requests processing limitation (e.g., during accuracy dispute)
2. **Assessment:** Grounds for restriction evaluated
3. **Restriction:** Data flagged as "restricted" (storage only, no active processing)
4. **Notification:** Third parties notified if data shared
5. **Lifting:** Restriction lifted when grounds resolved, data subject notified
6. **Timeline:** 1 month from receipt

**Grounds for Restriction:**
- Accuracy dispute (restriction until verified)
- Unlawful processing (data subject prefers restriction to erasure)
- Legal claim defence (data subject requires data retention)

---

### 8.5 Right to Data Portability

**Procedure:**
1. **Request:** Data subject requests data in portable format
2. **Scope:** Personal data provided by data subject (excludes derived/inferred data)
3. **Format:** Commonly used electronic format (JSON, CSV, XML)
4. **Delivery:** Secure transfer to data subject or directly to another controller (if technically feasible)
5. **Timeline:** 1 month from receipt

**Applicable Data:**
- Patient demographics (name, DOB, contact details)
- User-generated content (notes, comments)
- **Excludes:** AI-generated content, audit logs, derived analytics

---

### 8.6 Right to Object

**Procedure:**
1. **Request:** Data subject objects to processing based on legitimate interests or public task
2. **Assessment:** Compelling legitimate grounds evaluated
3. **Decision:** Processing ceased unless overriding legitimate grounds demonstrated
4. **Timeline:** 1 month from receipt

**Grounds for Objection:**
- Processing based on legitimate interests (Article 6(1)(f))
- Processing for public task (Article 6(1)(e))
- **Not applicable:** Processing for legal obligation, contract performance

**Example:**
- **Marketing emails:** Objection granted immediately (cease processing)
- **Clinical governance:** Objection likely refused (overriding public interest in patient safety)

---

### 8.7 Rights Related to Automated Decision-Making

**GDPR Article 22 Compliance:**

**Automated Decisions in Platform:**
- **AI4GP clinical support:** NOT solely automated (human-in-the-loop required)
- **Complaint triage:** NOT automated (manual review and assignment)
- **Prescribing policy checks:** Automated flagging only (clinician makes final decision)

**Data Subject Rights:**
- **Right to human intervention:** Any AI-assisted decision can be reviewed by human
- **Right to explanation:** AI rationale provided (e.g., "drug not on approved list because...")
- **Right to contest:** Mechanism to challenge AI output

**Safeguards:**
- All AI outputs flagged "AI-generated - verify independently"
- No solely automated clinical decisions
- Transparency in privacy notice

---

### 8.8 Response Timeline & Fees

| Right | Standard Timeline | Extended Timeline | Fee |
|-------|-------------------|-------------------|-----|
| Access (SAR) | 1 month | 2 months (complex) | Free (unless manifestly unfounded) |
| Rectification | 1 month | 2 months (complex) | Free |
| Erasure | 1 month | 2 months (complex) | Free |
| Restriction | 1 month | - | Free |
| Portability | 1 month | 2 months (complex) | Free |
| Objection | 1 month | - | Free |

**Manifestly Unfounded/Excessive Requests:**
- Charge reasonable fee based on administrative costs (up to £150)
- Or refuse to act (with justification provided)

---

## Part 9: Breach Notification Procedures

### 9.1 Detection & Assessment

**Detection Mechanisms:**
- Security monitoring (automated alerts for anomalies)
- Audit log review (weekly automated, monthly manual)
- User reports (incident reporting mechanism)
- Third-party processor notifications (24-hour contractual SLA)
- Penetration test findings

**Immediate Actions (within 1 hour):**
1. Contain breach (disable compromised account, isolate affected system)
2. Preserve evidence (isolate logs, take snapshots)
3. Notify DPO immediately
4. Initiate incident response plan

**Assessment Criteria (within 24 hours):**
- **Scope:** Number of data subjects affected, data categories involved
- **Severity:** Sensitivity of data (patient health data = high severity)
- **Cause:** Malicious attack, human error, system failure, third-party compromise
- **Likelihood of Harm:** Realistic risk to data subjects (identity theft, discrimination, distress)
- **Reportability:** Does breach require ICO notification and/or data subject notification?

### 9.2 ICO Notification (72 Hours)

**Reportable Breaches:**
Any breach likely to result in risk to data subjects' rights and freedoms (GDPR Article 33)

**Examples of Reportable Breaches:**
- Unauthorised access to patient records (>10 individuals)
- Ransomware encryption of clinical data
- Email sent to wrong recipient containing patient information
- Lost/stolen unencrypted device with patient data
- Third-party processor breach affecting patient data

**Notification Content (ICO template):**
1. Description of breach (nature, categories of data, approximate number of data subjects)
2. DPO contact details
3. Likely consequences for data subjects
4. Measures taken or proposed to address breach and mitigate harm
5. Measures to prevent recurrence

**Notification Method:**
- ICO online reporting tool: https://ico.org.uk/for-organisations/report-a-breach/
- Timeline: Within 72 hours of becoming aware (if delayed, justification required)

**Phased Notification:**
If full information not available within 72 hours, initial notification submitted with updates to follow.

### 9.3 Data Subject Notification

**Criteria for Data Subject Notification:**
Breach likely to result in **high risk** to data subjects (GDPR Article 34)

**Examples of High-Risk Breaches:**
- Financial data exposed (risk of fraud)
- Special category data widely exposed (health, ethnicity, religious beliefs)
- Data compromised by malicious actor (risk of identity theft, blackmail)
- Children's data involved

**Notification Content:**
1. Description of breach in clear, plain language
2. DPO contact details for further information
3. Likely consequences
4. Measures taken to mitigate harm
5. Recommended actions for data subjects (e.g., password reset, credit monitoring)

**Notification Method:**
- Direct communication (email, letter, phone) to each affected data subject
- Public announcement (if contact details unavailable or disproportionate effort)
- Timeline: Without undue delay

**Exceptions (No Data Subject Notification Required):**
- Encryption/pseudonymisation renders data unintelligible (low risk)
- Measures taken to ensure high risk no longer likely (e.g., immediate containment)
- Disproportionate effort (large-scale breach, public announcement alternative)

### 9.4 Breach Log Maintenance

**Mandatory Documentation (GDPR Article 33(5)):**

Every breach documented regardless of reportability:

| Field | Description |
|-------|-------------|
| Breach ID | Unique identifier (e.g., BREACH-2025-001) |
| Detection Date/Time | When breach discovered |
| Breach Type | Unauthorised access, loss, alteration, disclosure |
| Data Categories | Patient data, staff data, administrative |
| Number of Data Subjects | Approximate count |
| Cause | Malicious attack, human error, system failure |
| Containment Actions | Steps taken to stop breach |
| ICO Notification | Yes/No, date, reference number |
| Data Subject Notification | Yes/No, date, method |
| Lessons Learned | Root cause analysis, preventive measures |
| Status | Open, Contained, Closed |

**Retention:** 6 years (regulatory requirement)

**Review:** Quarterly breach log review by Privacy Steering Group

### 9.5 Post-Breach Actions

**Root Cause Analysis:**
- Incident response team debrief within 5 working days
- Technical investigation (forensic analysis if necessary)
- Human factors review (training gaps, process failures)

**Corrective Actions:**
- System patches or configuration changes
- Enhanced monitoring or access controls
- Staff retraining or disciplinary action
- Policy updates

**Regulatory Engagement:**
- ICO follow-up (respond to queries, provide evidence of remediation)
- NHS Digital notification (if NHS data involved)
- Integrated Care Board notification (for deployed services)

**Communication:**
- Internal communication (lessons learned, staff briefing)
- External communication (patients, press, stakeholders if high-profile)

---

## Part 10: Compliance Monitoring & Review

### 10.1 DPIA Review Schedule

**Mandatory Review Triggers:**

1. **Annual Review:** Every 12 months from sign-off date (17th November 2026)
2. **Material Changes:**
   - New processing activities or modules
   - Changes to third-party processors or sub-processors
   - International transfers to new jurisdictions
   - Changes in data protection law (e.g., new ICO guidance)
   - Significant security incidents or near-misses
   - New technologies (e.g., additional AI models)
   - Organisational changes (merger, acquisition, restructure)
3. **Regulatory Requests:** ICO, NHS Digital, ICB requests for review
4. **Data Subject Complaints:** Pattern of complaints indicating privacy issues

**Review Process:**
1. DPO initiates review (triggers identified)
2. Risk register reassessed (new risks, changed likelihoods/severities)
3. Control effectiveness reviewed (are mitigations working?)
4. Stakeholder consultation (SIRO, Caldicott Guardian, CSO)
5. DPIA updated (version control, change log)
6. Re-approval by governance committee
7. Communication to staff and data subjects (if material changes)

### 10.2 Monitoring Metrics (Key Performance Indicators)

**Privacy KPIs:**

| Metric | Target | Frequency |
|--------|--------|-----------|
| SAR response time | <1 month | Monthly |
| Data breaches (reportable) | 0 per year | Monthly |
| Access reviews completed | 100% quarterly | Quarterly |
| Staff training completion | >95% | Annually |
| Audit log review | 100% weekly | Weekly |
| Automated deletion success rate | >99% | Monthly |
| Third-party audit reports reviewed | 100% | Annually |

**Reporting:**
- Monthly privacy dashboard to Privacy Steering Group
- Quarterly report to Board (high-level summary)
- Annual report to ICB (deployment sites)

### 10.3 Audit & Assurance

**Internal Audits:**
- Annual privacy audit by internal audit function or DPO
- Scope: Compliance with DPIA commitments, policy adherence, control effectiveness
- Findings: Reported to SIRO and Board, action plans tracked

**External Audits:**
- Penetration testing (annual) by CREST-accredited provider
- DSPT assessment (annual) - NHS Digital toolkit
- ICB pre-deployment audit (prior to go-live at each site)
- Cyber Essentials Plus certification (Q2 2026 target)

**Processor Audits:**
- Annual review of processor SOC 2 / ISO 27001 reports
- Right to audit exercised if concerns arise
- Sub-processor notifications reviewed (any changes require risk assessment)

### 10.4 Continuous Improvement

**Feedback Mechanisms:**
- Data subject feedback (privacy concerns, SAR experience)
- Staff feedback (usability of privacy controls, training effectiveness)
- Incident lessons learned (post-breach improvements)
- Regulatory guidance (ICO, NHS Digital updates incorporated)

**Technology Evolution:**
- Privacy-enhancing technologies (PETs) evaluated annually
- Encryption standards reviewed (quantum-resistant algorithms considered)
- AI governance frameworks updated (emerging best practices)

**Benchmarking:**
- Comparison with peer organisations (other PCN service providers)
- Industry standards (NHS Digital best practices, ICO guidance)
- International standards (ISO 27701 Privacy Information Management)

---

## Part 11: Sign-Off and Approval

### 11.1 Approval Requirements

This DPIA requires approval from the following stakeholders before the platform is deployed:

| Role | Name | Organisation | Signature | Date |
|------|------|--------------|-----------|------|
| **Data Protection Officer** | [DPO Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **Senior Information Risk Owner (SIRO)** | [SIRO Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **Caldicott Guardian** | [Caldicott Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **Clinical Safety Officer** | [CSO Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **Information Governance Lead** | [IG Lead Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **Chief Technology Officer** | [CTO Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **Medical Director** | [Medical Director Name] | PCN Services Ltd | _______________ | ____/____/____ |
| **ICB Data Protection Lead** | [ICB DPO Name] | [ICB Name] | _______________ | ____/____/____ |

### 11.2 Approval Statements

**Data Protection Officer:**
"I confirm that this DPIA adequately identifies and mitigates privacy risks, and that the residual risks are acceptable. The processing operations comply with UK GDPR and Data Protection Act 2018."

Signed: _______________ Date: ____/____/____

---

**Senior Information Risk Owner (SIRO):**
"I confirm that information security risks have been assessed and are managed to an acceptable level. I approve deployment of this platform subject to ongoing monitoring and annual review."

Signed: _______________ Date: ____/____/____

---

**Caldicott Guardian:**
"I confirm that patient confidentiality is adequately protected, and that processing complies with the Common Law Duty of Confidentiality and Caldicott Principles."

Signed: _______________ Date: ____/____/____

---

**Clinical Safety Officer:**
"I confirm that this DPIA aligns with the Clinical Safety Case (DCB0129), and that patient safety risks arising from data processing have been adequately mitigated."

Signed: _______________ Date: ____/____/____

---

**ICB Data Protection Lead:**
"I confirm that this DPIA meets the requirements for deployment within our Integrated Care Board, subject to local information governance approval."

Signed: _______________ Date: ____/____/____

---

### 11.3 Conditions of Approval

Approval is conditional upon:

1. **Completion of Outstanding Actions:**
   - [ ] Migration to UK-based email service (EmailJS replacement) - Q1 2026
   - [ ] Penetration testing by CREST-accredited provider - Q1 2026
   - [ ] Staff data protection training (>95% completion) - Prior to go-live
   - [ ] Patient information materials finalized and published - Prior to go-live

2. **Ongoing Compliance:**
   - [ ] Quarterly Privacy Steering Group meetings
   - [ ] Annual DPIA review (or upon material changes)
   - [ ] Breach notification procedures activated if incidents occur
   - [ ] Processor audit reports reviewed annually

3. **Deployment Prerequisites:**
   - [ ] ICO registration obtained (if not already held)
   - [ ] Data Processing Agreements executed with all processors
   - [ ] ICB-specific information governance approval (per deployment site)

---

## Part 12: Appendices

### Appendix A: Data Mapping Register

[Detailed table of all data categories, fields, purposes, legal bases, retention periods, third-party processors - maintained separately in operational documentation]

### Appendix B: Privacy Notice (Extract)

**How We Use Your Information:**

We process your personal data to provide NHS healthcare services, including:
- Managing complaints and improving services
- Recording clinical meetings and governance discussions
- Providing AI-assisted medical translation for non-English speakers
- Ensuring quality and safety of care (CQC compliance)

**Legal Basis:** Public task, legal obligation, and where applicable your consent.

**Your Rights:** Access, rectification, erasure (where applicable), restriction, portability, objection.

**Contact:** Data Protection Officer - dpo@gpnotewell.co.uk

[Full privacy notice available at www.pcnservices.nhs.uk/privacy]

### Appendix C: Glossary

- **DPA:** Data Processing Agreement
- **DPO:** Data Protection Officer
- **DPIA:** Data Protection Impact Assessment
- **DSPT:** Data Security and Protection Toolkit
- **IDTA:** International Data Transfer Agreement
- **RLS:** Row Level Security
- **SAR:** Subject Access Request
- **SCC:** Standard Contractual Clauses
- **SIRO:** Senior Information Risk Owner
- **TIA:** Transfer Impact Assessment

### Appendix D: Related Documentation

- Clinical Safety Case Report (DCB0129) - `reports/Clinical_Safety_Case.md`
- Clinical Safety Technical Appendix - `reports/Clinical_Safety_Technical_Appendix.md`
- Data Flow Architecture Diagram - `/data-flow-architecture`
- Privacy Policy - `/privacy-policy`
- Hazard Log - `/hazard-log`

---

## Document End

**Document Version:** 1.0  
**Next Review Date:** 17th November 2026  
**Document Owner:** Data Protection Officer

**Distribution:**
- Privacy Steering Group
- Board of Directors
- Integrated Care Board Data Protection Leads
- Clinical Safety Officer
- Information Governance Team

**Document Control:**
This document is controlled and version-managed. Uncontrolled copies should not be relied upon. Current version available at: [Internal SharePoint / Document Management System]

---

**Conclusion:**

This Data Protection Impact Assessment demonstrates that PCN Services Ltd has conducted a thorough privacy risk analysis for its Integrated Care Management Platform, identified and mitigated risks to acceptable levels, and implemented comprehensive data protection by design and default.

The platform is suitable for deployment within NHS organisations subject to:
- Completion of outstanding actions per defined timelines
- Ongoing monitoring and annual review
- ICB-specific information governance approval

**DPO Recommendation:** **APPROVE DEPLOYMENT** with conditions as stated.

---

*This DPIA was prepared in accordance with:*
- UK GDPR Article 35
- ICO DPIA Guidance
- NHS Data Security and Protection Toolkit
- ISO/IEC 29134:2017 (Privacy Impact Assessment Guidelines)
