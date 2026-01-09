import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import PptxGenJS from "npm:pptxgenjs@3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NHS_BLUE = "005EB8";
const LIGHT_GREY = "F0F0F0";

// Layout constants for dynamic positioning - INCREASED spacing to prevent overlap
const LAYOUT = {
  SLIDE_WIDTH: 13.33,
  SLIDE_HEIGHT: 7.5,
  HEADER_HEIGHT: 0.9,
  CONTENT_START_Y: 1.4,
  CONTENT_END_Y: 6.2,
  FOOTER_Y: 6.8,
  LEFT_MARGIN: 0.5,
  CONTENT_WIDTH: 9.5,
  CHARS_PER_LINE: 65, // Reduced to be more conservative
  LINE_HEIGHT: 0.45,  // Increased from 0.38
  BULLET_SPACING: 0.25, // Increased from 0.15
  MIN_BULLET_HEIGHT: 0.7, // Increased from 0.5
};

// Estimate lines needed for text - more conservative
function estimateTextLines(text: string): number {
  // Account for word wrapping breaking at word boundaries, not character boundaries
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

// Calculate height needed for a bullet point - more generous
function calculateBulletHeight(text: string): number {
  const lines = estimateTextLines(text);
  // Add extra padding for safety
  return Math.max(LAYOUT.MIN_BULLET_HEIGHT, (lines * LAYOUT.LINE_HEIGHT) + LAYOUT.BULLET_SPACING + 0.1);
}

// Split bullets if they exceed available space, returning overflow for next slide
function splitBulletsForSlide(bullets: string[], startY: number, maxY: number): { 
  fitBullets: { text: string; y: number; height: number }[];
  overflow: string[];
} {
  const fitBullets: { text: string; y: number; height: number }[] = [];
  const overflow: string[] = [];
  let currentY = startY;
  
  for (let i = 0; i < bullets.length; i++) {
    const bulletText = bullets[i];
    const height = calculateBulletHeight(bulletText);
    
    // Check if this bullet fits
    if (currentY + height <= maxY) {
      fitBullets.push({ text: bulletText, y: currentY, height });
      currentY += height;
    } else {
      // This and remaining bullets overflow
      overflow.push(...bullets.slice(i));
      break;
    }
  }
  
  return { fitBullets, overflow };
}

export async function jsonToPpt(jsonString: string): Promise<ArrayBuffer> {
  const data = JSON.parse(jsonString);
  const pptx = new PptxGenJS();

  // Slide size & default text
  pptx.layout = "LAYOUT_16x9";
  const bodyText = { fontFace: "Calibri", fontSize: 20, color: "000000" };
  const titleText = { fontFace: "Calibri", fontSize: 32, bold: true, color: "FFFFFF" };
  const footerText = { fontFace: "Calibri", fontSize: 10, color: "777777" };

  // Title slide
  {
    const s = pptx.addSlide();
    s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: LAYOUT.HEADER_HEIGHT, fill: { color: NHS_BLUE }, line: { color: "FFFFFF", size: 0 } });
    s.addText(data?.meta?.title || "AI Generated Presentation", { x: 0.4, y: 0.15, w: 10, h: 0.7, ...titleText });
    addFooter(s, footerText);
  }

  for (const slide of data.slides) {
    let slidesToCreate: { title: string; bullets?: string[]; table?: any }[] = [];
    
    if (slide.table) {
      // Table slides don't need splitting logic
      slidesToCreate.push(slide);
    } else if (slide.bullets?.length) {
      // Check if bullets fit on one slide, split if needed
      let remainingBullets = [...slide.bullets];
      let partNumber = 0;
      
      while (remainingBullets.length > 0) {
        const { fitBullets, overflow } = splitBulletsForSlide(
          remainingBullets,
          LAYOUT.CONTENT_START_Y,
          LAYOUT.CONTENT_END_Y
        );
        
        if (fitBullets.length === 0 && overflow.length > 0) {
          // Edge case: single bullet too tall, force it anyway
          fitBullets.push({ 
            text: remainingBullets[0], 
            y: LAYOUT.CONTENT_START_Y, 
            height: calculateBulletHeight(remainingBullets[0]) 
          });
          remainingBullets = remainingBullets.slice(1);
        } else {
          remainingBullets = overflow;
        }
        
        const slideTitle = partNumber === 0 ? slide.title : `${slide.title} (continued)`;
        slidesToCreate.push({ 
          title: slideTitle, 
          bullets: fitBullets.map(b => b.text),
          // Store calculated positions for rendering
          _bulletPositions: fitBullets
        } as any);
        partNumber++;
      }
    } else {
      slidesToCreate.push(slide);
    }
    
    // Create all slides for this content
    for (const slideData of slidesToCreate) {
      const s = pptx.addSlide();
      
      // Header band
      s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: "100%", h: LAYOUT.HEADER_HEIGHT, fill: { color: NHS_BLUE }, line: { size: 0 } });
      s.addText(slideData.title || "", { x: 0.4, y: 0.12, w: 12, h: 0.65, ...titleText });

      if (slideData.table) {
        // Table slide with improved sizing
        const { headers, rows } = slideData.table;
        const rowsWithHeader = [headers, ...rows];
        
        // Calculate dynamic row height based on content
        const maxCellLength = Math.max(
          ...rowsWithHeader.flat().map((cell: string) => cell?.length || 0)
        );
        const rowHeight = Math.max(0.45, Math.min(0.7, maxCellLength / 40));
        
        s.addTable(rowsWithHeader, {
          x: LAYOUT.LEFT_MARGIN,
          y: LAYOUT.CONTENT_START_Y,
          w: LAYOUT.CONTENT_WIDTH + 2,
          fontFace: "Calibri",
          fontSize: 16,
          colW: Array(headers.length).fill((LAYOUT.CONTENT_WIDTH + 2) / headers.length),
          border: { type: "solid", color: "CCCCCC", pt: 1 },
          fill: "FFFFFF",
          rowH: rowHeight,
          valign: "middle",
          autoPage: true,
          autoPageRepeatHeader: true,
          tableHeaderRow: true,
          color: "000000",
          header: { fill: NHS_BLUE, color: "FFFFFF", bold: true, fontSize: 17 },
          zebra: { isZebra: true, color: LIGHT_GREY },
        });
      } else if ((slideData as any)._bulletPositions?.length) {
        // Use pre-calculated positions for accurate placement
        const positions = (slideData as any)._bulletPositions;
        
        for (const bullet of positions) {
          s.addText(`• ${bullet.text}`, {
            x: LAYOUT.LEFT_MARGIN + 0.1,
            y: bullet.y,
            w: LAYOUT.CONTENT_WIDTH,
            h: bullet.height,
            ...bodyText,
            lineSpacing: 28,
            wrap: true,
            valign: 'top'
          });
        }
      } else if (slideData.bullets?.length) {
        // Fallback: render with dynamic positioning
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

      if (slide.notes) s.addNotes(slide.notes);
      addFooter(s, footerText);
    }
  }

  function addFooter(s: any, style: any) {
    s.addText(`AI Generated Summary – ${new Date().toLocaleDateString("en-GB")}`, { 
      x: 0.4, 
      y: LAYOUT.FOOTER_Y, 
      w: 12, 
      h: 0.3, 
      ...style 
    });
  }

  return await pptx.write("arraybuffer");
}

serve(async (req) => {
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

    console.log('Generating PowerPoint with dynamic layout...');
    const pptxBuffer = await jsonToPpt(jsonData);
    console.log('PowerPoint generated successfully');
    
    return new Response(pptxBuffer, {
      headers: {
        ...corsHeaders,
        // IMPORTANT: Supabase functions-js client only treats "application/octet-stream" as a Blob.
        // If we return the real PPTX MIME type, the client will fall back to response.text(), corrupting the binary.
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="presentation.pptx"',
      },
    });
  } catch (error) {
    console.error('Error generating PowerPoint:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PowerPoint', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});