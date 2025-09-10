import { TranslationEntry } from '@/components/TranslationHistory';
import { assessSessionSafety, TranslationScore } from './translationScoring';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

// DOCX export functionality for translation history
export interface SessionMetadata {
  sessionDate: Date;
  sessionStart: Date;  
  sessionEnd: Date;
  patientLanguage: string;
  totalTranslations: number;
  sessionDuration: number;
  overallSafetyRating: 'safe' | 'warning' | 'unsafe';
  averageAccuracy: number;
  averageConfidence: number;
  gpName?: string;
  patientId?: string;
  nhsNumber?: string;
  practiceCode?: string;
  practiceInfo?: {
    name: string;
    address: string;
    phone?: string;
  };
}

/**
 * Generates DOCX content as HTML (to be processed by a library like docx or html-docx-js)
 */
export function generateDOCXContent(
  translations: TranslationEntry[],
  metadata: SessionMetadata,
  translationScores: TranslationScore[]
): string {
  // Deduplicate translations based on exact timestamp to prevent duplicates in export
  const deduplicatedTranslations = translations.filter((translation, index, array) => {
    // Handle all possible timestamp formats
    let timestamp: number;
    
    if (typeof translation.timestamp === 'number') {
      timestamp = translation.timestamp;
    } else if (translation.timestamp instanceof Date) {
      timestamp = translation.timestamp.getTime();
    } else if (typeof translation.timestamp === 'string') {
      timestamp = new Date(translation.timestamp).getTime();
    } else {
      // Use index as fallback to prevent filtering out valid entries
      timestamp = index;
    }
    
    return array.findIndex(t => {
      let tTimestamp: number;
      if (typeof t.timestamp === 'number') {
        tTimestamp = t.timestamp;
      } else if (t.timestamp instanceof Date) {
        tTimestamp = t.timestamp.getTime();
      } else if (typeof t.timestamp === 'string') {
        tTimestamp = new Date(t.timestamp).getTime();
      } else {
        tTimestamp = array.indexOf(t);
      }
      return tTimestamp === timestamp;
    }) === index;
  });
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

  const sessionAssessment = assessSessionSafety(translationScores);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>NHS Translation Session Report</title>
      <style>
        body { 
          font-family: 'Calibri', sans-serif; 
          font-size: 11pt; 
          line-height: 1.4; 
          color: #333;
          margin: 20px;
        }
        .header { 
          text-align: center; 
          border-bottom: 3px solid #005EB8; 
          padding-bottom: 15px; 
          margin-bottom: 20px;
        }
        .nhs-logo { 
          color: #005EB8; 
          font-size: 24pt; 
          font-weight: bold; 
          margin-bottom: 5px;
        }
        .title { 
          font-size: 18pt; 
          font-weight: bold; 
          color: #005EB8; 
          margin: 10px 0;
        }
        .subtitle { 
          font-size: 12pt; 
          color: #666; 
          margin-bottom: 20px;
        }
        .metadata-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0;
          border: 1px solid #ddd;
        }
        .metadata-table th, .metadata-table td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left;
        }
        .metadata-table th { 
          background-color: #f8f9fa; 
          font-weight: bold;
          color: #005EB8;
        }
        .safety-section { 
          background-color: #f8f9fa; 
          border-left: 5px solid #005EB8; 
          padding: 15px; 
          margin: 20px 0;
        }
        .safety-safe { border-left-color: #28a745; }
        .safety-warning { border-left-color: #ffc107; }
        .safety-unsafe { border-left-color: #dc3545; }
        .translation-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0;
          font-size: 10pt;
        }
        .translation-table th, .translation-table td { 
          border: 1px solid #ddd; 
          padding: 6px; 
          vertical-align: top;
        }
        .translation-table th { 
          background-color: #005EB8; 
          color: white; 
          font-weight: bold;
          text-align: center;
        }
        .speaker-gp { background-color: #e3f2fd; }
        .speaker-patient { background-color: #e8f5e8; }
        .accuracy-high { color: #28a745; font-weight: bold; }
        .accuracy-medium { color: #ffc107; font-weight: bold; }
        .accuracy-low { color: #dc3545; font-weight: bold; }
        .safety-badge-safe { 
          background-color: #d4edda; 
          color: #155724; 
          padding: 2px 6px; 
          border-radius: 3px; 
          font-size: 9pt;
        }
        .safety-badge-warning { 
          background-color: #fff3cd; 
          color: #856404; 
          padding: 2px 6px; 
          border-radius: 3px; 
          font-size: 9pt;
        }
        .safety-badge-unsafe { 
          background-color: #f8d7da; 
          color: #721c24; 
          padding: 2px 6px; 
          border-radius: 3px; 
          font-size: 9pt;
        }
        .section-title { 
          font-size: 14pt; 
          font-weight: bold; 
          color: #005EB8; 
          margin: 25px 0 10px 0;
          border-bottom: 2px solid #005EB8;
          padding-bottom: 5px;
        }
        .page-break { page-break-before: always; }
        .footer { 
          margin-top: 30px; 
          padding-top: 15px; 
          border-top: 1px solid #ddd; 
          font-size: 9pt; 
          color: #666; 
          text-align: center;
        }
        .recommendations { 
          background-color: #fff8dc; 
          border: 1px solid #ddd; 
          padding: 15px; 
          margin: 15px 0;
        }
        .risk-factors { 
          background-color: #ffe6e6; 
          border: 1px solid #ddd; 
          padding: 15px; 
          margin: 15px 0;
        }
        ul { margin: 10px 0; padding-left: 20px; }
        li { margin: 5px 0; }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="nhs-logo">NHS</div>
        <div class="title">Translation Service Report</div>
        <div class="subtitle">Automated Translation Session Documentation</div>
      </div>

      <!-- Session Metadata -->
      <div class="section-title">Session Information</div>
      <table class="metadata-table">
        <tr>
          <th width="25%">Report Generated</th>
          <td>${new Date().toLocaleString('en-GB')}</td>
          <th width="25%">Session Date</th>
          <td>${metadata.sessionDate.toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <th>Session Start</th>
          <td>${metadata.sessionStart.toLocaleTimeString('en-GB')}</td>
          <th>Session End</th>
          <td>${metadata.sessionEnd.toLocaleTimeString('en-GB')}</td>
        </tr>
        <tr>
          <th>Duration</th>
          <td>${formatDuration(metadata.sessionDuration)}</td>
          <th>Patient Language</th>
          <td>${metadata.patientLanguage}</td>
        </tr>
        <tr>
          <th>Total Translations</th>
          <td>${metadata.totalTranslations}</td>
          <th>Average Accuracy</th>
          <td>${metadata.averageAccuracy}%</td>
        </tr>
        ${metadata.gpName ? `
        <tr>
          <th>GP/Clinician</th>
          <td>${metadata.gpName}</td>
          <th>Practice Code</th>
          <td>${metadata.practiceCode || 'Not specified'}</td>
        </tr>
        ` : ''}
        ${metadata.patientId ? `
        <tr>
          <th>Patient ID</th>
          <td>${metadata.patientId}</td>
          <th>NHS Number</th>
          <td>${metadata.nhsNumber || 'Not specified'}</td>
        </tr>
        ` : ''}
      </table>

      <!-- Safety Assessment -->
      <div class="section-title">Safety Assessment</div>
      <div class="safety-section safety-${sessionAssessment.overallRating}">
        <h3 style="margin-top: 0; color: #005EB8;">Overall Safety Rating: ${sessionAssessment.overallRating.toUpperCase()}</h3>
        <p><strong>Assessment:</strong> Based on translation accuracy, confidence scores, and medical terminology detection, this session has been rated as <strong>${sessionAssessment.overallRating}</strong> for clinical communication purposes.</p>
        
        ${sessionAssessment.riskFactors.length > 0 ? `
        <div class="risk-factors">
          <h4 style="margin-top: 0; color: #dc3545;">Risk Factors Identified:</h4>
          <ul>
            ${sessionAssessment.riskFactors.map(factor => `<li>${factor}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="recommendations">
          <h4 style="margin-top: 0; color: #005EB8;">Recommendations:</h4>
          <ul>
            ${sessionAssessment.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Translation Accuracy Summary -->
      <div class="section-title">Translation Quality Metrics</div>
      <table class="metadata-table">
        <tr>
          <th>Metric</th>
          <th>Value</th>
          <th>Assessment</th>
        </tr>
        <tr>
          <td>Average Accuracy</td>
          <td class="${metadata.averageAccuracy >= 90 ? 'accuracy-high' : metadata.averageAccuracy >= 75 ? 'accuracy-medium' : 'accuracy-low'}">${metadata.averageAccuracy}%</td>
          <td>${metadata.averageAccuracy >= 90 ? 'Excellent' : metadata.averageAccuracy >= 75 ? 'Good' : 'Needs Review'}</td>
        </tr>
        <tr>
          <td>Average Confidence</td>
          <td class="${metadata.averageConfidence >= 90 ? 'accuracy-high' : metadata.averageConfidence >= 75 ? 'accuracy-medium' : 'accuracy-low'}">${metadata.averageConfidence}%</td>
          <td>${metadata.averageConfidence >= 90 ? 'High Confidence' : metadata.averageConfidence >= 75 ? 'Moderate Confidence' : 'Low Confidence'}</td>
        </tr>
        <tr>
          <td>Safe Translations</td>
          <td>${translationScores.filter(s => s.safetyFlag === 'safe').length}</td>
          <td>${(translationScores.filter(s => s.safetyFlag === 'safe').length / translationScores.length * 100).toFixed(1)}% of total</td>
        </tr>
        <tr>
          <td>Warning Translations</td>
          <td>${translationScores.filter(s => s.safetyFlag === 'warning').length}</td>
          <td>${(translationScores.filter(s => s.safetyFlag === 'warning').length / translationScores.length * 100).toFixed(1)}% of total</td>
        </tr>
        <tr>
          <td>Unsafe Translations</td>
          <td>${translationScores.filter(s => s.safetyFlag === 'unsafe').length}</td>
          <td>${(translationScores.filter(s => s.safetyFlag === 'unsafe').length / translationScores.length * 100).toFixed(1)}% of total</td>
        </tr>
      </table>

      <div class="page-break"></div>

      <!-- Detailed Translation Log -->
      <div class="section-title">Detailed Translation Log</div>
      <p style="font-size: 10pt; color: #666; margin-bottom: 15px;">
        Complete record of all translations during the session, including accuracy scores and safety assessments.
      </p>

      <table class="translation-table">
        <thead>
          <tr>
            <th width="5%">#</th>
            <th width="8%">Time</th>
            <th width="8%">Speaker</th>
            <th width="25%">Original Text</th>
            <th width="25%">Translation</th>
            <th width="8%">Languages</th>
            <th width="7%">Accuracy</th>
            <th width="7%">Confidence</th>
            <th width="7%">Safety</th>
          </tr>
        </thead>
        <tbody>
          ${deduplicatedTranslations.map((translation, index) => {
            const score = translationScores[index];
            const accuracyClass = !score ? '' : score.accuracy >= 90 ? 'accuracy-high' : score.accuracy >= 75 ? 'accuracy-medium' : 'accuracy-low';
            const confidenceClass = !score ? '' : score.confidence >= 90 ? 'accuracy-high' : score.confidence >= 75 ? 'accuracy-medium' : 'accuracy-low';
            
            return `
              <tr class="${translation.speaker === 'gp' ? 'speaker-gp' : 'speaker-patient'}">
                <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                <td style="text-align: center;">${(() => {
                  if (typeof translation.timestamp === 'number') {
                    return new Date(translation.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  } else if (translation.timestamp instanceof Date) {
                    return translation.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  } else if (typeof translation.timestamp === 'string') {
                    return new Date(translation.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  } else {
                    return 'Unknown time';
                  }
                })()}</td>
                <td style="text-align: center;">${translation.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}</td>
                <td>${translation.originalText}</td>
                <td>${translation.translatedText}</td>
                <td style="text-align: center; font-size: 9pt;">
                  ${translation.originalLanguage}<br>↓<br>${translation.targetLanguage}
                </td>
                <td class="${accuracyClass}" style="text-align: center;">
                  ${score ? score.accuracy + '%' : 'N/A'}
                </td>
                <td class="${confidenceClass}" style="text-align: center;">
                  ${score ? score.confidence + '%' : 'N/A'}
                </td>
                <td style="text-align: center;">
                  ${score ? `<span class="safety-badge-${score.safetyFlag}">${score.safetyFlag.toUpperCase()}</span>` : 'N/A'}
                </td>
              </tr>
              ${score && (score.medicalTermsDetected.length > 0 || score.issues.length > 0) ? `
              <tr>
                <td colspan="9" style="background-color: #f8f9fa; font-size: 9pt; padding: 8px;">
                  ${score.medicalTermsDetected.length > 0 ? `<strong>Medical Terms:</strong> ${score.medicalTermsDetected.join(', ')}<br>` : ''}
                  ${score.issues.length > 0 ? `<strong>Issues:</strong> ${score.issues.join('; ')}` : ''}
                </td>
              </tr>
              ` : ''}
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Footer -->
      <div class="footer">
        <p>
          <strong>IMPORTANT DISCLAIMER:</strong> This is an automated translation service for communication assistance only. 
          All medical decisions should be based on professional clinical judgement. Critical medical information should be 
          verified through qualified medical interpretation services.
        </p>
        <p>
          Report generated by NHS Translation Tool (Proof of Concept) - ${new Date().toLocaleString('en-GB')}
        </p>
        <p>
          This document contains confidential patient information and should be handled in accordance with NHS data protection policies.
        </p>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

/**
 * Downloads the translation session data as a DOCX file using the docx library
 */
export async function downloadDOCX(
  translations: TranslationEntry[],
  metadata: SessionMetadata,
  translationScores: TranslationScore[],
  isPatientCopy: boolean = false,
  translatedContent?: any
): Promise<void> {
  try {
    // Deduplicate translations based on exact timestamp to prevent duplicates in export
    const deduplicatedTranslations = translations.filter((translation, index, array) => {
      // Handle all possible timestamp formats
      let timestamp: number;
      
      if (typeof translation.timestamp === 'number') {
        timestamp = translation.timestamp;
      } else if (translation.timestamp instanceof Date) {
        timestamp = translation.timestamp.getTime();
      } else if (typeof translation.timestamp === 'string') {
        timestamp = new Date(translation.timestamp).getTime();
      } else {
        // Use index as fallback to prevent filtering out valid entries
        timestamp = index;
      }
      
      return array.findIndex(t => {
        let tTimestamp: number;
        if (typeof t.timestamp === 'number') {
          tTimestamp = t.timestamp;
        } else if (t.timestamp instanceof Date) {
          tTimestamp = t.timestamp.getTime();
        } else if (typeof t.timestamp === 'string') {
          tTimestamp = new Date(t.timestamp).getTime();
        } else {
          tTimestamp = array.indexOf(t);
        }
        return tTimestamp === timestamp;
      }) === index;
    });
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

    const sessionAssessment = assessSessionSafety(translationScores);
    
    const children = [
      // Header
      new Paragraph({
        children: [
          new TextRun({
            text: isPatientCopy 
              ? (translatedContent?.title || "NHS Translation Service - Patient Copy")
              : "NHS Translation Service Report",
            bold: true,
            size: 32,
            color: "005EB8"
          })
        ],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER
      }),
      
      new Paragraph({
        children: [
          new TextRun({
            text: isPatientCopy 
              ? (translatedContent?.subtitle || "Summary of Translation Session for Your Records") 
              : "Automated Translation Session Documentation",
            size: 24,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      
      new Paragraph({ text: "" }), // Empty line
      
      // Practice Information (if available)
      ...(metadata.practiceInfo ? [
        new Paragraph({
          children: [new TextRun({ text: "Practice Information", bold: true, size: 28, color: "005EB8" })],
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({ children: [new TextRun(`Practice: ${metadata.practiceInfo.name}`)] }),
        new Paragraph({ children: [new TextRun(`Address: ${metadata.practiceInfo.address}`)] }),
        ...(metadata.practiceInfo.phone ? [
          new Paragraph({ children: [new TextRun(`Phone: ${metadata.practiceInfo.phone}`)] })
        ] : []),
        new Paragraph({ text: "" }), // Empty line
      ] : []),
      
      // Session Information
      new Paragraph({
        children: [new TextRun({ 
          text: isPatientCopy 
            ? (translatedContent?.sessionInfo || "Session Information")
            : "Session Information", 
          bold: true, 
          size: 28, 
          color: "005EB8" 
        })],
        heading: HeadingLevel.HEADING_2
      }),
      
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.reportGenerated || 'Report Generated'}: ${new Date().toLocaleString('en-GB')}`)] }),
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.sessionDate || 'Session Date'}: ${metadata.sessionDate.toLocaleDateString('en-GB')}`)] }),
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.sessionStart || 'Session Start'}: ${metadata.sessionStart.toLocaleTimeString('en-GB')}`)] }),
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.sessionEnd || 'Session End'}: ${metadata.sessionEnd.toLocaleTimeString('en-GB')}`)] }),
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.duration || 'Duration'}: ${formatDuration(metadata.sessionDuration)}`)] }),
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.patientLanguage || 'Patient Language'}: ${metadata.patientLanguage}`)] }),
      new Paragraph({ children: [new TextRun(`${translatedContent?.generalLabels?.totalTranslations || 'Total Translations'}: ${metadata.totalTranslations}`)] }),
      ...(isPatientCopy ? [] : [
        new Paragraph({ children: [new TextRun(`Average Accuracy: ${metadata.averageAccuracy}%`)] })
      ]),
      
      new Paragraph({ text: "" }), // Empty line
    ];

    // Add patient-friendly note for patient copies
    if (isPatientCopy) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Patient Information", bold: true, size: 28, color: "005EB8" })],
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({
          children: [new TextRun("This document contains a record of all translations made during your medical consultation. This is provided for your personal records and reference.")]
        }),
        new Paragraph({ text: "" })
      );
    }

    // Add safety assessment, risk factors, and recommendations only for GP reports
    if (!isPatientCopy) {
      children.push(
        // Safety Assessment
        new Paragraph({
          children: [new TextRun({ text: "Safety Assessment", bold: true, size: 28, color: "005EB8" })],
          heading: HeadingLevel.HEADING_2
        }),
        
        new Paragraph({
          children: [
            new TextRun("Overall Safety Rating: "),
            new TextRun({ 
              text: sessionAssessment.overallRating.toUpperCase(), 
              bold: true,
              color: sessionAssessment.overallRating === 'safe' ? '28a745' : sessionAssessment.overallRating === 'warning' ? 'ffc107' : 'dc3545'
            })
          ]
        }),
        
        new Paragraph({
          children: [new TextRun(`Based on translation accuracy, confidence scores, and medical terminology detection, this session has been rated as ${sessionAssessment.overallRating} for clinical communication purposes.`)]
        })
      );

      // Add risk factors if any
      if (sessionAssessment.riskFactors.length > 0) {
        children.push(
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Risk Factors Identified:", bold: true, color: "dc3545" })]
          }),
          ...sessionAssessment.riskFactors.map(factor => 
            new Paragraph({
              children: [new TextRun(`• ${factor}`)],
              indent: { left: 720 }
            })
          )
        );
      }

      // Add recommendations
      children.push(
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [new TextRun({ text: "Recommendations:", bold: true, color: "005EB8" })]
        }),
        ...sessionAssessment.recommendations.map(rec => 
          new Paragraph({
            children: [new TextRun(`• ${rec}`)],
            indent: { left: 720 }
          })
        )
      );
    }

    // Translation Log Header
    children.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ 
          text: isPatientCopy 
            ? (translatedContent?.translationLogHeader || "Detailed Translation Log")
            : "Detailed Translation Log", 
          bold: true, 
          size: 28, 
          color: "005EB8" 
        })],
        heading: HeadingLevel.HEADING_2
      })
    );

    // Create translation log table - different columns for patient vs GP reports
    const tableRows = [
      new TableRow({
        children: isPatientCopy ? [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })],
            width: { size: 8, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: translatedContent?.generalLabels?.time || "Time", bold: true })] })],
            width: { size: 12, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: translatedContent?.generalLabels?.speaker || "Speaker", bold: true })] })],
            width: { size: 15, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: translatedContent?.generalLabels?.originalText || "Original Text", bold: true })] })],
            width: { size: 32, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: translatedContent?.generalLabels?.translation || "Translation", bold: true })] })],
            width: { size: 33, type: WidthType.PERCENTAGE }
          })
        ] : [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })],
            width: { size: 5, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Time", bold: true })] })],
            width: { size: 10, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Speaker", bold: true })] })],
            width: { size: 10, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Original Text", bold: true })] })],
            width: { size: 30, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Translation", bold: true })] })],
            width: { size: 30, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Accuracy", bold: true })] })],
            width: { size: 8, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Safety", bold: true })] })],
            width: { size: 7, type: WidthType.PERCENTAGE }
          })
        ]
      }),
      // Data rows
      ...deduplicatedTranslations.map((translation, index) => {
        const score = translationScores[index];
        return new TableRow({
          children: isPatientCopy ? [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(`${index + 1}`)] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun((() => {
                if (typeof translation.timestamp === 'number') {
                  return new Date(translation.timestamp).toLocaleTimeString('en-GB');
                } else if (translation.timestamp instanceof Date) {
                  return translation.timestamp.toLocaleTimeString('en-GB');
                } else if (typeof translation.timestamp === 'string') {
                  return new Date(translation.timestamp).toLocaleTimeString('en-GB');
                } else {
                  return 'Unknown time';
                }
              })())] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(
                translation.speaker === 'gp' 
                  ? (translatedContent?.speakerLabels?.gp || 'GP')
                  : (translatedContent?.speakerLabels?.patient || 'Patient')
              )] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(translation.originalText)] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(translation.translatedText)] })]
            })
          ] : [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(`${index + 1}`)] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun((() => {
                if (typeof translation.timestamp === 'number') {
                  return new Date(translation.timestamp).toLocaleTimeString('en-GB');
                } else if (translation.timestamp instanceof Date) {
                  return translation.timestamp.toLocaleTimeString('en-GB');
                } else if (typeof translation.timestamp === 'string') {
                  return new Date(translation.timestamp).toLocaleTimeString('en-GB');
                } else {
                  return 'Unknown time';
                }
              })())] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(translation.speaker === 'gp' ? 'GP' : 'Patient')] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(translation.originalText)] })]
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(translation.translatedText)] })]
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({
                  text: score ? `${score.accuracy}%` : 'N/A',
                  color: !score ? '000000' : score.accuracy >= 90 ? '28a745' : score.accuracy >= 75 ? 'ffc107' : 'dc3545'
                })] 
              })]
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({
                  text: score ? score.safetyFlag.toUpperCase() : 'N/A',
                  color: !score ? '000000' : score.safetyFlag === 'safe' ? '28a745' : score.safetyFlag === 'warning' ? 'ffc107' : 'dc3545'
                })] 
              })]
            })
          ]
        });
      })
    ];

    const translationTable = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    });

    // Create document with sections that can contain tables
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          ...children,
          translationTable,
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({
              text: "IMPORTANT DISCLAIMER: This is an automated translation service for communication assistance only. All medical decisions should be based on professional clinical judgement.",
              bold: true,
              size: 20
            })],
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            children: [new TextRun({
              text: `Report generated by NHS Translation Tool - ${new Date().toLocaleString('en-GB')}`,
              size: 18,
              italics: true
            })],
            alignment: AlignmentType.CENTER
          })
        ]
      }]
    });

    // Generate and save
    const blob = await Packer.toBlob(doc);
    const filePrefix = isPatientCopy ? "NHS_Translation_Patient_Copy" : "NHS_Translation_Report";
    const filename = `${filePrefix}_${metadata.sessionDate.toISOString().split('T')[0]}_${(() => {
      if (metadata.sessionStart instanceof Date) {
        return metadata.sessionStart.toLocaleTimeString('en-GB').replace(/:/g, '-');
      } else {
        return new Date().toLocaleTimeString('en-GB').replace(/:/g, '-');
      }
    })()}.docx`;
    saveAs(blob, filename);
    
  } catch (error) {
    console.error('Error generating DOCX:', error);
    throw new Error('Failed to generate DOCX document');
  }
}