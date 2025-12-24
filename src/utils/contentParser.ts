interface SlideContent {
  title: string;
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  notes?: string;
  estimatedHeight?: number; // Track estimated height for overflow detection
}

interface ParsedPresentation {
  meta: {
    title: string;
  };
  slides: SlideContent[];
}

// Constants for layout calculations
const LAYOUT_CONFIG = {
  CHARS_PER_LINE: 65, // Characters that fit on one line
  LINE_HEIGHT: 0.5, // Height per line in inches
  BULLET_BASE_HEIGHT: 0.4, // Base height for a bullet
  MAX_CONTENT_HEIGHT: 4.5, // Maximum content area height (slide height minus header/footer)
  MAX_BULLETS_PER_SLIDE: 5, // Safe number of bullets per slide
  MAX_CHARS_PER_BULLET: 150, // Maximum characters before splitting a bullet
};

// Estimate how many lines a text will wrap to
const estimateTextLines = (text: string): number => {
  return Math.max(1, Math.ceil(text.length / LAYOUT_CONFIG.CHARS_PER_LINE));
};

// Estimate the height a bullet point will take
const estimateBulletHeight = (text: string): number => {
  const lines = estimateTextLines(text);
  return LAYOUT_CONFIG.BULLET_BASE_HEIGHT + ((lines - 1) * LAYOUT_CONFIG.LINE_HEIGHT);
};

// Split a long bullet into smaller chunks at logical break points
const splitLongBullet = (text: string): string[] => {
  if (text.length <= LAYOUT_CONFIG.MAX_CHARS_PER_BULLET) {
    return [text];
  }
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > LAYOUT_CONFIG.MAX_CHARS_PER_BULLET) {
    // Find a good break point (sentence end, semicolon, comma, or space)
    let breakPoint = LAYOUT_CONFIG.MAX_CHARS_PER_BULLET;
    
    // Try to find sentence end
    const sentenceEnd = remaining.lastIndexOf('. ', breakPoint);
    if (sentenceEnd > LAYOUT_CONFIG.MAX_CHARS_PER_BULLET * 0.5) {
      breakPoint = sentenceEnd + 1;
    } else {
      // Try semicolon
      const semicolon = remaining.lastIndexOf('; ', breakPoint);
      if (semicolon > LAYOUT_CONFIG.MAX_CHARS_PER_BULLET * 0.5) {
        breakPoint = semicolon + 1;
      } else {
        // Try comma
        const comma = remaining.lastIndexOf(', ', breakPoint);
        if (comma > LAYOUT_CONFIG.MAX_CHARS_PER_BULLET * 0.5) {
          breakPoint = comma + 1;
        } else {
          // Fall back to last space
          const space = remaining.lastIndexOf(' ', breakPoint);
          if (space > LAYOUT_CONFIG.MAX_CHARS_PER_BULLET * 0.3) {
            breakPoint = space;
          }
        }
      }
    }
    
    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }
  
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  
  return chunks;
};

// Calculate total estimated height for a slide's content
const calculateSlideContentHeight = (bullets: string[]): number => {
  return bullets.reduce((total, bullet) => total + estimateBulletHeight(bullet), 0);
};

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
        // Split long bullets into smaller chunks
        const chunks = splitLongBullet(bulletText);
        currentSlide.bullets!.push(...chunks);
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
        // Split long text if needed
        const chunks = splitLongBullet(line);
        currentSlide.bullets.push(...chunks);
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
  
  // Split slides that exceed content height limits
  const processedSlides: SlideContent[] = [];
  
  slides.forEach(slide => {
    if (!slide.bullets || slide.bullets.length === 0) {
      // Tables or empty slides pass through
      processedSlides.push(slide);
      return;
    }
    
    // Calculate if content fits on one slide
    const totalHeight = calculateSlideContentHeight(slide.bullets);
    
    if (totalHeight <= LAYOUT_CONFIG.MAX_CONTENT_HEIGHT && slide.bullets.length <= LAYOUT_CONFIG.MAX_BULLETS_PER_SLIDE) {
      // Content fits, add estimated height
      slide.estimatedHeight = totalHeight;
      processedSlides.push(slide);
    } else {
      // Need to split across multiple slides
      let currentBullets: string[] = [];
      let currentHeight = 0;
      let partNumber = 1;
      
      for (const bullet of slide.bullets) {
        const bulletHeight = estimateBulletHeight(bullet);
        
        // Check if adding this bullet would exceed limits
        if (currentBullets.length >= LAYOUT_CONFIG.MAX_BULLETS_PER_SLIDE || 
            currentHeight + bulletHeight > LAYOUT_CONFIG.MAX_CONTENT_HEIGHT) {
          // Save current slide and start new one
          if (currentBullets.length > 0) {
            processedSlides.push({
              title: partNumber === 1 ? slide.title : `${slide.title} (${partNumber})`,
              bullets: currentBullets,
              estimatedHeight: currentHeight,
              notes: slide.notes
            });
            partNumber++;
          }
          currentBullets = [];
          currentHeight = 0;
        }
        
        currentBullets.push(bullet);
        currentHeight += bulletHeight;
      }
      
      // Add remaining bullets
      if (currentBullets.length > 0) {
        processedSlides.push({
          title: partNumber === 1 ? slide.title : `${slide.title} (${partNumber})`,
          bullets: currentBullets,
          estimatedHeight: currentHeight,
          notes: slide.notes
        });
      }
    }
  });
  
  return {
    meta: { title },
    slides: processedSlides
  };
}