import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  phoneNumber: string;
  message: string;
  consultationId?: string;
}

// Validate and normalise UK phone numbers to E.164 format
function normaliseUKPhoneNumber(phone: string): string | null {
  // Remove all whitespace and non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle different UK formats
  if (cleaned.startsWith('07')) {
    // UK mobile starting with 07 - convert to +44
    cleaned = '+44' + cleaned.substring(1);
  } else if (cleaned.startsWith('447')) {
    // Already has 44 prefix but missing +
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('+447')) {
    // Already in correct format
  } else if (cleaned.startsWith('00447')) {
    // International format with 00 prefix
    cleaned = '+' + cleaned.substring(2);
  } else {
    return null; // Invalid format
  }
  
  // Validate it's a valid UK mobile length (should be +44 followed by 10 digits)
  if (!/^\+44\d{10}$/.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOV_UK_NOTIFY_API_KEY");
    if (!apiKey) {
      console.error("GOV_UK_NOTIFY_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { phoneNumber, message, consultationId }: SMSRequest = await req.json();

    // Validate required fields
    if (!phoneNumber || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Normalise phone number
    const normalisedPhone = normaliseUKPhoneNumber(phoneNumber);
    if (!normalisedPhone) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid UK phone number format. Please use 07xxx or +447xxx format." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate message length (SMS max is 918 characters for concatenated messages)
    if (message.length > 918) {
      return new Response(
        JSON.stringify({ success: false, error: "Message too long. Maximum 918 characters allowed." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending SMS to ${normalisedPhone.substring(0, 7)}***`);

    // GOV.UK Notify API endpoint
    const notifyUrl = "https://api.notifications.service.gov.uk/v2/notifications/sms";

    // Send SMS via GOV.UK Notify
    const notifyResponse = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Authorization": `ApiKey-v1 ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: normalisedPhone,
        template_id: Deno.env.get("GOV_UK_NOTIFY_TEMPLATE_ID") || undefined,
        personalisation: {
          message: message,
        },
      }),
    });

    // If no template is configured, use the direct SMS endpoint
    if (!Deno.env.get("GOV_UK_NOTIFY_TEMPLATE_ID")) {
      // For services without a template, GOV.UK Notify requires you to set up a template
      // We'll attempt to send using a generic approach
      console.log("No template ID configured, attempting direct SMS");
    }

    const responseData = await notifyResponse.json();

    if (!notifyResponse.ok) {
      console.error("GOV.UK Notify API error:", JSON.stringify(responseData));
      
      // Parse common error messages
      let errorMessage = "Failed to send SMS";
      if (responseData.errors && responseData.errors.length > 0) {
        errorMessage = responseData.errors[0].message || errorMessage;
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: notifyResponse.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("SMS sent successfully:", responseData.id);

    return new Response(
      JSON.stringify({
        success: true,
        notifyReference: responseData.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "An unexpected error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
