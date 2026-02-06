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
    // Import action item extraction utility
    const { extractActionItemsForTable } = await import('./meetingCoachIntegration');
    
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
        
        // Handle bold and italic (***text***) - render as bold only for cleaner output
        if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
          const content = matchedText.slice(3, -3);
          children.push(new TextRun({
            text: content,
            ...baseRun,
            bold: true,
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
        // Handle single asterisk (*text*) - render as bold for cleaner professional output
        // AI models use these heavily; italic creates cluttered documents
        else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
          const content = matchedText.slice(1, -1);
          children.push(new TextRun({
            text: content,
            ...baseRun,
            bold: true,
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

      // Parse table rows - use slice(1, -1) to remove pipe borders while preserving empty cells
      const rows = tableLines.map(line => {
        const rawCells = line.split('|').map(cell => cell.trim());
        // Use slice(1, -1) to preserve empty cells while removing pipe border artifacts
        return rawCells.slice(1, -1);
      });

      // Skip header separator lines (like ---) but keep empty data rows
      // Use /^[-:]+$/ which requires at least one character, so empty cells are preserved
      const dataRows = rows.filter(row => 
        !row.every(cell => /^[-:]+$/.test(cell))
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

    // Process content into paragraphs and detect tables and action items
    const sections = content.split('\n\n');
    const documentElements: any[] = [];
    let inActionItemsSection = false;

    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;

      // Check if this is the start of ACTION ITEMS section
      const actionItemsHeaderMatch = trimmedSection.match(/^(#{1,6}\s*)?ACTION\s*ITEMS?\s*$/i);
      
      if (actionItemsHeaderMatch) {
        inActionItemsSection = true;
        // Add the heading
        documentElements.push(new Paragraph({
          children: [new TextRun({
            text: 'ACTION ITEMS',
            size: 28,
            bold: true,
            color: '2E5C8A'
          })],
          heading: 'Heading2',
          spacing: { before: 360, after: 180 }
        }));
        continue;
      }

      // Check if we're leaving the action items section (new heading)
      if (inActionItemsSection && trimmedSection.match(/^#{1,6}\s+/)) {
        inActionItemsSection = false;
      }

      // If we're in action items section, look for action items with assignments
      if (inActionItemsSection) {
        const actionItems = extractActionItemsForTable(section);
        
        if (actionItems.length > 0) {
          // Create table for action items
          const tableRows = [
            // Header row
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: 'Assignee', bold: true })],
                  })],
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                }),
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: 'Due Date', bold: true })],
                  })],
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                }),
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: 'Action', bold: true })],
                  })],
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                }),
              ],
              tableHeader: true,
            }),
            // Data rows
            ...actionItems.map(item => new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({
                    children: processFormattedText(item.assignee),
                  })],
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                }),
                new TableCell({
                  children: [new Paragraph({
                    children: processFormattedText(item.dueDate),
                  })],
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                }),
                new TableCell({
                  children: [new Paragraph({
                    children: processFormattedText(item.action),
                  })],
                  margins: { top: 100, bottom: 100, left: 150, right: 150 },
                }),
              ],
            })),
          ];

          documentElements.push(new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '2E5C8A' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '2E5C8A' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '2E5C8A' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '2E5C8A' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            }
          }));
          continue;
        }
      }

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
          
          // More generous spacing for headings - professional document look
          const headingSpacing = {
            1: { before: 400, after: 200 },  // H1 - major sections
            2: { before: 360, after: 180 },  // H2 - sub-sections
            3: { before: 300, after: 160 },  // H3 - minor sections
            4: { before: 260, after: 140 },  // H4-H6 - detail headings
            5: { before: 240, after: 120 },
            6: { before: 220, after: 100 },
          };
          
          documentElements.push(new Paragraph({
            children: processFormattedText(headingText),
            heading: level === 1 ? 'Heading1' : 
                    level === 2 ? 'Heading2' : 
                    level === 3 ? 'Heading3' : 
                    level === 4 ? 'Heading4' : 
                    level === 5 ? 'Heading5' : 'Heading6',
            spacing: headingSpacing[level as keyof typeof headingSpacing] || { before: 240, after: 120 }
          }));
        } else {
          // Check for clinical sub-headings (bold text followed by colon)
          // e.g., "**History:** patient presents..." or "Overall Impression:"
          const clinicalSubheadingMatch = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
          const inlineSubheadingMatch = line.match(/^([A-Z][^:]{2,30}):\s*(.+)$/);
          
          if (clinicalSubheadingMatch) {
            // Bold clinical sub-heading with content
            const [, heading, content] = clinicalSubheadingMatch;
            documentElements.push(new Paragraph({
              children: [
                new TextRun({
                  text: `${heading}: `,
                  bold: true,
                  size: 24,
                  font: defaultRunFont,
                }),
                ...processFormattedText(content)
              ],
              spacing: { before: 260, after: 160 }
            }));
          } else if (inlineSubheadingMatch && inlineSubheadingMatch[1].length < 40) {
            // Inline sub-heading (e.g., "Overall Impression: ...")
            const [, heading, content] = inlineSubheadingMatch;
            documentElements.push(new Paragraph({
              children: [
                new TextRun({
                  text: `${heading}: `,
                  bold: true,
                  size: 24,
                  font: defaultRunFont,
                }),
                ...processFormattedText(content)
              ],
              spacing: { before: 220, after: 160 }
            }));
          } else {
            // Regular paragraph with improved spacing
            documentElements.push(new Paragraph({
              children: processFormattedText(line),
              spacing: { before: 160, after: 160 }
            }));
          }
        }
      }
    }

    // If no elements were created, add the full content as a paragraph
    if (documentElements.length === 0) {
      documentElements.push(new Paragraph({
        children: processFormattedText(content),
        spacing: { before: 160, after: 160 }
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

// Interface for Scribe consultation export
export interface ScribeExportDetails {
  content: string;
  title?: string;
  practiceName?: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  practiceLogoUrl?: string;
}

// Generate a formatted Scribe consultation Word document with smaller fonts and practice logo
export const generateScribeWordDocument = async (details: ScribeExportDetails): Promise<Blob> => {
  const { ImageRun } = await import('docx');
  
  try {
    const {
      content,
      title = 'Consultation Notes',
      practiceName = '',
      practiceAddress = '',
      practicePhone = '',
      practiceEmail = '',
      practiceLogoUrl = ''
    } = details;

    const documentElements: any[] = [];

    // Add logo at the top if available
    if (practiceLogoUrl) {
      try {
        const imageResponse = await fetch(practiceLogoUrl);
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          documentElements.push(new Paragraph({
            children: [
              new ImageRun({
                data: uint8Array,
                transformation: { width: 120, height: 60 },
                type: practiceLogoUrl.toLowerCase().includes('.png') ? 'png' : 'jpg'
              })
            ],
            alignment: 'center' as any,
            spacing: { after: 120 }
          }));
        }
      } catch (logoError) {
        console.warn('Failed to fetch logo for Word export:', logoError);
      }
    }

    // Add practice name header
    if (practiceName) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: practiceName,
          size: 22, // 11pt
          bold: true,
          color: '005EB8',
          font: defaultRunFont
        })],
        alignment: 'center' as any,
        spacing: { after: 60 }
      }));
    }

    // Add practice address
    if (practiceAddress) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: practiceAddress,
          size: 16, // 8pt
          color: '666666',
          font: defaultRunFont
        })],
        alignment: 'center' as any,
        spacing: { after: 40 }
      }));
    }

    // Add practice contact details
    const contactParts: string[] = [];
    if (practicePhone) contactParts.push(`Tel: ${practicePhone}`);
    if (practiceEmail) contactParts.push(practiceEmail);
    if (contactParts.length > 0) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: contactParts.join(' | '),
          size: 16, // 8pt
          color: '666666',
          font: defaultRunFont
        })],
        alignment: 'center' as any,
        spacing: { after: 200 }
      }));
    }

    // Add separator line if we have practice details
    if (practiceName || practiceLogoUrl) {
      documentElements.push(new Paragraph({
        children: [new TextRun({ text: '' })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '005EB8' } },
        spacing: { after: 240 }
      }));
    }

    // Add document title
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: title,
        size: 22, // 11pt
        bold: true,
        color: '2E5C8A',
        font: defaultRunFont
      })],
      spacing: { before: 0, after: 120 }
    }));

    // Add generated date
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        size: 16, // 8pt
        color: '666666',
        font: defaultRunFont
      })],
      spacing: { before: 0, after: 240 }
    }));

    // Process content - split into sections and paragraphs
    const sections = content.split('\n\n');
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;

      const lines = trimmedSection.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Check if it's a section header (all caps or ends with colon)
        const isHeader = /^[A-Z\s()]+$/.test(line.trim()) || line.trim().endsWith(':');
        
        if (isHeader) {
          documentElements.push(new Paragraph({
            children: [new TextRun({
              text: line.trim(),
              size: 18, // 9pt
              bold: true,
              color: '2E5C8A',
              font: defaultRunFont
            })],
            spacing: { before: 180, after: 60 }
          }));
        } else {
          // Regular paragraph with smaller font
          documentElements.push(new Paragraph({
            children: [new TextRun({
              text: line.trim(),
              size: 18, // 9pt - smaller than default
              font: defaultRunFont
            })],
            spacing: { before: 40, after: 40 }
          }));
        }
      }
    }

    // Create document with smaller default fonts
    const doc = new Document({
      creator: 'GP Scribe',
      title: title,
      description: 'Generated by GP Scribe',
      styles: {
        default: {
          document: {
            run: {
              size: 18, // 9pt default
              font: 'Arial'
            }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            }
          }
        },
        children: documentElements
      }]
    });

    // Generate and save the document
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
    const blob = await Packer.toBlob(doc);
    saveAs(blob, fileName);
    
    return blob;
    
  } catch (error: any) {
    console.error('Error generating Scribe Word document:', error);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
}

