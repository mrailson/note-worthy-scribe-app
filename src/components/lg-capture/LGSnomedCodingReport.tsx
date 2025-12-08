import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { ClipboardList, Loader2 } from 'lucide-react';
import { LGPatient } from '@/hooks/useLGCapture';

interface SnomedEntry {
  term: string;
  code: string;
  from: string;
  confidence: number;
  evidence: string;
  date?: string;
  source_page?: number | null;
}

interface SnomedData {
  diagnoses?: SnomedEntry[];
  surgeries?: SnomedEntry[];
  allergies?: SnomedEntry[];
  immunisations?: SnomedEntry[];
}

interface LGSnomedCodingReportProps {
  patient: LGPatient;
  snomedData: SnomedData | null;
}

const formatNhsNumber = (nhs: string | null): string => {
  if (!nhs) return '—';
  const clean = nhs.replace(/\s/g, '');
  if (clean.length !== 10) return nhs;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return `${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} on ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  } catch {
    return dateStr;
  }
};

const getConfidenceRAG = (confidence: number): { label: string; color: string } => {
  if (confidence >= 0.90) return { label: 'HIGH', color: '28A745' };
  if (confidence >= 0.80) return { label: 'GOOD', color: '6C757D' };
  if (confidence >= 0.50) return { label: 'REVIEW', color: 'FFC107' };
  return { label: 'LOW', color: 'DC3545' };
};

const categoriseCodes = (snomedData: SnomedData | null) => {
  const recommended: { domain: string; entry: SnomedEntry }[] = [];
  const manualReview: { domain: string; entry: SnomedEntry }[] = [];
  const notRecommended: { domain: string; entry: SnomedEntry; reason: string }[] = [];

  if (!snomedData) return { recommended, manualReview, notRecommended };

  const processEntries = (entries: SnomedEntry[] | undefined, domain: string) => {
    if (!entries) return;
    entries.forEach(entry => {
      const conf = entry.confidence;
      const hasValidCode = entry.code && entry.code !== 'UNKNOWN' && entry.code !== 'MANUAL_REVIEW';
      
      if (conf >= 0.80 && hasValidCode) {
        recommended.push({ domain, entry });
      } else if (conf >= 0.50 && conf < 0.80) {
        manualReview.push({ domain, entry });
      } else {
        let reason = 'Low confidence score';
        if (conf < 0.50) reason = `Low confidence score (${Math.round(conf * 100)}%)`;
        if (!hasValidCode) reason = 'SNOMED code not verified or requires manual lookup';
        if (entry.code === 'MANUAL_REVIEW') reason = 'Flagged for manual clinical review';
        notRecommended.push({ domain, entry, reason });
      }
    });
  };

  processEntries(snomedData.diagnoses, 'Diagnoses');
  processEntries(snomedData.surgeries, 'Procedures');
  processEntries(snomedData.allergies, 'Allergies');
  processEntries(snomedData.immunisations, 'Immunisations');

  return { recommended, manualReview, notRecommended };
};

export function LGSnomedCodingReport({ patient, snomedData }: LGSnomedCodingReportProps) {
  const [generating, setGenerating] = useState(false);

  const generateWordDocument = async (): Promise<Blob> => {
    const { recommended, manualReview, notRecommended } = categoriseCodes(snomedData);

    const createSectionHeader = (text: string, color: string = '005EB8') => {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, bold: true, size: 26, color })],
        spacing: { before: 400, after: 200 }
      });
    };

    const createSubHeader = (text: string) => {
      return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22, italics: true })],
        spacing: { before: 200, after: 100 }
      });
    };

    const createBulletPoint = (text: string, bold: boolean = false) => {
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text, size: 20, bold })],
        spacing: { after: 60 }
      });
    };

    const createCodeTableRow = (
      term: string, 
      code: string, 
      date: string, 
      evidence: string, 
      confidence: number,
      recommendation: string,
      isHeader: boolean = false
    ) => {
      const rag = getConfidenceRAG(confidence);
      const shading = isHeader ? { fill: '005EB8', type: ShadingType.SOLID } : undefined;
      const textColor = isHeader ? 'FFFFFF' : '000000';
      
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 2500, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: term, bold: isHeader, size: 18, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: code, size: 18, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 1000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: date, size: 18, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 2500, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: evidence.slice(0, 80) + (evidence.length > 80 ? '...' : ''), size: 16, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 800, type: WidthType.DXA },
            children: [new Paragraph({ 
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: isHeader ? confidence.toString() : `${Math.round(confidence * 100)}%`, size: 18, color: isHeader ? textColor : rag.color, bold: !isHeader })] 
            })],
            shading
          }),
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: recommendation, size: 16, color: textColor })] })],
            shading
          })
        ]
      });
    };

    const createExcludedTableRow = (
      term: string, 
      code: string, 
      evidence: string, 
      reason: string,
      isHeader: boolean = false
    ) => {
      const shading = isHeader ? { fill: '6C757D', type: ShadingType.SOLID } : undefined;
      const textColor = isHeader ? 'FFFFFF' : '000000';
      
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 2500, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: term, bold: isHeader, size: 18, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 1500, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: code, size: 18, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: evidence.slice(0, 100) + (evidence.length > 100 ? '...' : ''), size: 16, color: textColor })] })],
            shading
          }),
          new TableCell({
            width: { size: 2800, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: reason, size: 16, color: textColor, italics: !isHeader })] })],
            shading
          })
        ]
      });
    };

    const docChildren: (Paragraph | Table)[] = [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'SNOMED CT Clinical Coding Assistant Report', bold: true, size: 36, color: '005EB8' })],
        spacing: { after: 100 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Lloyd George Record Review — AI-Assisted Coding Recommendations', size: 24, italics: true })],
        spacing: { after: 300 }
      }),

      // Important Disclaimer Box
      new Paragraph({
        shading: { fill: 'FFF3CD', type: ShadingType.SOLID },
        border: { top: { color: 'FFC107', size: 6, style: 'single' }, bottom: { color: 'FFC107', size: 6, style: 'single' }, left: { color: 'FFC107', size: 6, style: 'single' }, right: { color: 'FFC107', size: 6, style: 'single' } },
        children: [new TextRun({ text: '⚠️ IMPORTANT: AI-GENERATED SUGGESTIONS ONLY', bold: true, size: 22, color: '856404' })],
        spacing: { before: 100, after: 60 }
      }),
      new Paragraph({
        shading: { fill: 'FFF3CD', type: ShadingType.SOLID },
        children: [new TextRun({ text: 'This report contains AI-generated coding suggestions extracted from scanned Lloyd George records. A qualified clinical coder or clinician MUST independently verify all codes against source documents before recording in EMIS Web or SystmOne. These suggestions do not constitute clinical advice.', size: 18, color: '856404' })],
        spacing: { after: 300 }
      }),

      // Patient Details Section
      createSectionHeader('Patient Details'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Patient Name', bold: true, size: 20 })] })], shading: { fill: 'F0F0F0' } }),
              new TableCell({ width: { size: 4500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: patient.patient_name || patient.ai_extracted_name || '—', size: 20 })] })] }),
              new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'NHS Number', bold: true, size: 20 })] })], shading: { fill: 'F0F0F0' } }),
              new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: formatNhsNumber(patient.nhs_number), size: 20 })] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date of Birth', bold: true, size: 20 })] })], shading: { fill: 'F0F0F0' } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatDate(patient.dob), size: 20 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Pages Scanned', bold: true, size: 20 })] })], shading: { fill: 'F0F0F0' } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(patient.images_count || 0), size: 20 })] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Scan Date', bold: true, size: 20 })] })], shading: { fill: 'F0F0F0' } }),
              new TableCell({ columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: formatDateTime(patient.created_at), size: 20 })] })] })
            ]
          })
        ]
      }),

      // NHS Coding Best Practice Section
      createSectionHeader('NHS Clinical Coding Best Practice Guidance'),
      new Paragraph({
        children: [new TextRun({ text: 'When coding from Lloyd George records, follow NHS Digital SNOMED CT guidance:', size: 20 })],
        spacing: { after: 150 }
      }),
      createSubHeader('SHOULD be coded:'),
      createBulletPoint('Significant active and historical diagnoses (e.g., diabetes, heart disease, cancer)'),
      createBulletPoint('Major surgical procedures and operations'),
      createBulletPoint('Drug allergies and adverse reactions'),
      createBulletPoint('Immunisation history'),
      createBulletPoint('Long-term medications'),
      createBulletPoint('Chronic conditions requiring ongoing management'),

      createSubHeader('Should NOT be coded:'),
      createBulletPoint('Minor self-limiting conditions (e.g., common cold, minor cuts)'),
      createBulletPoint('Administrative notes and clerical entries'),
      createBulletPoint('Routine check-ups without clinical findings'),
      createBulletPoint('Suspected or query diagnoses without confirmation'),
      createBulletPoint('Illegible or ambiguous entries without corroborating evidence'),

      new Paragraph({
        children: [new TextRun({ text: 'Reference: NHS Digital SNOMED CT Implementation Guide for Primary Care', size: 18, italics: true, color: '666666' })],
        spacing: { before: 100, after: 300 }
      })
    ];

    // Recommended Codes Section
    if (recommended.length > 0) {
      docChildren.push(createSectionHeader('✓ Recommended SNOMED Codes for Coding', '28A745'));
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `${recommended.length} codes with high confidence (≥80%) and clear supporting evidence.`, size: 20, italics: true })],
        spacing: { after: 150 }
      }));

      // Group by domain
      const byDomain = recommended.reduce((acc, item) => {
        if (!acc[item.domain]) acc[item.domain] = [];
        acc[item.domain].push(item.entry);
        return acc;
      }, {} as Record<string, SnomedEntry[]>);

      for (const [domain, entries] of Object.entries(byDomain)) {
        docChildren.push(createSubHeader(domain));
        docChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createCodeTableRow('SNOMED Term', 'Code', 'Date', 'Supporting Evidence', 'Conf.' as any, 'Recommendation', true),
            ...entries.map(entry => {
              const pageRef = entry.source_page ? `Page ${entry.source_page}: ` : '';
              const evidence = pageRef + (entry.evidence || 'Evidence in scanned document');
              return createCodeTableRow(
                entry.term,
                entry.code,
                entry.date || 'NK',
                evidence,
                entry.confidence,
                'Recommended for coding'
              );
            })
          ]
        }));
      }
    }

    // Manual Review Section
    if (manualReview.length > 0) {
      docChildren.push(createSectionHeader('⚠ Codes Requiring Manual Review', 'FFC107'));
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `${manualReview.length} codes with moderate confidence (50-79%) requiring clinical verification.`, size: 20, italics: true })],
        spacing: { after: 150 }
      }));

      const byDomain = manualReview.reduce((acc, item) => {
        if (!acc[item.domain]) acc[item.domain] = [];
        acc[item.domain].push(item.entry);
        return acc;
      }, {} as Record<string, SnomedEntry[]>);

      for (const [domain, entries] of Object.entries(byDomain)) {
        docChildren.push(createSubHeader(domain));
        docChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createCodeTableRow('SNOMED Term', 'Code', 'Date', 'Evidence', 'Conf.' as any, 'Action Required', true),
            ...entries.map(entry => {
              const pageRef = entry.source_page ? `Page ${entry.source_page}: ` : '';
              const evidence = pageRef + (entry.evidence || 'Check source document');
              let action = 'Verify against source';
              if (!entry.date || entry.date === 'NK') action = 'Verify date from source';
              if (entry.confidence < 0.65) action = 'Clinical review required';
              return createCodeTableRow(
                entry.term,
                entry.code,
                entry.date || 'NK',
                evidence,
                entry.confidence,
                action
              );
            })
          ]
        }));
      }
    }

    // Not Recommended Section
    if (notRecommended.length > 0) {
      docChildren.push(createSectionHeader('✗ Codes NOT Recommended for Coding', 'DC3545'));
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `${notRecommended.length} codes captured but excluded from coding recommendations. This section provides audit trail of excluded items.`, size: 20, italics: true })],
        spacing: { after: 150 }
      }));

      docChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          createExcludedTableRow('SNOMED Term', 'Code', 'Original Evidence', 'Reason for Exclusion', true),
          ...notRecommended.map(({ entry, reason }) => {
            const pageRef = entry.source_page ? `Page ${entry.source_page}: ` : '';
            const evidence = pageRef + (entry.evidence || '—');
            return createExcludedTableRow(
              entry.term,
              entry.code || 'Unknown',
              evidence,
              reason
            );
          })
        ]
      }));
    }

    // Coding Decision Audit Trail
    docChildren.push(createSectionHeader('Coding Decision Audit Trail'));
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'Complete log of AI coding decisions for governance and compliance.', size: 20, italics: true })],
      spacing: { after: 150 }
    }));

    const allCodes = [
      ...recommended.map(r => ({ ...r, decision: 'INCLUDE', color: '28A745' })),
      ...manualReview.map(r => ({ ...r, decision: 'REVIEW', color: 'FFC107' })),
      ...notRecommended.map(r => ({ domain: r.domain, entry: r.entry, decision: 'EXCLUDE', reason: r.reason, color: 'DC3545' }))
    ];

    if (allCodes.length > 0) {
      docChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Code', bold: true, size: 18, color: 'FFFFFF' })] })], shading: { fill: '343A40' } }),
              new TableCell({ width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Domain', bold: true, size: 18, color: 'FFFFFF' })] })], shading: { fill: '343A40' } }),
              new TableCell({ width: { size: 1200, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Decision', bold: true, size: 18, color: 'FFFFFF' })] })], shading: { fill: '343A40' } }),
              new TableCell({ width: { size: 4600, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: 'Reasoning', bold: true, size: 18, color: 'FFFFFF' })] })], shading: { fill: '343A40' } })
            ]
          }),
          ...allCodes.map(item => {
            let reasoning = '';
            if (item.decision === 'INCLUDE') {
              reasoning = `Confidence ${Math.round(item.entry.confidence * 100)}% meets threshold. Evidence: "${item.entry.evidence?.slice(0, 50) || 'N/A'}..."`;
            } else if (item.decision === 'REVIEW') {
              reasoning = `Confidence ${Math.round(item.entry.confidence * 100)}% below threshold. Requires clinical verification.`;
            } else {
              reasoning = (item as any).reason || 'Did not meet coding criteria';
            }
            return new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.entry.term, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.domain, size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.decision, size: 16, bold: true, color: item.color })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: reasoning, size: 14 })] })] })
              ]
            });
          })
        ]
      }));
    }

    // Human Reviewer Sign-off
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'Human Reviewer Sign-off', bold: true, size: 22 })],
      spacing: { before: 400, after: 150 }
    }));
    docChildren.push(new Paragraph({
      border: { bottom: { color: '000000', size: 1, style: 'single' } },
      children: [new TextRun({ text: 'Reviewed by: _________________________________    Date: _______________', size: 20 })],
      spacing: { after: 100 }
    }));
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'I confirm I have reviewed the above coding recommendations against the source Lloyd George records and applied my clinical judgement before coding.', size: 18, italics: true })],
      spacing: { after: 300 }
    }));

    // Footer
    docChildren.push(new Paragraph({
      shading: { fill: 'E9ECEF', type: ShadingType.SOLID },
      children: [new TextRun({ text: 'GOVERNANCE & COMPLIANCE NOTICE', bold: true, size: 20 })],
      spacing: { before: 300, after: 60 }
    }));
    docChildren.push(new Paragraph({
      shading: { fill: 'E9ECEF', type: ShadingType.SOLID },
      children: [new TextRun({ text: '• This report contains AI-generated coding suggestions only and does not constitute clinical advice.', size: 18 })],
      spacing: { after: 40 }
    }));
    docChildren.push(new Paragraph({
      shading: { fill: 'E9ECEF', type: ShadingType.SOLID },
      children: [new TextRun({ text: '• A qualified clinical coder or clinician MUST independently verify all codes against source documents.', size: 18 })],
      spacing: { after: 40 }
    }));
    docChildren.push(new Paragraph({
      shading: { fill: 'E9ECEF', type: ShadingType.SOLID },
      children: [new TextRun({ text: '• The final decision to record any code in EMIS Web or SystmOne rests with the human reviewer.', size: 18 })],
      spacing: { after: 40 }
    }));
    docChildren.push(new Paragraph({
      shading: { fill: 'E9ECEF', type: ShadingType.SOLID },
      children: [new TextRun({ text: '• This report should be retained as part of the clinical coding audit trail.', size: 18 })],
      spacing: { after: 200 }
    }));

    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `Report generated: ${formatDateTime(new Date().toISOString())}`, size: 18, italics: true, color: '666666' })],
      spacing: { before: 200 }
    }));
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: 'Notewell AI — LG Capture SNOMED Coding Assistant', size: 18, italics: true, color: '666666' })]
    }));

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    return await Packer.toBlob(doc);
  };

  const downloadReport = async () => {
    if (!snomedData) {
      toast.error('No SNOMED data available');
      return;
    }

    setGenerating(true);
    try {
      const blob = await generateWordDocument();
      const nhsClean = patient.nhs_number?.replace(/\s/g, '') || 'unknown';
      const filename = `SNOMED_Coding_Report_${nhsClean}_${new Date().toISOString().split('T')[0]}.docx`;
      saveAs(blob, filename);
      toast.success('Coding report downloaded');
    } catch (err) {
      console.error('Error generating coding report:', err);
      toast.error('Failed to generate coding report');
    } finally {
      setGenerating(false);
    }
  };

  if (!snomedData) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={downloadReport}
      disabled={generating}
      className="gap-1.5"
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ClipboardList className="h-4 w-4" />
      )}
      Coding Report
    </Button>
  );
}