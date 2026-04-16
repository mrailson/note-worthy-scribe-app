import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SurveyStats {
  title: string;
  type: string;
  responseCount: number;
}

interface EmailPreference {
  user_id: string;
  practice_id: string;
  profiles: {
    email: string;
    full_name: string;
  };
}

interface SurveyWithResponses {
  id: string;
  title: string;
  survey_type: string;
  survey_responses: Array<{ id: string; submitted_at: string }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Send survey digest function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all users with weekly digest enabled
    const { data: preferences, error: prefError } = await supabase
      .from('survey_email_preferences')
      .select(`
        user_id,
        practice_id,
        profiles!inner(email, full_name)
      `)
      .eq('receive_weekly_digest', true);

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch email preferences' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${preferences?.length || 0} users with weekly digest enabled`);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let emailsSent = 0;
    const errors: string[] = [];

    for (const pref of (preferences || []) as unknown as EmailPreference[]) {
      try {
        // Get surveys for this practice
        const { data: surveys, error: surveyError } = await supabase
          .from('surveys')
          .select(`
            id, title, survey_type,
            survey_responses(id, submitted_at)
          `)
          .eq('practice_id', pref.practice_id)
          .eq('status', 'active');

        if (surveyError) {
          console.error(`Error fetching surveys for practice ${pref.practice_id}:`, surveyError);
          continue;
        }

        // Filter to responses from last 7 days and calculate stats
        const surveyStats: SurveyStats[] = ((surveys || []) as SurveyWithResponses[])
          .map(s => ({
            title: s.title,
            type: s.survey_type,
            responseCount: (s.survey_responses || []).filter(
              r => new Date(r.submitted_at) > oneWeekAgo
            ).length
          }))
          .filter(s => s.responseCount > 0);

        if (surveyStats.length === 0) {
          console.log(`No new responses for practice ${pref.practice_id} - skipping email`);
          continue;
        }

        const totalResponses = surveyStats.reduce((sum, s) => sum + s.responseCount, 0);

        // Generate email HTML
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .stat-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6; }
              .stat-title { font-weight: 600; color: #1f2937; margin-bottom: 5px; }
              .stat-count { font-size: 24px; color: #3b82f6; font-weight: bold; }
              .stat-type { font-size: 12px; color: #6b7280; text-transform: uppercase; }
              .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .summary { background: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 Weekly Survey Digest</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your survey activity summary for the past 7 days</p>
              </div>
              <div class="content">
                <div class="summary">
                  <strong>Total new responses this week:</strong> ${totalResponses}
                </div>
                
                <p>Hello ${pref.profiles.full_name || 'Practice Manager'},</p>
                <p>Here's a summary of your survey activity:</p>
                
                ${surveyStats.map(s => `
                  <div class="stat-card">
                    <div class="stat-type">${formatSurveyType(s.type)}</div>
                    <div class="stat-title">${s.title}</div>
                    <div class="stat-count">${s.responseCount} new response${s.responseCount !== 1 ? 's' : ''}</div>
                  </div>
                `).join('')}
                
                <a href="https://meetingmagic.lovable.app/surveys" class="button">View Full Dashboard</a>
              </div>
              <div class="footer">
                <p>This is an automated weekly digest from Notewell Survey Manager.</p>
                <p>You can manage your email preferences in the Survey Manager settings.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Send email with Resend
        const { error: emailError } = await resend.emails.send({
          from: 'Notewell Surveys <noreply@bluepcn.co.uk>',
          to: [pref.profiles.email],
          subject: `📊 Weekly Survey Digest - ${totalResponses} new response${totalResponses !== 1 ? 's' : ''}`,
          html: emailHtml
        });

        if (emailError) {
          console.error(`Error sending email to ${pref.profiles.email}:`, emailError);
          errors.push(`Failed to send to ${pref.profiles.email}`);
        } else {
          console.log(`Successfully sent digest to ${pref.profiles.email}`);
          emailsSent++;
        }
      } catch (userError) {
        console.error(`Error processing user ${pref.user_id}:`, userError);
        errors.push(`Error processing user ${pref.user_id}`);
      }
    }

    console.log(`Digest complete: ${emailsSent} emails sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        errors: errors.length > 0 ? errors : undefined 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in send-survey-digest:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

function formatSurveyType(type: string): string {
  const types: Record<string, string> = {
    'patient_experience': 'Patient Experience',
    'staff': 'Staff Survey',
    'custom': 'Custom Survey',
    'event_training': 'Event/Training Feedback'
  };
  return types[type] || type;
}

serve(handler);
