interface SlideContent {
  title: string;
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  notes?: string;
}

interface ParsedPresentation {
  meta: {
    title: string;
  };
  slides: SlideContent[];
}

export function parseContentToSlides(content: string, title: string): ParsedPresentation {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const slides: SlideContent[] = [];
  let currentSlide: SlideContent | null = null;
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a heading (markdown ## or bold text)
    if (line.startsWith('##') || line.startsWith('**') && line.endsWith('**') || 
        line.includes(':') && line.length < 100) {
      
      // Save previous slide if exists
      if (currentSlide) {
        slides.push(currentSlide);
      }
      
      // Start new slide
      const slideTitle = line.replace(/^##\s*/, '')
                           .replace(/^\*\*/, '')
                           .replace(/\*\*$/, '')
                           .replace(/:$/, '')
                           .trim();
      
      currentSlide = {
        title: slideTitle,
        bullets: [],
      };
      currentTable = null;
      continue;
    }
    
    // Check if this line starts a table
    if (line.includes('|') && line.split('|').length >= 3) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
      
      // If this is the first row of a table, it's headers
      if (!currentTable) {
        currentTable = {
          headers: cells,
          rows: []
        };
      } else if (!line.match(/^[\s\|:\-]+$/)) { // Skip separator rows
        currentTable.rows.push(cells);
      }
      continue;
    }
    
    // If we were building a table and hit non-table content, finish the table
    if (currentTable && !line.includes('|')) {
      if (currentSlide) {
        // Create separate slide for table
        const tableSlide: SlideContent = {
          title: currentSlide.title + " - Details",
          table: currentTable
        };
        slides.push(currentSlide);
        slides.push(tableSlide);
        
        // Start fresh slide for remaining content
        currentSlide = {
          title: currentSlide.title + " - Summary",
          bullets: []
        };
      }
      currentTable = null;
    }
    
    // Handle bullet points
    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
      if (!currentSlide) {
        currentSlide = {
          title: "Key Points",
          bullets: []
        };
      }
      
      const bulletText = line.replace(/^[-•*]\s*/, '').trim();
      if (bulletText.length > 0) {
        currentSlide.bullets!.push(bulletText);
      }
      continue;
    }
    
    // Handle regular paragraphs as bullet points if they're not too long
    if (line.length > 0 && line.length < 200 && !line.includes(':')) {
      if (!currentSlide) {
        currentSlide = {
          title: "Overview",
          bullets: []
        };
      }
      
      if (currentSlide.bullets && currentSlide.bullets.length < 6) {
        currentSlide.bullets.push(line);
      }
    }
  }
  
  // Add final slide or table
  if (currentTable && currentSlide) {
    currentSlide.table = currentTable;
    slides.push(currentSlide);
  } else if (currentSlide) {
    slides.push(currentSlide);
  }
  
  // Ensure we have at least one slide
  if (slides.length === 0) {
    slides.push({
      title: "Summary",
      bullets: ["No structured content found"]
    });
  }
  
  // Limit bullets per slide to prevent overlap
  const processedSlides: SlideContent[] = [];
  slides.forEach(slide => {
    if (slide.bullets && slide.bullets.length > 8) {
      // Split into multiple slides
      const bulletChunks = [];
      for (let i = 0; i < slide.bullets.length; i += 6) {
        bulletChunks.push(slide.bullets.slice(i, i + 6));
      }
      
      bulletChunks.forEach((chunk, index) => {
        processedSlides.push({
          title: index === 0 ? slide.title : `${slide.title} (${index + 1})`,
          bullets: chunk,
          notes: slide.notes
        });
      });
    } else {
      processedSlides.push(slide);
    }
  });
  
  return {
    meta: { title },
    slides: processedSlides
  };
}