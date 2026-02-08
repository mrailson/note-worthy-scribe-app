import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  display_order: number;
}

interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string | null;
  answer_rating: number | null;
  answer_options: string[] | null;
}

interface Response {
  id: string;
  submitted_at: string;
  respondent_name: string | null;
  respondent_email: string | null;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
}

interface QuestionStats {
  type: 'rating' | 'yes_no' | 'multiple_choice' | 'text';
  average?: number;
  max?: number;
  distribution?: { label: string; count: number }[];
  data?: { name: string; value: number }[];
  answers?: string[];
  total: number;
}

const getQuestionStats = (
  questionId: string,
  questionType: string,
  options: string[] | null,
  answers: Answer[]
): QuestionStats | null => {
  const questionAnswers = answers.filter((a) => a.question_id === questionId);
  
  if (questionType === 'rating' || questionType === 'scale') {
    const ratings = questionAnswers
      .filter((a) => a.answer_rating !== null)
      .map((a) => a.answer_rating!);
    
    if (ratings.length === 0) return null;
    
    const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    const max = questionType === 'rating' ? 5 : 10;
    
    const distribution = Array.from({ length: max }, (_, i) => ({
      label: String(i + 1),
      count: ratings.filter((r) => r === i + 1).length,
    }));
    
    return { type: 'rating', average, max, distribution, total: ratings.length };
  }
  
  if (questionType === 'yes_no') {
    const yesCount = questionAnswers.filter((a) => 
      a.answer_text?.toLowerCase() === 'yes'
    ).length;
    const noCount = questionAnswers.filter((a) => 
      a.answer_text?.toLowerCase() === 'no'
    ).length;
    
    return {
      type: 'yes_no',
      data: [
        { name: 'Yes', value: yesCount },
        { name: 'No', value: noCount },
      ],
      total: yesCount + noCount,
    };
  }
  
  if (questionType === 'multiple_choice' && options) {
    const optionCounts = options.map((opt) => ({
      name: opt,
      value: questionAnswers.filter((a) => 
        a.answer_text === opt || a.answer_options?.includes(opt)
      ).length,
    }));
    
    return { type: 'multiple_choice', data: optionCounts, total: questionAnswers.length };
  }
  
  if (questionType === 'text') {
    const textAnswers = questionAnswers
      .filter((a) => a.answer_text)
      .map((a) => a.answer_text!);
    
    return { type: 'text', answers: textAnswers, total: textAnswers.length };
  }
  
  return null;
};

const createBorderedCell = (text: string, options: { 
  bold?: boolean; 
  shading?: string;
  width?: number;
} = {}): TableCell => {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: options.bold,
            size: 22,
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
      }),
    ],
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading ? {
      type: ShadingType.SOLID,
      color: options.shading,
      fill: options.shading,
    } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
};

const createDistributionTable = (stats: QuestionStats): Table => {
  const rows: TableRow[] = [];
  
  if (stats.type === 'rating' && stats.distribution) {
    // Header row
    rows.push(new TableRow({
      children: [
        createBorderedCell('Rating', { bold: true, shading: 'E8E8E8', width: 30 }),
        createBorderedCell('Count', { bold: true, shading: 'E8E8E8', width: 25 }),
        createBorderedCell('Percentage', { bold: true, shading: 'E8E8E8', width: 45 }),
      ],
    }));
    
    // Data rows
    stats.distribution.forEach((item) => {
      const percentage = stats.total > 0 ? ((item.count / stats.total) * 100).toFixed(1) : '0.0';
      const barLength = Math.round((item.count / Math.max(...stats.distribution!.map(d => d.count), 1)) * 20);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      
      rows.push(new TableRow({
        children: [
          createBorderedCell(`${item.label} Star${item.label !== '1' ? 's' : ''}`, { width: 30 }),
          createBorderedCell(String(item.count), { width: 25 }),
          createBorderedCell(`${percentage}%  ${bar}`, { width: 45 }),
        ],
      }));
    });
  } else if ((stats.type === 'yes_no' || stats.type === 'multiple_choice') && stats.data) {
    // Header row
    rows.push(new TableRow({
      children: [
        createBorderedCell('Option', { bold: true, shading: 'E8E8E8', width: 50 }),
        createBorderedCell('Count', { bold: true, shading: 'E8E8E8', width: 20 }),
        createBorderedCell('Percentage', { bold: true, shading: 'E8E8E8', width: 30 }),
      ],
    }));
    
    // Data rows
    const maxValue = Math.max(...stats.data.map(d => d.value), 1);
    stats.data.forEach((item) => {
      const percentage = stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(1) : '0.0';
      const barLength = Math.round((item.value / maxValue) * 15);
      const bar = '█'.repeat(barLength) + '░'.repeat(15 - barLength);
      
      rows.push(new TableRow({
        children: [
          createBorderedCell(item.name, { width: 50 }),
          createBorderedCell(String(item.value), { width: 20 }),
          createBorderedCell(`${percentage}%  ${bar}`, { width: 30 }),
        ],
      }));
    });
  }
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
};

