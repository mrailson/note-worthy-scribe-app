import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const defaultRunFont = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Arial', cs: 'Arial' } as const;

export interface TranscriptComparisonDetails {
  notewellLiveTranscript: string;
  notewellBatchTranscript: string;
  consultationDate: string;
  consultationStartTime: string;
  consultationEndTime?: string;
  consultationType: 'f2f' | 'telephone' | 'dictate';
  gpUserName: string;
  gpQualifications?: string;
  practiceName?: string;
  patientName?: string;
  patientNhsNumber?: string;
}

interface ComparisonResult {
  matchPercentage: number;
  liveWordCount: number;
  batchWordCount: number;
  missingSectionsInLive: string[];
  missingSectionsInBatch: string[];
  suspectedHallucinations: string[];
  matchedPhrases: string[];
  unmatchedInLive: string[];
  unmatchedInBatch: string[];
}

// Normalise text for comparison
const normaliseText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Split text into sentences for comparison
const splitIntoSentences = (text: string): string[] => {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Ignore very short fragments
};

// Find similar sentences using simple word overlap
const calculateSimilarity = (s1: string, s2: string): number => {
  const words1 = new Set(normaliseText(s1).split(' '));
  const words2 = new Set(normaliseText(s2).split(' '));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
};

// Analyse and compare both transcripts
const analyseTranscripts = (live: string, batch: string): ComparisonResult => {
  const liveSentences = splitIntoSentences(live);
  const batchSentences = splitIntoSentences(batch);
  
  const liveWords = live.split(/\s+/).filter(Boolean);
  const batchWords = batch.split(/\s+/).filter(Boolean);
  
  const matchedPhrases: string[] = [];
  const unmatchedInLive: string[] = [];
  const unmatchedInBatch: string[] = [];
  const suspectedHallucinations: string[] = [];
  
  const matchedLiveIndices = new Set<number>();
  const matchedBatchIndices = new Set<number>();
  
  // Find matching sentences
  liveSentences.forEach((liveSent, liveIdx) => {
    let bestMatch = { idx: -1, score: 0 };
    
    batchSentences.forEach((batchSent, batchIdx) => {
      if (matchedBatchIndices.has(batchIdx)) return;
      
      const score = calculateSimilarity(liveSent, batchSent);
      if (score > bestMatch.score) {
        bestMatch = { idx: batchIdx, score };
      }
    });
    
    if (bestMatch.score >= 0.5) {
      matchedLiveIndices.add(liveIdx);
      matchedBatchIndices.add(bestMatch.idx);
      matchedPhrases.push(liveSent.substring(0, 100) + (liveSent.length > 100 ? '...' : ''));
    }
  });
  
  // Find unmatched in Live (present in Live but not Batch - potential hallucinations)
  liveSentences.forEach((sent, idx) => {
    if (!matchedLiveIndices.has(idx)) {
      unmatchedInLive.push(sent);
      // If sentence contains medical terms or specific claims, flag as potential hallucination
      if (/\d+\s*(mg|ml|mcg|units?|tablets?|times?|days?|weeks?)/i.test(sent) ||
          /diagnosed?|prescription|referred|blood\s*pressure|temperature|pulse/i.test(sent)) {
        suspectedHallucinations.push(`[In Live only] ${sent.substring(0, 150)}${sent.length > 150 ? '...' : ''}`);
      }
    }
  });
  
  // Find unmatched in Batch (present in Batch but not Live)
  batchSentences.forEach((sent, idx) => {
    if (!matchedBatchIndices.has(idx)) {
      unmatchedInBatch.push(sent);
      // Check for potential hallucinations in batch too
      if (/\d+\s*(mg|ml|mcg|units?|tablets?|times?|days?|weeks?)/i.test(sent) ||
          /diagnosed?|prescription|referred|blood\s*pressure|temperature|pulse/i.test(sent)) {
        suspectedHallucinations.push(`[In Batch only] ${sent.substring(0, 150)}${sent.length > 150 ? '...' : ''}`);
      }
    }
  });
  
  // Calculate match percentage
  const totalSentences = liveSentences.length + batchSentences.length;
  const matchedCount = matchedLiveIndices.size + matchedBatchIndices.size;
  const matchPercentage = totalSentences > 0 ? Math.round((matchedCount / totalSentences) * 100) : 0;
  
  // Identify missing sections (large gaps)
  const missingSectionsInLive = unmatchedInBatch
    .filter(s => s.length > 50)
    .slice(0, 5)
    .map(s => s.substring(0, 200) + (s.length > 200 ? '...' : ''));
    
  const missingSectionsInBatch = unmatchedInLive
    .filter(s => s.length > 50)
    .slice(0, 5)
    .map(s => s.substring(0, 200) + (s.length > 200 ? '...' : ''));
  
  return {
    matchPercentage,
    liveWordCount: liveWords.length,
    batchWordCount: batchWords.length,
    missingSectionsInLive,
    missingSectionsInBatch,
    suspectedHallucinations: suspectedHallucinations.slice(0, 10),
    matchedPhrases: matchedPhrases.slice(0, 10),
    unmatchedInLive,
    unmatchedInBatch
  };
};

