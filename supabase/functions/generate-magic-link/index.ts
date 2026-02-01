import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateMagicLinkRequest {
  email: string;
}

// Rate limit configuration
const RATE_LIMIT_WINDOW_MINUTES = 5;
const MAX_REQUESTS_PER_WINDOW = 2;

// Extract client IP from request headers
function getClientIP(req: Request): string {
  // Try various headers in order of reliability
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;

  const xRealIP = req.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;

  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // Take the first IP in the chain (original client)
    return xForwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase admin client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { email }: GenerateMagicLinkRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Extract client information
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const timestamp = new Date().toISOString();

    console.log("Magic link request from IP:", clientIP, "for email:", email);

    // Check rate limit - count requests from this IP in the past 5 minutes
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: recentRequests, error: countError } = await supabaseAdmin
      .from("magic_link_rate_limits")
      .select("id, created_at")
      .eq("ip_address", clientIP)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("Error checking rate limits:", countError);
      // Continue with request if rate limit check fails (fail open for availability)
    }

    const requestCount = recentRequests?.length || 0;

    // Log this request to rate limits table
    const { error: insertError } = await supabaseAdmin
      .from("magic_link_rate_limits")
      .insert({
        ip_address: clientIP,
        email_requested: email,
        user_agent: userAgent,
        blocked: requestCount >= MAX_REQUESTS_PER_WINDOW,
      });

    if (insertError) {
      console.error("Error logging rate limit:", insertError);
    }

    // Check if rate limited
    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
      console.warn("Rate limit exceeded for IP:", clientIP, "Count:", requestCount + 1);

      // Calculate wait time - find the oldest request in window and calculate when it expires
      const oldestRequest = recentRequests?.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0];

      let waitSeconds = RATE_LIMIT_WINDOW_MINUTES * 60; // Default to full window
      if (oldestRequest) {
        const oldestTime = new Date(oldestRequest.created_at).getTime();
        const windowEnd = oldestTime + (RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
        waitSeconds = Math.ceil((windowEnd - Date.now()) / 1000);
        if (waitSeconds < 0) waitSeconds = 0;
      }

      // Trigger admin notification (async, don't wait)
      fetch(`${supabaseUrl}/functions/v1/notify-admin-rate-limit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          ip_address: clientIP,
          email_requested: email,
          user_agent: userAgent,
          request_count: requestCount + 1,
          timestamp: timestamp,
        }),
      }).catch((err) => {
        console.error("Failed to send admin notification:", err);
      });

      // Log to security_events table if it exists
      try {
        await supabaseAdmin.from("security_events").insert({
          event_type: "magic_link_rate_limit",
          severity: "warning",
          ip_address: clientIP,
          user_agent: userAgent,
          details: {
            email_requested: email,
            request_count: requestCount + 1,
            window_minutes: RATE_LIMIT_WINDOW_MINUTES,
          },
        });
      } catch (securityLogError) {
        console.error("Failed to log security event:", securityLogError);
      }

      return new Response(
        JSON.stringify({
          error: "Too many requests. Please wait before trying again.",
          rate_limited: true,
          wait_seconds: waitSeconds,
          success: false,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Generating magic link for:", email);

    // Generate magic link using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (error) {
      console.error("Error generating magic link:", error);
      throw new Error(error.message);
    }

    if (!data?.properties?.hashed_token) {
      throw new Error("Failed to generate magic link - no hashed token returned");
    }

    // Build a confirmation URL that goes to our auth-confirm page first
    const tokenHash = data.properties.hashed_token;
    const confirmUrl = `https://gpnotewell.co.uk/auth-confirm?token_hash=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent('https://gpnotewell.co.uk/')}`;

    const userName = email.split("@")[0];

    console.log("Magic link generated successfully, sending via EmailJS");

    // Send the email via the send-magic-link function
    const sendEmailResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-magic-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          email: email,
          magic_link: confirmUrl,
          user_name: userName,
        }),
      }
    );

    if (!sendEmailResponse.ok) {
      const errorText = await sendEmailResponse.text();
      console.error("Error sending magic link email:", errorText);
      throw new Error(`Failed to send magic link email: ${errorText}`);
    }

    const sendResult = await sendEmailResponse.json();
    console.log("Magic link email sent successfully:", sendResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Magic link sent successfully via EmailJS",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-magic-link function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
