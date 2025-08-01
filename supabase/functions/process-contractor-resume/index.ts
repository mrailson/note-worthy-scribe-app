import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeId, fileContent } = await req.json();
    console.log('Processing resume:', resumeId);

    // Update resume status to processing
    await supabase
      .from('contractor_resumes')
      .update({ processing_status: 'processing' })
      .eq('id', resumeId);

    // Parse resume content with OpenAI
    const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert contractor resume parser. Extract structured information from contractor resumes.
            
            Return ONLY valid JSON with this exact structure:
            {
              "personal_info": {
                "name": "Full Name",
                "email": "email@example.com",
                "phone": "+44 123 456 7890",
                "location": "City, Region"
              },
              "trade": "Primary trade (Electrician, Plumber, Carpenter, etc.)",
              "experience": [
                {
                  "employer": "Company Name",
                  "position": "Job Title",
                  "start_date": "YYYY-MM-DD or null",
                  "end_date": "YYYY-MM-DD or null",
                  "is_current": false,
                  "description": "Brief description"
                }
              ],
              "competencies": [
                {
                  "name": "Skill/Certification Name",
                  "type": "skill|certification|tool|system",
                  "level": "basic|intermediate|advanced|expert|unknown",
                  "expiry_date": "YYYY-MM-DD or null",
                  "issuing_body": "Organization name or null"
                }
              ],
              "availability": {
                "status": "immediately|notice_required|unavailable|unknown",
                "date": "YYYY-MM-DD or null",
                "notice_period": "e.g., 2 weeks, 1 month, or null"
              },
              "years_experience": 0,
              "red_flags": [
                "List of potential concerns or gaps"
              ],
              "summary": "Brief professional summary"
            }`
          },
          {
            role: 'user',
            content: `Parse this contractor resume:\n\n${fileContent}`
          }
        ],
        temperature: 0.1,
      }),
    });

    const parseData = await parseResponse.json();
    const extractedData = JSON.parse(parseData.choices[0].message.content);
    console.log('Extracted data:', extractedData);

    // Calculate scores
    const scores = calculateScores(extractedData);
    
    // Generate AI summary and recommendations
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a contractor recruitment expert. Analyze the extracted resume data and provide insights.
            
            Return ONLY valid JSON with this structure:
            {
              "ai_summary": "Professional summary highlighting key strengths and concerns",
              "recommendations": [
                {
                  "type": "question|concern|follow_up|action",
                  "title": "Brief title",
                  "description": "Detailed recommendation",
                  "priority": "low|medium|high"
                }
              ]
            }`
          },
          {
            role: 'user',
            content: `Analyze this contractor profile:\n\n${JSON.stringify(extractedData, null, 2)}`
          }
        ],
        temperature: 0.2,
      }),
    });

    const analysisData = await analysisResponse.json();
    const analysis = JSON.parse(analysisData.choices[0].message.content);

    // Get the contractor from the resume
    const { data: resume } = await supabase
      .from('contractor_resumes')
      .select('contractor_id')
      .eq('id', resumeId)
      .single();

    if (!resume) {
      throw new Error('Resume not found');
    }

    // Update contractor profile
    await supabase
      .from('contractors')
      .update({
        name: extractedData.personal_info?.name || 'Unknown',
        email: extractedData.personal_info?.email,
        phone: extractedData.personal_info?.phone,
        location: extractedData.personal_info?.location,
        trade: extractedData.trade,
        availability_status: extractedData.availability?.status || 'unknown',
        availability_date: extractedData.availability?.date,
        overall_score: scores.overall,
        experience_score: scores.experience,
        certification_score: scores.certification,
        availability_score: scores.availability,
        completeness_score: scores.completeness,
        ai_summary: analysis.ai_summary,
        red_flags: extractedData.red_flags || [],
        status: scores.overall >= 70 ? 'approved' : 'needs_review'
      })
      .eq('id', resume.contractor_id);

    // Update resume with extracted data
    await supabase
      .from('contractor_resumes')
      .update({
        parsed_content: extractedData.summary || '',
        raw_extracted_data: extractedData,
        processing_status: 'completed'
      })
      .eq('id', resumeId);

    // Insert competencies
    if (extractedData.competencies && extractedData.competencies.length > 0) {
      const competencies = extractedData.competencies.map(comp => ({
        contractor_id: resume.contractor_id,
        competency_type: comp.type,
        name: comp.name,
        level: comp.level || 'unknown',
        expiry_date: comp.expiry_date,
        issuing_body: comp.issuing_body
      }));

      await supabase
        .from('contractor_competencies')
        .insert(competencies);
    }

    // Insert experience
    if (extractedData.experience && extractedData.experience.length > 0) {
      const experience = extractedData.experience.map(exp => ({
        contractor_id: resume.contractor_id,
        employer: exp.employer,
        position: exp.position,
        start_date: exp.start_date,
        end_date: exp.end_date,
        is_current: exp.is_current || false,
        description: exp.description
      }));

      await supabase
        .from('contractor_experience')
        .insert(experience);
    }

    // Insert recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      const recommendations = analysis.recommendations.map(rec => ({
        contractor_id: resume.contractor_id,
        recommendation_type: rec.type,
        title: rec.title,
        description: rec.description,
        priority: rec.priority
      }));

      await supabase
        .from('contractor_recommendations')
        .insert(recommendations);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      scores,
      summary: analysis.ai_summary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing resume:', error);
    
    // Update resume status to failed if resumeId is available
    const body = await req.clone().json().catch(() => ({}));
    if (body.resumeId) {
      await supabase
        .from('contractor_resumes')
        .update({ processing_status: 'failed' })
        .eq('id', body.resumeId);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateScores(data: any) {
  let experienceScore = 0;
  let certificationScore = 0;
  let availabilityScore = 0;
  let completenessScore = 0;

  // Experience scoring (0-40 points)
  const years = data.years_experience || 0;
  if (years >= 10) experienceScore = 40;
  else if (years >= 5) experienceScore = 30;
  else if (years >= 2) experienceScore = 20;
  else if (years >= 1) experienceScore = 10;

  // Certification scoring (0-30 points)
  const certifications = data.competencies?.filter(c => c.type === 'certification') || [];
  const keyTradeCerts = certifications.filter(c => 
    c.name.toLowerCase().includes('gas safe') ||
    c.name.toLowerCase().includes('niceic') ||
    c.name.toLowerCase().includes('ciphe') ||
    c.name.toLowerCase().includes('nvq') ||
    c.name.toLowerCase().includes('city & guilds')
  );
  
  certificationScore = Math.min(keyTradeCerts.length * 10, 30);

  // Availability scoring (0-20 points)
  if (data.availability?.status === 'immediately') availabilityScore = 20;
  else if (data.availability?.status === 'notice_required') availabilityScore = 15;
  else if (data.availability?.date) availabilityScore = 10;
  else availabilityScore = 0;

  // Completeness scoring (0-10 points)
  let completenessCount = 0;
  if (data.personal_info?.name) completenessCount++;
  if (data.personal_info?.email) completenessCount++;
  if (data.personal_info?.phone) completenessCount++;
  if (data.personal_info?.location) completenessCount++;
  if (data.trade) completenessCount++;
  if (data.experience?.length > 0) completenessCount++;
  if (data.competencies?.length > 0) completenessCount++;
  if (data.summary) completenessCount++;
  
  completenessScore = Math.floor((completenessCount / 8) * 10);

  const overall = experienceScore + certificationScore + availabilityScore + completenessScore;

  return {
    experience: experienceScore,
    certification: certificationScore,
    availability: availabilityScore,
    completeness: completenessScore,
    overall
  };
}