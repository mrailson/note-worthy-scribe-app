import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RateLimitAlertRequest {
  ip_address: string;
  email_requested: string;
  user_agent: string;
  request_count: number;
  timestamp: string;
}

// Parse browser info from User-Agent string
function parseBrowser(userAgent: string): string {
  if (!userAgent) return "Unknown browser";
  
  // Check for common browsers
  if (userAgent.includes("Edg/")) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return `Microsoft Edge ${match?.[1] || ""}`.trim();
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
  
  // Check for OS info
  let os = "Unknown OS";
  if (userAgent.includes("Windows NT 10")) os = "Windows 10/11";
  else if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS X")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("iPhone")) os = "iOS";
  else if (userAgent.includes("Android")) os = "Android";
  
  return `Unknown browser on ${os}`;
}

// Parse OS from User-Agent
function parseOS(userAgent: string): string {
  if (!userAgent) return "Unknown";
  
  if (userAgent.includes("Windows NT 10")) return "Windows 10/11";
  if (userAgent.includes("Windows NT 6.3")) return "Windows 8.1";
  if (userAgent.includes("Windows NT 6.2")) return "Windows 8";
  if (userAgent.includes("Windows NT 6.1")) return "Windows 7";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS X")) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (match) return `macOS ${match[1].replace("_", ".")}`;
    return "macOS";
  }
  if (userAgent.includes("iPhone")) return "iOS (iPhone)";
  if (userAgent.includes("iPad")) return "iOS (iPad)";
  if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android (\d+)/);
    if (match) return `Android ${match[1]}`;
    return "Android";
  }
  if (userAgent.includes("Linux")) return "Linux";
  
  return "Unknown";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      ip_address, 
      email_requested, 
      user_agent, 
      request_count,
      timestamp 
    }: RateLimitAlertRequest = await req.json();

    console.log("Rate limit alert triggered for IP:", ip_address);

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    // Fetch geolocation from ip-api.com (free, no API key required)
    let location = "Location unavailable";
    try {
      const geoResponse = await fetch(`http://ip-api.com/json/${ip_address}?fields=status,city,regionName,country,isp`);
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData.status === "success") {
          location = `${geoData.city || "Unknown city"}, ${geoData.regionName || ""}, ${geoData.country || "Unknown country"}`.replace(/, ,/g, ",").replace(/^, /, "");
          if (geoData.isp) {
            location += ` (ISP: ${geoData.isp})`;
          }
        }
      }
    } catch (geoError) {
      console.warn("Failed to fetch geolocation:", geoError);
    }

    // Parse browser and OS
    const browser = parseBrowser(user_agent);
    const os = parseOS(user_agent);

    // Format UK date/time
    const dateTime = new Date(timestamp).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-label { font-weight: bold; width: 140px; color: #6b7280; }
    .detail-value { flex: 1; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⚠️ Rate Limit Alert</h1>
      <p style="margin: 10px 0 0 0;">Magic Link Request Limit Exceeded</p>
    </div>
    <div class="content">
      <p>An IP address has exceeded the magic link request limit (${request_count} requests in 5 minutes).</p>
      
      <h3 style="margin-top: 20px; color: #111827;">Request Details</h3>
      
      <div class="detail-row">
        <span class="detail-label">IP Address:</span>
        <span class="detail-value"><strong>${ip_address}</strong></span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Email Entered:</span>
        <span class="detail-value"><strong>${email_requested}</strong></span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Browser:</span>
        <span class="detail-value">${browser}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Operating System:</span>
        <span class="detail-value">${os}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Date/Time:</span>
        <span class="detail-value">${dateTime}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${location}</span>
      </div>
      
      <div class="detail-row" style="border-bottom: none;">
        <span class="detail-label">Request Count:</span>
        <span class="detail-value">${request_count} in 5 minutes</span>
      </div>
      
      <div class="warning">
        <strong>This may indicate:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>A user having difficulty logging in</li>
          <li>An automated attack attempt</li>
          <li>Shared IP address (e.g., NHS network, VPN)</li>
        </ul>
      </div>
      
      <p style="margin-top: 20px;">
        <strong>Action taken:</strong> This IP is now blocked from magic link requests for 5 minutes.
      </p>
    </div>
    <div class="footer">
      <p>Notewell AI Security Alert System</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: "Notewell AI Security <noreply@bluepcn.co.uk>",
      to: ["malcolm.railson@nhs.net"],
      subject: `⚠️ Magic Link Rate Limit Alert - ${ip_address}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Failed to send rate limit alert email:", emailError);
      throw new Error(`Email send failed: ${emailError.message}`);
    }

    console.log("Rate limit alert email sent successfully to malcolm.railson@nhs.net");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin notification sent successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-rate-limit function:", error);
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
