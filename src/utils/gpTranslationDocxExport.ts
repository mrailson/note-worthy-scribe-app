import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface GPConversationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  englishText: string;
  translatedText: string;
  timestamp: Date;
}

interface GPTranslationSession {
  sessionStart: Date;
  sessionEnd: Date;
  targetLanguageCode: string;
  targetLanguageName: string;
  totalExchanges: number;
  gpExchanges: number;
  patientExchanges: number;
  sessionDurationSeconds: number;
}

export async function downloadGPTranslationDOCX(
  session: GPTranslationSession,
  entries: GPConversationEntry[]
): Promise<void> {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Document Header
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "NHS GP-PATIENT TRANSLATION SERVICE",
              bold: true,
              size: 32,
              color: "005EB8"
            })
          ]
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Live Translation Session Documentation",
              size: 24,
              color: "666666"
            })
          ]
        }),

        new Paragraph({ text: "" }),

        // Session Information Header
        new Paragraph({
          children: [
            new TextRun({
              text: "SESSION INFORMATION",
              bold: true,
              size: 24,
              color: "005EB8"
            })
          ]
        }),

        // Session Information Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Report Generated", bold: true })] 
                  })]
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })] 
                  })]
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Session Date", bold: true })] 
                  })]
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: session.sessionStart.toLocaleDateString('en-GB') })] 
                  })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Session Start", bold: true })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: session.sessionStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Session End", bold: true })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: session.sessionEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })] 
                  })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Duration", bold: true })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: formatDuration(session.sessionDurationSeconds) })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Patient Language", bold: true })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: session.targetLanguageName })] 
                  })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "Total Exchanges", bold: true })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: session.totalExchanges.toString() })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: "GP / Patient", bold: true })] 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    children: [new TextRun({ text: `${session.gpExchanges} / ${session.patientExchanges}` })] 
                  })]
                })
              ]
            })
          ]
        }),

        new Paragraph({ text: "" }),

        // Conversation Log Header
        new Paragraph({
          children: [
            new TextRun({
              text: "CONVERSATION LOG",
              bold: true,
              size: 24,
              color: "005EB8"
            })
          ]
        }),

        new Paragraph({
          children: [
            new TextRun({
              text: "Complete record of the translation session between GP and patient.",
              size: 20,
              color: "666666"
            })
          ]
        }),

        new Paragraph({ text: "" }),

        // Conversation entries
        ...entries.flatMap((entry, index) => [
          new Paragraph({
            children: [
              new TextRun({
                text: `Exchange #${index + 1} - ${entry.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'} (${entry.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})`,
                bold: true,
                size: 22,
                color: entry.speaker === 'gp' ? '005EB8' : '28A745'
              })
            ]
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ 
                        children: [new TextRun({ text: "English", bold: true })] 
                      }),
                      new Paragraph({ text: entry.englishText })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ 
                        children: [new TextRun({ text: session.targetLanguageName, bold: true })] 
                      }),
                      new Paragraph({ text: entry.translatedText })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "" })
        ]),

        // Disclaimer
        new Paragraph({
          children: [
            new TextRun({
              text: "IMPORTANT DISCLAIMER",
              bold: true,
              size: 24,
              color: "DC3545"
            })
          ]
        }),

        new Paragraph({
          children: [
            new TextRun({
              text: "This is an automated translation service provided for communication assistance purposes only. All clinical decisions must be based on professional judgement. Translation accuracy should be verified for critical medical information. This service does not replace the need for qualified medical interpreters where clinically indicated.",
              size: 20
            })
          ]
        }),

        new Paragraph({ text: "" }),

        // Footer
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Report generated by Notewell AI GP Translation Service",
              size: 18,
              color: "999999"
            })
          ]
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Confidential - Handle in accordance with NHS data protection policies",
              size: 18,
              color: "999999",
              italics: true
            })
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `GP_Translation_Session_${session.targetLanguageName}_${session.sessionStart.toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
}
