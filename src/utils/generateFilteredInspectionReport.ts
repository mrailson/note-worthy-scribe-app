import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface ReportItem {
  id: string;
  key: string;
  name: string;
  category?: string;
  domain?: string;
  status: string;
  notes?: string | null;
  assignedTo?: string | null;
  fixByDate?: string | null;
  fixByPreset?: string | null;
  photoUrl?: string | null;
  photoFileName?: string | null;
  evidenceFiles?: Array<{ type: string; url?: string; name: string }>;
}

interface PracticeDetails {
  name: string;
  address?: string;
  postcode?: string;
  practiceCode?: string;
}

interface FilteredReportData {
  title: string;
  practice: PracticeDetails;
  items: ReportItem[];
  statusLabel: string;
}

const STATUS_LABELS: Record<string, string> = {
  verified: 'Verified',
  issue_found: 'Issue Found',
  not_applicable: 'Not Applicable',
  not_checked: 'Not Checked',
  met: 'Met',
  partially_met: 'Partially Met',
  not_met: 'Not Met',
  not_assessed: 'Not Assessed'
};

// Helper to fetch image as base64
const fetchImageAsBase64 = async (url: string): Promise<{ base64: string; width: number; height: number } | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      const img = new Image();
      
      img.onload = () => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ 
            base64, 
            width: Math.min(img.width, 200), 
            height: Math.min(img.height, 150) 
          });
        };
        reader.readAsDataURL(blob);
      };
      
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
};

export const generateFilteredInspectionReport = async (data: FilteredReportData): Promise<void> => {
  const { title, practice, items, statusLabel } = data;
  const currentDate = format(new Date(), 'dd MMMM yyyy');
  const currentTime = format(new Date(), 'HH:mm');

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Generated: ${currentDate} at ${currentTime}`, italics: true })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  // Practice Details
  children.push(
    new Paragraph({
      text: 'Practice Details',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Practice Name:', bold: true })] })],
              width: { size: 30, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph(practice.name)],
              width: { size: 70, type: WidthType.PERCENTAGE }
            })
          ]
        }),
        ...(practice.practiceCode ? [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Practice Code:', bold: true })] })]
              }),
              new TableCell({
                children: [new Paragraph(practice.practiceCode)]
              })
            ]
          })
        ] : []),
        ...(practice.postcode ? [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: 'Postcode:', bold: true })] })]
              }),
              new TableCell({
                children: [new Paragraph(practice.postcode)]
              })
            ]
          })
        ] : []),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Report Date:', bold: true })] })]
            }),
            new TableCell({
              children: [new Paragraph(currentDate)]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Status Filter:', bold: true })] })]
            }),
            new TableCell({
              children: [new Paragraph(statusLabel)]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Total Items:', bold: true })] })]
            }),
            new TableCell({
              children: [new Paragraph(String(items.length))]
            })
          ]
        })
      ]
    })
  );

  children.push(new Paragraph({ text: '', spacing: { after: 300 } }));

  // Items Section
  children.push(
    new Paragraph({
      text: `${statusLabel} Items (${items.length})`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 200 }
    })
  );

  // Process each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Item header
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true }),
          new TextRun({ text: item.name, bold: true })
        ],
        spacing: { before: 200, after: 100 }
      })
    );

    // Category/Domain
    if (item.category || item.domain) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Category: ', bold: true, size: 20 }),
            new TextRun({ text: item.category || item.domain || '', size: 20 })
          ],
          spacing: { after: 50 }
        })
      );
    }

    // Status
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true, size: 20 }),
          new TextRun({ text: STATUS_LABELS[item.status] || item.status, size: 20 })
        ],
        spacing: { after: 50 }
      })
    );

    // Assigned To
    if (item.assignedTo) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Assigned To: ', bold: true, size: 20 }),
            new TextRun({ text: item.assignedTo, size: 20 })
          ],
          spacing: { after: 50 }
        })
      );
    }

    // Fix By Date
    if (item.fixByDate) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Fix By: ', bold: true, size: 20 }),
            new TextRun({ text: format(new Date(item.fixByDate), 'dd MMMM yyyy'), size: 20 })
          ],
          spacing: { after: 50 }
        })
      );
    }

    // Notes
    if (item.notes) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Notes:', bold: true, size: 20 })
          ],
          spacing: { before: 50, after: 50 }
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.notes, size: 20 })],
          spacing: { after: 100 }
        })
      );
    }

    // Evidence Files
    if (item.evidenceFiles && item.evidenceFiles.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Attachments:', bold: true, size: 20 })
          ],
          spacing: { before: 50, after: 50 }
        })
      );

      for (const file of item.evidenceFiles) {
        if (file.type === 'link') {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `• Link: ${file.name}`, size: 20 }),
                file.url ? new TextRun({ text: ` (${file.url})`, size: 18, italics: true }) : new TextRun({ text: '' })
              ],
              spacing: { after: 30 }
            })
          );
        } else if (file.type === 'photo' || file.type === 'file') {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `• File: ${file.name}`, size: 20 })
              ],
              spacing: { after: 30 }
            })
          );
          
          // Try to add image thumbnail
          if (file.url && file.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            try {
              const imageData = await fetchImageAsBase64(file.url);
              if (imageData) {
                children.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: Uint8Array.from(atob(imageData.base64), c => c.charCodeAt(0)),
                        transformation: {
                          width: imageData.width,
                          height: imageData.height
                        },
                        type: 'png'
                      })
                    ],
                    spacing: { after: 100 }
                  })
                );
              }
            } catch (error) {
              console.error('Could not add image:', error);
            }
          }
        }
      }
    }

    // Photo URL (for fundamentals)
    if (item.photoUrl) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Photo Evidence:', bold: true, size: 20 })
          ],
          spacing: { before: 50, after: 50 }
        })
      );
      
      try {
        const imageData = await fetchImageAsBase64(item.photoUrl);
        if (imageData) {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: Uint8Array.from(atob(imageData.base64), c => c.charCodeAt(0)),
                  transformation: {
                    width: imageData.width,
                    height: imageData.height
                  },
                  type: 'png'
                })
              ],
              spacing: { after: 100 }
            })
          );
        }
      } catch (error) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Photo: ${item.photoFileName || item.photoUrl}`, size: 20 })],
            spacing: { after: 100 }
          })
        );
      }
    }

    // Separator line
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '─'.repeat(50), color: 'CCCCCC' })],
        spacing: { before: 100, after: 100 }
      })
    );
  }

  // Footer
  children.push(
    new Paragraph({
      text: '',
      spacing: { after: 200 }
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ 
          text: `Report generated on ${currentDate} at ${currentTime}`, 
          italics: true, 
          size: 18 
        })
      ],
      alignment: AlignmentType.CENTER
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.docx`;
  saveAs(blob, fileName);
};
