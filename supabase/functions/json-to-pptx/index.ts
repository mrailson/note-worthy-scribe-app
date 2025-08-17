import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import PptxGenJS from "npm:pptxgenjs@3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NHS_BLUE = "005EB8";
const LIGHT_GREY = "F0F0F0";

export async function jsonToPpt(jsonString: string): Promise<ArrayBuffer> {
  const data = JSON.parse(jsonString);
  const pptx = new PptxGenJS();

  // Slide size & default text
  pptx.layout = "LAYOUT_16x9";
  const bodyText = { fontFace: "Calibri", fontSize: 22, color: "000000" };
  const titleText = { fontFace: "Calibri", fontSize: 36, bold: true, color: "FFFFFF" };
  const footerText = { fontFace: "Calibri", fontSize: 10, color: "777777" };

  // Title slide
  {
    const s = pptx.addSlide();
    // NHS blue header band
    s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.9, fill: { color: NHS_BLUE }, line: { color: "FFFFFF", size: 0 } });
    s.addText(data?.meta?.title || "AI Generated Presentation", { x: 0.4, y: 0.15, w: 10, h: 0.7, ...titleText });
    addFooter(s, footerText);
  }

  for (const slide of data.slides) {
    const s = pptx.addSlide();
    // Header band
    s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: 0.9, fill: { color: NHS_BLUE }, line: { size: 0 } });
    s.addText(slide.title || "", { x: 0.4, y: 0.15, w: 10, h: 0.7, ...titleText });

    if (slide.table) {
      // Table slide
      const { headers, rows } = slide.table;
      const rowsWithHeader = [headers, ...rows];
      s.addTable(rowsWithHeader, {
        x: 0.35, y: 1.25, w: 9.5,
        fontFace: "Calibri", fontSize: 18,
        colW: Array(headers.length).fill(9.5 / headers.length),
        border: { type: "solid", color: "CCCCCC", pt: 1 },
        fill: "FFFFFF",
        rowH: 0.45,
        // Header style
        valign: "middle",
        autoPage: true, // will spill to a new slide if too long
        autoPageRepeatHeader: true,
        tableHeaderRow: true,
        color: "000000",
        header: { fill: NHS_BLUE, color: "FFFFFF", bold: true, fontSize: 20 },
        zebra: { isZebra: true, color: LIGHT_GREY },
      });
    } else if (slide.bullets?.length) {
      // Bullet slide - improved spacing to prevent overlap
      let yPos = 1.4; // Start below header with more margin
      const bulletSpacing = 0.6; // Increased spacing between bullets
      const maxBulletsPerSlide = 6; // Limit bullets to prevent overflow
      
      const bulletsToShow = slide.bullets.slice(0, maxBulletsPerSlide);
      
      bulletsToShow.forEach((bulletText: string, index: number) => {
        // Calculate text height based on content length
        const estimatedLines = Math.ceil(bulletText.length / 80);
        const textHeight = Math.max(0.4, estimatedLines * 0.3);
        
        s.addText(`• ${bulletText}`, {
          x: 0.6, 
          y: yPos, 
          w: 9.0, 
          h: textHeight,
          ...bodyText,
          lineSpacing: 26, // Proper line spacing
          wrap: true,
          margin: 8,
          valign: 'top'
        });
        
        yPos += textHeight + bulletSpacing;
        
        // Prevent going off slide
        if (yPos > 5.8) break;
      });
    }

    if (slide.notes) s.addNotes(slide.notes);
    addFooter(s, footerText);
  }

  function addFooter(s: any, style: any) {
    s.addText(`AI Generated Summary – ${new Date().toLocaleDateString("en-GB")}`, { x: 0.4, y: 6.8, w: 9.5, h: 0.3, ...style });
  }

  return await pptx.write("arraybuffer");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jsonData } = await req.json();
    
    if (!jsonData) {
      return new Response(
        JSON.stringify({ error: 'JSON data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pptxBuffer = await jsonToPpt(jsonData);
    
    return new Response(pptxBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="presentation.pptx"',
      },
    });
  } catch (error) {
    console.error('Error generating PowerPoint:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PowerPoint' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});