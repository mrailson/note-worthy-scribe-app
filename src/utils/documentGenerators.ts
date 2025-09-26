import { Document, Packer, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';

// Detect if text contains right-to-left scripts (Arabic, Hebrew, etc.)
const containsRTL = (text: string) => /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);

const arabicRunFont = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Arial', cs: 'Arial' } as const;
const defaultRunFont = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Arial', cs: 'Arial' } as const;

// Function to clean markdown formatting from text
const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // Remove triple asterisks (bold+italic)
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // Remove double asterisks (bold)
    .replace(/\*([^*]+)\*/g, '$1')         // Remove single asterisks (italic)
    .replace(/`([^`]+)`/g, '$1')           // Remove backticks (code)
    .replace(/#{1,6}\s+/g, '')             // Remove heading markers
    .replace(/^---+$/gm, '')               // Remove horizontal rules
    .replace(/\n\s*\n\s*\n/g, '\n\n')     // Clean up extra newlines
    .trim();
};

export const generateWordDocument = async (content: string, title: string = 'AI Generated Document', saveFile: boolean = true): Promise<Blob> => {
  try {
    // Function to process text with inline formatting (bold, italic, code, links)
    const processFormattedText = (text: string) => {
      const children: any[] = [];

      const rtl = containsRTL(text);
      const baseRun = { size: 24, rightToLeft: rtl, font: rtl ? arabicRunFont : defaultRunFont } as const;
      
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
              ...baseRun,
            }));
          }
        }
        
        const matchedText = match[0];
        
        // Handle bold and italic (***text***)
        if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
          const content = matchedText.slice(3, -3);
          children.push(new TextRun({
            text: content,
            ...baseRun,
            bold: true,
            italics: rtl ? false : true,
          }));
        }
        // Handle bold (**text**)
        else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
          const content = matchedText.slice(2, -2);
          children.push(new TextRun({
            text: content,
            ...baseRun,
            bold: true,
          }));
        }
        // Handle italic (*text*)
        else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
          const content = matchedText.slice(1, -1);
          children.push(new TextRun({
            text: content,
            ...baseRun,
            italics: rtl ? false : true,
          }));
        }
        // Handle code (`text`)
        else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
          const content = matchedText.slice(1, -1);
          children.push(new TextRun({
            text: content,
            size: 22,
            rightToLeft: false,
            font: 'Courier New' as any,
          }));
        }
        // Handle URLs
        else if (matchedText.match(/^https?:\/\//)) {
          children.push(new ExternalHyperlink({
            children: [new TextRun({
              text: matchedText,
              ...baseRun,
              color: '0563C1',
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
            ...baseRun,
          }));
        }
      }
      
      return children.length > 0 ? children : [new TextRun({ text: cleanMarkdown(text), ...baseRun })];
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

      // Skip header separator lines and horizontal rules
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

    // Generate and optionally save the document
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
    const blob = await Packer.toBlob(doc);
    
    if (saveFile) {
      saveAs(blob, fileName);
    }
    
    return blob;
    
  } catch (error: any) {
    console.error('Error generating Word document:', error);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
};

export const generatePowerPoint = async (content: string, title: string = 'AI Generated Presentation') => {
  try {
    const pptx = new PptxGenJS();
    
    // NHS Color scheme
    const nhsBlue = '#005EB8';
    const lightBlue = '#E8F4FD';
    const lightGrey = '#F5F5F5';
    const darkGrey = '#666666';
    
    // Set slide layout
    pptx.defineLayout({ name: 'NHS_LAYOUT', width: 10, height: 7.5 });
    pptx.layout = 'NHS_LAYOUT';
    
    // Helper function to add NHS-style background
    const addNHSBackground = (slide: any) => {
      slide.background = { 
        fill: 'FFFFFF'
      };
    };
    
    // Helper function to add footer
    const addFooter = (slide: any) => {
      const timestamp = `AI Generated Summary – ${new Date().toLocaleDateString()}`;
      slide.addText(timestamp, {
        x: 0.5,
        y: 6.9,
        w: 9,
        h: 0.4,
        fontSize: 12,
        color: darkGrey,
        fontFace: 'Calibri',
        align: 'center'
      });
    };
    
    // Helper function to get appropriate icon for section
    const getIconForSection = (text: string): string => {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('contraindication') || lowerText.includes('warning') || lowerText.includes('caution')) return '⚠️';
      if (lowerText.includes('dos') || lowerText.includes('medication') || lowerText.includes('drug') || lowerText.includes('treatment')) return '💊';
      if (lowerText.includes('reference') || lowerText.includes('study') || lowerText.includes('evidence')) return '📑';
      if (lowerText.includes('symptom') || lowerText.includes('sign') || lowerText.includes('diagnosis')) return '🩺';
      return '';
    };
    
    // Title slide
    const titleSlide = pptx.addSlide();
    addNHSBackground(titleSlide);
    
    // Main title
    titleSlide.addText(title, {
      x: 1,
      y: 2.5,
      w: 8,
      h: 1.5,
      fontSize: 36,
      bold: true,
      color: '005EB8',
      fontFace: 'Calibri',
      align: 'center'
    });
    
    // Subtitle
    titleSlide.addText('AI Generated Summary', {
      x: 1,
      y: 4.2,
      w: 8,
      h: 0.8,
      fontSize: 24,
      color: '666666',
      fontFace: 'Calibri',
      align: 'center'
    });
    
    addFooter(titleSlide);

    // Process content into slides
    const sections = content.split('\n\n');
    let slideCount = 0;
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;
      
      const lines = trimmedSection.split('\n');
      const firstLine = lines[0].trim();

      // Check if this section contains a table
      const pipeLines = lines.filter(line => line.includes('|') && line.split('|').length > 2);
      const hasTable = pipeLines.length >= 2;
      
      // Get non-table content (text before or after table)
      const nonTableLines = lines.filter(line => !(line.includes('|') && line.split('|').length > 2));
      const hasDescriptiveText = nonTableLines.some(line => line.trim().length > 0 && !line.match(/^[-\s|]+$/));
      
      // If section has both descriptive text and table, create TWO slides
      if (hasTable && hasDescriptiveText) {
        // SLIDE 1: Descriptive text
        const textSlide = pptx.addSlide();
        addNHSBackground(textSlide);
        slideCount++;
        
        const slideTitle = cleanMarkdown(firstLine.replace(/^#+\s*/, '').replace(/:$/, ''));
        const titleIcon = getIconForSection(slideTitle);
        
        textSlide.addText(titleIcon + slideTitle, {
          x: 0.8,
          y: 0.8,
          w: 8.4,
          h: 0.8,
          fontSize: 36,
          bold: true,
          color: '005EB8',
          fontFace: 'Calibri'
        });
        
        // Convert dashes to bullet points and handle proper spacing
        const bulletPoints = nonTableLines
          .filter(line => line.trim().length > 0)
          .map(line => {
            // Remove leading dashes and clean up
            let cleanLine = cleanMarkdown(line.replace(/^[-•]\s*/, '').trim());
            return cleanLine;
          })
          .filter(line => line.length > 0);
        
        // Add each bullet point separately for proper spacing
        bulletPoints.forEach((point, index) => {
          textSlide.addText(point, {
            x: 1.2,
            y: 2.0 + (index * 0.4),
            w: 7.6,
            h: 0.35,
            fontSize: 22,
            fontFace: 'Calibri',
            bullet: { type: 'bullet' },
            lineSpacing: 26,
            wrap: true,
            autoFit: true,
            color: '333333'
          });
        });
        
        addFooter(textSlide);
        
        // SLIDE 2: Table
        const tableSlide = pptx.addSlide();
        addNHSBackground(tableSlide);
        slideCount++;
        
        tableSlide.addText('📊 ' + slideTitle + ' - Data Table', {
          x: 0.8,
          y: 0.8,
          w: 8.4,
          h: 0.8,
          fontSize: 36,
          bold: true,
          color: '005EB8',
          fontFace: 'Calibri'
        });

        // Process table
        const tableRows = pipeLines.map(line => {
          return line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell !== '');
        });

        const dataRows = tableRows.filter(row => 
          !row.every(cell => /^[-\s]*$/.test(cell))
        );

        if (dataRows.length > 0) {
          const tableData = dataRows.map((row, rowIndex) => 
            row.map(cell => ({ 
              text: cleanMarkdown(cell), 
              options: { 
                fontSize: 18,
                fontFace: 'Calibri',
                color: rowIndex === 0 ? 'FFFFFF' : '333333',
                bold: rowIndex === 0,
                fill: { color: rowIndex === 0 ? '005EB8' : (rowIndex % 2 === 1 ? 'F5F5F5' : 'FFFFFF') }
              } 
            }))
          );

          tableSlide.addTable(tableData, {
            x: 0.8,
            y: 2.0,
            w: 8.4,
            h: 4.2,
            border: { pt: 1, color: '005EB8' },
            rowH: 0.6,
            margin: 0.1
          });
        }
        
        addFooter(tableSlide);
        
      } else if (hasTable) {
        // Table only - single slide
        const tableSlide = pptx.addSlide();
        addNHSBackground(tableSlide);
        slideCount++;
        
        const slideTitle = cleanMarkdown(firstLine.includes('|') ? 'Data Table' : firstLine);
        tableSlide.addText('📊 ' + slideTitle, {
          x: 0.8,
          y: 0.8,
          w: 8.4,
          h: 0.8,
          fontSize: 36,
          bold: true,
          color: '005EB8',
          fontFace: 'Calibri'
        });

        const tableRows = pipeLines.map(line => {
          return line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell !== '');
        });

        const dataRows = tableRows.filter(row => 
          !row.every(cell => /^[-\s]*$/.test(cell))
        );

        if (dataRows.length > 0) {
          const tableData = dataRows.map((row, rowIndex) => 
            row.map(cell => ({ 
              text: cleanMarkdown(cell), 
              options: { 
                fontSize: 18,
                fontFace: 'Calibri',
                color: rowIndex === 0 ? 'FFFFFF' : '333333',
                bold: rowIndex === 0,
                fill: { color: rowIndex === 0 ? '005EB8' : (rowIndex % 2 === 1 ? 'F5F5F5' : 'FFFFFF') }
              } 
            }))
          );

          tableSlide.addTable(tableData, {
            x: 0.8,
            y: 2.0,
            w: 8.4,
            h: 4.2,
            border: { pt: 1, color: '005EB8' },
            rowH: 0.6,
            margin: 0.1
          });
        }
        
        addFooter(tableSlide);
        
      } else {
        // Text only - single slide
        const textSlide = pptx.addSlide();
        addNHSBackground(textSlide);
        slideCount++;
        
        const slideTitle = cleanMarkdown(firstLine.replace(/^#+\s*/, '').replace(/:$/, ''));
        const titleIcon = getIconForSection(slideTitle);
        
        textSlide.addText(titleIcon + slideTitle, {
          x: 0.8,
          y: 0.8,
          w: 8.4,
          h: 0.8,
          fontSize: 36,
          bold: true,
          color: '005EB8',
          fontFace: 'Calibri'
        });
        
        // Convert dashes to bullet points and handle proper spacing
        if (lines.length > 1) {
          const bulletPoints = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
              // Remove leading dashes and clean up
              let cleanLine = cleanMarkdown(line.replace(/^[-•]\s*/, '').trim());
              return cleanLine;
            })
            .filter(line => line.length > 0);
          
          // Add each bullet point separately for proper spacing
          bulletPoints.forEach((point, index) => {
            textSlide.addText(point, {
              x: 1.2,
              y: 2.0 + (index * 0.4),
              w: 7.6,
              h: 0.35,
              fontSize: 22,
              fontFace: 'Calibri',
              bullet: { type: 'bullet' },
              lineSpacing: 26,
              wrap: true,
              autoFit: true,
              color: '333333'
            });
          });
        }
        
        addFooter(textSlide);
      }
      
      // Limit slides to prevent overly long presentations
      if (slideCount >= 20) break;
    }
    
    // If no content slides were created, add a summary slide
    if (slideCount === 0) {
      const contentSlide = pptx.addSlide();
      addNHSBackground(contentSlide);
      
      contentSlide.addText('📋 Content Summary', {
        x: 0.8,
        y: 0.8,
        w: 8.4,
        h: 0.8,
        fontSize: 36,
        bold: true,
        color: '005EB8',
        fontFace: 'Calibri'
      });
      
      const cleanedContent = cleanMarkdown(content);
      const contentLines = cleanedContent.split('\n')
        .filter(line => line.trim())
        .slice(0, 8)
        .join('\n• ');
      
      contentSlide.addText('• ' + contentLines, {
        x: 1.2,
        y: 2.0,
        w: 7.6,
        h: 4.2,
        fontSize: 22,
        fontFace: 'Calibri',
        color: '333333',
        lineSpacing: 1.3,
        valign: 'top'
      });
      
      addFooter(contentSlide);
    }

    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
    await pptx.writeFile({ fileName });
    
  } catch (error) {
    console.error('Error generating PowerPoint:', error);
    throw new Error('Failed to generate PowerPoint presentation');
  }
};

export const generatePDF = async (content: string, title: string = 'AI Generated Document') => {
  try {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const lineHeight = 7;
    const maxLineWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Helper function to add a new page if needed
    const addNewPageIfNeeded = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
    };

    // Helper function to process text with formatting and proper wrapping
    const addFormattedText = (text: string, fontSize: number, xPos: number = margin) => {
      pdf.setFontSize(fontSize);
      
      // First, split the text into words to handle wrapping properly
      const words = text.split(' ');
      let currentLine = '';
      let currentX = xPos;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        // Check if this word contains formatting
        const hasFormatting = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/.test(word);
        
        // Calculate width of test line
        pdf.setFont('helvetica', 'normal'); // Reset to measure properly
        const testWidth = pdf.getTextWidth(testLine);
        
        if (testWidth > maxLineWidth && currentLine !== '') {
          // Current line is full, render it and start new line
          renderFormattedLine(currentLine, fontSize, currentX);
          yPosition += lineHeight;
          addNewPageIfNeeded(lineHeight);
          currentLine = word;
          currentX = margin;
        } else {
          currentLine = testLine;
        }
      }
      
      // Render the last line
      if (currentLine) {
        renderFormattedLine(currentLine, fontSize, currentX);
      }
    };
    
    // Helper function to render a line with formatting
    const renderFormattedLine = (text: string, fontSize: number, xPos: number) => {
      const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
      let currentX = xPos;
      
      pdf.setFontSize(fontSize);
      
      for (const part of parts) {
        if (!part) continue;
        
        let displayText = part;
        let isBold = false;
        let isItalic = false;
        let isCode = false;
        
        // Check formatting
        if (part.startsWith('**') && part.endsWith('**')) {
          displayText = part.slice(2, -2);
          isBold = true;
        } else if (part.startsWith('*') && part.endsWith('*')) {
          displayText = part.slice(1, -1);
          isItalic = true;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          displayText = part.slice(1, -1);
          isCode = true;
        }
        
        // Set font style
        if (isBold && isItalic) {
          pdf.setFont('helvetica', 'bolditalic');
        } else if (isBold) {
          pdf.setFont('helvetica', 'bold');
        } else if (isItalic) {
          pdf.setFont('helvetica', 'italic');
        } else if (isCode) {
          pdf.setFont('courier', 'normal');
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        
        // Add text at current position
        pdf.text(displayText, currentX, yPosition);
        currentX += pdf.getTextWidth(displayText);
      }
      
      // Reset font
      pdf.setFont('helvetica', 'normal');
    };

    // Add title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, yPosition);
    yPosition += lineHeight + 5;

    // Add generation date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, yPosition);
    yPosition += lineHeight * 2;

    // Reset text color
    pdf.setTextColor(0, 0, 0);

    // Process content
    const sections = content.split('\n\n');
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;

      const lines = trimmedSection.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;

        // Check if it's a heading
        const headingMatch = line.match(/^(#+)\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(headingMatch[1].length, 6);
          const headingText = headingMatch[2];
          
          // Add space before heading
          yPosition += 5;
          addNewPageIfNeeded(lineHeight + 5);
          
          // Set heading style
          const fontSize = 16 - (level * 1);
          pdf.setFontSize(fontSize);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(46, 92, 138); // Blue color
          
          addFormattedText(headingText, fontSize);
          yPosition += lineHeight + 3;
          
          // Reset style
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          
        } else {
          // Regular text - preserve formatting
          if (!line.trim()) continue;
          
          // Check if line contains table indicators
          if (line.includes('|') && line.split('|').length > 2) {
            // Simple table handling - split by pipes
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
            if (cells.length > 0 && !cells.every(cell => /^[-\s]*$/.test(cell))) {
              addNewPageIfNeeded(lineHeight);
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'normal');
              
              const cellWidth = (maxLineWidth - 10) / cells.length; // Leave some margin
              cells.forEach((cell, index) => {
                const xPos = margin + (index * cellWidth);
                // Use simple text for table cells to avoid formatting issues
                const cleanText = cleanMarkdown(cell);
                const wrappedText = pdf.splitTextToSize(cleanText, cellWidth - 5);
                pdf.text(wrappedText[0] || '', xPos, yPosition); // Just first line for tables
              });
              yPosition += lineHeight;
            }
          } else {
            // Regular paragraph with formatting
            addNewPageIfNeeded(lineHeight);
            addFormattedText(line, 11);
            yPosition += lineHeight;
          }
        }
      }
      
      // Add space between sections
      yPosition += 5;
    }

    // Save the PDF
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(fileName);
    
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};