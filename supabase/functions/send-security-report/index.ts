import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Parse browser info from User-Agent string
function parseBrowser(userAgent: string): string {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("Edg/")) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return `Edge ${match?.[1] || ""}`.trim();
  }
  if (userAgent.includes("Chrome/")) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return `Chrome ${match?.[1] || ""}`.trim();
  }
  if (userAgent.includes("Firefox/")) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return `Firefox ${match?.[1] || ""}`.trim();
  }
  if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
    const match = userAgent.match(/Version\/(\d+)/);
    return `Safari ${match?.[1] || ""}`.trim();
  }
  return "Unknown";
}

// Parse OS from User-Agent
function parseOS(userAgent: string): string {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("Windows NT 10")) return "Windows 10/11";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS X")) return "macOS";
  if (userAgent.includes("iPhone")) return "iOS";
  if (userAgent.includes("iPad")) return "iPadOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Linux")) return "Linux";
  return "Unknown";
}

// Format date in UK format (DD/MM/YYYY HH:mm)
function formatUKDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// Escape HTML to prevent injection
function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = claimsData.claims.email as string;
    console.log(`Security report requested by: ${userEmail}`);

    // Parse request body
    const { recipient_email, days = 30 } = await req.json();

    if (!recipient_email) {
      return new Response(
        JSON.stringify({ error: "recipient_email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Calculate date range
    const now = new Date();
    const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const sinceISO = sinceDate.toISOString();

    console.log(`Fetching security data from ${sinceISO} (last ${days} days)`);

    // Use service role for reading data
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch rate limit events and security events in parallel
    const [rateLimitResult, securityEventsResult] = await Promise.all([
      serviceSupabase
        .from("login_rate_limits")
        .select("*")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false }),
      serviceSupabase
        .from("security_events")
        .select("*")
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false }),
    ]);

    if (rateLimitResult.error) {
      console.error("Error fetching rate limits:", rateLimitResult.error);
    }
    if (securityEventsResult.error) {
      console.error("Error fetching security events:", securityEventsResult.error);
    }

    const rateLimits = rateLimitResult.data || [];
    const securityEvents = securityEventsResult.data || [];

    console.log(`Found ${rateLimits.length} rate limit entries, ${securityEvents.length} security events`);

    // Calculate summary stats
    const totalAttempts = rateLimits.length;
    const blockedAttempts = rateLimits.filter((r: any) => r.is_blocked === true).length;
    const uniqueIPs = new Set(rateLimits.map((r: any) => r.ip_address).filter(Boolean)).size;
    const uniqueEmails = new Set(rateLimits.map((r: any) => r.email_attempted).filter(Boolean)).size;

    // Format report date
    const reportDate = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Build rate limit rows
    let rateLimitRows = "";
    if (rateLimits.length === 0) {
      rateLimitRows = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#6b7280;">No rate limit events in this period</td></tr>`;
    } else {
      for (const rl of rateLimits) {
        const userAgent = (rl as any).user_agent || "";
        const browser = parseBrowser(userAgent);
        const os = parseOS(userAgent);
        const blocked = (rl as any).is_blocked === true;
        rateLimitRows += `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${formatUKDateTime((rl as any).created_at)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml((rl as any).ip_address || "—")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml((rl as any).email_attempted || "—")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml(browser)} / ${escapeHtml(os)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${(rl as any).attempt_count || 1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;${blocked ? "background:#fee2e2;color:#dc2626;" : "background:#dcfce7;color:#16a34a;"}">
                ${blocked ? "Blocked" : "Allowed"}
              </span>
            </td>
          </tr>`;
      }
    }

    // Build security event rows
    let securityEventRows = "";
    if (securityEvents.length === 0) {
      securityEventRows = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#6b7280;">No security events in this period</td></tr>`;
    } else {
      for (const se of securityEvents) {
        const details = (se as any).event_details || {};
        const severity = (se as any).severity || "info";
        let severityColour = "#3b82f6";
        if (severity === "high" || severity === "critical") severityColour = "#dc2626";
        else if (severity === "medium") severityColour = "#f59e0b";

        securityEventRows += `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml((se as any).event_type || "—")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${severityColour}22;color:${severityColour};">
                ${escapeHtml(severity)}
              </span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml((se as any).user_email || details?.email || "—")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml((se as any).ip_address || details?.ip || "—")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${formatUKDateTime((se as any).created_at)}</td>
          </tr>`;
      }
    }

    // Build the full HTML email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .summary-grid { display: flex; gap: 12px; margin-bottom: 24px; }
    .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .number { font-size: 28px; font-weight: 700; color: #1e3a5f; }
    .summary-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .section-title { font-size: 18px; font-weight: 600; color: #1e3a5f; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
    .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Notewell Security Report</h1>
      <p>Generated ${reportDate} · Last ${days} days · Requested by ${escapeHtml(userEmail)}</p>
    </div>
    <div class="content">
      <!-- Summary Cards -->
      <!--[if mso]><table role="presentation" width="100%"><tr><td width="25%" valign="top"><![endif]-->
      <table role="presentation" width="100%" style="margin-bottom:24px;">
        <tr>
          <td style="padding:6px;" width="25%">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${totalAttempts}</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Login Attempts</div>
            </div>
          </td>
          <td style="padding:6px;" width="25%">
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#dc2626;">${blockedAttempts}</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Blocked</div>
            </div>
          </td>
          <td style="padding:6px;" width="25%">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${uniqueIPs}</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Unique IPs</div>
            </div>
          </td>
          <td style="padding:6px;" width="25%">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${uniqueEmails}</div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Unique Emails</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Rate Limit Events -->
      <div class="section-title">📊 Login Rate Limit Events (${rateLimits.length})</div>
      <table>
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>IP Address</th>
            <th>Email</th>
            <th>Browser / OS</th>
            <th>Attempts</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rateLimitRows}
        </tbody>
      </table>

      <!-- Security Events -->
      <div class="section-title">🔐 Security Events (${securityEvents.length})</div>
      <table>
        <thead>
          <tr>
            <th>Event Type</th>
            <th>Severity</th>
            <th>User Email</th>
            <th>IP Address</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${securityEventRows}
        </tbody>
      </table>
    </div>
    <div class="footer">
      <p>Notewell AI · Security Monitoring · Report generated automatically</p>
      <p>This email was sent to ${escapeHtml(recipient_email)} from noreply@bluepcn.co.uk</p>
    </div>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const { error: emailError } = await resend.emails.send({
      from: "Notewell AI Security <noreply@bluepcn.co.uk>",
      to: [recipient_email],
      subject: `Notewell Security Report — ${reportDate}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Email send failed: ${emailError.message}`);
    }

    console.log(`Security report sent successfully to ${recipient_email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Security report sent to ${recipient_email}`,
        summary: {
          totalAttempts,
          blockedAttempts,
          uniqueIPs,
          uniqueEmails,
          securityEvents: securityEvents.length,
          periodDays: days,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-security-report:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
