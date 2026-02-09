import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail } = await req.json();
    if (!recipientEmail) {
      throw new Error("recipientEmail is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all entries with user names
    const { data: entries, error } = await supabase
      .from("nres_hours_entries")
      .select("*")
      .order("work_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw error;

    // Fetch profiles for name lookup
    const userIds = [...new Set((entries || []).map((e: any) => e.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    // Sort by name then date
    const sorted = (entries || []).sort((a: any, b: any) => {
      const nameA = profileMap.get(a.user_id)?.full_name || "Unknown";
      const nameB = profileMap.get(b.user_id)?.full_name || "Unknown";
      const cmp = nameA.localeCompare(nameB);
      if (cmp !== 0) return cmp;
      return a.work_date.localeCompare(b.work_date) || a.start_time.localeCompare(b.start_time);
    });

    // Build HTML table
    const rows = sorted
      .map((e: any, i: number) => {
        const profile = profileMap.get(e.user_id);
        const name = profile?.full_name || "Unknown";
        const email = profile?.email || "";
        const bg = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
        return `<tr style="background:${bg}">
          <td style="padding:6px 10px;border:1px solid #dee2e6">${i + 1}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${name}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${email}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.work_date}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.start_time?.slice(0, 5) || ""}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.end_time?.slice(0, 5) || ""}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.duration_hours}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.activity_type || ""}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.description || ""}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.claimant_type || "personal"}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.claimant_name || ""}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6">${e.entered_by ? (profileMap.get(e.entered_by)?.full_name || e.entered_by) : ""}</td>
          <td style="padding:6px 10px;border:1px solid #dee2e6;font-size:11px">${e.created_at?.slice(0, 16).replace("T", " ") || ""}</td>
        </tr>`;
      })
      .join("");

    const totalHours = sorted.reduce(
      (sum: number, e: any) => sum + parseFloat(e.duration_hours || 0),
      0
    );

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:100%;overflow-x:auto">
        <h2 style="color:#005EB8">NRES Hours Tracker – Full Export</h2>
        <p>Total entries: <strong>${sorted.length}</strong> | Total hours: <strong>${totalHours.toFixed(2)}</strong></p>
        <p style="color:#666;font-size:13px">Generated: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</p>
        <table style="border-collapse:collapse;font-size:13px;width:100%">
          <thead>
            <tr style="background:#005EB8;color:white">
              <th style="padding:8px 10px;border:1px solid #dee2e6">#</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Name</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Email</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Work Date</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Start</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">End</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Hours</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Activity</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Description</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Claimant Type</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Claimant Name</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Entered By</th>
              <th style="padding:8px 10px;border:1px solid #dee2e6">Created At</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from: "Notewell AI <noreply@bluepcn.co.uk>",
      to: [recipientEmail],
      subject: `NRES Hours Tracker – Full Export (${sorted.length} entries)`,
      html,
    });

    if (emailError) throw emailError;

    return new Response(
      JSON.stringify({ success: true, count: sorted.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
