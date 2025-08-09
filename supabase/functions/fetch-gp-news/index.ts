import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsArticle {
  title: string;
  summary: string;
  content: string;
  url: string;
  image_url?: string;
  source: string;
  published_at: string;
  relevance_score: number;
  tags: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    
    // Handle full article request
    if (body.mode === 'full_article') {
      console.log(`Fetching full article content`);
      
      if (perplexityApiKey) {
        const fullArticleResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
              {
                role: 'system',
                content: 'You are a healthcare journalist. Provide comprehensive, detailed articles about NHS and GP practice news based on real information. Structure with clear sections and practical implications for healthcare professionals. Maximum 5000 words.'
              },
              {
                role: 'user',
                content: `Write a comprehensive, detailed article about: ${body.title || 'NHS GP practice developments'}. Include background, current situation, implications for GP practices, and practical advice for practice managers and clinicians. Use real, current information.`
              }
            ],
            temperature: 0.2,
            max_tokens: 4000,
          }),
        });

        if (fullArticleResponse.ok) {
          const fullArticleData = await fullArticleResponse.json();
          const content = fullArticleData.choices[0]?.message?.content || '';
          
          return new Response(JSON.stringify({ content }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      return new Response(JSON.stringify({ 
        content: "Full article content is currently unavailable. Please check back later.",
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching real NHS GP practice news...');

    // Initialize articles array
    let newsArticles: NewsArticle[] = [];

    // Fetch real news using Perplexity API
    if (perplexityApiKey) {
      console.log('Using Perplexity API to fetch real NHS news...');
      // Try to call Perplexity API for real news content
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
              {
                role: 'system',
                content: `You are a news aggregator for NHS GP practices. Find and format real, current news articles relevant to GP practice managers, clinicians, and healthcare administrators in the UK.

Return exactly 5 real news articles as a JSON array. For each article:
- title: Actual headline from news source
- summary: 150-200 word summary of the article
- content: 500-800 word detailed content based on the real article
- url: Original source URL
- source: Actual news source name
- published_at: Actual publication date in ISO format
- relevance_score: Number between 7-10 based on relevance to GP practices
- tags: Array of 3-5 relevant tags

Focus on recent (last 30 days) topics like:
- NHS policy updates and announcements
- GP practice management and funding
- Clinical guidelines and protocols
- Healthcare technology and digital health
- Primary care networks and partnerships
- Workforce planning and recruitment
- Patient care improvements
- Regulatory changes and compliance

Only include real, verifiable news from credible sources like NHS England, BMJ, Pulse Today, GPonline, Department of Health, CQC, etc.`
              },
              {
                role: 'user',
                content: 'Find 5 current real news articles about NHS GP practices, primary care policy, and healthcare management from the last 30 days. Include actual sources and URLs.'
              }
            ],
            temperature: 0.2,
            max_tokens: 3000,
            search_recency_filter: 'month',
            return_images: false,
            return_related_questions: false,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          console.log('Perplexity response received');
          
          try {
            // Extract JSON from the response if it's wrapped in text
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            const jsonContent = jsonMatch ? jsonMatch[0] : content;
            const parsedContent = JSON.parse(jsonContent);
            
            if (Array.isArray(parsedContent)) {
              newsArticles = parsedContent.map((article: any) => ({
                title: article.title || 'News Article',
                summary: article.summary || 'Article summary',
                content: article.content || 'Article content',
                url: article.url || 'https://www.england.nhs.uk/news/',
                source: article.source || 'NHS News',
                published_at: article.published_at || new Date().toISOString(),
                relevance_score: article.relevance_score || 7,
                tags: Array.isArray(article.tags) ? article.tags : ['NHS', 'GP Practice'],
                image_url: article.image_url || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=600&h=400&fit=crop'
              }));
              console.log(`Fetched ${newsArticles.length} real articles from Perplexity`);
            }
          } catch (parseError) {
            console.log('Failed to parse Perplexity response, using fallback');
            console.error('Parse error:', parseError);
          }
        } else {
          console.error('Perplexity API error:', await response.text());
        }
      } catch (apiError) {
        console.error('Perplexity API error:', apiError);
      }
    } else {
      console.log('No Perplexity API key found');
    }

    // Fallback news articles if Perplexity fails or is not configured
    if (newsArticles.length === 0) {
      console.log('Perplexity API failed or not configured - showing fallback message');
      
      newsArticles = [
        {
          title: "Real NHS News Requires API Configuration",
          summary: "The news system is configured to fetch real, current NHS and GP practice news from credible healthcare sources. However, the Perplexity API connection appears to be unavailable or misconfigured.",
          content: "This system is designed to provide real-time access to current NHS news, GP practice updates, and healthcare policy changes from authoritative sources including NHS England, BMJ, Pulse Today, GP Online, and other healthcare publications. To enable real news fetching, please ensure the Perplexity API key is properly configured. Once configured, the system will automatically fetch current articles about GP practice management, NHS policy updates, clinical guidelines, digital health initiatives, workforce planning, and other topics relevant to healthcare professionals. The system searches for articles from the last 30 days and filters them for relevance to primary care and practice management.",
          url: "https://www.england.nhs.uk/news/",
          source: "System Configuration Notice",
          published_at: new Date().toISOString(),
          relevance_score: 5,
          tags: ["System", "Configuration", "Real News", "API"],
          image_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=600&h=400&fit=crop"
        }
      ];
    }

    // Clear existing articles and insert new ones
    const { error: deleteError } = await supabase
      .from('news_articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error deleting existing articles:', deleteError);
    }

    // Insert new articles
    const { error: insertError } = await supabase
      .from('news_articles')
      .insert(newsArticles.map(article => ({
        title: article.title,
        summary: article.summary,
        content: article.content,
        url: article.url,
        source: article.source,
        published_at: article.published_at,
        relevance_score: article.relevance_score,
        tags: article.tags,
        image_url: article.image_url
      })));

    if (insertError) {
      console.error('Error inserting articles:', insertError);
      throw insertError;
    }

    console.log(`Successfully processed ${newsArticles.length} news articles`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully refreshed ${newsArticles.length} news articles`,
      articles: newsArticles.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-gp-news function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});