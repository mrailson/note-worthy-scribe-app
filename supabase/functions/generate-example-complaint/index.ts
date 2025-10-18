import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const exampleComplaints = {
  1: {
    name: "High Priority - Clinical Care & Staff Attitude",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 28th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Sarah Elizabeth Johnson
Date of Birth: 15th March 1985
Address: 42 Oak Lane, Northampton, NN1 2AB
Phone: 01604 123 4567
Email: sarah.johnson@email.com

COMPLAINT REFERENCE: Unprofessional Staff Behavior and Inadequate Clinical Care

I am writing to formally complain about the unacceptable treatment I received during my visit to Oak Lane Practice on 23rd October 2025.

INCIDENT DETAILS:
I arrived punctually for my appointment with Dr. Sarah Smith but was kept waiting for over 45 minutes without explanation. When I politely approached reception, the receptionist Emma Thompson was extremely rude and dismissive, telling me to "just wait like everyone else" and rolling her eyes.

CLINICAL CONCERNS:
When I finally saw Dr. Smith at 3:20 PM, she appeared rushed and unprofessional. She failed to properly examine me despite my concerns about recurring headaches affecting my daily life. The consultation lasted only 5 minutes, and she prescribed medication without conducting any physical examination.

STAFF INVOLVED:
- Emma Thompson (Reception Staff)
- Dr. Sarah Smith (General Practitioner)

IMPACT:
This experience has caused significant distress and undermined my confidence in the practice's ability to provide adequate healthcare.

CATEGORY: Staff Attitude and Clinical Care
PRIORITY: High

CONSENT: I consent to this complaint being processed according to NHS complaints procedures.
COMPLAINT ON BEHALF: No

Yours sincerely,
Sarah Johnson`
  },
  2: {
    name: "Medium Priority - Appointment Delays & Communication",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 27th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. James Robert Williams
Date of Birth: 22nd July 1972
Address: 156 High Street, Northampton, NN2 6JF
Phone: 01604 987 6543
Email: james.williams@email.com

COMPLAINT REFERENCE: Repeated Appointment Cancellations and Poor Communication

I am writing to complain about the ongoing issues with appointment cancellations at Oak Lane Practice over the past three months.

INCIDENT DETAILS:
Since August 2025, I have had four scheduled appointments cancelled at short notice (less than 24 hours). On two occasions, I only found out about the cancellation when I arrived at the practice. This has caused significant disruption to my work schedule as I arrange time off in advance.

COMMUNICATION ISSUES:
The practice failed to notify me promptly about cancellations via text or phone. When I complained to the practice manager, I was told they would improve their systems, but the problem has continued.

IMPACT:
The repeated cancellations have delayed treatment for my chronic back pain, causing unnecessary suffering. I have also lost income due to taking unpaid time off work for appointments that didn't happen.

CATEGORY: Appointment System and Communication
PRIORITY: Medium

CONSENT: Yes, I consent to complaint processing.
COMPLAINT ON BEHALF: No

Yours sincerely,
James Williams`
  },
  3: {
    name: "High Priority - Medication Error",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 26th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Patricia Anne Davies
Date of Birth: 8th November 1956
Address: 73 Victoria Road, Northampton, NN3 5LK
Phone: 01604 234 8765
Email: patricia.davies@email.com

COMPLAINT REFERENCE: Serious Medication Dispensing Error

I am writing to formally complain about a serious medication error that occurred at Oak Lane Practice on 15th October 2025.

INCIDENT DETAILS:
I collected my regular prescription for blood pressure medication (Amlodipine 5mg). When I arrived home and checked the medication, I discovered I had been given the wrong dosage - 10mg instead of 5mg. I had taken one tablet before noticing the error.

IMMEDIATE ACTION TAKEN:
I immediately contacted the practice and was advised to stop taking the medication. I had to make an emergency appointment the following day to confirm it was safe to continue my correct prescription.

STAFF INVOLVED:
- Pharmacy Technician David Richardson (dispensed incorrect medication)

IMPACT:
This error caused me significant anxiety and concern about my health. I experienced dizziness and had to take time off work. This has severely damaged my trust in the practice's medication management systems.

CATEGORY: Medication Error
PRIORITY: High - Patient Safety

CONSENT: Yes, I consent to investigation.
COMPLAINT ON BEHALF: No

Yours sincerely,
Patricia Davies`
  },
  4: {
    name: "Low Priority - Facility & Cleanliness",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 25th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. David Michael Thompson
Date of Birth: 3rd June 1988
Address: 29 Manor Gardens, Northampton, NN4 8QR
Phone: 01604 456 7890
Email: david.thompson@email.com

COMPLAINT REFERENCE: Poor Hygiene Standards in Waiting Area

I am writing to raise concerns about the cleanliness and hygiene standards at Oak Lane Practice.

INCIDENT DETAILS:
During my visit on 18th October 2025 at 10:00 AM, I noticed that the waiting room was not properly cleaned. There were used tissues on chairs, the floor hadn't been vacuumed, and the toilets were in an unacceptable state with no soap or paper towels available.

CONCERNS:
As a healthcare facility, maintaining high hygiene standards is essential to prevent infection spread. The state of the facilities on multiple recent visits suggests this is an ongoing issue rather than a one-off problem.

IMPACT:
This has made me uncomfortable about visiting the practice and concerned about basic infection control measures.

CATEGORY: Premises and Facilities
PRIORITY: Low

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
David Thompson`
  },
  5: {
    name: "Medium Priority - Test Results Delay",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 24th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Ms. Emma Louise Richardson
Date of Birth: 19th February 1995
Address: 84 St. George's Way, Northampton, NN1 7HP
Phone: 01604 678 9012
Email: emma.richardson@email.com

COMPLAINT REFERENCE: Delayed Blood Test Results and Lack of Follow-up

I am writing to complain about the significant delay in receiving my blood test results from Oak Lane Practice.

INCIDENT DETAILS:
I had blood tests taken on 25th September 2025 for ongoing fatigue and dizziness. I was told results would be available within 7 days. Despite calling the practice repeatedly over three weeks, I received conflicting information - first that results weren't back, then that they couldn't find them in the system.

CONSEQUENCE:
I finally received my results on 20th October (25 days later) showing I have significantly low iron levels requiring immediate treatment. The delay has prolonged my symptoms and caused unnecessary anxiety.

STAFF INVOLVED:
Multiple reception staff members provided inconsistent information about my results.

IMPACT:
The delay in diagnosis has affected my ability to work and caused considerable distress. I am concerned about the practice's results management system.

CATEGORY: Clinical Care and Test Results
PRIORITY: Medium

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
Emma Richardson`
  },
  6: {
    name: "High Priority - Misdiagnosis Concern",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 23rd October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Robert John Mitchell
Date of Birth: 14th April 1960
Address: 91 Abington Avenue, Northampton, NN5 2GH
Phone: 01604 789 0123
Email: robert.mitchell@email.com

COMPLAINT REFERENCE: Potential Misdiagnosis of Chest Pain

I am writing to formally complain about concerning clinical care I received at Oak Lane Practice on 5th October 2025.

INCIDENT DETAILS:
I visited Dr. Michael Anderson with severe chest pain, shortness of breath, and pain radiating down my left arm. I specifically mentioned my family history of heart disease (father died of heart attack aged 55).

CLINICAL CARE CONCERNS:
Dr. Anderson dismissed my symptoms as "probably muscular pain" without conducting any examination, ECG, or referring me for further tests. He prescribed painkillers and told me to come back if it didn't improve.

SUBSEQUENT EVENTS:
Concerned about being dismissed, I attended A&E two days later. Hospital tests revealed I had suffered a mild heart attack. I was admitted for three days and now require ongoing cardiac medication and monitoring.

STAFF INVOLVED:
- Dr. Michael Anderson (General Practitioner)

IMPACT:
The failure to properly assess my symptoms could have had fatal consequences. I am shocked that obvious warning signs were dismissed without proper investigation.

CATEGORY: Clinical Care and Diagnosis
PRIORITY: High - Patient Safety

CONSENT: Yes, I consent and request thorough investigation.
COMPLAINT ON BEHALF: No

Yours sincerely,
Robert Mitchell`
  },
  7: {
    name: "Medium Priority - Discrimination & Accessibility",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 22nd October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Amara Okoye
Date of Birth: 27th September 1978
Address: 45 Billing Road, Northampton, NN2 3TP
Phone: 01604 890 1234
Email: amara.okoye@email.com

COMPLAINT REFERENCE: Discrimination and Inadequate Accessibility Support

I am writing to complain about discriminatory treatment and lack of accessibility support at Oak Lane Practice.

INCIDENT DETAILS:
On 12th October 2025, I attended an appointment using my wheelchair. The accessible toilet was being used as a storage room, making it impossible for me to use the facilities during my visit. When I mentioned this to reception staff, I was told "we don't have many wheelchair users, so we needed the space".

FURTHER ISSUES:
During my consultation with Dr. Helen Carter, she spoke to my husband rather than directly to me, despite me being the patient. When I tried to explain my symptoms, she repeatedly asked my husband to "explain what she means".

IMPACT:
This experience was humiliating and made me feel discriminated against based on my disability. I expect to be treated with the same dignity and respect as any other patient.

CATEGORY: Access and Discrimination
PRIORITY: Medium

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
Amara Okoye`
  },
  8: {
    name: "Low Priority - Administrative Error",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 21st October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Christopher Paul Baker
Date of Birth: 11th December 1983
Address: 62 Wellingborough Road, Northampton, NN6 4DR
Phone: 01604 901 2345
Email: christopher.baker@email.com

COMPLAINT REFERENCE: Incorrect Medical Records and Administrative Errors

I am writing to complain about errors in my medical records at Oak Lane Practice.

INCIDENT DETAILS:
In September 2025, I requested access to my medical records and discovered multiple inaccuracies:
- Incorrect home address (showing my previous address from 5 years ago)
- Test results from another patient (Sarah Baker) incorrectly filed in my records
- Missing consultation notes from my visit in July 2025

ATTEMPTS TO RESOLVE:
I reported these errors to the practice manager on 1st October. Despite assurances they would be corrected within one week, the errors remain unfixed as of today (20th October).

IMPACT:
These errors could lead to serious clinical mistakes. I am concerned about data protection and the accuracy of other patients' records if mine contains such significant errors.

CATEGORY: Administration and Records
PRIORITY: Low

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
Christopher Baker`
  },
  9: {
    name: "High Priority - Child Safeguarding Concern",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 20th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Sophie Marie Turner (complaint about son's care)
Patient: Joshua Turner (son)
Date of Birth: 7th May 2015
Address: 38 Kingsthorpe Road, Northampton, NN7 3JK
Phone: 01604 012 3456
Email: sophie.turner@email.com

COMPLAINT REFERENCE: Failure to Act on Safeguarding Concerns

I am writing to formally complain about the practice's failure to properly respond to safeguarding concerns regarding my son Joshua, aged 10.

INCIDENT DETAILS:
On 2nd October 2025, I brought Joshua to see Dr. Rachel Hughes. He had unexplained bruising on his arms and had become withdrawn at school. I expressed concerns about his father's boyfriend who had recently moved into their home following our separation.

CLINICAL RESPONSE:
Dr. Hughes examined Joshua but did not ask to speak with him privately. She documented the bruising as "consistent with normal childhood play" without proper inquiry into the circumstances or my expressed concerns.

SAFEGUARDING FAILURE:
Three weeks later, Joshua disclosed to his teacher that he was being physically harmed at home. Social services are now involved. I believe the practice missed an opportunity to intervene earlier when I raised concerns.

STAFF INVOLVED:
- Dr. Rachel Hughes (General Practitioner)

IMPACT:
My son continued to suffer harm for three additional weeks. I am deeply concerned about the practice's safeguarding procedures and training.

CATEGORY: Clinical Care and Safeguarding
PRIORITY: High - Child Safety

CONSENT: Yes, I consent on behalf of my son.
COMPLAINT ON BEHALF: Yes - on behalf of my son Joshua

Yours sincerely,
Sophie Turner`
  },
  10: {
    name: "Medium Priority - Prescription Error & Follow-up",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 19th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Margaret Rose Phillips
Date of Birth: 31st January 1945
Address: 15 Duston Village, Northampton, NN8 5BL
Phone: 01604 123 4567
Email: margaret.phillips@email.com

COMPLAINT REFERENCE: Prescription Error and Lack of Medication Review

I am writing to complain about issues with my repeat prescription management at Oak Lane Practice.

INCIDENT DETAILS:
I have been on the same medications for diabetes and high blood pressure for over three years without a medication review, despite NHS guidance recommending annual reviews for patients with multiple chronic conditions.

PRESCRIPTION ERROR:
On 8th October 2025, I requested my repeat prescription through the online system. When I collected it from the pharmacy, my diabetes medication (Metformin) was missing. The pharmacy contacted the practice, and I was told it had been discontinued in error during a system update in August.

CONSEQUENCE:
I went without my diabetes medication for two days until this was resolved. My blood sugar levels became dangerously high, and I felt very unwell. Nobody from the practice contacted me proactively about this medication being stopped.

IMPACT:
This error put my health at serious risk. As an 80-year-old patient with multiple conditions, proper medication management is essential for my wellbeing.

CATEGORY: Medication Management
PRIORITY: Medium

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
Margaret Phillips`
  },
  11: {
    name: "High Priority - Privacy & Data Breach",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 18th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Ms. Jennifer Louise Edwards
Date of Birth: 9th August 1992
Address: 127 Spencer Bridge Road, Northampton, NN9 3TL
Phone: 01604 234 5678
Email: jennifer.edwards@email.com

COMPLAINT REFERENCE: Serious Breach of Patient Confidentiality

I am writing to formally complain about a serious breach of my medical confidentiality at Oak Lane Practice.

INCIDENT DETAILS:
On 10th October 2025, I received a phone call from my employer's HR department asking about my recent medical appointments. They mentioned receiving a letter from Oak Lane Practice confirming I had attended appointments for "mental health support" on specific dates.

INVESTIGATION FINDINGS:
When I contacted the practice, I discovered that a member of staff, Lisa Martin, had mistakenly sent my appointment confirmation letter to my employer's address instead of my home address. This letter contained sensitive information about the nature of my appointments.

CONSENT BREACH:
I never gave permission for any medical information to be shared with my employer. This has caused me significant distress and embarrassment at work. Colleagues have been asking questions, and I feel my privacy has been completely violated.

STAFF INVOLVED:
- Lisa Martin (Administrative Assistant)

IMPACT:
This breach has damaged my professional reputation and caused me severe anxiety. I am considering legal action and have reported this to the Information Commissioner's Office (ICO).

CATEGORY: Confidentiality and Data Protection
PRIORITY: High - GDPR Breach

CONSENT: Yes, I consent to investigation.
COMPLAINT ON BEHALF: No

Yours sincerely,
Jennifer Edwards`
  },
  12: {
    name: "VEXATIOUS - Unreasonable Demands",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 17th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Gerald Frederick Hamilton
Date of Birth: 4th February 1951
Address: 203 Welford Road, Northampton, NN10 6HJ
Phone: 01604 345 6789
Email: gerald.hamilton@email.com

COMPLAINT REFERENCE: THIRTY-SEVENTH Formal Complaint - Continued Unacceptable Service

This is my THIRTY-SEVENTH formal complaint this year about Oak Lane Practice. I am DISGUSTED by the continued failure to meet my requirements.

LATEST INCIDENTS:
1. On 9th October, receptionist refused to give me an appointment with Dr. Smith specifically, despite my CLEAR requirement to only see him.
2. My appointment on 11th October started 3 minutes late - this is UNACCEPTABLE and shows complete disregard.
3. Dr. Smith did not agree with my self-diagnosis of multiple rare conditions I researched online.
4. The waiting room chairs are not comfortable enough for someone of my importance.
5. Reception staff did not greet me enthusiastically enough when I arrived.

MY DEMANDS:
- I require a same-day appointment with Dr. Smith ONLY, every week, at exactly 10:00 AM
- All staff must attend sensitivity training about MY specific needs
- The practice must install reclining leather chairs in the waiting room
- I demand compensation of £5,000 for emotional distress
- Dr. Smith must prescribe the medications I specify based on my internet research
- The Practice Manager must call me daily to confirm my satisfaction

PREVIOUS COMPLAINTS:
As you know from my previous 36 complaints this year, I have documented every perceived slight, including: staff not making enough eye contact, music being too quiet in the waiting room, the colour of the walls, temperature being 0.5 degrees too warm, and many other serious issues.

WARNING:
If these demands are not met within 48 hours, I will escalate to the ombudsman, my MP, the Care Quality Commission, NHS England, the local newspaper, social media, and pursue legal action. I have already posted about this practice's failures on 15 different online platforms.

CATEGORY: Multiple (all categories)
PRIORITY: URGENT - MAXIMUM

CONSENT: Of course
COMPLAINT ON BEHALF: No

This is absolutely DISGRACEFUL.

Gerald Hamilton`
  },
  13: {
    name: "VEXATIOUS - Aggressive & Excessive Communication",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 16th October 2025 [SENT AT 3:47 AM]

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Barbara Anne Stevens
Date of Birth: 19th May 1968
Address: 88 Kingswell Road, Northampton, NN11 2PQ
Phone: 01604 456 7891
Email: barbara.stevens@email.com

COMPLAINT REFERENCE: ONGOING INCOMPETENCE AND DELIBERATE VICTIMISATION

I am writing my 23rd complaint letter this month about the CONSPIRACY against me at Oak Lane Practice.

INCIDENT DETAILS:
Everyone at this practice is DELIBERATELY TARGETING ME. I know for a FACT that staff members are discussing me behind my back and laughing at me. Yesterday, I saw two receptionists whispering and they were OBVIOUSLY talking about me.

RECENT "INCIDENTS" (ACTUALLY PERSECUTION):
- 14th October: Waited 8 minutes for my appointment (UNACCEPTABLE)
- 13th October: Dr. Jenkins didn't agree with my diagnosis - he's clearly incompetent
- 12th October: Receptionist smiled at another patient more than she smiled at me
- 11th October: My prescription took 25 hours to be ready instead of 24 hours
- 10th October: Someone coughed in the waiting room near me - infection control failure

HARASSMENT OF PRACTICE STAFF:
I have called the practice 47 times in the last week to discuss my concerns. I don't understand why they say I'm being "excessive". I have EVERY RIGHT to call whenever I want. When they stopped answering my calls, I visited the practice six times in one day to speak with the manager. Security asked me to leave, which is DISCRIMINATION.

MY POSITION:
I demand:
- CCTV footage of all staff areas to prove they're talking about me
- Personal mobile numbers of all doctors so I can contact them 24/7
- All staff to sign statements that they're not part of the conspiracy
- Unlimited appointments whenever I demand them
- The Practice Manager to provide daily written apologies

I have already:
- Posted 127 negative reviews online (all deleted by "corrupt" moderators)
- Filed complaints with 8 different organizations
- Contacted my MP 15 times
- Started a petition (which has 0 signatures but that's because of the conspiracy)
- Recorded all staff without their knowledge (for evidence)

THREATS:
If you don't comply with ALL my demands immediately, I will:
- Sue for millions in damages
- Report everyone to the police
- Contact every media outlet
- Protest outside the practice daily
- Make your lives miserable until you admit what you've done

I know my rights and you CANNOT ignore me.

CATEGORY: Everything - this is SYSTEMATIC PERSECUTION
PRIORITY: EMERGENCY - LIFE OR DEATH

Do not try to label this as "vexatious" - that's just more evidence of the conspiracy.

Barbara Stevens

[P.S. - I will be calling every hour until someone responds]
[P.P.S. - I have CCd this to 47 different people and organisations]
[P.P.P.S. - I expect a response within 1 hour or I'm going to the press]`
  },
  14: {
    name: "Medium Priority - Mental Health Care Gap",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 15th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Thomas Benjamin Clarke
Date of Birth: 23rd March 1986
Address: 54 Billing Brook Road, Northampton, NN12 4GH
Phone: 01604 567 8901
Email: thomas.clarke@email.com

COMPLAINT REFERENCE: Inadequate Mental Health Support and Care Coordination

I am writing to formally complain about the lack of adequate mental health support provided by Oak Lane Practice.

BACKGROUND:
I have been experiencing severe depression and anxiety for the past six months. I have been open with my GP, Dr. James Wilson, about having suicidal thoughts and struggling to cope with daily life.

INCIDENT DETAILS:
Despite multiple appointments since April 2025, I have only been offered:
- Generic advice to "try exercise and eat well"
- A prescription for antidepressants with no follow-up monitoring
- A printout of a mental health helpline number

REFERRAL FAILURES:
Dr. Wilson promised to refer me to the IAPT service (Improving Access to Psychological Therapies) in May 2025. When I followed up in August, I discovered no referral had been made. A new referral was submitted, but I was told the waiting list is 6-8 months.

CRISIS SITUATION:
On 1st October 2025, I contacted the practice in crisis, having experienced a panic attack at work and feeling unable to cope. I was told there were no appointments available and advised to call 111. When I explained I felt unsafe, the receptionist said she would get someone to call me back "within 48 hours".

LACK OF CARE COORDINATION:
Nobody from the practice called back. There has been no proactive follow-up to check on my wellbeing. I feel completely abandoned by the practice at a time when I desperately need support.

STAFF INVOLVED:
- Dr. James Wilson (General Practitioner)
- Reception staff (crisis call on 1st October)

IMPACT:
The lack of appropriate mental health support has left me feeling hopeless and unsupported. I am struggling to work and my relationships are suffering. I am extremely concerned about my safety and wellbeing.

CATEGORY: Mental Health Care and Referrals
PRIORITY: Medium (should be High given risk factors)

CONSENT: Yes, I consent to investigation.
COMPLAINT ON BEHALF: No

Yours sincerely,
Thomas Clarke`
  },
  15: {
    name: "High Priority - Multiple Systems Failures",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 14th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Priya Sharma
Date of Birth: 12th October 1975
Address: 96 Abington Park Crescent, Northampton, NN13 8JL
Phone: 01604 678 9012
Email: priya.sharma@email.com

COMPLAINT REFERENCE: Multiple System Failures Affecting Cancer Care Pathway

I am writing to formally complain about multiple serious failures at Oak Lane Practice that have significantly impacted my cancer diagnosis and treatment pathway.

TIMELINE OF FAILURES:

JUNE 2025 - Initial Symptoms Ignored:
I visited Dr. Amanda Foster with persistent fatigue, unexplained weight loss, and night sweats. She attributed these to stress and prescribed sleeping tablets without conducting any investigations despite my expressing serious concern.

AUGUST 2025 - Delayed Referral:
After symptoms worsened, I saw Dr. Richard Barnes who ordered blood tests. Results showed significant abnormalities. He promised an urgent 2-week cancer pathway referral but the referral was not submitted due to "administrative oversight".

SEPTEMBER 2025 - Communication Breakdown:
I called repeatedly to check on my referral status but received no clear answers. Different staff gave contradictory information. Eventually, I discovered the referral had never been sent.

OCTOBER 2025 - Multiple Errors:
1. New urgent referral finally submitted on 23rd September
2. Appointment letter sent to wrong address (old address from 2019)
3. Missed hospital appointment because I didn't receive the letter
4. Practice blamed me for missing appointment
5. Threatened with discharge back to GP for non-attendance

CURRENT SITUATION:
I have now been diagnosed with Stage 3 Non-Hodgkin Lymphoma. The oncologist stated that the delays in diagnosis have allowed the disease to progress. Early detection in June could have meant significantly better prognosis and less aggressive treatment required.

STAFF INVOLVED:
- Dr. Amanda Foster (failed to investigate initial symptoms)
- Dr. Richard Barnes (referral not submitted)
- Multiple administrative staff (communication failures)
- Practice Manager (dismissive when I raised concerns)

IMPACT:
These cumulative failures have potentially life-threatening consequences. My cancer has progressed to a more advanced stage because of:
- Clinical failure to take symptoms seriously
- Administrative failure to submit urgent referral
- Communication failure regarding my hospital appointment
- Systemic failure in quality assurance and patient tracking

I am now facing more aggressive chemotherapy and radiotherapy than would have been necessary with earlier diagnosis. My prognosis has been significantly impacted.

CATEGORY: Clinical Care, Administration, and Communication (multiple categories)
PRIORITY: High - Patient Safety and Cancer Care

CONSENT: Yes, I consent and request thorough investigation of all failures.
COMPLAINT ON BEHALF: No

I am also considering legal action for clinical negligence and have documented all interactions with the practice.

    Yours sincerely,
Priya Sharma`
  },
  16: {
    name: "Medium Priority - Communication Breakdown",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 13th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Anthony Paul Richards
Date of Birth: 28th August 1967
Address: 112 Kettering Road, Northampton, NN14 7PL
Phone: 01604 789 0123
Email: anthony.richards@email.com

COMPLAINT REFERENCE: Poor Communication Leading to Delayed Treatment

I am writing to formally complain about serious communication failures at Oak Lane Practice that have significantly impacted my cancer treatment pathway.

INCIDENT DETAILS:
In July 2025, I was diagnosed with prostate cancer following a PSA test and biopsy. My urologist wrote to the practice requesting urgent blood tests and a medication review before starting hormone therapy.

COMMUNICATION FAILURES:
1. The hospital letter was received by the practice on 15th July but not actioned until I chased it up on 5th August (21 days later)
2. When I called to book blood tests, reception staff had no record of the hospital letter
3. The practice blamed the hospital for "not sending it properly"
4. My GP had not read the letter despite it being marked "URGENT - CANCER PATHWAY"

IMPACT ON TREATMENT:
My hormone therapy was delayed by 4 weeks because the required blood tests weren't done. The oncologist explained this delay may affect treatment effectiveness and outcomes.

STAFF INVOLVED:
- Reception staff (failed to action hospital correspondence)
- Dr. Peter Collins (my registered GP - failed to review urgent correspondence)
- Practice Manager (defensive response when I complained)

CATEGORY: Communication and Care Coordination
PRIORITY: Medium

CONSENT: Yes, I consent to full investigation.
COMPLAINT ON BEHALF: No

Yours sincerely,
Anthony Richards`
  },
  17: {
    name: "High Priority - Aggressive Staff Behaviour",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 12th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Linda Marie Foster
Date of Birth: 5th April 1982
Address: 67 Weston Favell Centre, Northampton, NN15 4MN
Phone: 01604 890 1234
Email: linda.foster@email.com

COMPLAINT REFERENCE: Aggressive and Intimidating Behaviour by Practice Manager

I am writing to formally complain about extremely concerning behaviour by your Practice Manager, Mr. Steven Walsh, during my visit on 8th October 2025.

INCIDENT DETAILS:
I attended the practice to discuss concerns about my son's care. When I explained I was unhappy with the way his ADHD symptoms had been dismissed, Mr. Walsh became increasingly aggressive and confrontational.

UNACCEPTABLE BEHAVIOUR:
- He raised his voice and spoke over me repeatedly
- He told me I was "being difficult and wasting everyone's time"
- He stood very close to me in an intimidating manner
- When I said I felt intimidated, he laughed dismissively
- He said "if you don't like it here, you can find another practice"
- Other patients in reception witnessed this behaviour and looked shocked

IMPACT:
I left the practice in tears, feeling humiliated and upset. I have since experienced anxiety about attending appointments. This behaviour is completely unacceptable from any healthcare professional, especially someone in a senior management position.

WITNESSES:
Multiple patients and staff members were present in reception during this incident at approximately 2:30 PM.

STAFF INVOLVED:
- Mr. Steven Walsh (Practice Manager)

CATEGORY: Staff Attitude and Behaviour
PRIORITY: High - Patient Safety and Dignity

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
Linda Foster`
  },
  18: {
    name: "Low Priority - Telephone System Issues",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 11th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. William James Cooper
Date of Birth: 14th June 1991
Address: 23 Riverside Way, Northampton, NN16 8QP
Phone: 01604 901 2345
Email: william.cooper@email.com

COMPLAINT REFERENCE: Persistent Problems with Telephone Access System

I am writing to complain about ongoing difficulties accessing the practice by telephone, which has become increasingly frustrating over recent months.

TELEPHONE SYSTEM PROBLEMS:
- The phone system opens at 8:00 AM but consistently shows "all lines busy" 
- I have tried calling at exactly 8:00 AM on multiple occasions and still cannot get through
- When I do eventually get through (usually after 30+ attempts), I'm often cut off
- The automated system is confusing and doesn't allow me to speak to anyone directly
- I've been disconnected multiple times while waiting in the queue

SPECIFIC INCIDENTS:
- 25th September: Made 47 call attempts before getting through at 9:15 AM
- 2nd October: Cut off three times while in queue position 12
- 9th October: Automated system disconnected me after 18 minutes on hold

IMPACT:
I have had to take time off work to keep trying to reach the practice. This system makes it virtually impossible to access timely medical advice, particularly for urgent concerns.

CATEGORY: Access and Appointment System
PRIORITY: Low

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
William Cooper`
  },
  19: {
    name: "Medium Priority - Prescription Safety Concern",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 10th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Miss Olivia Grace Matthews
Date of Birth: 16th September 1998
Address: 41 Derngate, Northampton, NN17 2LJ
Phone: 01604 012 3456
Email: olivia.matthews@email.com

COMPLAINT REFERENCE: Dangerous Drug Interaction Not Identified

I am writing to formally complain about a serious medication safety issue at Oak Lane Practice that could have caused me significant harm.

INCIDENT DETAILS:
On 20th September 2025, I saw Dr. Laura Bennett for a chest infection. She prescribed Clarithromycin (an antibiotic). However, I am already taking Simvastatin for high cholesterol, which is clearly documented in my medical records.

MEDICATION SAFETY FAILURE:
Clarithromycin and Simvastatin have a dangerous interaction that can cause severe muscle damage (rhabdomyolysis). This is a well-known interaction that should have been flagged by:
1. The GP prescribing system
2. The GP's clinical knowledge
3. The pharmacy dispensing the medication

DISCOVERY OF ERROR:
Fortunately, my mother (who is a retired nurse) noticed the interaction and advised me not to take the antibiotic. I contacted the practice immediately. The GP admitted she "hadn't checked for interactions" and prescribed an alternative antibiotic.

IMPACT:
This error could have caused me serious harm requiring hospitalization. I am deeply concerned about the practice's medication safety protocols and whether other patients may be at risk.

STAFF INVOLVED:
- Dr. Laura Bennett (prescribing GP)

CATEGORY: Medication Safety
PRIORITY: Medium - Patient Safety Issue

CONSENT: Yes, I consent to thorough investigation of medication safety systems.
COMPLAINT ON BEHALF: No

Yours sincerely,
Olivia Matthews`
  },
  20: {
    name: "High Priority - Delayed Cancer Diagnosis",
    content: `NHS FORMAL COMPLAINT LETTER

Date: 9th October 2025

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Daniel Robert Hughes
Date of Birth: 7th January 1964
Address: 78 Spencer Parade, Northampton, NN18 3HK
Phone: 01604 123 4567
Email: daniel.hughes@email.com

COMPLAINT REFERENCE: Multiple Missed Opportunities for Early Cancer Diagnosis

I am writing to formally complain about repeated failures to investigate my symptoms, resulting in a delayed diagnosis of bowel cancer.

TIMELINE OF MISSED OPPORTUNITIES:

MARCH 2025:
Visited Dr. Sarah Mitchell reporting blood in stool, change in bowel habits, and unexplained weight loss. She diagnosed "haemorrhoids" without examination and prescribed cream.

MAY 2025:
Returned with worsening symptoms. Different GP (Dr. James Wilson) prescribed laxatives for "constipation" without reviewing my previous consultation or conducting any tests.

JULY 2025:
Third visit with severe abdominal pain and significant weight loss (2 stone in 4 months). Dr. Mitchell again dismissed concerns, suggesting "IBS and stress." No blood tests or referral offered despite my repeated requests.

SEPTEMBER 2025:
Attended A&E with severe pain. Emergency CT scan revealed large bowel tumour with liver metastases. Now diagnosed with Stage 4 colorectal cancer.

CLINICAL FAILURES:
All three presentations had clear red flag symptoms for cancer:
- Rectal bleeding
- Change in bowel habits
- Unexplained weight loss
- Persistent symptoms despite treatment
- Age over 60

NHS guidance requires urgent 2-week cancer referral for these symptoms, yet this was never offered.

STAFF INVOLVED:
- Dr. Sarah Mitchell
- Dr. James Wilson

IMPACT:
The 6-month delay in diagnosis has allowed my cancer to progress from potentially curable to advanced stage. My prognosis has been significantly worsened. I am now facing palliative chemotherapy rather than curative treatment.

CATEGORY: Clinical Care - Delayed Diagnosis
PRIORITY: High - Patient Safety and Potential Clinical Negligence

CONSENT: Yes. I am also seeking legal advice regarding clinical negligence.
COMPLAINT ON BEHALF: No

Yours sincerely,
Daniel Hughes`
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exampleNumber = 1 } = await req.json().catch(() => ({ exampleNumber: 1 }));
    
    console.log(`Generating example complaint ${exampleNumber}...`);
    
    const example = exampleComplaints[exampleNumber as keyof typeof exampleComplaints] || exampleComplaints[1];
    const complaintContent = example.content;

    console.log('Complaint content generated successfully');

    return new Response(complaintContent, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="example-patient-complaint-letter.txt"'
      },
    });
  } catch (error) {
    console.error('Error generating example complaint:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate example complaint document' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});