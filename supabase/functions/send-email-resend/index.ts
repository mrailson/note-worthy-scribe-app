import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Buffer } from "node:buffer";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to_email: string;
  to_name?: string;
  subject: string;
  html_content: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  cc_email?: string;
  bcc_email?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    type: string;
  }>;
}

// Simple in-memory rate limiter (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // Max emails per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

const checkRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const emailData: EmailRequest = await req.json();

    console.log("Sending email via Resend to:", emailData.to_email);
    console.log("Subject:", emailData.subject);
    console.log("Client IP:", clientIP);

    // Validate required fields
    if (!emailData.to_email || !emailData.subject || !emailData.html_content) {
      console.error("Missing required email fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_email, subject, html_content" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.to_email)) {
      console.error("Invalid email format:", emailData.to_email);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build attachments array for Resend using Buffer
    const attachments = emailData.attachments?.map(att => {
      const buffer = Buffer.from(att.content, 'base64');
      console.log(`Attachment: ${att.filename}, size: ${buffer.length} bytes`);
      return {
        filename: att.filename,
        content: buffer,
      };
    }) || [];

    console.log(`Total attachments: ${attachments.length}`);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: emailData.from_email 
        ? `${emailData.from_name || 'Notewell AI'} <${emailData.from_email}>`
        : "Notewell AI <noreply@bluepcn.co.uk>",
      to: [emailData.to_email],
      cc: emailData.cc_email ? [emailData.cc_email] : undefined,
      bcc: emailData.bcc_email ? [emailData.bcc_email] : undefined,
      reply_to: emailData.reply_to,
      subject: emailData.subject,
      html: emailData.html_content,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message, success: false }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-email-resend function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