const getConsultationTypeLabel = (type: 'f2f' | 'telephone' | 'dictate'): string => {
  switch (type) {
    case 'f2f': return 'Face to Face';
    case 'telephone': return 'Telephone';
    case 'dictate': return 'Dictate';
  }
};

export const generateTranscriptComparisonReport = async (details: TranscriptComparisonDetails): Promise<Blob> => {
  const {
    notewellLiveTranscript,
    notewellBatchTranscript,
    consultationDate,
    consultationStartTime,
    consultationEndTime,
    consultationType,
    gpUserName,
    gpQualifications,
    practiceName,
    patientName,
    patientNhsNumber
  } = details;
  
  // Analyse the transcripts
  const analysis = analyseTranscripts(notewellLiveTranscript || '', notewellBatchTranscript || '');
  
  const documentElements: any[] = [];
  
  // Title
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'Transcript Comparison Report',
      size: 32,
      bold: true,
      color: '005EB8',
      font: defaultRunFont
    })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 }
  }));
  
  // Practice name if available
  if (practiceName) {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: practiceName,
        size: 22,
        color: '666666',
        font: defaultRunFont
      })],
      spacing: { after: 100 }
    }));
  }
  
  // Generated timestamp
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: `Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      size: 18,
      color: '999999',
      font: defaultRunFont
    })],
    spacing: { after: 300 }
  }));
  
  // Separator
  documentElements.push(new Paragraph({
    children: [new TextRun({ text: '' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '005EB8' } },
    spacing: { after: 300 }
  }));
  
  // Consultation Details Section
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'Consultation Details',
      size: 26,
      bold: true,
      color: '2E5C8A',
      font: defaultRunFont
    })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 150 }
  }));
  
  // Details table
  const detailsRows = [
    ['Consultation Type', getConsultationTypeLabel(consultationType)],
    ['Date', consultationDate],
    ['Start Time', consultationStartTime],
    ['End Time', consultationEndTime || 'Not recorded'],
    ['GP Clinician', `${gpUserName}${gpQualifications ? ` (${gpQualifications})` : ''}`],
  ];
  
  if (patientName) {
    detailsRows.push(['Patient', patientName]);
  }
  if (patientNhsNumber) {
    detailsRows.push(['NHS Number', patientNhsNumber]);
  }
  
  documentElements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: detailsRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 20, font: defaultRunFont })]
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: 'F5F5F5', type: ShadingType.SOLID }
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: value, size: 20, font: defaultRunFont })]
          })],
          width: { size: 70, type: WidthType.PERCENTAGE }
        })
      ]
    }))
  }));
  
  documentElements.push(new Paragraph({ children: [], spacing: { after: 300 } }));
  
  // Comparison Summary Section
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'Comparison Summary',
      size: 26,
      bold: true,
      color: '2E5C8A',
      font: defaultRunFont
    })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 150 }
  }));
  
  // Summary stats table
  const summaryRows = [
    ['Match Rate', `${analysis.matchPercentage}%`],
    ['Notewell Live Word Count', analysis.liveWordCount.toLocaleString()],
    ['Notewell Batch Word Count', analysis.batchWordCount.toLocaleString()],
    ['Word Count Difference', `${Math.abs(analysis.liveWordCount - analysis.batchWordCount).toLocaleString()} (${analysis.liveWordCount > analysis.batchWordCount ? 'Live has more' : 'Batch has more'})`],
  ];
  
  documentElements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: summaryRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 20, font: defaultRunFont })]
          })],
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: { fill: 'E8F4FD', type: ShadingType.SOLID }
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: value, size: 20, font: defaultRunFont })]
          })],
          width: { size: 60, type: WidthType.PERCENTAGE }
        })
      ]
    }))
  }));
  
  documentElements.push(new Paragraph({ children: [], spacing: { after: 300 } }));
  
  // Missing Sections in Live (content in Batch but not Live)
  if (analysis.missingSectionsInLive.length > 0) {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'Content in Batch but Missing from Live',
        size: 24,
        bold: true,
        color: 'D97706',
        font: defaultRunFont
      })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 }
    }));
    
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'These sections appear in Notewell Batch but were not captured in Notewell Live:',
        size: 18,
        italics: true,
        color: '666666',
        font: defaultRunFont
      })],
      spacing: { after: 100 }
    }));
    
    analysis.missingSectionsInLive.forEach((section, idx) => {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: `${idx + 1}. "${section}"`,
          size: 18,
          font: defaultRunFont
        })],
        spacing: { after: 80 },
        indent: { left: 400 }
      }));
    });
    
    documentElements.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }
  
  // Missing Sections in Batch (content in Live but not Batch)
  if (analysis.missingSectionsInBatch.length > 0) {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'Content in Live but Missing from Batch',
        size: 24,
        bold: true,
        color: '7C3AED',
        font: defaultRunFont
      })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 }
    }));
    
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'These sections appear in Notewell Live but were not captured in Notewell Batch:',
        size: 18,
        italics: true,
        color: '666666',
        font: defaultRunFont
      })],
      spacing: { after: 100 }
    }));
    
    analysis.missingSectionsInBatch.forEach((section, idx) => {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: `${idx + 1}. "${section}"`,
          size: 18,
          font: defaultRunFont
        })],
        spacing: { after: 80 },
        indent: { left: 400 }
      }));
    });
    
    documentElements.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  }
  
  // Suspected Hallucinations Section
  if (analysis.suspectedHallucinations.length > 0) {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: '⚠️ Suspected Hallucinations / Discrepancies',
        size: 24,
        bold: true,
        color: 'DC2626',
        font: defaultRunFont
      })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 }
    }));
    
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: 'These sections contain specific clinical details (medications, measurements, diagnoses) that appear in only one transcript and should be verified:',
        size: 18,
        italics: true,
        color: '666666',
        font: defaultRunFont
      })],
      spacing: { after: 100 }
    }));
    
    analysis.suspectedHallucinations.forEach((item, idx) => {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: `${idx + 1}. ${item}`,
          size: 18,
          font: defaultRunFont,
          color: 'B91C1C'
        })],
        spacing: { after: 80 },
        indent: { left: 400 },
        shading: { fill: 'FEF2F2', type: ShadingType.SOLID }
      }));
    });
    
    documentElements.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  } else {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: '✓ No Suspected Hallucinations Detected',
        size: 22,
        bold: true,
        color: '059669',
        font: defaultRunFont
      })],
      spacing: { before: 200, after: 200 }
    }));
  }
  
  // Page break before transcripts
  documentElements.push(new Paragraph({
    children: [],
    pageBreakBefore: true
  }));
  
  // Full Transcripts Section
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'Full Transcripts',
      size: 28,
      bold: true,
      color: '005EB8',
      font: defaultRunFont
    })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 300 }
  }));
  
  // Notewell Live Transcript
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'Notewell Live Transcript',
      size: 24,
      bold: true,
      color: '2E5C8A',
      font: defaultRunFont
    })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 }
  }));
  
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: `Word count: ${analysis.liveWordCount.toLocaleString()}`,
      size: 18,
      italics: true,
      color: '666666',
      font: defaultRunFont
    })],
    spacing: { after: 100 }
  }));
  
  if (notewellLiveTranscript?.trim()) {
    const liveParagraphs = notewellLiveTranscript.split('\n\n').filter(p => p.trim());
    liveParagraphs.forEach(para => {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: para.trim(),
          size: 20,
          font: defaultRunFont
        })],
        spacing: { after: 120 },
        shading: { fill: 'F0FDF4', type: ShadingType.SOLID }
      }));
    });
  } else {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: '(No live transcript available)',
        size: 18,
        italics: true,
        color: '999999',
        font: defaultRunFont
      })],
      spacing: { after: 200 }
    }));
  }
  
  documentElements.push(new Paragraph({ children: [], spacing: { after: 300 } }));
  
  // Notewell Batch Transcript
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'Notewell Batch Transcript',
      size: 24,
      bold: true,
      color: '2E5C8A',
      font: defaultRunFont
    })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 }
  }));
  
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: `Word count: ${analysis.batchWordCount.toLocaleString()}`,
      size: 18,
      italics: true,
      color: '666666',
      font: defaultRunFont
    })],
    spacing: { after: 100 }
  }));
  
  if (notewellBatchTranscript?.trim()) {
    const batchParagraphs = notewellBatchTranscript.split('\n\n').filter(p => p.trim());
    batchParagraphs.forEach(para => {
      documentElements.push(new Paragraph({
        children: [new TextRun({
          text: para.trim(),
          size: 20,
          font: defaultRunFont
        })],
        spacing: { after: 120 },
        shading: { fill: 'FEF3C7', type: ShadingType.SOLID }
      }));
    });
  } else {
    documentElements.push(new Paragraph({
      children: [new TextRun({
        text: '(No batch transcript available)',
        size: 18,
        italics: true,
        color: '999999',
        font: defaultRunFont
      })],
      spacing: { after: 200 }
    }));
  }
  
  // Footer
  documentElements.push(new Paragraph({
    children: [new TextRun({ text: '' })],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
    spacing: { before: 400, after: 100 }
  }));
  
  documentElements.push(new Paragraph({
    children: [new TextRun({
      text: 'This report is for clinical quality assurance purposes. Always verify clinical information against source documentation.',
      size: 16,
      italics: true,
      color: '999999',
      font: defaultRunFont
    })],
    alignment: AlignmentType.CENTER
  }));
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: documentElements
    }]
  });
  
  return await Packer.toBlob(doc);
};

export const downloadTranscriptComparisonReport = async (details: TranscriptComparisonDetails): Promise<void> => {
  const blob = await generateTranscriptComparisonReport(details);
  const filename = `Transcript_Comparison_${details.consultationDate.replace(/\//g, '-')}_${details.consultationStartTime.replace(/:/g, '')}.docx`;
  saveAs(blob, filename);
};
