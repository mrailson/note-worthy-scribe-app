import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Full extracted text from "New Models Primary Care Service Specification v5"
const SPECIFICATION_TEXT = `
SERVICE SPECIFICATION - New Models Programme - Neighbourhood Access Service
Commissioner Lead: Ellie Wagg

1. POPULATION NEEDS - National/Local Context and Evidence Base

The New Models Programme is one part of the Integrated Care Board's (ICB) response to Delivering an Integrated Neighbourhood Health Service. It is a long-term transformation programme that will bring together integrated Neighbourhood teams to deliver improved outcomes and access for patients, a thriving workforce, financially sustainable organisations and a shift of investment away from acute hospital care into primary and community care services.

The programme directly responds to three high profile national policy documents: the Fuller Stocktake Report (May 2022), the Darzi report (2024), and the NHS Neighbourhood guidelines (January 2025).

The programme aligns directly with the 10 Year Plan.

The programme is focusing on developing 3 new models of care:
- Community Urgent Care (incorporating the Neighbourhood Access Service)
- Complex Care and Long-Term Conditions
- Planned Care

Sitting alongside is a fourth area: Proactive Care, led by the Local Authority with the VCSE sector.

6 core components to standardise:
- population health management
- modern general practice
- standardising community health services
- neighbourhood multi-disciplinary teams (MDTs)
- integrated intermediate care
- urgent neighbourhood services

Single nominated organisations will take a leading role working collaboratively with mental health/learning disability & autism (MHLDA), children & young people (CYP), over 65s, elective care, urgent care, health inequalities, and prevention.

At the heart of the programme is the ambition to protect 50% of GP time to support an enhanced model of complex care and long-term condition management. Presently GPs spend up to 90% of their time on reactive care.

This Enhanced Specification (ES) supports the delivery of 22% additional capacity using the allocated funding for reactive appointments. A further 18% additionality will be found by efficiencies such as working at scale and integrated pathways. Together, these deliver 40% additionality, releasing 40% of GP time for complex care and long-term condition management.

Commissioners expect delivery 'at scale', led by a single nominated organisation responsible for holding and managing programme funding ('held funds') for all GP Practices in that Neighbourhood. All appointments will be accessible to all registered patients and temporary residents from all GP Practices within the geographical footprint.

Activity delivered in the Neighbourhood Access Service is in addition to General Medical Services (GMS) contract services, and any existing LES and DES contracts.

2. OUTCOMES

2.1 NHS Outcomes Framework Domains:
- Domain 1: Preventing people from dying prematurely
- Domain 2: Enhancing quality of life for people with long-term conditions
- Domain 3: Helping people to recover from episodes of ill-health or following injury
- Domain 4: Ensuring people have a positive experience of care
- Domain 5: Treating and caring for people in safe environment and protecting them from avoidable harm

2.2 Local defined outcomes:
- Improved outcomes and access for patients through new models of care and integrated pathways
- A sustainable primary care sector with investment shifted to community-based services
- Effective triage: right care, right place, right time
- Reduced A&E attendances, outpatient activity, and non-elective admissions
- Empowered patients via increased self-management
- Increased use of NHS app
- Co-produced service through patient engagement
- High quality, efficient service delivery covering Safety, Effectiveness, and Patient Experience
- Increased patient and carer satisfaction
- Increased staff satisfaction, recruitment and retention
- Improved public perception of the local health system

Benefits Realisation Programme: A structured approach to managing change. Benefits include:
- Financial: cashable (cost savings) and non-cashable (cost avoidance, productivity improvement)
- Non-financial: effectiveness, statutory requirements, strategic goals, risk mitigation, workforce morale, reputation

Innovator neighbourhoods are funded on the premise of system savings in excess of the investment.

2.2.1 Monthly Reporting:
Fixed areas including but not limited to:
- Activity and performance (Neighbourhood Access Service): utilisation rates (including practice breakdown), outcomes, onward referrals, diagnostics, access times, repeat attendances, patients not receiving an appointment due to lack of availability
- Activity and performance (Complex and Long-Term Conditions Service): utilisation rates, outcomes, onward referrals, diagnostics, access times

3. SCOPE

This ES is offered by the Commissioner to GP Practices in selected Neighbourhoods within Northamptonshire ICB.

Part A - Neighbourhood Access Service
Part B - Enhanced Complex Care and Long-term Condition Service

Part A covers clinical care beyond scope of essential or additional GMS services. Part B covers aspects included in essential or additional services. Part A shifts activity around reactive care, enabling released time for Part B, aligning to the 50/50 ambition.

GOVERNANCE

Single nominated organisation requirements:
- Ensure GP Practices are signed up to deliver collaboratively
- Managing authority for Part A 'held funds'
- Establish a Programme Board with representation from each GP Practice
- The ICB relationship will be with the Board, not individual practices
- Board will co-ordinate annual neighbourhood plan
- Board will co-ordinate approach to receiving funds
- Generate and participate in a Benefits Realisation Programme
- Undertake "Open Book" approach to sharing information

Activity, performance, financial and workforce breakdowns required. Financial information must include detailed spend breakdown.

Management of Programme Risks:
- Immediately inform ICB of major risks (e.g. 50% of practices failing to utilise activity against KPIs)
- ICB will write to all practices to take immediate remedial action
- Respond to FOI requests within 20 working days
- Have policies with agreed roles and responsibilities
- Publish quarterly financial and activity reports at practice level including:
  - Appointment contribution and utilisation
  - Financial allocation and spend
  - Patient feedback themes
- Data shared with all practices and ICB for transparency and equity

TERMS

Begins 1 April 2026, minimum term of two years.
- Either party may terminate without cause with 6 months written notice
- Notice may be given if outcomes not met
- If a practice gives notice but others wish to continue, viability at commissioner's discretion
- Merger impact assessed by Commissioner who may terminate if minimum standards cannot be met

PAYMENT CONDITIONS

Payment conditional on all participating GP Practices:
- Entering into this ES, including variations
- Complying with requirements
- Aligning with and participating in any variation to the GMS contract

RESPONSIBILITIES OF GP PRACTICES:
- Have a neighbourhood MOU between each practice and the single nominated organisation
- Inform commissioner of proposed changes to sub-contractors
- Comply with information requests including monthly data submissions
- Provide information to patients about services
- Ensure lawful data sharing arrangements
- Ensure sub-contracting arrangements comply with statutory regulations
- Ensure suitable translation and interpretation services
- Facilitate reasonable adjustments
- Effectively utilise the service aiming for full utilisation
- Ensure safeguarding responsibilities are in place
- Retain responsibility for booking and cancellation management
- Have appropriate insurances (medical and public liability)
- Continued access to Part A funds conditional on demonstrable delivery of Part B
- Business continuity processes in place
- Attend design phase workshops

Exceptions:
- Cannot opt out of handing over 'held funds' to the single nominated organisation
- Must not disaggregate funds back to GP Practices for GMS/DES/LES services
- Held funds only for additional capacity above existing baseline
- Restricting access to some practices not permitted
- Utilising NAS capacity for complex/LTC patients not routinely advised
- Wrap around services not funded as part of this ES

AIMS AND OBJECTIVES:
- Support collaborative working to design 'at scale' operating model, GP-led, high quality, patient centred
- Provide funding for additional GP, ANP/ACP diagnostic appointments
- Expected to deliver 15.2 appointments per week per 1,000 patients (standard), 18.2 during winter surge (13 weeks)
- Provide HCA support (not counted as activity)
- Support protected time for proactive care
- Work collaboratively with neighbourhood teams and wider system partners

NEIGHBOURHOOD ACCESS SERVICE - Service Description:
A neighbourhood same day or reactive access service fully integrated into wider community urgent care model. GP practice retains front door role. Practices directly book into the service. In addition to existing primary care and Pharmacy First. Provided through at-scale model.

Workforce:
- Attract new staff and redesign roles
- Clinical resource from GP Practices must be backfilled
- Develop training approach for nurses, medical students, foundation year and GP registrars
- Work with universities and Northamptonshire Primary Care Training Hub
- Supervised by appropriately trained clinicians
- Interprofessional learning opportunities

Activity Modelling:
- Funding expected to be spent on Part A and innovation (not Part B)
- 22% funded additionality + 18% from innovation = 40% total additional capacity
- 15.2 appointments per week per 1,000 patients (standard)
- 18.2 during winter surge (13 weeks)
- Modelling based upon:
  - 50% GP/GPwER/GPwSI/Consultant, 50% ANP/ACP/AHP
  - 15-minute appointments, 12 per session
  - Up to half delivered virtually (online or telephone)
  - ANP/ACP/AHP: 24 appointments per day (WTE)
  - GP/GPwER/GPwSI/Consultant: 15 appointments per session

Referral Processes:
- Referrals made directly from clinicians in NAS, not passed back to host practices
- Includes follow-up services, specialist referrals, diagnostics, phlebotomy

Pathology:
- Requests made directly from NAS clinicians
- Tests reviewed in line with national requirements within agreed SOP

Medicines Optimisation:
- Prescribing budget forms part of primary care prescribing budget
- Follow local formulary and traffic light classifications
- Follow local and national recommendations for value from medicines

Exceptions:
- Complex/LTC patients seen in own GP Practice, not NAS (except specialist input via innovation)
- Home visiting not covered

Population Covered:
- All patients registered with partaking practices including temporary residents, all ages
- Children under 5 where clinically appropriate, face-to-face only

Opening Hours:
- Operational 252 days per year (weekdays excluding bank holidays)
- Minimum core GMS contract hours, option to extend
- Commissioner may request extended hours
- Within geographic footprint of Northamptonshire ICS
- Premises accessible by public transport with car parking

PART B - COMPLEX CARE AND LONG-TERM CONDITIONS SERVICE:
Proactive and preventative service in time released by Part A. GP practice retains front door.
Personalised care with prevention and community services elements.

Patients with complex needs supported via:
- COPD/Asthma management plans including children, standby medication, post exacerbation/admission reviews
- Cancer: GP check-ins via telephone
- Diabetes: newly diagnosed support, poorly controlled optimisation
- Frailty including dementia: support for family/carers, RESPECT plans
- Low level anxiety and depression
- Chronic disease/LD reviews/serious MH check-ups
- End of life: named GP, home visits, telephone check-ins, RESPECT plans
- High intensity users: reduce escalations
- Housebound patients: GP home visits
- Polypharmacy: specific support beyond routine reviews
- Complex pain: continuity of care
- Unexplained medical symptoms: continuity for high users
- Patients with delayed discharges

Named GP for key cohorts. Complex CYP (MH, ADHD/ASD, eating disorders) with GPwSI/GPwER support. Core20PLUS5 agenda.

Appointments:
- Variable length with consideration of Make Every Contact Count
- Minimum proactive care appointments per 1,000 registered patients per month
- Must be clearly coded in clinical system
- Allocated to patients in PNG groups 8-11
- Tracked for continuity (same clinician, follow-up intervals)
- Proactive care slots must not be used for reactive care

INNOVATION:
- Move towards new ways of working during ES lifetime
- Commissioners keen to support innovation especially for patients requiring specialist input (GPwSI/GPwER/Consultant)
- GPwSI/GPwER activity can be counted as NAS activity
- Align with Neighbourhood Health Centres, Family Hubs as they develop

Innovator Sites must:
- Test the model of care design
- Test new ways of working (triage, referrals, pathology scaling, pooled medicines budget)
- Review activity and financial modelling assumptions
- Share learning with ICB and other Neighbourhoods
- Support ICB presentations at local, regional and national level
- Work with Commissioners on Open Book approach

Service Improvement:
- Continually review and develop service
- Offer each patient opportunity to feedback on service experience (full pathway)
- Single nominated organisation collates patient experience and demonstrates improvements
- Engage with all GP Practices for feedback on administration, quality and clinical advice

PRICING STRUCTURE:
- List size as of 1 January determines contract value for following financial year
- Annual contract value = 1 January list size × £26.33
- Uplifted by DDRB from 2027/28 onwards

INTERDEPENDENCE WITH OTHER SERVICES:
Must work collaboratively with: end of life, MHLDA, CYP, over 65s, elective care, emergency care, health inequalities, prevention, winter surge schemes, EMAS, NHFT, University Hospitals of Northamptonshire.

4. APPLICABLE STANDARDS:
- Health and Care Act 2022, Children and Families Act 2014, Children Act 1989/2004, Human Rights Act 1998, NHS Act 2006, Equality Act 2010
- Neighbourhood Health Guidelines 2025/26, Fuller Stocktake Report 2022, Darzi Report 2024
- Patient Safety Incident Response Framework 2024
- RCGP Guide to GP Clinical Extended Roles 2021
- NICE guidance for all related decisions
- Safeguarding policies
- NHS Primary Care Patient Safety Strategy 2025
- Learn from Patient Safety Events (LFPSE) requirements
- Caldicott principles (2020), DPA 2018/UK GDPR
- ICO registration, DPST completion
- Health and safety regulations

EQUALITY AND INCLUSION:
No discrimination based on gender, age, race, religion, sexual orientation, disability, marital status, gender reassignment, pregnancy and maternity.

INSURANCE REQUIREMENTS:
- Employer's Liability: £5,000,000
- Public Liability: £10,000,000
- Professional Negligence: £5,000,000
- Clinical Negligence: £10,000,000
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory, dashboardContext } = await req.json();

    if (!message || !message.trim()) {
      throw new Error("Question is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware system prompt
    let additionalContext = "";
    if (dashboardContext) {
      additionalContext = "\n\nYou also have access to LIVE DASHBOARD DATA from the NRES SDA Programme. This includes the Programme Board Action Log, Risk Register, Hours Tracker, and Evidence Library metadata. Use this data to provide up-to-date, contextual answers.\n\nLIVE DASHBOARD DATA:\n\n" + dashboardContext;
    }

    const systemPrompt = "You are an expert NHS programme analyst for the NRES Neighbourhood SDA Programme. You have access to the FULL TEXT of the \"New Models Primary Care Service Specification v5\" contract document AND live programme data from the dashboard.\n\nIMPORTANT RULES:\n1. Answer questions based on the contract document AND/OR the live dashboard data as appropriate.\n2. When answering about contract terms, KPIs, or specification details, cite the relevant section.\n3. When answering about actions, risks, hours, or evidence, reference the live dashboard data.\n4. If information is not found in any source, clearly state so.\n5. Quote directly from sources where possible.\n6. Use British English spelling.\n7. Format dates as DD/MM/YYYY.\n8. Use bullet points for clarity when listing items.\n9. Cross-reference between the contract specification and live programme data when relevant (e.g., linking risks to contract requirements).\n\nCONTRACT DOCUMENT:\n\n" + SPECIFICATION_TEXT + additionalContext;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    console.log("Contract Ask AI - Question:", message);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite-preview",
        messages,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please top up your Lovable AI credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error: " + response.status);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "I could not generate a response.";

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Contract Ask AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
