import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating example complaint document...');
    
    // Create a comprehensive sample complaint letter
    const complaintContent = `NHS FORMAL COMPLAINT LETTER

Date: ${new Date().toLocaleDateString('en-GB')}

Dear Complaints Manager,

PATIENT DETAILS:
Name: Mrs. Sarah Elizabeth Johnson
Date of Birth: 15th March 1985
NHS Number: 485 123 4567
Address: 42 Oak Street, Northampton, NN1 2AB
Phone: 01604 123 4567
Email: sarah.johnson@email.com

COMPLAINT REFERENCE: Unprofessional Staff Behavior and Delayed Appointment

I am writing to formally complain about the unacceptable treatment I received during my visit to Oak Lane Medical Practice on 23rd October 2024 at approximately 2:30 PM.

INCIDENT DETAILS:
I arrived punctually for my scheduled appointment with Dr. Sarah Smith. Despite arriving on time, I was kept waiting for over 45 minutes in the reception area without any explanation or acknowledgment from the staff.

When I politely approached the reception desk to inquire about the delay, the receptionist, Emma Thompson, was extremely rude and dismissive. She told me to "just wait like everyone else" and rolled her eyes when I asked for an estimated waiting time.

CLINICAL CONCERNS:
When I finally saw Dr. Smith at 3:20 PM, she appeared rushed and unprofessional. She failed to properly examine me despite my concerns about recurring headaches that have been affecting my daily life. The consultation lasted only 5 minutes, during which she prescribed medication without conducting any physical examination or taking my symptoms seriously.

STAFF INVOLVED:
- Emma Thompson (Reception Staff)
- Dr. Sarah Smith (General Practitioner)

IMPACT:
This experience has caused me significant distress and has undermined my confidence in the practice's ability to provide adequate healthcare. The unprofessional behavior and rushed consultation have left my health concerns unaddressed.

CATEGORY: Staff Attitude and Clinical Care
PRIORITY: High - Patient safety and dignity concerns

CONSENT:
I consent to this complaint being processed according to NHS complaints procedures. I understand that relevant staff may need to be contacted as part of the investigation.

COMPLAINT ON BEHALF: No - I am making this complaint myself as the affected patient.

DESIRED OUTCOMES:
1. A formal written apology from both staff members involved
2. Assurance that reception staff will receive training on patient communication
3. A proper medical consultation to address my ongoing health concerns
4. Implementation of measures to prevent similar incidents
5. Confirmation of any changes made to practice procedures

I look forward to your prompt response and a thorough investigation of this matter.

Yours sincerely,

Sarah Johnson
Date: ${new Date().toLocaleDateString('en-GB')}

---
ADDITIONAL INFORMATION:
This complaint contains comprehensive details suitable for AI extraction testing including patient demographics, incident specifics, staff identification, clinical concerns, and desired outcomes.`;

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