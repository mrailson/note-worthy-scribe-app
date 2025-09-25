import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface ManualTranslationEntry {
  id: string;
  exchangeNumber: number;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguageDetected: string;
  targetLanguage: string;
  detectionConfidence: number;
  translationAccuracy: number;
  translationConfidence: number;
  safetyFlag: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected: string[];
  processingTimeMs: number;
  timestamp: Date;
}

interface ManualTranslationSession {
  id: string;
  sessionTitle: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  totalExchanges: number;
  sessionDurationSeconds: number;
  averageAccuracy: number;
  averageConfidence: number;
  overallSafetyRating: 'safe' | 'warning' | 'unsafe';
  sessionStart: Date;
  sessionEnd?: Date;
  isCompleted: boolean;
  entries: ManualTranslationEntry[];
}

export async function downloadManualTranslationDOCX(
  session: ManualTranslationSession,
  translations: ManualTranslationEntry[]
): Promise<void> {
  try {
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

    const getLanguageName = (code: string) => {
      const languageNames: Record<string, string> = {
        'en': 'English',
        'ar': 'Arabic',
        'zh': 'Chinese (Mandarin)',
        'hi': 'Hindi',
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'tr': 'Turkish',
        'fa': 'Persian (Farsi)',
        'ku': 'Kurdish',
        'ps': 'Pashto',
        'ti': 'Tigrinya'
      };
      return languageNames[code] || code.charAt(0).toUpperCase() + code.slice(1);
    };

    const safeCount = translations.filter(t => t.safetyFlag === 'safe').length;
    const warningCount = translations.filter(t => t.safetyFlag === 'warning').length;
    const unsafeCount = translations.filter(t => t.safetyFlag === 'unsafe').length;

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Document Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "NHS MANUAL TRANSLATION SERVICE REPORT",
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
                text: "Automated Translation Session Documentation",
                size: 24,
                color: "666666"
              })
            ]
          }),

          new Paragraph({ text: "" }), // Space

          // Session Information Table
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
                      children: [new TextRun({ text: new Date().toLocaleString('en-GB') })] 
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
                      children: [new TextRun({ 
                        text: session.sessionEnd 
                          ? session.sessionEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          : 'In Progress'
                      })] 
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
                      children: [new TextRun({ text: "Target Language", bold: true })] 
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
                      children: [new TextRun({ text: "Average Accuracy", bold: true })] 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: `${Math.round(session.averageAccuracy)}%` })] 
                    })]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "" }), // Space

          // Safety Assessment
          new Paragraph({
            children: [
              new TextRun({
                text: "SAFETY ASSESSMENT",
                bold: true,
                size: 24,
                color: "005EB8"
              })
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Overall Safety Rating: ${session.overallSafetyRating.toUpperCase()}`,
                bold: true,
                size: 20,
                color: session.overallSafetyRating === 'safe' ? '28A745' : 
                      session.overallSafetyRating === 'warning' ? 'FFC107' : 'DC3545'
              })
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `This manual translation session has been assessed and rated as ${session.overallSafetyRating.toUpperCase()} for clinical communication purposes based on translation accuracy, confidence scores, and medical terminology detection.`
              })
            ]
          }),

          new Paragraph({ text: "" }), // Space

          // Translation Quality Metrics
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: "Metric", bold: true })] 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: "Value", bold: true })] 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: "Assessment", bold: true })] 
                    })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: "Average Accuracy" })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ 
                        text: `${Math.round(session.averageAccuracy)}%`,
                        color: session.averageAccuracy >= 90 ? '28A745' : 
                               session.averageAccuracy >= 75 ? 'FFC107' : 'DC3545'
                      })] 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: session.averageAccuracy >= 90 ? 'Excellent' : 
                            session.averageAccuracy >= 75 ? 'Good' : 'Needs Review'
                    })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: "Average Confidence" })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ 
                        text: `${Math.round(session.averageConfidence)}%`,
                        color: session.averageConfidence >= 90 ? '28A745' : 
                               session.averageConfidence >= 75 ? 'FFC107' : 'DC3545'
                      })] 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: session.averageConfidence >= 90 ? 'High Confidence' : 
                            session.averageConfidence >= 75 ? 'Moderate Confidence' : 'Low Confidence'
                    })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: "Safe Translations" })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: safeCount.toString() })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: `${Math.round((safeCount / translations.length) * 100)}% of total`
                    })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: "Warning Translations" })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: warningCount.toString() })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: `${Math.round((warningCount / translations.length) * 100)}% of total`
                    })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: "Unsafe Translations" })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: unsafeCount.toString() })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: `${Math.round((unsafeCount / translations.length) * 100)}% of total`
                    })]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "" }), // Space

          // Detailed Translation Log
          new Paragraph({
            children: [
              new TextRun({
                text: "DETAILED TRANSLATION LOG",
                bold: true,
                size: 24,
                color: "005EB8"
              })
            ]
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "Complete record of all translations during the session, including accuracy scores and safety assessments.",
                size: 20,
                color: "666666"
              })
            ]
          }),

          new Paragraph({ text: "" }), // Space

          // Translation entries
          ...translations.map((translation, index) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Exchange #${translation.exchangeNumber} - ${translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'} (${translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})`,
                  bold: true,
                  size: 22
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
                          children: [new TextRun({ text: `Original (${getLanguageName(translation.originalLanguageDetected)})`, bold: true })] 
                        }),
                        new Paragraph({ text: translation.originalText })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ 
                          children: [new TextRun({ text: `Translation (${getLanguageName(translation.targetLanguage)})`, bold: true })] 
                        }),
                        new Paragraph({ text: translation.translatedText })
                      ]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ 
                          children: [
                            new TextRun({ text: "Accuracy: ", bold: true }),
                            new TextRun({ 
                              text: `${translation.translationAccuracy}%`,
                              color: translation.translationAccuracy >= 90 ? '28A745' : 
                                     translation.translationAccuracy >= 75 ? 'FFC107' : 'DC3545'
                            })
                          ] 
                        }),
                        new Paragraph({ 
                          children: [
                            new TextRun({ text: "Confidence: ", bold: true }),
                            new TextRun({ 
                              text: `${translation.translationConfidence}%`,
                              color: translation.translationConfidence >= 90 ? '28A745' : 
                                     translation.translationConfidence >= 75 ? 'FFC107' : 'DC3545'
                            })
                          ] 
                        })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ 
                          children: [
                            new TextRun({ text: "Safety: ", bold: true }),
                            new TextRun({ 
                              text: translation.safetyFlag.toUpperCase(),
                              color: translation.safetyFlag === 'safe' ? '28A745' : 
                                     translation.safetyFlag === 'warning' ? 'FFC107' : 'DC3545'
                            })
                          ] 
                        }),
                        new Paragraph({ 
                          children: [
                            new TextRun({ text: "Processing: ", bold: true }),
                            new TextRun({ text: `${translation.processingTimeMs}ms` })
                          ] 
                        })
                      ]
                    })
                  ]
                }),
                ...(translation.medicalTermsDetected.length > 0 ? [
                  new TableRow({
                    children: [
                      new TableCell({
                        columnSpan: 2,
                        children: [
                          new Paragraph({ 
                            children: [
                              new TextRun({ text: "Medical Terms Detected: ", bold: true }),
                              new TextRun({ text: translation.medicalTermsDetected.join(', '), color: "005EB8" })
                            ] 
                          })
                        ]
                      })
                    ]
                  })
                ] : [])
              ]
            }),

            new Paragraph({ text: "" }) // Space between entries
          ]).flat(),

          new Paragraph({ text: "" }), // Space

          // Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
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
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "This is an automated translation service for communication assistance only. All medical decisions should be based on professional clinical judgement. Critical medical information should be verified through qualified medical interpretation services."
              })
            ]
          }),

          new Paragraph({ text: "" }), // Space

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Report generated by Notewell AI Manual Translation Tool - ${new Date().toLocaleString('en-GB')}`,
                size: 20,
                color: "666666"
              })
            ]
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "This document contains confidential patient information and should be handled in accordance with NHS data protection policies.",
                size: 20,
                color: "666666"
              })
            ]
          })
        ]
      }]
    });

    // Generate and download the file
    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    const fileName = `Manual_Translation_Session_${session.targetLanguageName.replace(/[^a-zA-Z0-9]/g, '_')}_${session.sessionStart.toISOString().split('T')[0]}.docx`;
    saveAs(blob, fileName);

    console.log('Manual translation DOCX export completed:', fileName);

  } catch (error) {
    console.error('Failed to export manual translation DOCX:', error);
    throw new Error('Failed to generate translation documentation');
  }
}