// Generate a formatted patient letter Word document matching the on-screen layout
export interface PatientLetterDetails {
  letterContent: string;
  practiceName?: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  practiceLogoUrl?: string;
  gpName?: string;
  gpTitle?: string;
  date?: string;
}

export const generatePatientLetterDocument = async (details: PatientLetterDetails): Promise<Blob> => {
  try {
    const {
      letterContent,
      practiceName = 'GP Surgery',
      practiceAddress = '',
      practicePhone = '',
      practiceEmail = '',
      gpName = 'Your GP',
      gpTitle = '',
      date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    } = details;

    const fullSignatureName = gpTitle ? `${gpTitle} ${gpName}` : gpName;

    // Build document elements
    const documentElements: any[] = [];

    // Letterhead - Practice Name (centred, bold, primary colour)
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: practiceName,
        size: 32,
        bold: true,
        color: '005EB8', // NHS Blue
        font: defaultRunFont
      })],
      alignment: 'center' as any,
      spacing: { after: 60 }
    }));

    // Practice Address (centred, smaller)
    if (practiceAddress) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: practiceAddress,
          size: 20,
          color: '666666',
          font: defaultRunFont
        })],
        alignment: 'center' as any,
        spacing: { after: 40 }
      }));
    }

    // Practice Phone & Email (centred, smaller)
    const contactParts: string[] = [];
    if (practicePhone) contactParts.push(`Tel: ${practicePhone}`);
    if (practiceEmail) contactParts.push(practiceEmail);
    if (contactParts.length > 0) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: contactParts.join(' | '),
          size: 20,
          color: '666666',
          font: defaultRunFont
        })],
        alignment: 'center' as any,
        spacing: { after: 120 }
      }));
    }

    // Horizontal line separator
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: '─'.repeat(80),
        size: 16,
        color: '005EB8'
      })],
      alignment: 'center' as any,
      spacing: { after: 240 }
    }));

    // Date (right aligned)
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: date,
        size: 22,
        color: '666666',
        font: defaultRunFont
      })],
      alignment: 'right' as any,
      spacing: { after: 360 }
    }));

    // Dear Patient greeting
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'Dear Patient,',
        size: 24,
        font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
      })],
      spacing: { after: 240 }
    }));

    // Letter body - split by paragraphs
    const paragraphs = letterContent.split('\n\n').filter(p => p.trim());
    for (const para of paragraphs) {
      const lines = para.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          documentElements.push(new Paragraph({
            children: [new TextRun({
              text: line.trim(),
              size: 24,
              font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
            })],
            spacing: { after: 200 }
          }));
        }
      }
      // Add extra space between paragraphs
      documentElements.push(new Paragraph({
        children: [],
        spacing: { after: 120 }
      }));
    }

    // Kind regards
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'Kind regards,',
        size: 24,
        font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
      })],
      spacing: { before: 360, after: 0 }
    }));

    // Empty lines before signature (matching on-screen)
    documentElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
    documentElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));

    // GP Name (bold)
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: fullSignatureName,
        size: 24,
        bold: true,
        font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
      })],
      spacing: { after: 60 }
    }));

    // Practice name under signature
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: practiceName,
        size: 22,
        color: '666666',
        font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
      })],
      spacing: { after: 40 }
    }));

    // Practice phone under signature
    if (practicePhone) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: `Tel: ${practicePhone}`,
          size: 22,
          color: '666666',
          font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
        })],
        spacing: { after: 40 }
      }));
    }

    // Practice email under signature
    if (practiceEmail) {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: `Email: ${practiceEmail}`,
          size: 22,
          color: '666666',
          font: { ascii: 'Georgia', hAnsi: 'Georgia', eastAsia: 'Georgia', cs: 'Georgia' }
        })],
        spacing: { after: 0 }
      }));
    }

    // Create document
    const doc = new Document({
      creator: 'AI4GP',
      title: 'Patient Consultation Summary',
      description: 'Patient letter generated by AI4GP',
      sections: [{
        properties: {
          page: {
            margin: {
              top: 720,  // 0.5 inch
              right: 1440, // 1 inch
              bottom: 720,
              left: 1440,
            }
          }
        },
        children: documentElements
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'patient_consultation_summary.docx');
    return blob;

  } catch (error: any) {
    console.error('Error generating patient letter document:', error);
    throw new Error(`Failed to generate patient letter: ${error.message}`);
  }
}

// Layout configuration for PowerPoint generation - INCREASED spacing to prevent overlap
const PPTX_LAYOUT = {
  SLIDE_WIDTH: 10,
  SLIDE_HEIGHT: 7.5,
  HEADER_Y: 0.8,
  HEADER_HEIGHT: 0.8,
  CONTENT_START_Y: 1.9,
  CONTENT_END_Y: 5.8, // Reduced to give more breathing room
  FOOTER_Y: 6.9,
  LEFT_MARGIN: 0.8,
  CONTENT_WIDTH: 8.4,
  CHARS_PER_LINE: 55, // Reduced from 70 to be more conservative
  LINE_HEIGHT: 0.55,  // Increased from 0.4
  BULLET_SPACING: 0.35, // Increased from 0.2
  MIN_BULLET_HEIGHT: 0.85, // Increased from 0.55
  MAX_BULLETS_PER_SLIDE: 5, // Reduced from 6
};

// Estimate lines needed for text in PowerPoint - account for word wrapping
const estimatePptxTextLines = (text: string): number => {
  // Word-aware line estimation
  const words = text.split(' ');
  let lines = 1;
  let currentLineLength = 0;
  
  for (const word of words) {
    if (currentLineLength + word.length + 1 > PPTX_LAYOUT.CHARS_PER_LINE) {
      lines++;
      currentLineLength = word.length;
    } else {
      currentLineLength += word.length + 1;
    }
  }
  
  return Math.max(1, lines);
};

// Calculate height needed for a bullet point - more generous spacing
const calculatePptxBulletHeight = (text: string): number => {
  const lines = estimatePptxTextLines(text);
  // Add extra padding for safety
  return Math.max(PPTX_LAYOUT.MIN_BULLET_HEIGHT, (lines * PPTX_LAYOUT.LINE_HEIGHT) + PPTX_LAYOUT.BULLET_SPACING + 0.15);
};

// Split long text into manageable chunks
const splitLongText = (text: string, maxChars: number = 140): string[] => {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > maxChars) {
    let breakPoint = maxChars;
    
    // Find natural break points
    const sentenceEnd = remaining.lastIndexOf('. ', breakPoint);
    const semicolon = remaining.lastIndexOf('; ', breakPoint);
    const comma = remaining.lastIndexOf(', ', breakPoint);
    const space = remaining.lastIndexOf(' ', breakPoint);
    
    if (sentenceEnd > maxChars * 0.5) {
      breakPoint = sentenceEnd + 1;
    } else if (semicolon > maxChars * 0.5) {
      breakPoint = semicolon + 1;
    } else if (comma > maxChars * 0.5) {
      breakPoint = comma + 1;
    } else if (space > maxChars * 0.3) {
      breakPoint = space;
    }
    
    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }
  
  if (remaining) chunks.push(remaining);
  return chunks;
};

