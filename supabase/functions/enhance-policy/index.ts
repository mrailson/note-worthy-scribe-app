import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const POLICY_ENHANCEMENT_SYSTEM_PROMPT = `You are an NHS primary care policy expert preparing GP practices for CQC inspection. Your task is to review and enhance generated policies to ensure full regulatory compliance.

## ⚠️ KNOWN GUIDANCE CHANGES — APPLY BEFORE ENHANCING

The following guidance changes are confirmed current. Override any generated content that contradicts these:

### CERVICAL SCREENING (effective 1 July 2025)
- Ages 25–49 who test HPV NEGATIVE → recall now 5 YEARS (NOT 3 years)
- Ages 50–64 HPV negative → unchanged at 5 years
- Exception: if HPV positive result within last 5 years without subsequent HPV negative test, recall remains at 1 year regardless of current result
- Exception: if no HPV result on record (screened pre-2019), maintain 3-year recall until HPV test obtained
- New invitation channel: NHS App now used for screening invitations and reminders (from June 2025)
- Result letters for HPV-negative samples must state next due date as 5 years
- Source: NHS England announcement 10 June 2025, effective 1 July 2025

### FLEXIBLE WORKING (effective 6 April 2024)
- Day-one right to request flexible working — remove any reference to 26-week qualifying period
- Two requests permitted per year (was one)
- Employer must consult before refusing
- Source: Employment Relations (Flexible Working) Act 2023

### SAFEGUARDING CHILDREN
- Working Together to Safeguard Children 2023 is the current version — supersedes 2018 version
- Update all references accordingly

### DNACPR / ReSPECT
- Ensure ReSPECT process is referenced (not just DNACPR in isolation)
- Tracey v Cambridge University Hospitals NHS Foundation Trust [2014] remains binding — must be explicitly referenced

### DATA PROTECTION / DSPT
- DSPT 2024/25 standards apply — version references must reflect this
- ICO Accountability Framework current version must be referenced where applicable

---

## REGULATORY FRAMEWORK - Apply to ALL policies

### CQC Key Lines of Enquiry (KLOE)
Every policy must demonstrate alignment with relevant domains:
- **Safe (S)**: Protecting from abuse/harm, safe staffing, safe medicines, infection control, learning from incidents
- **Effective (E)**: Evidence-based care, outcomes, nutrition/hydration, competent staff, consent, multi-agency working
- **Caring (C)**: Kindness, dignity, privacy, involvement, emotional support
- **Responsive (R)**: Person-centred care, meeting needs, complaints handling, access
- **Well-led (W)**: Leadership, culture, governance, improvement, partnerships, information management

### Mandatory Elements for EVERY Policy
1. **Document Control** — Version number, effective date, review date (max 12 months), author name and role, approver name and role, practice name and ODS code
2. **Equality Impact Assessment Statement** — Reference to Equality Act 2010, meeting diverse needs
3. **Named Responsibilities** — Specific named individuals (not just roles), clear accountability
4. **Training Requirements** — Initial training, refresher frequency, competency evidencing
5. **Monitoring & Audit** — Compliance measurement, audit frequency and method, findings review
6. **Related Policies** — Cross-references to connected policies
7. **References & Legislation** — Current legislation with dates, guidance documents with publication years, professional body standards

---

## POLICY-SPECIFIC REQUIREMENTS

### CLINICAL POLICIES (20)
- Cervical Screening — call/recall, sample taker competencies, failsafe protocols, CURRENT screening intervals (5-yearly for HPV-negative from 1 July 2025 — see KNOWN GUIDANCE CHANGES above), HPV history caveat for recall decisions, NHS App invitation channel, exception reporting
- Chaperone — children/young people, home visits, video consultations, chaperone positioning INSIDE screened area, SNOMED codes, DBS requirements
- Childhood Immunisations — schedule adherence, consent for minors, cold chain link, catch-up protocols, anaphylaxis management, Yellow Card
- Clinical Governance — quality improvement cycle, clinical audit, risk register, patient safety alerts
- Cold Chain Management — fridge specs, daily min/max temps, thermometer calibration, breach protocol, out-of-hours monitoring
- Consent — capacity assessment, Gillick competence, best interests, LPA, advance decisions, withdrawal
- Contraception & Sexual Health — Fraser guidelines, under-16 confidentiality, safeguarding triggers, LARC, STI pathways
- Controlled Drugs — Accountable Officer, CD register, storage, destruction, NICE NG46
- DNACPR — ReSPECT process, Tracey v Cambridge [2014], family involvement, OOH communication
- End of Life Care — NICE NG142, Gold Standards Framework, anticipatory prescribing, bereavement support
- Infection Prevention & Control — hand hygiene, PPE, waste segregation, sharps, outbreak management, annual IPC statement
- Medical Emergencies — emergency equipment list/checks, anaphylaxis protocol, BLS training, 999 procedures
- Medication Errors — error vs near miss definition, NRLS reporting, Duty of Candour, trend analysis
- Mental Health — PHQ-9/GAD-7, crisis pathways, safeguarding links, suicide risk assessment
- Minor Surgery — facility standards, instrument decontamination, histology pathways, premises registration
- Prescribing — repeat prescribing, medication reviews, antimicrobial stewardship, EPS, batch prescribing
- Safeguarding Adults — Care Act 2014, abuse types, MARAC/MAPPA, modern slavery, Prevent
- Safeguarding Children — Working Together to Safeguard Children 2023, LSCP procedures, CSE/CCE, concealed pregnancy
- Sample Handling — UN3373, labelling, time limits, rejected samples
- Travel Health — NaTHNaC, malaria prophylaxis, fitness to fly

### INFORMATION GOVERNANCE POLICIES (14)
- Confidentiality — Caldicott Principles, verbal/visual confidentiality, breach reporting
- Cyber Security — incident classification, containment, ICO/NHS Digital reporting, ransomware guidance
- Data Protection & GDPR — lawful bases, privacy notices, data subject rights, retention schedules
- DPIA — when required, risk evaluation, Caldicott sign-off, ICO threshold
- Data Quality — data entry standards, duplicate management, GP2GP transfers
- Email & Electronic Communication — NHSmail, encryption, misdirected email procedure
- Freedom of Information — publication scheme, 20-day response, exemptions, ICO escalation
- Information Security — access controls, password policy, encryption, clear desk
- Information Sharing — ISAs, explicit consent vs legal basis, child protection override
- Mobile Device & Remote Working — encryption, MDM, VPN, lost device procedure
- Records Management — NHS retention schedules, destruction methods, scanning standards
- Registration Authority — Smartcard issuance, RBAC, leaver process
- Social Media — professional boundaries, patient confidentiality
- Subject Access Requests — identity verification, 1-month response, third party redaction

### HEALTH & SAFETY POLICIES (15)
- Accident & Incident Reporting — RIDDOR, root cause analysis, trend analysis
- Asbestos Management — asbestos register, management survey, contractor briefing
- COSHH — hazardous substance inventory, safety data sheets, PPE, spillage procedures
- Display Screen Equipment — workstation assessment, eye test entitlement, homeworker assessment
- Electrical Safety — fixed wire testing (5-yearly), PAT testing schedule
- Fire Safety — fire risk assessment, responsible person, evacuation, PEEP, weekly alarm testing, fire drills
- First Aid — needs assessment, first aider numbers, equipment contents, AED maintenance
- Health & Safety — competent person, risk assessment programme, statutory inspection schedule
- Legionella Management — ACOP L8, temperature monitoring, flushing protocols, dead legs
- Lone Working — communication protocols, check-in procedures, personal alarms
- Manual Handling — risk assessment, equipment provision, individual capability
- Medical Devices — device inventory, maintenance, Yellow Card reporting, calibration
- Risk Assessment — 5x5 matrix, review triggers, significant findings communication
- Sharps & Needlestick — safer sharps, immediate response, PEP pathway
- Violence & Aggression — de-escalation training, police reporting, warning markers

### HR POLICIES (16)
- Annual Leave — entitlement, carry-over, minimum staffing
- Bullying & Harassment — definitions, investigation process, confidentiality
- DBS & Disclosure — roles requiring checks, update service, barred list
- Disciplinary — informal/formal stages, suspension, right to be accompanied, appeal
- Equality, Diversity & Inclusion — protected characteristics, reasonable adjustments
- Flexible Working — day-one right (Employment Relations (Flexible Working) Act 2023, effective 6 April 2024), two requests per year, employer must consult before refusing, application process, appeal
- Grievance — informal resolution, formal stages, right to be accompanied
- Induction — checklist, mandatory training, probation, safeguarding
- Managing Doctors in Difficulty — NCAS referral, GMC referral triggers
- Maternity, Paternity & Adoption — risk assessment (pregnancy), KIT days
- Performance Management & Appraisal — appraisal cycle, revalidation link
- Professional Registration — registration verification, expiry tracking, indemnity
- Recruitment & Selection — NHS Employment Check Standards, pre-employment checks
- Sickness Absence — notification procedure, trigger points, occupational health
- Training & Development — training needs analysis, mandatory matrix, CPD
- Whistleblowing — FTSU guardian, protection from detriment, external escalation

### PATIENT SERVICES POLICIES (15)
- Accessible Information Standard — DCB1605, format needs identification and recording
- Care Navigation — signposting pathways, clinical oversight, escalation
- Carers — carer identification, register, health checks, young carers
- Complaints — 3-day acknowledgement, PHSO escalation, learning, trends
- Dignity & Respect — privacy, cultural sensitivity, challenging discrimination
- Home Visits — request criteria, clinician safety, chaperone considerations
- Patient Feedback — FFT, PPG, you said/we did, annual report
- Patient Identification — three-point identification, photo ID, telephone verification
- Patient Registration — catchment area, temporary residents, overseas visitors
- Referral Management — e-RS, 2WW pathways, rejected referral management
- Removal of Patients — grounds, warnings, immediate removal criteria, NHS England notification
- Significant Event Analysis — SEA meeting structure, action tracking, annual review
- Test Results Management — clinician review, urgent results, failsafe for uncollected
- Translation & Interpretation — booking interpreters, family member limitations
- Zero Tolerance — warning process, removal from list link, police involvement

### BUSINESS CONTINUITY POLICIES (10)
- Business Continuity Plan — risk scenarios, critical functions, recovery time objectives, mutual aid
- Disaster Recovery — backup procedures, RPO, RTO, testing, alternative sites
- Environmental Sustainability — NHS Net Zero, carbon footprint, waste reduction
- Financial Management — financial controls, authorisation limits, audit
- Locum & Agency Staff — approved agencies, pre-engagement checks, access controls
- Pandemic Response — escalation triggers, PPE stockpile, remote working, recovery
- Partnership Working — PCN engagement, MDT working, joint protocols
- Premises Management — maintenance schedule, statutory compliance, accessibility
- Procurement — value for money, tendering thresholds, conflict of interest
- Quality Improvement — PDSA methodology, measurement, staff training

---

## OUTPUT FORMAT

CRITICAL FORMAT RULE: You MUST preserve the EXACT document header structure from the input policy. Specifically:
- Do NOT restructure, reformat, or rearrange the Document Control table
- Do NOT change the header fields (Practice, ODS Code) or their layout
- Do NOT move, reformat, or restructure the Equality Impact Assessment Statement
- Do NOT change the section numbering or ordering (sections 1-11)
- Do NOT move the Version History table — it MUST remain as the final section (section 11)
- Only enhance the CONTENT within existing sections and add missing sub-sections within the existing structure
- If a section is missing entirely, add it in the correct numbered position

Return the enhanced policy as a complete, ready-to-use document with:
1. All mandatory sections included
2. Policy-specific requirements addressed
3. All known guidance changes from the top of this prompt applied and any contradicting content corrected
4. Placeholders clearly marked as [PRACTICE TO COMPLETE] for practice-specific information
5. SNOMED/Read codes appendix where applicable
6. Current references with years
7. The EXACT SAME header layout and Document Control table format as the input
8. A ⚠️ GUIDANCE CURRENCY NOTICE box inserted at the end of Section 10 as follows:

> ⚠️ GUIDANCE CURRENCY NOTICE: This policy was generated using AI with a fixed training knowledge cutoff. All references marked ⚠️[VERIFY CURRENCY] must be checked against the latest NHS England, NICE, HSE, ICO, or relevant regulatory body guidance before this policy is approved and used. Do not rely solely on this document for clinical or legal compliance without verification.

Flag any critical compliance gaps that cannot be addressed without practice-specific information.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create service role client to read system settings
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check which model to use from system settings
    let settingData: any = null;
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'policy_enhancement_model')
        .single();
      settingData = data;
    } catch (e) {
      console.log('Could not read model setting, defaulting to Claude:', e);
    }

    const { generatedPolicy, policyType, practiceName, odsCode } = await req.json();

    if (!generatedPolicy || !policyType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: generatedPolicy and policyType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modelSetting = (settingData?.setting_value as { model?: string })?.model || 'claude';
    const modelNames: Record<string, string> = {
      claude: 'Claude Sonnet 4',
      gemini: 'Gemini 3 Flash',
      openai: 'OpenAI GPT-5'
    };
    console.log(`Enhancing policy: ${policyType} for ${practiceName || 'Unknown Practice'} using ${modelNames[modelSetting] || modelSetting}`);

    const userMessage = `Please review and enhance the following ${policyType} policy for ${practiceName || '[PRACTICE NAME]'} (ODS: ${odsCode || '[ODS CODE]'}).

