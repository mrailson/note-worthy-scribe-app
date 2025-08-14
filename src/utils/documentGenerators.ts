import { Document, Packer, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType } from 'docx';
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
      
      return children.length > 0 ? children : [new TextRun({ text: cleanMarkdown(text), size: 24 })];
    };

    // Function to detect and create Word tables
    const createWordTable = (tableText: string) => {
      const lines = tableText.split('\n').map(line => line.trim()).filter(Boolean);
      const tableLines = lines.filter(line => line.includes('|') && line.split('|').length > 2);
      
      if (tableLines.length < 2) return null;

      // Parse table rows
      const rows = tableLines.map(line => {
        return line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '') // Remove empty cells from start/end
      });

      // Skip header separator lines
      const dataRows = rows.filter(row => 
        !row.every(cell => /^[-\s]*$/.test(cell))
      );

      if (dataRows.length === 0) return null;

      // Create Word table
      const tableRows = dataRows.map((row, rowIndex) => {
        const cells = row.map(cellText => {
          return new TableCell({
            children: [new Paragraph({
              children: processFormattedText(cleanMarkdown(cellText))
            })],
            margins: {
              top: 100,
              bottom: 100,
              left: 150,
              right: 150,
            }
          });
        });

        return new TableRow({
          children: cells,
          tableHeader: rowIndex === 0
        });
      });

      return new Table({
        rows: tableRows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 },
        }
      });
    };

    // Process content into paragraphs and detect tables
    const sections = content.split('\n\n');
    const documentElements: any[] = [];

    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;

      // Check if this section contains a table
      const lines = trimmedSection.split('\n');
      const pipeLines = lines.filter(line => line.includes('|') && line.split('|').length > 2);
      
      if (pipeLines.length >= 2) {
        const table = createWordTable(trimmedSection);
        if (table) {
          documentElements.push(table);
          continue;
        }
      }

      // Process as regular content
      const lines2 = trimmedSection.split('\n');
      
      for (const line of lines2) {
        if (!line.trim()) continue;
        
        // Check if it's a heading
        const headingMatch = line.match(/^(#+)\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(headingMatch[1].length, 6);
          const headingText = headingMatch[2];
          
          documentElements.push(new Paragraph({
            children: processFormattedText(headingText),
            heading: level === 1 ? 'Heading1' : 
                    level === 2 ? 'Heading2' : 
                    level === 3 ? 'Heading3' : 
                    level === 4 ? 'Heading4' : 
                    level === 5 ? 'Heading5' : 'Heading6',
            spacing: { before: 240, after: 120 }
          }));
        } else {
          // Regular paragraph
          documentElements.push(new Paragraph({
            children: processFormattedText(line),
            spacing: { before: 120, after: 120 }
          }));
        }
      }
    }

    // If no elements were created, add the full content as a paragraph
    if (documentElements.length === 0) {
      documentElements.push(new Paragraph({
        children: processFormattedText(content),
        spacing: { before: 120, after: 120 }
      }));
    }

    // Create document
    const doc = new Document({
      creator: 'AI Assistant',
      title: title,
      description: 'Generated by AI Assistant',
      styles: {
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 32,
              bold: true,
              color: '2E5C8A'
            },
            paragraph: {
              spacing: { before: 480, after: 240 }
            }
          },
          {
            id: 'Heading2',
            name: 'Heading 2', 
            basedOn: 'Normal',
            next: 'Normal',
            run: {
              size: 28,
              bold: true,
              color: '2E5C8A'
            },
            paragraph: {
              spacing: { before: 360, after: 180 }
            }
          }
        ]
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            }
          }
        },
        children: [
          new Paragraph({
            children: [new TextRun({
              text: title,
              size: 36,
              bold: true,
              color: '2E5C8A'
            })],
            spacing: { before: 0, after: 480 }
          }),
          new Paragraph({
            children: [new TextRun({
              text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
              size: 20,
              color: '666666'
            })],
            spacing: { before: 0, after: 720 }
          }),
          ...documentElements
        ]
      }]
    });

    // Generate and save the document
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
    const blob = await Packer.toBlob(doc);
    saveAs(blob, fileName);
    
  } catch (error: any) {
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

    // Process content into slides - handle tables
    const sections = content.split('\n\n');
    let currentSlide = null;
    let slideCount = 0;
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;
      
      const lines = trimmedSection.split('\n');
      const firstLine = lines[0].trim();

      // Check if this section contains a table
      const pipeLines = lines.filter(line => line.includes('|') && line.split('|').length > 2);
      
      if (pipeLines.length >= 2) {
        // Create new slide for table
        currentSlide = pptx.addSlide();
        slideCount++;
        
        // Add title
        const slideTitle = cleanMarkdown(firstLine.includes('|') ? 'Table Data' : firstLine);
        currentSlide.addText(slideTitle, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 24,
          bold: true,
          color: '2E5C8A'
        });

        // Parse table for PowerPoint
        const tableRows = pipeLines.map(line => {
          return line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell !== '');
        });

        // Filter out separator rows
        const dataRows = tableRows.filter(row => 
          !row.every(cell => /^[-\s]*$/.test(cell))
        );

        if (dataRows.length > 0) {
          const tableData = dataRows.map(row => 
            row.map(cell => ({ text: cleanMarkdown(cell), options: { fontSize: 12 } }))
          );

          currentSlide.addTable(tableData, {
            x: 0.5,
            y: 1.8,
            w: 9,
            h: 4,
            border: { pt: 1, color: '666666' },
            fill: { color: 'F8F9FA' }
          });
        }
        continue;
      }
      
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