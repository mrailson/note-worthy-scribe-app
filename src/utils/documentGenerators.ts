import { Document, Packer, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle, SymbolRun, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';

// Function to clean markdown formatting from text
const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // Remove triple asterisks (bold+italic)
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // Remove double asterisks (bold)
    .replace(/\*([^*]+)\*/g, '$1')         // Remove single asterisks (italic)
    .replace(/`([^`]+)`/g, '$1')           // Remove backticks (code)
    .replace(/#{1,6}\s+/g, '')             // Remove heading markers
    .trim();
};

export const generateWordDocument = async (content: string, title: string = 'AI Generated Document') => {
  try {
    // Function to process text with inline formatting (bold, italic, code, links)
    const processFormattedText = (text: string) => {
      const children: any[] = [];
      
      // Clean the text first to remove any stray markdown
      const cleanedText = cleanMarkdown(text);
      
      // Enhanced pattern to handle bold, italic, code, and URLs
      const formatPattern = /(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|https?:\/\/[^\s]+)/g;
      let lastIndex = 0;
      let match;
      
      while ((match = formatPattern.exec(text)) !== null) {
        // Add any plain text before this match
        if (match.index > lastIndex) {
          const plainText = text.substring(lastIndex, match.index);
          if (plainText) {
            children.push(new TextRun({
              text: cleanMarkdown(plainText),
              size: 24
            }));
          }
        }
        
        const matchedText = match[0];
        
        // Handle bold and italic (***text***)
        if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
          const content = matchedText.slice(3, -3);
          children.push(new TextRun({
            text: content,
            size: 24,
            bold: true,
            italics: true
          }));
        }
        // Handle bold (**text**)
        else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
          const content = matchedText.slice(2, -2);
          children.push(new TextRun({
            text: content,
            size: 24,
            bold: true
          }));
        }
        // Handle italic (*text*)
        else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
          const content = matchedText.slice(1, -1);
          children.push(new TextRun({
            text: content,
            size: 24,
            italics: true
          }));
        }
        // Handle code (`text`)
        else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
          const content = matchedText.slice(1, -1);
          children.push(new TextRun({
            text: content,
            size: 22,
            font: "Courier New"
          }));
        }
        // Handle URLs
        else if (matchedText.match(/^https?:\/\//)) {
          children.push(new ExternalHyperlink({
            children: [new TextRun({
              text: matchedText,
              size: 24,
              color: "0563C1",
              underline: {}
            })],
            link: matchedText
          }));
        }
        
        lastIndex = formatPattern.lastIndex;
      }
      
      // Add any remaining plain text after the last match
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        if (remainingText) {
          children.push(new TextRun({
            text: cleanMarkdown(remainingText),
            size: 24
          }));
        }
      }
      
      return children.length > 0 ? children : [new TextRun({ text: cleanedText, size: 24 })];
    };

    const paragraphs = [
      new Paragraph({ 
        children: [new TextRun({ text: title, bold: true, size: 32 })],
        spacing: { after: 400 }
      })
    ];
    
    // Parse content into formatted paragraphs
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        paragraphs.push(new Paragraph({ 
          children: [new TextRun({ text: '', size: 12 })],
          spacing: { after: 200 }
        }));
        continue;
      }
      
      // Check if line starts with bullet point markers or action indicators
      const isBulletPoint = trimmedLine.match(/^[-*•]\s+/) || 
                           trimmedLine.match(/^(\d+\.)\s+/) ||
                           trimmedLine.toLowerCase().includes('action:') ||
                           trimmedLine.toLowerCase().includes('todo:') ||
                           trimmedLine.toLowerCase().includes('follow up:') ||
                           trimmedLine.toLowerCase().includes('next step:') ||
                           trimmedLine.toLowerCase().includes('key gp action:') ||
                           trimmedLine.toLowerCase().includes('prescribe') ||
                           trimmedLine.toLowerCase().includes('monitor') ||
                           trimmedLine.toLowerCase().includes('avoid') ||
                           trimmedLine.toLowerCase().includes('reinforce') ||
                           trimmedLine.toLowerCase().includes('regularly') ||
                           trimmedLine.toLowerCase().includes('check');

      if (isBulletPoint) {
        // Remove bullet markers and create simple bulleted paragraph
        const cleanedText = trimmedLine.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
        
        const bulletChildren = [
          new TextRun({ text: '• ', size: 24 }), // Simple bullet point
          ...processFormattedText(cleanedText)
        ];
        
        paragraphs.push(new Paragraph({ 
          children: bulletChildren,
          spacing: { after: 150 },
          indent: { left: 400 } // Indent bullet items
        }));
      } else {
        // Regular paragraph
        const formattedChildren = processFormattedText(trimmedLine);
        paragraphs.push(new Paragraph({ 
          children: formattedChildren,
          spacing: { after: 200 }
        }));
      }
    }

    // Create document with proper properties
    const doc = new Document({
      creator: "Notewell AI",
      title: title,
      description: "AI Generated Document",
      sections: [{
        properties: {
          page: {
            margin: {
              top: 720,    // 0.5 inch
              right: 720,  // 0.5 inch
              bottom: 720, // 0.5 inch
              left: 720    // 0.5 inch
            }
          }
        },
        children: paragraphs
      }]
    });

    // Generate the document and save
    const blob = await Packer.toBlob(doc);
    const fileName = `${title.replace(/[^a-z0-9\s]/gi, '_').toLowerCase().replace(/\s+/g, '_')}.docx`;
    saveAs(blob, fileName);
    
    return true;
    
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
};

export const generatePowerPoint = async (content: string, title: string = 'AI Generated Presentation') => {
  try {
    const pptx = new PptxGenJS();
    
    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(title, {
      x: 1,
      y: 2,
      w: 8,
      h: 2,
      fontSize: 32,
      bold: true,
      align: 'center'
    });
    
    titleSlide.addText(`Generated on ${new Date().toLocaleDateString()}`, {
      x: 1,
      y: 4,
      w: 8,
      h: 1,
      fontSize: 16,
      align: 'center',
      color: '666666'
    });

    // Process content into slides
    const sections = content.split('\n\n');
    let currentSlide = null;
    let slideCount = 0;
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;
      
      const lines = trimmedSection.split('\n');
      const firstLine = lines[0].trim();
      
      // Check if this looks like a heading (starts with #, all caps, or ends with :)
      const isHeading = firstLine.match(/^#+\s/) || 
                       firstLine === firstLine.toUpperCase() ||
                       firstLine.endsWith(':');
      
      if (isHeading || slideCount === 0) {
        // Create new slide
        currentSlide = pptx.addSlide();
        slideCount++;
        
        // Add title
        const slideTitle = cleanMarkdown(firstLine.replace(/^#+\s*/, '').replace(/:$/, ''));
        currentSlide.addText(slideTitle, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 24,
          bold: true,
          color: '2E5C8A'
        });
        
        // Add remaining content
        if (lines.length > 1) {
          const contentText = lines.slice(1).join('\n');
          currentSlide.addText(cleanMarkdown(contentText), {
            x: 0.5,
            y: 1.8,
            w: 9,
            h: 5,
            fontSize: 14,
            valign: 'top'
          });
        }
      } else if (currentSlide) {
        // Add to existing slide
        currentSlide.addText(cleanMarkdown(trimmedSection), {
          x: 0.5,
          y: 1.8,
          w: 9,
          h: 5,
          fontSize: 14,
          valign: 'top'
        });
      }
      
      // Limit slides to prevent overly long presentations
      if (slideCount >= 20) break;
    }
    
    // If no slides were created, add a content slide
    if (slideCount === 0) {
      const contentSlide = pptx.addSlide();
      contentSlide.addText('Content', {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 1,
        fontSize: 24,
        bold: true,
        color: '2E5C8A'
      });
      
      contentSlide.addText(cleanMarkdown(content), {
        x: 0.5,
        y: 1.8,
        w: 9,
        h: 5,
        fontSize: 14,
        valign: 'top'
      });
    }

    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
    await pptx.writeFile({ fileName });
    
  } catch (error) {
    console.error('Error generating PowerPoint:', error);
    throw new Error('Failed to generate PowerPoint presentation');
  }
};