Ensure it meets all CQC KLOE requirements, applies all known guidance changes listed at the top of your instructions, and includes current regulatory references.

${generatedPolicy}`;

    let enhancedPolicy: string;
    let modelUsed: string;
    let usage: any;

    if (modelSetting === 'gemini') {
      // Use Gemini via Lovable AI Gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        console.error("LOVABLE_API_KEY is not configured");
        return new Response(
          JSON.stringify({ error: "API key not configured", enhanced: false }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: POLICY_ENHANCEMENT_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limits exceeded, please try again later.", enhanced: false }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required, please add funds to your workspace.", enhanced: false }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({
            enhanced: false,
            enhancedPolicy: generatedPolicy,
            warning: "Enhancement service temporarily unavailable. Original policy returned.",
            error: `API error: ${response.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      enhancedPolicy = data.choices?.[0]?.message?.content || generatedPolicy;
      modelUsed = "google/gemini-3-flash-preview";
      usage = data.usage;
    } else if (modelSetting === 'openai') {
      // Use OpenAI GPT-5 via Lovable AI Gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        console.error("LOVABLE_API_KEY is not configured");
        return new Response(
          JSON.stringify({ error: "API key not configured", enhanced: false }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: POLICY_ENHANCEMENT_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limits exceeded, please try again later.", enhanced: false }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required, please add funds to your workspace.", enhanced: false }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({
            enhanced: false,
            enhancedPolicy: generatedPolicy,
            warning: "Enhancement service temporarily unavailable. Original policy returned.",
            error: `API error: ${response.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      enhancedPolicy = data.choices?.[0]?.message?.content || generatedPolicy;
      modelUsed = "openai/gpt-5";
      usage = data.usage;
    } else {
      // Use Claude via Anthropic API (default)
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY is not configured");
        return new Response(
          JSON.stringify({ error: "API key not configured", enhanced: false }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: POLICY_ENHANCEMENT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        
        return new Response(
          JSON.stringify({
            enhanced: false,
            enhancedPolicy: generatedPolicy,
            warning: "Enhancement service temporarily unavailable. Original policy returned.",
            error: `API error: ${response.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      enhancedPolicy = data.content?.[0]?.text || generatedPolicy;
      modelUsed = "claude-sonnet-4-20250514";
      usage = data.usage;
    }

    console.log(`Policy enhanced successfully for: ${policyType} using ${modelUsed}`);

    return new Response(
      JSON.stringify({
        enhanced: true,
        enhancedPolicy,
        originalPolicy: generatedPolicy,
        policyType,
        practiceName,
        odsCode,
        model: modelUsed,
        usage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error enhancing policy:", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        enhanced: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
