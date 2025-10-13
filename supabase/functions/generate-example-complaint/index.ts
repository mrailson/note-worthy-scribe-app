import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const exampleComplaints = {
  1: {
    name: "High Priority - Clinical Care & Staff Attitude",
    content: `NHS FORMAL COMPLAINT LETTER

Date: ${new Date().toLocaleDateString('en-GB')}

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Sarah Elizabeth Johnson
Date of Birth: 15th March 1985
Address: 42 Oak Lane, Northampton, NN1 2AB
Phone: 01604 123 4567
Email: sarah.johnson@email.com

COMPLAINT REFERENCE: Unprofessional Staff Behavior and Inadequate Clinical Care

I am writing to formally complain about the unacceptable treatment I received during my visit to Oak Lane Practice on 23rd October 2024.

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

Date: ${new Date().toLocaleDateString('en-GB')}

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
Since August 2024, I have had four scheduled appointments cancelled at short notice (less than 24 hours). On two occasions, I only found out about the cancellation when I arrived at the practice. This has caused significant disruption to my work schedule as I arrange time off in advance.

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

Date: ${new Date().toLocaleDateString('en-GB')}

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Patricia Anne Davies
Date of Birth: 8th November 1956
Address: 73 Victoria Road, Northampton, NN3 5LK
Phone: 01604 234 8765
Email: patricia.davies@email.com

COMPLAINT REFERENCE: Serious Medication Dispensing Error

I am writing to formally complain about a serious medication error that occurred at Oak Lane Practice on 15th October 2024.

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

Date: ${new Date().toLocaleDateString('en-GB')}

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
During my visit on 18th October 2024 at 10:00 AM, I noticed that the waiting room was not properly cleaned. There were used tissues on chairs, the floor hadn't been vacuumed, and the toilets were in an unacceptable state with no soap or paper towels available.

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

Date: ${new Date().toLocaleDateString('en-GB')}

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
I had blood tests taken on 25th September 2024 for ongoing fatigue and dizziness. I was told results would be available within 7 days. Despite calling the practice repeatedly over three weeks, I received conflicting information - first that results weren't back, then that they couldn't find them in the system.

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

Date: ${new Date().toLocaleDateString('en-GB')}

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mr. Robert John Mitchell
Date of Birth: 14th April 1960
Address: 91 Abington Avenue, Northampton, NN5 2GH
Phone: 01604 789 0123
Email: robert.mitchell@email.com

COMPLAINT REFERENCE: Potential Misdiagnosis of Chest Pain

I am writing to formally complain about concerning clinical care I received at Oak Lane Practice on 5th October 2024.

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

Date: ${new Date().toLocaleDateString('en-GB')}

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
On 12th October 2024, I attended an appointment using my wheelchair. The accessible toilet was being used as a storage room, making it impossible for me to use the facilities during my visit. When I mentioned this to reception staff, I was told "we don't have many wheelchair users, so we needed the space".

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

Date: ${new Date().toLocaleDateString('en-GB')}

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
In September 2024, I requested access to my medical records and discovered multiple inaccuracies:
- Incorrect home address (showing my previous address from 5 years ago)
- Test results from another patient (Sarah Baker) incorrectly filed in my records
- Missing consultation notes from my visit in July 2024

ATTEMPTS TO RESOLVE:
I reported these errors to the practice manager on 1st October. Despite assurances they would be corrected within one week, the errors remain unfixed as of today (22nd October).

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

Date: ${new Date().toLocaleDateString('en-GB')}

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Sophie Marie Turner (complaint about son's care)
Patient: Joshua Turner (son)
Date of Birth: 7th May 2015
Address: 38 Kingsthorpe Road, Northampton, NN7 3JK
Phone: 01604 012 3456
Email: sophie.turner@email.com

COMPLAINT REFERENCE: Failure to Act on Safeguarding Concerns

I am writing to formally complain about the practice's failure to properly respond to safeguarding concerns regarding my son Joshua, aged 9.

INCIDENT DETAILS:
On 2nd October 2024, I brought Joshua to see Dr. Rachel Hughes. He had unexplained bruising on his arms and had become withdrawn at school. I expressed concerns about his father's boyfriend who had recently moved into their home following our separation.

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

Date: ${new Date().toLocaleDateString('en-GB')}

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
On 8th October 2024, I requested my repeat prescription through the online system. When I collected it from the pharmacy, my diabetes medication (Metformin) was missing. The pharmacy contacted the practice, and I was told it had been discontinued in error during a system update in August.

CONSEQUENCE:
I went without my diabetes medication for two days until this was resolved. My blood sugar levels became dangerously high, and I felt very unwell. Nobody from the practice contacted me proactively about this medication being stopped.

IMPACT:
This error put my health at serious risk. As an 79-year-old patient with multiple conditions, proper medication management is essential for my wellbeing.

CATEGORY: Medication Management
PRIORITY: Medium

CONSENT: Yes
COMPLAINT ON BEHALF: No

Yours sincerely,
Margaret Phillips`
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