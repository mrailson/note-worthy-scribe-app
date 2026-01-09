import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import PptxGenJS from "npm:pptxgenjs@3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NHS_BLUE = "005EB8";
const LIGHT_GREY = "F0F0F0";

const LAYOUT = {
  SLIDE_WIDTH: 13.33,
  SLIDE_HEIGHT: 7.5,
  HEADER_HEIGHT: 0.9,
  CONTENT_START_Y: 1.4,
  CONTENT_END_Y: 6.2,
  FOOTER_Y: 6.8,
  LEFT_MARGIN: 0.5,
  CONTENT_WIDTH: 9.5,
  CHARS_PER_LINE: 65,
  LINE_HEIGHT: 0.45,
  BULLET_SPACING: 0.25,
  MIN_BULLET_HEIGHT: 0.7,
};

interface SlideData {
  slideNumber: number;
  title: string;
  bullets: string[];
  speakerNotes: string;
  audioBase64?: string;
}

interface RequestBody {
  title: string;
  slides: SlideData[];
}

function estimateTextLines(text: string): number {
  const words = text.split(' ');
  let lines = 1;
  let currentLineLength = 0;
  
  for (const word of words) {
    if (currentLineLength + word.length + 1 > LAYOUT.CHARS_PER_LINE) {
      lines++;
      currentLineLength = word.length;
    } else {
      currentLineLength += word.length + 1;
    }
  }
  
  return Math.max(1, lines);
}

function calculateBulletHeight(text: string): number {
  const lines = estimateTextLines(text);
  return Math.max(LAYOUT.MIN_BULLET_HEIGHT, (lines * LAYOUT.LINE_HEIGHT) + LAYOUT.BULLET_SPACING + 0.1);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, slides } = await req.json() as RequestBody;
    
    if (!slides?.length) {
      return new Response(
        JSON.stringify({ error: 'Slides data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PPTX+Audio] Building presentation: "${title}" with ${slides.length} slides`);

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    pptx.title = title;
    pptx.author = "AI4GP";
    
    const bodyText = { fontFace: "Calibri", fontSize: 20, color: "000000" };
    const titleText = { fontFace: "Calibri", fontSize: 32, bold: true, color: "FFFFFF" };
    const footerText = { fontFace: "Calibri", fontSize: 10, color: "777777" };

    // Title slide
    {
      const s = pptx.addSlide();
      s.addShape(pptx.shapes.RECTANGLE, { 
        x: 0, y: 0, w: "100%", h: LAYOUT.HEADER_HEIGHT, 
        fill: { color: NHS_BLUE }, 
        line: { color: "FFFFFF", size: 0 } 
      });
      s.addText(title || "AI Generated Presentation", { 
        x: 0.4, y: 0.15, w: 10, h: 0.7, 
        ...titleText 
      });
      s.addText(`AI Generated Summary – ${new Date().toLocaleDateString("en-GB")}`, { 
        x: 0.4, y: LAYOUT.FOOTER_Y, w: 12, h: 0.3, 
        ...footerText 
      });
    }

    // Content slides
    for (const slideData of slides) {
      const s = pptx.addSlide();
      
      // Header band
      s.addShape(pptx.shapes.RECTANGLE, { 
        x: 0, y: 0, w: "100%", h: LAYOUT.HEADER_HEIGHT, 
        fill: { color: NHS_BLUE }, 
        line: { size: 0 } 
      });
      s.addText(slideData.title || `Slide ${slideData.slideNumber}`, { 
        x: 0.4, y: 0.12, w: 12, h: 0.65, 
        ...titleText 
      });

      // Bullet points
      if (slideData.bullets?.length) {
        let yPos = LAYOUT.CONTENT_START_Y;
        
        for (const bulletText of slideData.bullets) {
          const height = calculateBulletHeight(bulletText);
          
          if (yPos + height > LAYOUT.CONTENT_END_Y) break;
          
          s.addText(`• ${bulletText}`, {
            x: LAYOUT.LEFT_MARGIN + 0.1,
            y: yPos,
            w: LAYOUT.CONTENT_WIDTH,
            h: height,
            ...bodyText,
            lineSpacing: 28,
            wrap: true,
            valign: 'top'
          });
          
          yPos += height;
        }
      }

      // Speaker notes - EMBEDDED
      if (slideData.speakerNotes) {
        console.log(`[PPTX+Audio] Adding speaker notes to slide ${slideData.slideNumber}: ${slideData.speakerNotes.substring(0, 50)}...`);
        s.addNotes(slideData.speakerNotes);
      }

      // Audio - EMBEDDED
      if (slideData.audioBase64) {
        try {
          console.log(`[PPTX+Audio] Embedding audio in slide ${slideData.slideNumber}...`);
          
          // PptxGenJS expects base64 data with the proper prefix for media
          s.addMedia({
            type: 'audio',
            data: `data:audio/mpeg;base64,${slideData.audioBase64}`,
            x: 11.5,
            y: 6.0,
            w: 1.5,
            h: 0.8,
          });
          
          console.log(`[PPTX+Audio] Audio embedded successfully for slide ${slideData.slideNumber}`);
        } catch (audioErr) {
          console.error(`[PPTX+Audio] Failed to embed audio for slide ${slideData.slideNumber}:`, audioErr);
          // Continue without audio for this slide
        }
      }

      // Footer
      s.addText(`AI Generated Summary – ${new Date().toLocaleDateString("en-GB")}`, { 
        x: 0.4, y: LAYOUT.FOOTER_Y, w: 12, h: 0.3, 
        ...footerText 
      });
    }

    console.log('[PPTX+Audio] Generating final PPTX...');
    const pptxBuffer = await pptx.write("arraybuffer") as ArrayBuffer;
    const pptxBase64 = base64Encode(new Uint8Array(pptxBuffer));
    
    console.log(`[PPTX+Audio] PPTX generated successfully, size: ${pptxBuffer.byteLength} bytes`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        pptxBase64,
        title,
        slideCount: slides.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[PPTX+Audio] Error generating PowerPoint:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PowerPoint', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
