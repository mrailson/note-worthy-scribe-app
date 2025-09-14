import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';

interface EmailTranslation {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

interface EmailReply {
  englishText: string;
  translatedText: string;
  targetLanguage: string;
}

interface QualityAssessment {
  forwardAccuracy: number;
  reverseAccuracy: number;
  medicalTermsPreserved: boolean;
  culturalAppropriateness: number;
  overallSafety: 'safe' | 'warning' | 'unsafe';
  issues: string[];
  recommendation: string;
  reverseTranslation?: string;
}

const getLanguageName = (code: string): string => {
  const language = HEALTHCARE_LANGUAGES.find(l => l.code === code);
  return language?.name || code.charAt(0).toUpperCase() + code.slice(1);
};

const getSafetyStatusText = (safety: string): string => {
  switch (safety) {
    case 'safe': return 'SAFE TO SEND';
    case 'warning': return 'REVIEW RECOMMENDED';
    case 'unsafe': return 'MANUAL REVIEW REQUIRED';
    default: return 'UNKNOWN';
  }
};

const getSafetyColor = (safety: string): string => {
  switch (safety) {
    case 'safe': return '22C55E'; // Green
    case 'warning': return 'F59E0B'; // Yellow
    case 'unsafe': return 'EF4444'; // Red
    default: return '6B7280'; // Gray
  }
};

export const downloadEmailTranslationProof = async (
  originalEmail: EmailTranslation,
  emailReply: EmailReply,
  qualityAssessment: QualityAssessment
): Promise<void> => {
  try {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-GB');
    const formattedTime = currentDate.toLocaleTimeString('en-GB');
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header
          new Paragraph({
            children: [
              new TextRun({
                text: 'NHS GP TRANSLATION SERVICE',
                bold: true,
                size: 32,
                color: '2563EB'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 }
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: 'EMAIL TRANSLATION PROOF CERTIFICATE',
                bold: true,
                size: 28,
                color: '1F2937'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
          }),

          // Document Info
          new Paragraph({
            children: [
              new TextRun({
                text: 'Generated: ',
                bold: true
              }),
              new TextRun(`${formattedDate} at ${formattedTime}`)
            ],
            spacing: { after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Document ID: ',
                bold: true
              }),
              new TextRun(`ET-${currentDate.getTime().toString().slice(-8)}`)
            ],
            spacing: { after: 400 }
          }),

          // Safety Status
          new Paragraph({
            children: [
              new TextRun({
                text: 'SAFETY STATUS: ',
                bold: true,
                size: 24
              }),
              new TextRun({
                text: getSafetyStatusText(qualityAssessment.overallSafety),
                bold: true,
                size: 24,
                color: getSafetyColor(qualityAssessment.overallSafety)
              })
            ],
            spacing: { after: 400 }
          }),

          // Section 1: Original Email
          new Paragraph({
            children: [
              new TextRun({
                text: '1. ORIGINAL INCOMING EMAIL',
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Language: ',
                bold: true
              }),
              new TextRun(`${getLanguageName(originalEmail.detectedLanguage)} (Confidence: ${originalEmail.confidence}%)`)
            ],
            spacing: { after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Content:',
                bold: true
              })
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: originalEmail.originalText,
                italics: true
              })
            ],
            spacing: { after: 300 },
            indent: { left: 720 }
          }),

          // Section 2: English Translation
          new Paragraph({
            children: [
              new TextRun({
                text: '2. ENGLISH TRANSLATION',
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: originalEmail.translatedText,
                italics: true
              })
            ],
            spacing: { after: 300 },
            indent: { left: 720 }
          }),

          // Section 3: English Reply
          new Paragraph({
            children: [
              new TextRun({
                text: '3. ENGLISH REPLY COMPOSED',
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: emailReply.englishText,
                italics: true
              })
            ],
            spacing: { after: 300 },
            indent: { left: 720 }
          }),

          // Section 4: Translated Reply
          new Paragraph({
            children: [
              new TextRun({
                text: `4. TRANSLATED REPLY (${getLanguageName(emailReply.targetLanguage).toUpperCase()})`,
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: emailReply.translatedText,
                italics: true
              })
            ],
            spacing: { after: 300 },
            indent: { left: 720 }
          }),

          // Section 5: Quality Assessment
          new Paragraph({
            children: [
              new TextRun({
                text: '5. QUALITY ASSESSMENT RESULTS',
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Forward Translation Accuracy: ',
                bold: true
              }),
              new TextRun(`${qualityAssessment.forwardAccuracy}%`)
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Reverse Translation Accuracy: ',
                bold: true
              }),
              new TextRun(`${qualityAssessment.reverseAccuracy}%`)
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Medical Terms Preserved: ',
                bold: true
              }),
              new TextRun({
                text: qualityAssessment.medicalTermsPreserved ? 'YES' : 'NO',
                color: qualityAssessment.medicalTermsPreserved ? '22C55E' : 'EF4444',
                bold: true
              })
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Cultural Appropriateness: ',
                bold: true
              }),
              new TextRun(`${qualityAssessment.culturalAppropriateness}%`)
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Overall Safety Assessment: ',
                bold: true
              }),
              new TextRun({
                text: getSafetyStatusText(qualityAssessment.overallSafety),
                bold: true,
                color: getSafetyColor(qualityAssessment.overallSafety)
              })
            ],
            spacing: { after: 300 }
          }),

          // Section 6: Assessment Issues & Recommendation
          new Paragraph({
            children: [
              new TextRun({
                text: '6. ASSESSMENT DETAILS',
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Issues Identified:',
                bold: true
              })
            ],
            spacing: { after: 100 }
          }),

          ...qualityAssessment.issues.map(issue => 
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${issue}`,
                  italics: true
                })
              ],
              spacing: { after: 100 },
              indent: { left: 720 }
            })
          ),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Recommendation:',
                bold: true
              })
            ],
            spacing: { before: 200, after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: qualityAssessment.recommendation,
                italics: true
              })
            ],
            spacing: { after: 400 },
            indent: { left: 720 }
          }),

          // Reverse Translation (if available)
          ...(qualityAssessment.reverseTranslation ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: '7. REVERSE TRANSLATION CHECK',
                  bold: true,
                  size: 24,
                  color: '2563EB'
                })
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: 'Reverse Translation (back to English):',
                  bold: true
                })
              ],
              spacing: { after: 100 }
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: qualityAssessment.reverseTranslation,
                  italics: true
                })
              ],
              spacing: { after: 400 },
              indent: { left: 720 }
            })
          ] : []),

          // Footer/Certification
          new Paragraph({
            children: [
              new TextRun({
                text: '8. CERTIFICATION',
                bold: true,
                size: 24,
                color: '2563EB'
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'This document certifies that the above email translation has been processed through the NHS GP Translation Service quality assurance system. The translation has been assessed for accuracy, medical terminology preservation, and cultural appropriateness.',
                italics: true
              })
            ],
            spacing: { after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Status: ${getSafetyStatusText(qualityAssessment.overallSafety)}`,
                bold: true,
                color: getSafetyColor(qualityAssessment.overallSafety)
              })
            ],
            spacing: { after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Generated by NHS GP Translation Service AI System',
                size: 20,
                color: '6B7280'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 }
          })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const filename = `NHS_Translation_Proof_${currentDate.toISOString().split('T')[0]}_${currentDate.getTime().toString().slice(-6)}.docx`;
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error('Failed to generate Word document');
  }
};