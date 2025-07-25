import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    // Create a sample complaint PDF content
    const pdfContent = `
NHS COMPLAINT EXAMPLE DOCUMENT
================================

PATIENT INFORMATION:
Name: Sarah Johnson
Date of Birth: 15th March 1985
Address: 42 Oak Street, Manchester, M1 2AB
Phone: 0161 123 4567
Email: sarah.johnson@email.com

COMPLAINT DETAILS:
Date of Incident: 23rd October 2024
Location/Service: Greenwood Medical Centre, Reception Area

COMPLAINT TITLE:
Unprofessional Staff Behavior and Delayed Appointment

DETAILED COMPLAINT:
I am writing to formally complain about the unprofessional behavior I experienced during my visit to Greenwood Medical Centre on 23rd October 2024.

I arrived for my 2:30 PM appointment with Dr. Smith at the scheduled time. However, I was kept waiting for over 45 minutes without any explanation or apology from the reception staff.

When I politely inquired about the delay at the reception desk, the receptionist, who I believe was named Emma Thompson, was extremely rude and dismissive. She told me to "just wait like everyone else" and rolled her eyes when I asked if there was an estimated time for when I would be seen.

Furthermore, when I finally saw Dr. Smith at 3:20 PM, she seemed rushed and did not adequately address my concerns about recurring headaches. She prescribed medication without proper examination and cut the consultation short after only 5 minutes.

STAFF MENTIONED:
- Emma Thompson (Receptionist)
- Dr. Sarah Smith (GP)

CATEGORY: Staff Attitude and Clinical Care

PRIORITY: Medium - This behavior is unacceptable and affects patient care quality

CONSENT: I consent to this complaint being processed according to NHS procedures

COMPLAINT MADE ON BEHALF: No - this complaint is made by the patient directly

DESIRED OUTCOME:
I would like:
1. A formal apology from the staff involved
2. Assurance that staff will receive appropriate training on patient interaction
3. A proper medical consultation to address my ongoing health concerns
4. Confirmation that procedures will be improved to prevent similar incidents

SIGNATURE:
Sarah Johnson
Date: 25th October 2024

---
This example complaint contains all the necessary information that can be extracted by the AI import system including patient details, incident information, staff involved, and complaint specifics.
    `;

    // Create a simple PDF-like response (in practice, you'd use a proper PDF library)
    // For this example, we'll return the content as plain text that can be copied
    return new Response(pdfContent, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="example-complaint.txt"'
      },
    });
  } catch (error) {
    console.error('Error generating example complaint:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate example complaint' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});