export const exportSurveyResultsToWord = async (
  survey: Survey,
  questions: Question[],
  responses: Response[],
  answers: Answer[]
): Promise<void> => {
  const totalResponses = responses.length;
  
  // Calculate average rating
  const ratingQuestions = questions.filter((q) => q.question_type === 'rating');
  let averageRating: number | null = null;
  if (ratingQuestions.length > 0) {
    const allRatings = ratingQuestions.flatMap((q) =>
      answers
        .filter((a) => a.question_id === q.id && a.answer_rating !== null)
        .map((a) => a.answer_rating!)
    );
    if (allRatings.length > 0) {
      averageRating = allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;
    }
  }

  const documentChildren: (Paragraph | Table)[] = [];

  // Title
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Survey Results Report',
          bold: true,
          size: 48,
          color: '2563EB',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Survey Title
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: survey.title,
          bold: true,
          size: 36,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  // Generated date
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`,
          size: 22,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Summary section
  documentChildren.push(
    new Paragraph({
      text: 'Summary Overview',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
    })
  );

  // Summary table
  const summaryRows = [
    new TableRow({
      children: [
        createBorderedCell('Total Responses', { bold: true, shading: 'E8E8E8', width: 50 }),
        createBorderedCell(String(totalResponses), { width: 50 }),
      ],
    }),
    new TableRow({
      children: [
        createBorderedCell('Total Questions', { bold: true, shading: 'E8E8E8', width: 50 }),
        createBorderedCell(String(questions.length), { width: 50 }),
      ],
    }),
  ];

  if (averageRating !== null) {
    summaryRows.push(
      new TableRow({
        children: [
          createBorderedCell('Average Rating', { bold: true, shading: 'E8E8E8', width: 50 }),
          createBorderedCell(`${averageRating.toFixed(1)} out of 5`, { width: 50 }),
        ],
      })
    );
  }

  if (responses.length > 0) {
    const latestResponse = responses.reduce((latest, r) => 
      new Date(r.submitted_at) > new Date(latest.submitted_at) ? r : latest
    );
    summaryRows.push(
      new TableRow({
        children: [
          createBorderedCell('Latest Response', { bold: true, shading: 'E8E8E8', width: 50 }),
          createBorderedCell(format(new Date(latestResponse.submitted_at), 'dd MMM yyyy, HH:mm'), { width: 50 }),
        ],
      })
    );
  }

  documentChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: summaryRows,
    })
  );

  // Questions section
  documentChildren.push(
    new Paragraph({
      text: 'Question Results',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  // Each question
  const sortedQuestions = [...questions].sort((a, b) => a.display_order - b.display_order);
  
  sortedQuestions.forEach((question, index) => {
    const stats = getQuestionStats(question.id, question.question_type, question.options, answers);
    
    // Question header
    documentChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Q${index + 1}. ${question.question_text}`,
            bold: true,
            size: 26,
          }),
        ],
        spacing: { before: 300, after: 100 },
      })
    );

    // Question type and response count
    const typeLabel = question.question_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    documentChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Type: ${typeLabel} | Responses: ${stats?.total || 0}`,
            size: 20,
            color: '666666',
            italics: true,
          }),
        ],
        spacing: { after: 150 },
      })
    );

    if (!stats || stats.total === 0) {
      documentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'No responses yet',
              size: 22,
              color: '999999',
              italics: true,
            }),
          ],
          spacing: { after: 200 },
        })
      );
      return;
    }

    // Rating summary
    if (stats.type === 'rating' && stats.average !== undefined) {
      documentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Average Rating: ${stats.average.toFixed(1)} out of ${stats.max}`,
              size: 24,
              bold: true,
              color: '2563EB',
            }),
          ],
          spacing: { after: 150 },
        })
      );
    }

    // Distribution table for rating/multiple choice/yes_no
    if (stats.type === 'rating' || stats.type === 'multiple_choice' || stats.type === 'yes_no') {
      documentChildren.push(createDistributionTable(stats));
    }

    // Text responses
    if (stats.type === 'text' && stats.answers && stats.answers.length > 0) {
      stats.answers.forEach((answer, answerIndex) => {
        documentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${answerIndex + 1}. "${answer}"`,
                size: 22,
              }),
            ],
            spacing: { before: 80, after: 80 },
            indent: { left: 400 },
          })
        );
      });
    }

    // Add spacing after each question
    documentChildren.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
      })
    );
  });

  // Footer
  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '─'.repeat(50),
          color: 'CCCCCC',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    })
  );

  documentChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Generated by Practice Survey Manager',
          size: 20,
          color: '999999',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: documentChildren,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${survey.title.replace(/[^a-z0-9]/gi, '_')}_Results_${format(new Date(), 'yyyy-MM-dd')}.docx`;
  saveAs(blob, fileName);
};
