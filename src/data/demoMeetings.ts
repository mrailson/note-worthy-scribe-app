export interface DemoMeeting {
  id: string;
  type: 'LMC' | 'PCN' | 'Partnership' | 'ICB';
  title: string;
  description: string;
  duration: string;
  wordCount: number;
  attendees: Array<{ name: string; title?: string; organization?: string }>;
  agenda: string;
  format: string;
  transcript: string;
  icon: string;
}

export const demoMeetings: DemoMeeting[] = [
  {
    id: 'lmc-contract-meeting',
    type: 'LMC',
    title: 'LMC Contract Negotiation Meeting',
    description: 'GP contract discussions, workload issues, and funding review',
    duration: '10:00',
    wordCount: 1485,
    icon: '🏥',
    format: 'face-to-face',
    attendees: [
      { name: 'Dr Sarah Mitchell', title: 'LMC Chair', organization: 'County LMC' },
      { name: 'Dr James Reynolds', title: 'LMC Secretary', organization: 'County LMC' },
      { name: 'Dr Priya Sharma', title: 'GP Representative', organization: 'Meadow View Surgery' },
      { name: 'Dr Michael Chen', title: 'GP Representative', organization: 'Park Lane Practice' },
      { name: 'Jane Patterson', title: 'Practice Manager Representative', organization: 'Riverside Medical Centre' }
    ],
    agenda: 'Review new GP contract proposals, discuss workforce pressures, funding allocation concerns, patient access requirements',
    transcript: `Dr Sarah Mitchell: Good morning, everyone. Thank you all for joining today's LMC meeting. We have several important items on our agenda, particularly around the new contract proposals and workforce challenges. James, shall we start with the contract review?

Dr James Reynolds: Thanks, Sarah. Yes, I've been reviewing the latest contract proposals from the ICB, and there are some significant changes we need to discuss. The main concern is around the additional quality indicators they're proposing without corresponding funding increases.

Dr Priya Sharma: That's exactly what we're worried about at Meadow View. We're already stretched incredibly thin. The current QOF requirements take up so much clinical time, and now they want to add more without proper resources. How are we supposed to manage this?

Dr Michael Chen: I completely agree. At Park Lane, we've calculated that implementing these new indicators would require at least two additional full-time clinical sessions per week. That's simply not sustainable with our current staffing levels.

Jane Patterson: From a practice manager perspective, the administrative burden is equally concerning. We're already struggling with the existing data collection requirements. The new proposals would require additional software modules and staff training that we haven't budgeted for.

Dr Sarah Mitchell: These are valid concerns, and we need to present a unified response. The key issue is that the contract is asking for increased output without increased input. James, what's the timeline for our response?

Dr James Reynolds: We have until the end of next month to submit our formal response. I suggest we draft a detailed analysis showing the resource implications for practices. We need hard data on the time and cost impacts.

Dr Priya Sharma: Can we also address the patient access requirements? The expectation of same-day appointments for all patients is creating impossible pressures. Our reception team is dealing with increasingly frustrated patients, and clinicians are being rushed through consultations.

Dr Michael Chen: It's affecting quality of care. When we're forced to see patients in shorter time slots to meet access targets, we can't provide the thorough consultations that complex cases require. It's a patient safety issue.

Jane Patterson: And the complaints are increasing. Patients don't understand that we're trying to balance access with quality. The system is setting us up to fail on both fronts.

Dr Sarah Mitchell: This needs to be a central part of our response. We need to make it clear that patient access cannot be improved simply by targets. It requires adequate funding for more clinical staff and better premises.

Dr James Reynolds: I'll draft a section on the workforce implications. Should we include data from the recent BMA workforce survey?

Dr Priya Sharma: Definitely. The burnout statistics are alarming. We've lost three GPs in our area in the past six months, and recruitment is nearly impossible. The contract needs to address why GPs are leaving the profession.

Dr Michael Chen: The partnership model is under threat too. Younger GPs don't want the financial risks and liabilities. We need to see support for sustainable practice models, not just more work expectations.

Dr Sarah Mitchell: Let's compile all these points into a comprehensive response document. James, can you coordinate with the representatives to gather specific examples and data from practices?

Dr James Reynolds: Yes, I'll send out a template next week. We need practices to provide concrete figures on time requirements and costs for each new requirement.

Jane Patterson: I can work with the practice manager network to gather the administrative impact data. We have good records of the time spent on current requirements.

Dr Priya Sharma: What about the funding formula? There's been no mention of addressing the disparities between practices serving different populations.

Dr Michael Chen: That's crucial. Practices in deprived areas face higher complexity and workload but aren't adequately compensated. The weighted capitation needs reviewing.

Dr Sarah Mitchell: Agreed. Let's ensure that's included in our response. We need to push for a fairer funding distribution that reflects actual workload and complexity.

Dr James Reynolds: I'll draft those sections and circulate them for comments by next Friday. Shall we aim to have a final document ready two weeks before the deadline?

Dr Priya Sharma: That works. It gives us time for member practices to review and provide feedback.

Dr Sarah Mitchell: Excellent. Let's make sure our response is evidence-based and constructive. We want to work with the ICB, but we must be clear about what's realistic and safe for practices and patients.

Dr Michael Chen: Should we also request a follow-up meeting with the ICB to discuss our concerns directly?

Jane Patterson: That would be helpful. A dialogue is more effective than just submitting written responses.

Dr Sarah Mitchell: Good idea. James, can you arrange that? Now, moving on to our next item - practice support services. Jane, you wanted to discuss the support available for practices struggling with workforce issues?

Jane Patterson: Yes, several practices have asked about locum support schemes and whether there's any funding available for recruitment initiatives. The costs of locums are becoming prohibitive.

Dr James Reynolds: The ICB has some funding for workforce development, but it's limited. We need to explore what's available and how practices can access it.

Dr Priya Sharma: Any support would be welcome. We're spending a fortune on locums, and it's affecting our practice finances significantly.

Dr Sarah Mitchell: Let's add that to our action points. We need to ensure practices know what support is available and how to access it. Thank you, everyone, for your input today. I think we have a clear way forward on the contract response.`
  },
  {
    id: 'pcn-board-meeting',
    type: 'PCN',
    title: 'PCN Board Meeting - Service Review',
    description: 'ARRS roles review, DES performance, and health inequalities initiatives',
    duration: '12:00',
    wordCount: 1920,
    icon: '🏢',
    format: 'hybrid',
    attendees: [
      { name: 'Dr Emma Thompson', title: 'PCN Clinical Director', organization: 'Valley PCN' },
      { name: 'Mark Stevens', title: 'PCN Manager', organization: 'Valley PCN' },
      { name: 'Dr Aisha Patel', title: 'GP Partner Representative', organization: 'Oakwood Surgery' },
      { name: 'Dr Robert Williams', title: 'GP Partner Representative', organization: 'Central Medical Practice' },
      { name: 'Lisa Henderson', title: 'Practice Manager', organization: 'Hillside Health Centre' },
      { name: 'Sarah Johnson', title: 'Social Prescribing Link Worker', organization: 'Valley PCN' },
      { name: 'Tom Baker', title: 'PCN Pharmacist', organization: 'Valley PCN' }
    ],
    agenda: 'ARRS roles performance review, DES delivery update, health inequalities programme, winter planning, quality improvement initiatives',
    transcript: `Dr Emma Thompson: Good afternoon, everyone. Welcome to this month's PCN board meeting. We have quite a full agenda today covering our ARRS roles performance, DES delivery, and planning for our health inequalities work. Mark, shall we start with the ARRS update?

Mark Stevens: Thanks, Emma. We now have our full complement of ARRS roles in post, which is excellent news. We have two social prescribers, a clinical pharmacist, a pharmacy technician, and a first contact physiotherapist. The utilisation rates are good overall, but there are some variations between practices.

Sarah Johnson: From the social prescribing perspective, I'm seeing about twenty-five to thirty patients per week across the network. The referrals are coming primarily from three of our six practices, though. We need to work on engagement with the other practices.

Dr Aisha Patel: At Oakwood, we've found social prescribing incredibly valuable. Our GPs are regularly referring patients with social isolation, financial concerns, and housing issues. It's made a real difference to reducing unnecessary GP appointments.

Dr Robert Williams: We're a bit slower at Central Practice. I think some of our GPs are still unsure about when to refer and what outcomes to expect. Perhaps we need more information about the service?

Sarah Johnson: I'd be happy to do some sessions with your practice. I can present case studies showing the outcomes we've achieved. Often GPs don't realise the wide range of issues we can help with.

Dr Emma Thompson: That's a great idea. Let's arrange some lunch-and-learn sessions at each practice. It's important all our clinicians understand how to utilise these roles effectively.

Tom Baker: From the clinical pharmacy side, we're conducting medication reviews and managing minor illness consultations. I'm doing about forty patient contacts per week. The feedback from patients has been very positive.

Lisa Henderson: The pharmacy service has been brilliant for our practice. It's freed up significant GP time, and patients appreciate the longer appointment slots for medication reviews. The quality of the reviews is excellent.

Mark Stevens: That's good to hear. The utilisation data shows the pharmacy service is performing above target. Tom, what about the structured medication reviews for care homes?

Tom Baker: We've completed thirty-five care home reviews this quarter. We've identified numerous medication optimisation opportunities, including deprescribing and addressing polypharmacy issues. I'm working with the GPs to implement the recommendations.

Dr Aisha Patel: The care home work has been particularly valuable. We've had some excellent outcomes in terms of reducing falls and hospital admissions through better medication management.

Dr Emma Thompson: Excellent. Moving on to our DES delivery. Mark, can you give us an update on where we are with our targets?

Mark Stevens: We're performing well on most indicators. The IIF achievement is at ninety-two percent so far, with three months remaining. Our CVD case-finding is strong, and we've exceeded the target for blood pressure checks in the hypertensive population.

Dr Robert Williams: What about the early cancer diagnosis DES? That's been more challenging for us.

Mark Stevens: Yes, that's one area where we're behind target. We're at seventy-eight percent, and we need to be at eighty-five percent. The main issue is capturing the data correctly and ensuring all eligible tests are coded appropriately.

Lisa Henderson: We've had issues with the coding requirements. They're quite specific, and our admin team needed additional training to ensure everything is captured.

Dr Emma Thompson: Can we arrange a network-wide training session on the cancer DES coding? If it's an issue for one practice, it's probably an issue for others too.

Mark Stevens: I'll organise that for next month. I'll also share some resources and templates that might help.

Dr Aisha Patel: What about the health inequalities work? That's a priority area for the ICB, and I know we've been developing some initiatives.

Dr Emma Thompson: Good transition. That's our next agenda item. We've been analysing our practice populations and identifying areas of health inequality. The data shows significant variations in outcomes for certain groups.

Mark Stevens: We've identified three priority areas: diabetes management in our South Asian population, COPD case-finding in our older population in areas of deprivation, and mental health access for young adults.

Sarah Johnson: Social prescribing can play a big role in the mental health access issue. We're already seeing young adults who wouldn't traditionally engage with clinical services.

Dr Robert Williams: For the diabetes work, we need to consider cultural factors. Standard approaches don't always work effectively. We might need to develop culturally specific interventions.

Dr Aisha Patel: Absolutely. At Oakwood, we've worked with community groups to deliver diabetes education in different languages. The engagement has been much better than our standard clinics.

Dr Emma Thompson: That's exactly the kind of innovation we need to share across the network. Can you present that at our next clinical meeting?

Tom Baker: I'd be interested in working on the diabetes project from a medication perspective. There are often issues with medication adherence in these populations.

Mark Stevens: Let's set up a working group for each of the three priority areas. We need representation from different practices and ARRS roles.

Lisa Henderson: What resources do we have for this work? Are there any additional funds from the ICB for health inequalities initiatives?

Mark Stevens: There's some funding available through the health inequalities fund. I'm preparing a bid for additional support, particularly for community engagement and data analysis.

Dr Emma Thompson: Good. Make sure the bids are submitted before the deadline. Now, we need to discuss winter planning. Last winter was extremely challenging, and we need to be better prepared this year.

Dr Robert Williams: The key issue last year was access to same-day appointments. The demand was overwhelming, and we couldn't meet it with our existing capacity.

Dr Aisha Patel: We need to look at different models. Perhaps extended hours clinics or better use of our ARRS roles for minor illness?

Tom Baker: I can take on more minor illness work during the winter period. We could also look at implementing pharmacy first schemes more widely.

Sarah Johnson: There's also a role for social prescribing in winter planning. Many people who seek GP appointments in winter are actually dealing with social issues made worse by the cold weather and isolation.

Dr Emma Thompson: Let's develop a comprehensive winter plan that includes all these elements. Mark, can you coordinate this?

Mark Stevens: Yes, I'll draft a plan for the next meeting. We should also look at communications to patients about appropriate service use.

Dr Emma Thompson: Agreed. Thank you, everyone. I think we've covered the main items. Are there any other issues before we close?`
  },
  {
    id: 'partnership-meeting',
    type: 'Partnership',
    title: 'GP Practice Partnership Meeting',
    description: 'Financial review, staffing updates, and CQC preparation',
    duration: '08:00',
    wordCount: 1285,
    icon: '👥',
    format: 'face-to-face',
    attendees: [
      { name: 'Dr Helen Carter', title: 'Senior Partner', organization: 'Riverside Medical Centre' },
      { name: 'Dr Thomas Wright', title: 'Partner', organization: 'Riverside Medical Centre' },
      { name: 'Dr Sophie Anderson', title: 'Partner', organization: 'Riverside Medical Centre' },
      { name: 'Rachel Green', title: 'Practice Manager', organization: 'Riverside Medical Centre' }
    ],
    agenda: 'Q3 financial performance, staffing recruitment update, CQC inspection preparation, premises lease renewal',
    transcript: `Dr Helen Carter: Good morning, everyone. Thanks for making time for this partnership meeting. We have several important items to discuss, particularly our financial position and the upcoming CQC inspection. Rachel, shall we start with the financial update?

Rachel Green: Thanks, Helen. I've prepared the Q3 financial report. Overall, we're in a reasonable position, but there are some areas of concern. Our income is down slightly compared to last year, mainly due to reduced QOF achievement and some vacant appointments on our list.

Dr Thomas Wright: What's the impact on partner drawings? Are we expecting to reduce them?

Rachel Green: Based on current projections, we may need to reduce drawings by about five percent for Q4 unless we can improve our QOF performance or reduce costs elsewhere.

Dr Sophie Anderson: That's concerning. What's causing the QOF shortfall? We were performing well last year.

Rachel Green: The main issues are around the diabetes indicators and the mental health targets. We've had some data quality problems, and we've also lost some patients who were contributing to our achievement.

Dr Helen Carter: The data quality issues are fixable. Rachel, can you work with the nursing team to ensure all eligible interventions are being coded correctly?

Rachel Green: Yes, I've already scheduled a meeting with them next week. We should be able to improve our position before the year-end.

Dr Thomas Wright: What about our cost base? Are there areas where we can reduce spending?

Rachel Green: We've analysed all our expenditure. The biggest costs are staff salaries and locum cover, which are hard to reduce without affecting service delivery. Our premises costs are also significant, which brings us to the lease renewal.

Dr Helen Carter: Right, the lease issue. Our current lease expires in six months, and the landlord wants to increase the rent by twelve percent.

Dr Sophie Anderson: That's a huge increase. Can we negotiate that down?

Rachel Green: I've been in discussions with them. The best they'll offer is eight percent, which is still substantial. It would add about fifteen thousand pounds to our annual costs.

Dr Thomas Wright: Have we looked at alternative premises? Perhaps it's time to consider moving.

Dr Helen Carter: We have looked briefly, but suitable premises in this area are limited and expensive. Also, moving would be hugely disruptive to patients and staff.

Rachel Green: There's also the fit-out costs to consider. Any new premises would need significant investment to meet our clinical requirements.

Dr Sophie Anderson: So we're probably stuck with the increase. Can we offset it with increased income somehow?

Dr Helen Carter: We're exploring options. The PCN has some additional ARRS roles we could host, which would bring in some income. We're also looking at whether we can take on more private work.

Dr Thomas Wright: What about the staffing situation? Last month we discussed recruiting a new salaried GP.

Rachel Green: We've advertised the position twice with no suitable applicants. The GP recruitment market is extremely challenging at the moment.

Dr Helen Carter: This is a sector-wide problem. Practices everywhere are struggling to recruit. We may need to look at alternative solutions.

Dr Sophie Anderson: What about training practices? Could we take on registrars? That would provide some clinical capacity and might attract future partners.

Rachel Green: We'd need to invest in becoming a training practice. It requires one of the partners to become a trainer, and there are quality standards to meet.

Dr Thomas Wright: I'd be interested in becoming a trainer. It's something I've been considering. What's involved?

Dr Helen Carter: It's quite a commitment, Tom. You'd need to complete the training programme, which takes about a year, and then dedicate time to supervising the registrar.

Dr Sophie Anderson: But it could be a good investment long-term. We'd have a regular supply of GPs, and some registrars stay with the practice after qualifying.

Rachel Green: The financial model works too. The training grant would cover most of the costs, and we'd have additional clinical capacity.

Dr Helen Carter: Let's explore this further. Tom, can you look into the requirements and report back at the next meeting?

Dr Thomas Wright: Will do. Now, what about the CQC inspection? When are we expecting them?

Rachel Green: We've not had formal notice yet, but based on the inspection cycle, we're due sometime in the next three months.

Dr Helen Carter: We need to be prepared. What's our current state of readiness?

Rachel Green: I've been working through the CQC framework. We're in good shape on most areas, but there are a few gaps. Our fire safety documentation needs updating, and we need to complete some staff training records.

Dr Sophie Anderson: What about clinical areas? Have we reviewed our prescribing data and clinical outcomes?

Rachel Green: Yes, I've run the reports. Our prescribing is within expected ranges, and our clinical outcomes are good. The main area for improvement is documenting our quality improvement activities.

Dr Helen Carter: We do lots of quality improvement, we're just not very good at documenting it. Let's make sure we're recording our audit cycles and learning from significant events.

Dr Thomas Wright: Should we do a mock inspection? It might identify issues we've missed.

Rachel Green: That's a good idea. The PCN is offering support with CQC preparation. We could ask them to do a peer review.

Dr Helen Carter: Please arrange that, Rachel. It's better to identify problems now than during the actual inspection.

Dr Sophie Anderson: What about patient feedback? That's always a key part of the inspection.

Rachel Green: Our Friends and Family Test scores are good overall. We do get complaints about phone access, which is a common issue. We've implemented the new phone system, which should help.

Dr Helen Carter: Make sure we can demonstrate we're responding to patient feedback and making improvements based on it.

Dr Thomas Wright: Are there any other major concerns we need to address before the inspection?

Rachel Green: Not major ones. Just ensuring all our policies are up to date and staff are familiar with them. I'll schedule some briefing sessions.

Dr Helen Carter: Excellent. I think that covers the main items. Let's meet again next month to review progress on these actions.`
  },
  {
    id: 'icb-strategy-meeting',
    type: 'ICB',
    title: 'ICB Strategic Planning Meeting',
    description: 'System-wide planning, elective recovery, and winter pressures preparation',
    duration: '15:00',
    wordCount: 2450,
    icon: '🏛️',
    format: 'online',
    attendees: [
      { name: 'Amanda Richards', title: 'ICB Chief Executive', organization: 'County ICB' },
      { name: 'Dr David Foster', title: 'Medical Director', organization: 'County ICB' },
      { name: 'Catherine Moore', title: 'Director of Strategy', organization: 'County ICB' },
      { name: 'Dr Lisa Chen', title: 'Primary Care Lead', organization: 'County ICB' },
      { name: 'James Patterson', title: 'Director of Finance', organization: 'County ICB' },
      { name: 'Sarah Williams', title: 'Chief Nursing Officer', organization: 'County ICB' },
      { name: 'Dr Michael Brown', title: 'Secondary Care Representative', organization: 'County Hospital Trust' },
      { name: 'Rebecca Taylor', title: 'Director of Performance', organization: 'County ICB' }
    ],
    agenda: 'Budget allocation for next financial year, elective recovery programme update, winter pressures planning, workforce development, health inequalities strategy, digital transformation initiatives',
    transcript: `Amanda Richards: Good afternoon, everyone, and thank you for joining today's strategic planning meeting. We have a substantial agenda covering budget allocation, elective recovery, winter planning, and several strategic initiatives. Catherine, would you like to start with the strategic overview?

Catherine Moore: Thank you, Amanda. As you know, we're in the planning phase for the next financial year, and we face some significant challenges. The national allocation has increased by only two point three percent, which doesn't keep pace with demand growth and cost pressures.

James Patterson: That's right. When we factor in pay awards, energy costs, and inflation, we're effectively looking at a real-terms reduction in our available funding. We need to find efficiency savings of approximately twenty-eight million pounds.

Dr David Foster: That's a considerable challenge given we're already operating with tight margins. Where are we proposing to find these savings?

James Patterson: We've identified several areas. Procurement efficiencies could yield about eight million. We're working with practices and trusts to standardise ordering and achieve better prices through collective purchasing power.

Dr Lisa Chen: From a primary care perspective, we need to be careful that efficiency savings don't undermine service delivery. Practices are already under enormous pressure.

Amanda Richards: Absolutely, Lisa. We're not looking to cut frontline services. The focus is on improving efficiency and reducing unnecessary variation in practice.

Catherine Moore: We're also looking at reducing management costs across the system. All organisations are being asked to reduce their corporate overheads by five percent.

Sarah Williams: What about the elective recovery programme? That's critical for our performance against national targets, but it requires investment.

Dr Michael Brown: From the hospital perspective, elective recovery is our top priority. We're still significantly behind on our waiting list targets, and patient harm is increasing due to delays.

Rebecca Taylor: The latest data shows we have three thousand two hundred patients waiting over eighteen months, and twelve thousand waiting over twelve months. This is against national targets of zero and six thousand respectively.

Amanda Richards: Michael, what resources do you need to improve this position?

Dr Michael Brown: We need additional theatre capacity, particularly for orthopaedics and general surgery. We've identified opportunities to increase our weekend and evening sessions, but that requires funding for additional staff and running costs.

James Patterson: We've allocated five million pounds for elective recovery initiatives. That should fund approximately two thousand additional procedures over the year.

Dr David Foster: Two thousand procedures would reduce the waiting list by about fifteen percent. That's helpful but won't fully resolve the problem. Are there other approaches we should consider?

Dr Lisa Chen: Community diagnostic hubs could help. If we can shift more diagnostics out of the hospital, we free up capacity for complex procedures.

Catherine Moore: We're planning to establish two new diagnostic hubs, one in the north and one in the south of our area. They'll provide rapid access to MRI, CT, ultrasound, and physiological tests.

Sarah Williams: The community hubs are an excellent initiative. They'll improve patient access and experience whilst reducing hospital pressure. When are they due to open?

Catherine Moore: The north hub should be operational by September, and the south hub by December. We're currently recruiting staff and finalising the equipment procurement.

Dr Lisa Chen: What about primary care capacity? We're seeing practices struggling with demand, and that's pushing more patients towards emergency services.

Amanda Richards: That's a key concern. We know primary care is the foundation of the system, but it's under enormous strain. Lisa, what are the main issues practices are reporting?

Dr Lisa Chen: Workforce is the biggest challenge. Practices can't recruit GPs, and retention is poor. We're losing experienced GPs to retirement or burnout, and younger doctors don't want to become partners due to the financial risks.

Dr David Foster: We've invested heavily in additional roles through the PCN DES. Is that helping?

Dr Lisa Chen: The ARRS roles are valuable, particularly pharmacists and social prescribers, but they don't replace GPs for complex clinical decision-making. We need both.

James Patterson: We have limited funds for primary care development. The core allocation is fixed nationally, and our discretionary funding is constrained by the efficiency savings requirement.

Dr Lisa Chen: Could we redirect some of the funding currently spent on locums? Practices are spending millions on locum cover because they can't recruit permanent staff. If we invested that in making GP careers more attractive, we might reduce the need for locums.

Catherine Moore: That's worth exploring. Perhaps a golden hello scheme for new GPs willing to commit to working in our area for a specified period?

Amanda Richards: Let's develop that proposal. Now, we need to discuss winter planning. Last winter was exceptionally challenging, and we need to be better prepared this year.

Sarah Williams: We've been analysing last winter's performance. The key issues were emergency department overcrowding, delayed discharges, and lack of community capacity to manage acute illness outside hospital.

Dr Michael Brown: From the hospital's perspective, the biggest problem was bed capacity. We were running at over ninety-five percent occupancy for weeks, which is unsafe and inefficient.

Rebecca Taylor: The data shows we had an average of one hundred and twenty delayed discharges per day. That's one hundred and twenty beds blocked by patients who were medically fit for discharge but couldn't leave.

Amanda Richards: Why couldn't they be discharged? What were the barriers?

Sarah Williams: Primarily lack of social care and community health services. We didn't have enough homecare packages or community nursing capacity to support people at home.

James Patterson: We've allocated additional funding for winter pressures, approximately twelve million pounds. How should we use that most effectively?

Sarah Williams: I'd suggest three priorities. First, increase community capacity - more district nurses, homecare workers, and rapid response teams. Second, improve discharge planning so we're identifying and addressing barriers earlier. Third, provide alternative pathways to emergency department attendance.

Dr Lisa Chen: Primary care could offer enhanced same-day access during winter if we have the resources. Perhaps urgent care centres in community settings?

Dr David Foster: We piloted that two years ago with mixed results. The challenge is staffing - we're pulling GPs out of their practices to staff the centres, which then creates gaps in routine access.

Catherine Moore: Perhaps we need to look at different workforce models. Could we use advanced nurse practitioners or physician associates in the urgent care centres?

Sarah Williams: We're training more advanced practitioners, but they're not ready yet. We might be able to recruit some from outside the area if we offer competitive packages.

Amanda Richards: Let's develop a detailed winter plan with costed options for board approval next month. Moving on, we need to discuss our health inequalities strategy.

Catherine Moore: Our population health analysis shows significant inequalities in outcomes. Life expectancy varies by up to eight years between our most and least deprived wards.

Dr David Foster: What are the main drivers of these inequalities?

Catherine Moore: Multiple factors - smoking rates, obesity, physical inactivity, and poor management of long-term conditions. The most deprived populations have much higher rates of emergency admissions and unplanned care.

Dr Lisa Chen: We've been working with PCNs to develop targeted interventions. Some have been very successful with community-based health promotion and case-finding for undiagnosed conditions.

Amanda Richards: Can we scale up the successful PCN interventions across the system?

Catherine Moore: We can, but it requires investment in community engagement and possibly some services tailored to specific populations. The evidence shows generic approaches don't work well for addressing inequalities.

James Patterson: How much investment are we talking about?

Catherine Moore: To implement across the system, probably three to four million pounds annually. But the return on investment should be significant through reduced emergency admissions and better long-term outcomes.

Amanda Richards: That seems reasonable given the scale of the problem. Let's include it in the budget proposals. Finally, digital transformation - where are we with that?

Rebecca Taylor: We've made good progress on shared care records. Nearly all GP practices are now contributing data, and the hospitals are viewing the records for emergency patients.

Dr Lisa Chen: The shared record is incredibly valuable. It's saved countless hours of chasing information and has definitely improved patient safety.

Dr Michael Brown: We've had excellent feedback from our emergency department. Clinicians can access GP records immediately, which speeds up assessment and treatment.

Catherine Moore: The next phase is patient access. We want to give patients the ability to view their own records and book appointments online across multiple services.

Sarah Williams: What about the digitally excluded? We need to ensure we're not creating a two-tier system.

Rebecca Taylor: Absolutely. The digital strategy includes support for those who can't or don't want to use digital services. We're not moving to digital-only.

Amanda Richards: Thank you, everyone. I think we've covered the key strategic areas. We'll schedule follow-up meetings on the specific workstreams, and I'll expect detailed proposals for the budget setting process.`
  }
];

export const getDemoMeetingById = (id: string): DemoMeeting | undefined => {
  return demoMeetings.find(meeting => meeting.id === id);
};

export const getDemoMeetingsByType = (type: DemoMeeting['type']): DemoMeeting[] => {
  return demoMeetings.filter(meeting => meeting.type === type);
};