export const generatePowerPoint = async (content: string, title: string = 'AI Generated Presentation') => {
  try {
    const pptx = new PptxGenJS();
    
    // NHS Color scheme
    const nhsBlue = '#005EB8';
    const darkGrey = '#666666';
    
    // Set slide layout
    pptx.defineLayout({ name: 'NHS_LAYOUT', width: PPTX_LAYOUT.SLIDE_WIDTH, height: PPTX_LAYOUT.SLIDE_HEIGHT });
    pptx.layout = 'NHS_LAYOUT';
    
    // Helper function to add NHS-style background
    const addNHSBackground = (slide: any) => {
      slide.background = { fill: 'FFFFFF' };
    };
    
    // Helper function to add footer
    const addFooter = (slide: any) => {
      const timestamp = `AI Generated Summary – ${new Date().toLocaleDateString('en-GB')}`;
      slide.addText(timestamp, {
        x: 0.5,
        y: PPTX_LAYOUT.FOOTER_Y,
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
      if (lowerText.includes('contraindication') || lowerText.includes('warning') || lowerText.includes('caution')) return '⚠️ ';
      if (lowerText.includes('dos') || lowerText.includes('medication') || lowerText.includes('drug') || lowerText.includes('treatment')) return '💊 ';
      if (lowerText.includes('reference') || lowerText.includes('study') || lowerText.includes('evidence')) return '📑 ';
      if (lowerText.includes('symptom') || lowerText.includes('sign') || lowerText.includes('diagnosis')) return '🩺 ';
      if (lowerText.includes('table') || lowerText.includes('data')) return '📊 ';
      return '';
    };
    
    // Helper to add bullets with dynamic positioning
    const addBulletsToSlide = (slide: any, bullets: string[], startY: number = PPTX_LAYOUT.CONTENT_START_Y): number => {
      let currentY = startY;
      
      for (const point of bullets) {
        const height = calculatePptxBulletHeight(point);
        
        // Stop if we'd exceed the content area
        if (currentY + height > PPTX_LAYOUT.CONTENT_END_Y) break;
        
        slide.addText(point, {
          x: PPTX_LAYOUT.LEFT_MARGIN + 0.4,
          y: currentY,
          w: PPTX_LAYOUT.CONTENT_WIDTH - 0.4,
          h: height,
          fontSize: 20,
          fontFace: 'Calibri',
          bullet: { type: 'bullet' },
          lineSpacing: 28,
          wrap: true,
          valign: 'top',
          color: '333333'
        });
        
        currentY += height;
      }
      
      return currentY;
    };
    
    // Helper to split bullets across slides if needed
    const createSlidesForBullets = (bullets: string[], slideTitle: string, titleIcon: string) => {
      const slides: { title: string; bullets: string[] }[] = [];
      let currentBullets: string[] = [];
      let currentHeight = 0;
      let partNumber = 1;
      
      for (const bullet of bullets) {
        const height = calculatePptxBulletHeight(bullet);
        
        // Check if this bullet fits
        const wouldExceed = currentHeight + height > (PPTX_LAYOUT.CONTENT_END_Y - PPTX_LAYOUT.CONTENT_START_Y);
        const tooManyBullets = currentBullets.length >= PPTX_LAYOUT.MAX_BULLETS_PER_SLIDE;
        
        if ((wouldExceed || tooManyBullets) && currentBullets.length > 0) {
          // Save current slide and start new one
          slides.push({
            title: partNumber === 1 ? titleIcon + slideTitle : titleIcon + slideTitle + ` (${partNumber})`,
            bullets: currentBullets
          });
          partNumber++;
          currentBullets = [];
          currentHeight = 0;
        }
        
        currentBullets.push(bullet);
        currentHeight += height;
      }
      
      // Add remaining bullets
      if (currentBullets.length > 0) {
        slides.push({
          title: partNumber === 1 ? titleIcon + slideTitle : titleIcon + slideTitle + ` (${partNumber})`,
          bullets: currentBullets
        });
      }
      
      return slides;
    };
    
    // Title slide
    const titleSlide = pptx.addSlide();
    addNHSBackground(titleSlide);
    
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
      
      // Get non-table content
      const nonTableLines = lines.filter(line => !(line.includes('|') && line.split('|').length > 2));
      const hasDescriptiveText = nonTableLines.some(line => line.trim().length > 0 && !line.match(/^[-\s|]+$/));
      
      if (hasTable && hasDescriptiveText) {
        // Create text slide(s) first
        const slideTitle = cleanMarkdown(firstLine.replace(/^#+\s*/, '').replace(/:$/, ''));
        const titleIcon = getIconForSection(slideTitle);
        
        // Process bullet points with text splitting
        let bulletPoints = nonTableLines
          .filter(line => line.trim().length > 0)
          .map(line => cleanMarkdown(line.replace(/^[-•]\s*/, '').trim()))
          .filter(line => line.length > 0)
          .flatMap(line => splitLongText(line));
        
        // Create slides for bullets (may be multiple if content is long)
        const bulletSlides = createSlidesForBullets(bulletPoints, slideTitle, titleIcon);
        
        for (const slideData of bulletSlides) {
          const textSlide = pptx.addSlide();
          addNHSBackground(textSlide);
          slideCount++;
          
          textSlide.addText(slideData.title, {
            x: PPTX_LAYOUT.LEFT_MARGIN,
            y: PPTX_LAYOUT.HEADER_Y,
            w: PPTX_LAYOUT.CONTENT_WIDTH,
            h: PPTX_LAYOUT.HEADER_HEIGHT,
            fontSize: 32,
            bold: true,
            color: '005EB8',
            fontFace: 'Calibri'
          });
          
          addBulletsToSlide(textSlide, slideData.bullets);
          addFooter(textSlide);
        }
        
        // Create table slide
        const tableSlide = pptx.addSlide();
        addNHSBackground(tableSlide);
        slideCount++;
        
        tableSlide.addText('📊 ' + slideTitle + ' - Data', {
          x: PPTX_LAYOUT.LEFT_MARGIN,
          y: PPTX_LAYOUT.HEADER_Y,
          w: PPTX_LAYOUT.CONTENT_WIDTH,
          h: PPTX_LAYOUT.HEADER_HEIGHT,
          fontSize: 32,
          bold: true,
          color: '005EB8',
          fontFace: 'Calibri'
        });

        // Process table with dynamic row heights
        const tableRows = pipeLines.map(line => 
          line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
        );

        const dataRows = tableRows.filter(row => !row.every(cell => /^[-\s]*$/.test(cell)));

        if (dataRows.length > 0) {
          const maxCellLength = Math.max(...dataRows.flat().map(cell => cell.length));
          const rowHeight = Math.max(0.5, Math.min(0.7, maxCellLength / 35));
          
          const tableData = dataRows.map((row, rowIndex) => 
            row.map(cell => ({ 
              text: cleanMarkdown(cell), 
              options: { 
                fontSize: 16,
                fontFace: 'Calibri',
                color: rowIndex === 0 ? 'FFFFFF' : '333333',
                bold: rowIndex === 0,
                fill: { color: rowIndex === 0 ? '005EB8' : (rowIndex % 2 === 1 ? 'F5F5F5' : 'FFFFFF') }
              } 
            }))
          );

          tableSlide.addTable(tableData, {
            x: PPTX_LAYOUT.LEFT_MARGIN,
            y: PPTX_LAYOUT.CONTENT_START_Y,
            w: PPTX_LAYOUT.CONTENT_WIDTH,
            h: PPTX_LAYOUT.CONTENT_END_Y - PPTX_LAYOUT.CONTENT_START_Y,
            border: { pt: 1, color: '005EB8' },
            rowH: rowHeight,
            margin: 0.08,
            autoPage: true,
            autoPageRepeatHeader: true,
          });
        }
        
        addFooter(tableSlide);
        
      } else if (hasTable) {
        // Table only slide
        const tableSlide = pptx.addSlide();
        addNHSBackground(tableSlide);
        slideCount++;
        
        const slideTitle = cleanMarkdown(firstLine.includes('|') ? 'Data Table' : firstLine);
        tableSlide.addText('📊 ' + slideTitle, {
          x: PPTX_LAYOUT.LEFT_MARGIN,
          y: PPTX_LAYOUT.HEADER_Y,
          w: PPTX_LAYOUT.CONTENT_WIDTH,
          h: PPTX_LAYOUT.HEADER_HEIGHT,
          fontSize: 32,
          bold: true,
          color: '005EB8',
          fontFace: 'Calibri'
        });

        const tableRows = pipeLines.map(line => 
          line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
        );

        const dataRows = tableRows.filter(row => !row.every(cell => /^[-\s]*$/.test(cell)));

        if (dataRows.length > 0) {
          const maxCellLength = Math.max(...dataRows.flat().map(cell => cell.length));
          const rowHeight = Math.max(0.5, Math.min(0.7, maxCellLength / 35));
          
          const tableData = dataRows.map((row, rowIndex) => 
            row.map(cell => ({ 
              text: cleanMarkdown(cell), 
              options: { 
                fontSize: 16,
                fontFace: 'Calibri',
                color: rowIndex === 0 ? 'FFFFFF' : '333333',
                bold: rowIndex === 0,
                fill: { color: rowIndex === 0 ? '005EB8' : (rowIndex % 2 === 1 ? 'F5F5F5' : 'FFFFFF') }
              } 
            }))
          );

          tableSlide.addTable(tableData, {
            x: PPTX_LAYOUT.LEFT_MARGIN,
            y: PPTX_LAYOUT.CONTENT_START_Y,
            w: PPTX_LAYOUT.CONTENT_WIDTH,
            h: PPTX_LAYOUT.CONTENT_END_Y - PPTX_LAYOUT.CONTENT_START_Y,
            border: { pt: 1, color: '005EB8' },
            rowH: rowHeight,
            margin: 0.08,
            autoPage: true,
            autoPageRepeatHeader: true,
          });
        }
        
        addFooter(tableSlide);
        
      } else {
        // Text only - with automatic overflow handling
        const slideTitle = cleanMarkdown(firstLine.replace(/^#+\s*/, '').replace(/:$/, ''));
        const titleIcon = getIconForSection(slideTitle);
        
        // Process bullet points
        const bulletPoints = lines.slice(1)
          .filter(line => line.trim())
          .map(line => cleanMarkdown(line.replace(/^[-•]\s*/, '').trim()))
          .filter(line => line.length > 0)
          .flatMap(line => splitLongText(line));
        
        if (bulletPoints.length === 0) continue;
        
        // Create slides (may be multiple if content overflows)
        const bulletSlides = createSlidesForBullets(bulletPoints, slideTitle, titleIcon);
        
        for (const slideData of bulletSlides) {
          const textSlide = pptx.addSlide();
          addNHSBackground(textSlide);
          slideCount++;
          
          textSlide.addText(slideData.title, {
            x: PPTX_LAYOUT.LEFT_MARGIN,
            y: PPTX_LAYOUT.HEADER_Y,
            w: PPTX_LAYOUT.CONTENT_WIDTH,
            h: PPTX_LAYOUT.HEADER_HEIGHT,
            fontSize: 32,
            bold: true,
            color: '005EB8',
            fontFace: 'Calibri'
          });
          
          addBulletsToSlide(textSlide, slideData.bullets);
          addFooter(textSlide);
        }
      }
      
      // Limit slides to prevent overly long presentations
      if (slideCount >= 25) break;
    }
    
    // If no content slides were created, add a summary slide
    if (slideCount === 0) {
      const contentSlide = pptx.addSlide();
      addNHSBackground(contentSlide);
      
      contentSlide.addText('📋 Content Summary', {
        x: PPTX_LAYOUT.LEFT_MARGIN,
        y: PPTX_LAYOUT.HEADER_Y,
        w: PPTX_LAYOUT.CONTENT_WIDTH,
        h: PPTX_LAYOUT.HEADER_HEIGHT,
        fontSize: 32,
        bold: true,
        color: '005EB8',
        fontFace: 'Calibri'
      });
      
      const cleanedContent = cleanMarkdown(content);
      const contentBullets = cleanedContent.split('\n')
        .filter(line => line.trim())
        .slice(0, 6)
        .flatMap(line => splitLongText(line));
      
      addBulletsToSlide(contentSlide, contentBullets);
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