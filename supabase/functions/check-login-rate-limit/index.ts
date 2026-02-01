import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckLoginRequest {
  email: string;
}

// Rate limit configuration
const RATE_LIMIT_WINDOW_MINUTES = 5;
const MAX_ATTEMPTS_PER_WINDOW = 5;

// Extract client IP from request headers
function getClientIP(req: Request): string {
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;

  const xRealIP = req.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;

  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
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
    const { email }: CheckLoginRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Extract client information
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const timestamp = new Date().toISOString();

    console.log("Login attempt from IP:", clientIP, "for email:", email);

    // Check rate limit - count attempts from this IP in the past 5 minutes
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: recentAttempts, error: countError } = await supabaseAdmin
      .from("login_rate_limits")
      .select("id, created_at")
      .eq("ip_address", clientIP)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("Error checking rate limits:", countError);
      // Continue with request if rate limit check fails (fail open for availability)
    }

    const attemptCount = recentAttempts?.length || 0;

    // Log this attempt to rate limits table
    const { error: insertError } = await supabaseAdmin
      .from("login_rate_limits")
      .insert({
        ip_address: clientIP,
        email_attempted: email,
        user_agent: userAgent,
        blocked: attemptCount >= MAX_ATTEMPTS_PER_WINDOW,
      });

    if (insertError) {
      console.error("Error logging login attempt:", insertError);
    }

    // Check if rate limited
    if (attemptCount >= MAX_ATTEMPTS_PER_WINDOW) {
      console.warn("Login rate limit exceeded for IP:", clientIP, "Count:", attemptCount + 1);

      // Calculate wait time
      const oldestAttempt = recentAttempts?.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0];

      let waitSeconds = RATE_LIMIT_WINDOW_MINUTES * 60;
      if (oldestAttempt) {
        const oldestTime = new Date(oldestAttempt.created_at).getTime();
        const windowEnd = oldestTime + (RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
        waitSeconds = Math.ceil((windowEnd - Date.now()) / 1000);
        if (waitSeconds < 0) waitSeconds = 0;
      }

      // Trigger admin notification (async, don't wait)
      fetch(`${supabaseUrl}/functions/v1/notify-login-rate-limit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          ip_address: clientIP,
          email_attempted: email,
          user_agent: userAgent,
          attempt_count: attemptCount + 1,
          timestamp: timestamp,
        }),
      }).catch((err) => {
        console.error("Failed to send admin notification:", err);
      });

      // Log to security_events table
      try {
        await supabaseAdmin.from("security_events").insert({
          event_type: "login_rate_limit",
          severity: "warning",
          ip_address: clientIP,
          user_agent: userAgent,
          details: {
            email_attempted: email,
            attempt_count: attemptCount + 1,
            window_minutes: RATE_LIMIT_WINDOW_MINUTES,
          },
        });
      } catch (securityLogError) {
        console.error("Failed to log security event:", securityLogError);
      }

      return new Response(
        JSON.stringify({
          allowed: false,
          rate_limited: true,
          wait_seconds: waitSeconds,
          message: `Too many login attempts. Please wait ${Math.ceil(waitSeconds / 60)} minutes before trying again.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Not rate limited - allow login attempt
    return new Response(
      JSON.stringify({
        allowed: true,
        rate_limited: false,
        attempts_remaining: MAX_ATTEMPTS_PER_WINDOW - attemptCount - 1,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-login-rate-limit function:", error);
    // On error, allow the login attempt (fail open)
    return new Response(
      JSON.stringify({
        allowed: true,
        rate_limited: false,
        error: error.message,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
