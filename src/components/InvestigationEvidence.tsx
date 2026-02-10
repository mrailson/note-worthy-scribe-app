import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Upload, Download, Trash2, Mic, Volume2, Loader2, CheckCircle2, XCircle, FileIcon, Clock, Eye, User, Stethoscope } from 'lucide-react';
import { AudioAIReviewDialog } from '@/components/AudioAIReviewDialog';
import { parseAudioReviewBadges, getBadgeSentimentClasses } from '@/utils/audioReviewBadges';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { useDropzone } from 'react-dropzone';

interface InvestigationEvidenceProps {
  complaintId: string;
  disabled?: boolean;
}

interface EvidenceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  evidence_type: string;
  description: string | null;
  ai_summary?: string | null;
  uploaded_at: string;
}

interface AudioTranscript {
  id: string;
  audio_file_id: string;
  transcript_text: string;
  transcription_confidence: number | null;
  transcribed_at: string;
  audio_duration_seconds: number | null;
}

interface ComplaintDetails {
  reference_number: string;
  patient_name: string;
  incident_date: string;
  complaint_title: string;
  complaint_description: string;
  category: string;
  status: string;
  created_at: string | null;
  practice_name: string | null;
  practice_id: string | null;
}

interface UploadingFile {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'analysing' | 'complete' | 'failed';
  error?: string;
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/rtf': ['.rtf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'image/svg+xml': ['.svg'],
  'image/tiff': ['.tiff', '.tif'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/x-m4a': ['.m4a'],
  'audio/ogg': ['.ogg', '.opus'],
  'audio/opus': ['.opus'],
  'audio/flac': ['.flac'],
  'audio/aac': ['.aac'],
  'audio/amr': ['.amr'],
  'audio/3gpp': ['.3gp'],
  'message/rfc822': ['.eml'],
  'application/vnd.ms-outlook': ['.msg'],
  'application/zip': ['.zip'],
  'text/html': ['.html', '.htm'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for non-audio files
const MAX_AUDIO_FILE_SIZE = 20 * 1024 * 1024; // 20MB for audio files
const MAX_FILES = 20;
const MAX_CONCURRENT = 5;

const EVIDENCE_TYPE_COLOURS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pdf: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  image: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  audio: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  document: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  spreadsheet: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  presentation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  archive: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  other: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
};

export function InvestigationEvidence({ complaintId, disabled = false }: InvestigationEvidenceProps) {
  const [complaintDetails, setComplaintDetails] = useState<ComplaintDetails | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [audioTranscripts, setAudioTranscripts] = useState<AudioTranscript[]>([]);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [generatingReview, setGeneratingReview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('files');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionModal, setTranscriptionModal] = useState<{
    isOpen: boolean;
    fileName: string;
    text: string;
    confidence: number | null;
    audioDuration: number | null;
  }>({
    isOpen: false,
    fileName: '',
    text: '',
    confidence: null,
    audioDuration: null
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    file: EvidenceFile | null;
  }>({
    isOpen: false,
    file: null
  });
  const [transcriptDeleteConfirmation, setTranscriptDeleteConfirmation] = useState<{
    isOpen: boolean;
    transcript: AudioTranscript | null;
  }>({
    isOpen: false,
    transcript: null
  });
  const [aiReviewModal, setAiReviewModal] = useState<{
    isOpen: boolean;
    fileName: string;
    review: string;
    evidenceFileId: string | null;
  }>({
    isOpen: false,
    fileName: '',
    review: '',
    evidenceFileId: null
  });

  useEffect(() => {
    fetchComplaintDetails();
    fetchEvidenceFiles();
    fetchAudioTranscripts();
  }, [complaintId]);

  const fetchComplaintDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          reference_number, 
          patient_name, 
          incident_date, 
          complaint_title,
          complaint_description,
          category, 
          status,
          created_at,
          practice_id,
          gp_practices (name)
        `)
        .eq('id', complaintId)
        .single();

      if (error) throw error;

      // Resolve practice name from practice_details (user profile) first, then gp_practices fallback
      let practiceName: string | null = null;
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Try practice_details by user_id first (the user's own profile practice)
        const { data: profilePractice } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .not('practice_name', 'ilike', '%Default Practice%')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (profilePractice?.practice_name) {
          practiceName = profilePractice.practice_name;
        }
      }

      // Fallback to gp_practices if no practice_details match
      if (!practiceName) {
        practiceName = data.gp_practices?.name || null;
      }

      setComplaintDetails({
        ...data,
        complaint_description: data.complaint_description || '',
        created_at: data.created_at || null,
        practice_name: practiceName,
        practice_id: data.practice_id || null,
      });
    } catch (error) {
      console.error('Error fetching complaint details:', error);
    }
  };

  const fetchEvidenceFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_evidence')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setEvidenceFiles((data || []) as EvidenceFile[]);
    } catch (error) {
      console.error('Error fetching evidence files:', error);
      toast.error('Failed to load evidence files');
    }
  };

  const fetchAudioTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_investigation_transcripts')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('transcribed_at', { ascending: false });

      if (error) throw error;
      setAudioTranscripts(data || []);
    } catch (error) {
      console.error('Error fetching audio transcripts:', error);
      toast.error('Failed to load audio transcripts');
    }
  };

  // --- Upload pipeline ---
  const processFile = async (uploadingFile: UploadingFile): Promise<void> => {
    const { file, id } = uploadingFile;

    // Step 1: Upload to storage
    setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'uploading' as const } : f));

    try {
      const fileExt = file.name.split('.').pop();
      const storagePath = `${complaintId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('communication-files')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Step 2: Convert to base64 and call AI analysis
      setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'analysing' as const } : f));

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binaryString);

      let evidenceType = 'other';
      let aiSummary = '';
      let pendingTranscript: string | undefined;

      try {
        const { data: analysisData, error: analysisError } = await supabase.functions
          .invoke('analyse-evidence-file', {
            body: {
              base64Data,
              fileName: file.name,
              mimeType: file.type,
            }
          });

        if (analysisError) {
          console.error('Analysis error:', analysisError);
          aiSummary = 'AI analysis unavailable.';
        } else if (analysisData) {
          evidenceType = analysisData.evidenceType || 'other';
          aiSummary = analysisData.summary || '';
          if (analysisData.transcript && evidenceType === 'audio') {
            pendingTranscript = analysisData.transcript;
          }
        }
      } catch (analysisErr) {
        console.error('Analysis call failed:', analysisErr);
        aiSummary = 'AI analysis could not be completed.';
      }

      // Step 3: Save to database
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      const { data: insertedRow, error: insertError } = await supabase
        .from('complaint_investigation_evidence')
        .insert({
          complaint_id: complaintId,
          file_name: file.name,
          file_path: uploadData.path,
          file_type: file.type,
          file_size: file.size,
          evidence_type: evidenceType,
          description: aiSummary || null,
          ai_summary: aiSummary || null,
          uploaded_by: userId,
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Auto-save transcript for audio files (after evidence record exists so we can link audio_file_id)
      if (pendingTranscript && userId) {
        try {
          await supabase
            .from('complaint_investigation_transcripts')
            .insert({
              complaint_id: complaintId,
              audio_file_id: (insertedRow as any).id,
              transcript_text: pendingTranscript,
              transcribed_by: userId,
              transcription_confidence: null,
              audio_duration_seconds: null,
            } as any);
          fetchAudioTranscripts();
          console.log(`Auto-saved transcript for ${file.name}`);
        } catch (transcriptErr) {
          console.error('Failed to auto-save transcript:', transcriptErr);
        }
      }

      setEvidenceFiles(prev => [{ ...(insertedRow as any), ai_summary: aiSummary } as EvidenceFile, ...prev]);
      setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'complete' as const } : f));
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      setUploadingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'failed' as const, error: errorMsg } : f));
    }
  };

  const processFilesWithConcurrency = async (files: UploadingFile[]) => {
    setIsProcessing(true);
    const queue = [...files];
    const active: Promise<void>[] = [];

    const runNext = async (): Promise<void> => {
      if (queue.length === 0) return;
      const next = queue.shift()!;
      const promise = processFile(next).then(() => {
        active.splice(active.indexOf(promise), 1);
        return runNext();
      });
      active.push(promise);
    };

    // Start up to MAX_CONCURRENT
    const starters = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
      starters.push(runNext());
    }

    await Promise.all(starters);
    // Wait for any remaining
    await Promise.all(active);
    setIsProcessing(false);
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        if (errors.some((e: any) => e.code === 'file-too-large')) {
          const isAudio = file.type?.startsWith('audio/');
          toast.error(`${file.name} is too large. Maximum size is ${isAudio ? '20MB' : '10MB'}.`);
        } else if (errors.some((e: any) => e.code === 'file-invalid-type')) {
          toast.error(`${file.name} has an unsupported file type.`);
        } else if (errors.some((e: any) => e.code === 'too-many-files')) {
          toast.error(`Too many files. Maximum is ${MAX_FILES} files at once.`);
        }
      });
    }

    if (acceptedFiles.length === 0) return;

    // Validate per-type size limits (dropzone allows up to 20MB; enforce 10MB for non-audio)
    const validFiles: File[] = [];
    acceptedFiles.forEach(file => {
      const isAudio = file.type?.startsWith('audio/');
      const limit = isAudio ? MAX_AUDIO_FILE_SIZE : MAX_FILE_SIZE;
      if (file.size > limit) {
        toast.error(`${file.name} is too large. Maximum size for ${isAudio ? 'audio files' : 'other files'} is ${isAudio ? '20MB' : '10MB'}.`);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) return;

    const newUploading: UploadingFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      status: 'queued' as const,
    }));

    setUploadingFiles(prev => [...newUploading, ...prev]);
    processFilesWithConcurrency(newUploading);
  }, [complaintId]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_AUDIO_FILE_SIZE,
    maxFiles: MAX_FILES,
    multiple: true,
    noClick: true,
    disabled: disabled || isProcessing,
  });

  // Handle paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'upload') return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && file.size <= MAX_AUDIO_FILE_SIZE) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onDrop(files, []);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeTab, onDrop]);

  // --- Existing functionality ---
  const formatTranscriptIntoParagraphs = (text: string): string[] => {
    return text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\?)\s+|(?<=\.)\s{2,}/).reduce((acc: string[][], sentence) => {
      const lastGroup = acc[acc.length - 1];
      if (!lastGroup || lastGroup.length >= 4 || (lastGroup.join(' ').length > 400)) {
        acc.push([sentence]);
      } else {
        lastGroup.push(sentence);
      }
      return acc;
    }, [] as string[][]).map(paragraph => paragraph.join(' '));
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} seconds`;
    if (secs === 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
  };

  const extractAudioDateFromFilename = (filename: string): string | null => {
    // Try common date patterns from audio filenames like "07-10-2024 10-49GST 1242 (1).mp3"
    const patterns = [
      /(\d{2})-(\d{2})-(\d{4})/,     // DD-MM-YYYY
      /(\d{4})-(\d{2})-(\d{2})/,     // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/,   // DD/MM/YYYY
    ];
    
    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        // If DD-MM-YYYY or DD/MM/YYYY
        if (match[3] && match[3].length === 4 && parseInt(match[1]) <= 31) {
          const d = new Date(`${match[3]}-${match[2]}-${match[1]}`);
          if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        }
        // If YYYY-MM-DD
        if (match[1] && match[1].length === 4) {
          const d = new Date(`${match[1]}-${match[2]}-${match[3]}`);
          if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        }
      }
    }
    return null;
  };

  const extractAudioTimeFromFilename = (filename: string): string | null => {
    // Match time after date pattern, e.g. "07-10-2024 10-49GST" or "07-10-2024_14-30" or "2024-10-07 10:49"
    const timePatterns = [
      /\d{2}[-\/]\d{2}[-\/]\d{4}\s+(\d{1,2})[-:](\d{2})\s*(?:GST|GMT|BST|UTC)?/i,  // DD-MM-YYYY HH-MM[TZ]
      /\d{4}[-\/]\d{2}[-\/]\d{2}[\s_T]+(\d{1,2})[-:](\d{2})/i,                       // YYYY-MM-DD HH-MM
      /\d{2}[-\/]\d{2}[-\/]\d{4}[_\s]+(\d{1,2})[-:](\d{2})/i,                        // DD-MM-YYYY_HH-MM
    ];

    for (const pattern of timePatterns) {
      const match = filename.match(pattern);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = match[2];
        if (hours >= 0 && hours <= 23 && parseInt(minutes) >= 0 && parseInt(minutes) <= 59) {
          return `${hours.toString().padStart(2, '0')}:${minutes}`;
        }
      }
    }
    return null;
  };

  const makeTableCell = (text: string, bold = false, shading?: string): TableCell => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold, size: 22, font: 'Calibri' })],
          spacing: { before: 60, after: 60 },
        }),
      ],
      shading: shading ? { fill: shading } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
    });
  };

  const downloadTranscriptAsWord = async (
    text: string = transcriptionModal.text,
    fileName: string = transcriptionModal.fileName,
    confidence: number | null = transcriptionModal.confidence,
    audioDuration: number | null = null,
    aiSummary: string | null = null
  ) => {
    if (!complaintDetails) {
      toast.error('Complaint details not available');
      return;
    }

    try {
      const paragraphs = formatTranscriptIntoParagraphs(text);
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      const audioDate = extractAudioDateFromFilename(fileName);
      const audioTime = extractAudioTimeFromFilename(fileName);
      const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const complaintDate = complaintDetails.created_at 
        ? new Date(complaintDetails.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date(complaintDetails.incident_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      // Truncate complaint description to a reasonable summary length
      const summaryText = complaintDetails.complaint_description.length > 300
        ? complaintDetails.complaint_description.substring(0, 297) + '…'
        : complaintDetails.complaint_description;

      // Build complaint details table rows
      const tableRows: TableRow[] = [
        new TableRow({
          children: [
            makeTableCell('Complaint Reference', true, 'F2F2F2'),
            makeTableCell(complaintDetails.reference_number),
          ],
        }),
        new TableRow({
          children: [
            makeTableCell('Practice', true, 'F2F2F2'),
            makeTableCell(complaintDetails.practice_name || 'Not specified'),
          ],
        }),
        new TableRow({
          children: [
            makeTableCell('Report Date', true, 'F2F2F2'),
            makeTableCell(todayFormatted),
          ],
        }),
        new TableRow({
          children: [
            makeTableCell('Date of Audio', true, 'F2F2F2'),
            makeTableCell(audioDate || 'Not available'),
          ],
        }),
      ];

      // Add time of call row if known
      if (audioTime) {
        tableRows.push(
          new TableRow({
            children: [
              makeTableCell('Time of Call', true, 'F2F2F2'),
              makeTableCell(audioTime),
            ],
          })
        );
      }

      tableRows.push(
        new TableRow({
          children: [
            makeTableCell('Date of Complaint', true, 'F2F2F2'),
            makeTableCell(complaintDate),
          ],
        }),
        new TableRow({
          children: [
            makeTableCell('Category', true, 'F2F2F2'),
            makeTableCell(complaintDetails.category),
          ],
        }),
        new TableRow({
          children: [
            makeTableCell('Complaint Summary', true, 'F2F2F2'),
            makeTableCell(summaryText),
          ],
        }),
      );

      // Build complaint details table
      const detailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      });

      // Build the factual summary section
      const summaryParagraphs: Paragraph[] = [];
      summaryParagraphs.push(
        new Paragraph({
          children: [],
          border: { bottom: { color: '999999', space: 1, size: 6, style: BorderStyle.SINGLE } },
          spacing: { after: 300 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Call Overview', bold: true, size: 28, font: 'Calibri' })],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
        })
      );

      // Duration
      if (audioDuration && audioDuration > 0) {
        summaryParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Duration: ', bold: true, size: 22, font: 'Calibri' }),
              new TextRun({ text: formatDuration(audioDuration), size: 22, font: 'Calibri' }),
            ],
            spacing: { after: 120 },
          })
        );
      }

      // Word count
      summaryParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Transcript Word Count: ', bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: wordCount.toLocaleString(), size: 22, font: 'Calibri' }),
          ],
          spacing: { after: 120 },
        })
      );

      // Confidence
      if (confidence) {
        summaryParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Transcription Confidence: ', bold: true, size: 22, font: 'Calibri' }),
              new TextRun({ text: `${Math.round(confidence * 100)}%`, size: 22, font: 'Calibri' }),
            ],
            spacing: { after: 120 },
          })
        );
      }

      // Audio file name
      summaryParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Audio File: ', bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: fileName, size: 22, font: 'Calibri' }),
          ],
          spacing: { after: 200 },
        })
      );

      // AI factual summary (stripped of markdown)
      if (aiSummary) {
        const cleanSummary = aiSummary
          .replace(/#{1,6}\s*/g, '')
          .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
          .replace(/\[BADGE:.*?\]/g, '')
          .trim();

        if (cleanSummary) {
          summaryParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: 'Summary:', bold: true, size: 22, font: 'Calibri' })],
              spacing: { after: 120 },
            })
          );

          const summaryLines = cleanSummary.split(/\n+/).filter(l => l.trim());
          summaryLines.forEach(line => {
            summaryParagraphs.push(
              new Paragraph({
                children: [new TextRun({ text: line.trim(), size: 22, font: 'Calibri' })],
                spacing: { after: 160, line: 340 },
              })
            );
          });
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Title
            new Paragraph({
              children: [new TextRun({ text: 'Audio Transcription Record', bold: true, size: 36, font: 'Calibri' })],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 120 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${complaintDetails.reference_number} — ${fileName}`, size: 22, color: '666666', font: 'Calibri' })],
              spacing: { after: 400 },
            }),

            // Complaint details table
            detailsTable,

            // Separator
            new Paragraph({ children: [], spacing: { before: 400 } }),
            new Paragraph({
              children: [],
              border: { bottom: { color: '999999', space: 1, size: 6, style: BorderStyle.SINGLE } },
              spacing: { after: 300 },
            }),

            // Transcript heading
            new Paragraph({
              children: [new TextRun({ text: 'Full Transcription', bold: true, size: 28, font: 'Calibri' })],
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 300 },
            }),

            // Transcript paragraphs
            ...paragraphs.map(para =>
              new Paragraph({
                children: [new TextRun({ text: para, size: 22, font: 'Calibri' })],
                spacing: { after: 240, line: 360 },
              })
            ),

            // Call overview / summary at the end
            ...summaryParagraphs,

            // Footer
            new Paragraph({ children: [], spacing: { before: 400 } }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Document generated on ${todayFormatted} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
                  italics: true, size: 18, color: '666666', font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const outputFileName = `Transcript_${complaintDetails.reference_number}_${fileName.replace(/\.[^/.]+$/, '')}.docx`;
      saveAs(blob, outputFileName);
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Failed to generate Word document');
    }
  };

  const transcribeAudio = async (audioFile: EvidenceFile) => {
    const isAudioFile = audioFile.file_type?.startsWith('audio/') ||
      audioFile.evidence_type === 'audio' ||
      /\.(mp3|wav|m4a|ogg|webm)$/i.test(audioFile.file_name);

    if (!isAudioFile) {
      toast.error('Selected file is not an audio file');
      return;
    }

    setTranscribing(audioFile.id);
    try {
      if (audioFile.file_size > 25 * 1024 * 1024) {
        throw new Error('Audio file too large. Maximum size is 25MB.');
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('communication-files')
        .download(audioFile.file_path);

      if (downloadError) throw downloadError;

      let audioDurationSeconds: number | null = null;
      try {
        const audioUrl = URL.createObjectURL(fileData);
        const audio = new Audio(audioUrl);
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => {
            audioDurationSeconds = Math.round(audio.duration);
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => { URL.revokeObjectURL(audioUrl); resolve(); };
          setTimeout(() => { URL.revokeObjectURL(audioUrl); resolve(); }, 5000);
        });
      } catch { /* ignore duration extraction errors */ }

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Audio = btoa(binaryString);

      const { data: transcriptionData, error: transcriptionError } = await supabase.functions
        .invoke('speech-to-text', {
          body: { audio: base64Audio, mimeType: audioFile.file_type, fileName: audioFile.file_name }
        });

      if (transcriptionError) throw transcriptionError;
      if (!transcriptionData?.text) throw new Error('No transcription text was returned');

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('You must be signed in to transcribe audio');

      const { data, error } = await supabase
        .from('complaint_investigation_transcripts')
        .insert({
          complaint_id: complaintId,
          audio_file_id: audioFile.id,
          transcript_text: transcriptionData.text,
          transcription_confidence: transcriptionData.confidence || null,
          transcribed_by: authData.user.id,
          audio_duration_seconds: audioDurationSeconds
        })
        .select()
        .single();

      if (error) throw error;

      setAudioTranscripts(prev => [data, ...prev]);
      setTranscriptionModal({
        isOpen: true,
        fileName: audioFile.file_name,
        text: transcriptionData.text,
        confidence: transcriptionData.confidence || null,
        audioDuration: audioDurationSeconds
      });

      // Auto-generate AI call summary from transcript
      toast.info('Generating AI summary…');
      try {
        const { data: reviewData, error: reviewError } = await supabase.functions
          .invoke('generate-audio-review', {
            body: { transcript: transcriptionData.text, fileName: audioFile.file_name, audioDuration: audioDurationSeconds }
          });

        if (!reviewError && reviewData?.review) {
          // Update evidence record with AI review
          await supabase
            .from('complaint_investigation_evidence')
            .update({ ai_summary: reviewData.review } as any)
            .eq('id', audioFile.id);

          // Update local state so the review is immediately visible
          setEvidenceFiles(prev => prev.map(f =>
            f.id === audioFile.id ? { ...f, ai_summary: reviewData.review } : f
          ));
          toast.success('AI summary generated successfully');
        } else {
          console.error('AI summary generation failed:', reviewError);
        }
      } catch (reviewErr) {
        console.error('Failed to generate AI summary:', reviewErr);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      toast.error('Failed to transcribe audio', { description: message || 'Unknown error' });
    } finally {
      setTranscribing(null);
    }
  };

  // Generate AI review for an audio file that already has a transcript
  const generateReviewForFile = async (file: EvidenceFile) => {
    const transcript = audioTranscripts.find(t => t.audio_file_id === file.id);
    if (!transcript) {
      toast.error('No transcript found. Please transcribe the audio first.');
      return;
    }

    setGeneratingReview(file.id);
    try {
      const { data: reviewData, error: reviewError } = await supabase.functions
        .invoke('generate-audio-review', {
          body: { transcript: transcript.transcript_text, fileName: file.file_name, audioDuration: transcript.audio_duration_seconds }
        });

      if (reviewError) throw reviewError;
      if (!reviewData?.review) throw new Error('No review returned');

      // Save to database
      await supabase
        .from('complaint_investigation_evidence')
        .update({ ai_summary: reviewData.review } as any)
        .eq('id', file.id);

      // Update local state
      setEvidenceFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, ai_summary: reviewData.review } : f
      ));

      toast.success('AI summary generated successfully');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      toast.error('Failed to generate AI summary');
    } finally {
      setGeneratingReview(null);
    }
  };

  const downloadFile = async (file: EvidenceFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('communication-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const confirmDeleteFile = (file: EvidenceFile) => {
    setDeleteConfirmation({ isOpen: true, file });
  };

  const deleteFile = async () => {
    const file = deleteConfirmation.file;
    if (!file) return;
    setDeleteConfirmation({ isOpen: false, file: null });

    try {
      const { error: dbError } = await supabase
        .from('complaint_investigation_evidence')
        .delete()
        .eq('id', file.id);

      if (dbError) throw new Error(`Database error: ${dbError.message}`);

      const { error: storageError } = await supabase.storage
        .from('communication-files')
        .remove([file.file_path]);

      if (storageError) {
        toast.error('File deleted from database but storage cleanup failed');
      }

      setEvidenceFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (error) {
      console.error('Error deleting evidence file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
      toast.error(errorMessage);
    }
  };

  const confirmDeleteTranscript = (transcript: AudioTranscript) => {
    setTranscriptDeleteConfirmation({ isOpen: true, transcript });
  };

  const deleteTranscript = async () => {
    const transcript = transcriptDeleteConfirmation.transcript;
    if (!transcript) return;

    try {
      const { error } = await supabase
        .from('complaint_investigation_transcripts')
        .delete()
        .eq('id', transcript.id);

      if (error) throw error;
      setAudioTranscripts(prev => prev.filter(t => t.id !== transcript.id));
    } catch (error) {
      console.error('Error deleting transcript:', error);
      toast.error('Failed to delete transcript');
    } finally {
      setTranscriptDeleteConfirmation({ isOpen: false, transcript: null });
    }
  };

  const getEvidenceTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      email: 'Email',
      pdf: 'PDF Document',
      image: 'Image',
      audio: 'Audio Recording',
      document: 'Document',
      spreadsheet: 'Spreadsheet',
      presentation: 'Presentation',
      archive: 'Archive',
      other: 'Other',
    };
    return types[type] || type;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'uploading': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'analysing': return <Loader2 className="h-4 w-4 animate-spin text-amber-500" />;
      case 'complete': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusLabel = (status: UploadingFile['status']) => {
    switch (status) {
      case 'queued': return 'Queued';
      case 'uploading': return 'Uploading…';
      case 'analysing': return 'Analysing…';
      case 'complete': return 'Complete';
      case 'failed': return 'Failed';
    }
  };

  const completedCount = uploadingFiles.filter(f => f.status === 'complete').length;
  const totalUploading = uploadingFiles.length;

  const rootProps = getRootProps({
    role: 'button',
    tabIndex: 0,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      open();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    }
  });

  return (
    <>
      {/* Delete evidence file dialog */}
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => !open && setDeleteConfirmation({ isOpen: false, file: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evidence File?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to permanently delete:</p>
              <p className="font-semibold text-foreground">{deleteConfirmation.file?.file_name}</p>
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Remove the file from investigation evidence</li>
                <li>Delete any associated audio transcripts</li>
                <li>Remove the file from secure storage</li>
              </ul>
              <p className="font-semibold text-destructive mt-3">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete transcript dialog */}
      <AlertDialog open={transcriptDeleteConfirmation.isOpen} onOpenChange={(open) => !open && setTranscriptDeleteConfirmation({ isOpen: false, transcript: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transcript?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete this transcript?</p>
              <p className="font-semibold text-destructive mt-3">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTranscript} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Transcript
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Review modal */}
      <AudioAIReviewDialog
        isOpen={aiReviewModal.isOpen}
        onOpenChange={(open) => setAiReviewModal(prev => ({ ...prev, isOpen: open }))}
        fileName={aiReviewModal.fileName}
        review={aiReviewModal.review}
        practiceId={complaintDetails?.practice_id}
        onReAnalyse={aiReviewModal.evidenceFileId ? async () => {
          const fileId = aiReviewModal.evidenceFileId;
          if (!fileId) return;
          const file = evidenceFiles.find(f => f.id === fileId);
          if (!file) return;
          const transcript = audioTranscripts.find(t => t.audio_file_id === fileId);
          if (!transcript) {
            toast.error('No transcript found. Please transcribe the audio first.');
            return;
          }
          const { data: reviewData, error: reviewError } = await supabase.functions
            .invoke('generate-audio-review', {
              body: { transcript: transcript.transcript_text, fileName: file.file_name, audioDuration: transcript.audio_duration_seconds }
            });
          if (reviewError) throw reviewError;
          if (!reviewData?.review) throw new Error('No summary returned');
          await supabase
            .from('complaint_investigation_evidence')
            .update({ ai_summary: reviewData.review } as any)
            .eq('id', fileId);
          setEvidenceFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, ai_summary: reviewData.review } : f
          ));
          setAiReviewModal(prev => ({ ...prev, review: reviewData.review }));
          toast.success('AI summary re-generated successfully');
        } : undefined}
      />

      {/* Transcription modal */}
      <Dialog open={transcriptionModal.isOpen} onOpenChange={(open) => setTranscriptionModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Volume2 className="h-5 w-5 text-primary" />
              Audio Transcription
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{transcriptionModal.fileName}</span>
              {transcriptionModal.confidence && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {Math.round(transcriptionModal.confidence * 100)}% confidence
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="bg-muted/50 p-6 rounded-lg border">
              <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert space-y-4">
                {transcriptionModal.text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\?)\s+|(?<=\.)\s{2,}/).reduce((acc: string[][], sentence) => {
                  const lastGroup = acc[acc.length - 1];
                  if (!lastGroup || lastGroup.length >= 4 || (lastGroup.join(' ').length > 400)) {
                    acc.push([sentence]);
                  } else {
                    lastGroup.push(sentence);
                  }
                  return acc;
                }, [] as string[][]).map((paragraph, idx) => (
                  <p key={idx} className="text-base leading-relaxed text-foreground">
                    {paragraph.join(' ')}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                // Find the evidence file to get its ai_summary
                const matchedFile = evidenceFiles.find(f => f.file_name === transcriptionModal.fileName);
                downloadTranscriptAsWord(
                  transcriptionModal.text,
                  transcriptionModal.fileName,
                  transcriptionModal.confidence,
                  transcriptionModal.audioDuration,
                  matchedFile?.ai_summary || null
                );
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Word
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(transcriptionModal.text);
                toast.success('Copied to clipboard');
              }}
            >
              Copy to Clipboard
            </Button>
            <Button onClick={() => setTranscriptionModal(prev => ({ ...prev, isOpen: false }))}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Investigation Evidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files">
                Evidence Files{evidenceFiles.length > 0 && ` (${evidenceFiles.length})`}
              </TabsTrigger>
              <TabsTrigger value="upload">Upload Evidence</TabsTrigger>
            </TabsList>

            {/* Upload Evidence Tab */}
            <TabsContent value="upload" className="space-y-4">
              <div
                {...rootProps}
                data-allow-file-drop
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                } ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center space-y-3">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {isDragActive
                        ? 'Drop files here'
                        : 'Drag & drop files here, paste from clipboard, or click to browse'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Excel, PowerPoint, Images, Audio, Emails, ZIP (audio up to 20MB, other files up to 10MB, up to 20 files)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); open(); }}
                    disabled={disabled || isProcessing}
                  >
                    Browse files
                  </Button>
                </div>
              </div>

              {/* Upload progress list */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      {isProcessing ? 'Processing files…' : 'Upload complete'}
                    </h4>
                    {totalUploading > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {completedCount}/{totalUploading} complete
                      </span>
                    )}
                  </div>
                  {uploadingFiles.map((uf) => (
                    <div key={uf.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                      {getStatusIcon(uf.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uf.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uf.file.size)}
                          {uf.error && <span className="text-destructive ml-2">— {uf.error}</span>}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          uf.status === 'complete' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          uf.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          ''
                        }
                      >
                        {getStatusLabel(uf.status)}
                      </Badge>
                    </div>
                  ))}
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadingFiles([])}
                      className="text-xs"
                    >
                      Clear list
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Evidence Files Tab */}
            <TabsContent value="files" className="space-y-4">
              {evidenceFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No evidence files uploaded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {evidenceFiles.map((file) => (
                    <div key={file.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm">{file.file_name}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EVIDENCE_TYPE_COLOURS[file.evidence_type] || EVIDENCE_TYPE_COLOURS.other}`}>
                              {getEvidenceTypeLabel(file.evidence_type)}
                            </span>
                          </div>
                          {(file.ai_summary || file.description) && (
                            <HoverCard openDelay={300}>
                              <HoverCardTrigger asChild>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 cursor-default">
                                  {(file.ai_summary || file.description || '').replace(/#{1,6}\s*/g, '').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')}
                                </p>
                              </HoverCardTrigger>
                              <HoverCardContent side="top" align="start" className="w-[420px] max-h-[300px] overflow-y-auto p-4 bg-popover border border-border shadow-xl">
                                <h4 className="font-semibold text-sm mb-2 text-foreground">Full Summary — {file.file_name}</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                  {(file.ai_summary || file.description || '').replace(/#{1,6}\s*/g, '').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')}
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                          {file.ai_summary && (file.evidence_type === 'audio' || file.file_type?.startsWith('audio/')) && (
                            <>
                              {(() => {
                                const badges = parseAudioReviewBadges(file.ai_summary!);
                                if (badges.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {badges.map((badge, idx) => (
                                      <span
                                        key={idx}
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getBadgeSentimentClasses(badge.sentiment)}`}
                                      >
                                        {badge.label.startsWith('Patient') && <User className="h-3 w-3" />}
                                        {badge.label.startsWith('Staff') && <Stethoscope className="h-3 w-3" />}
                                        {badge.label}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                              {(() => {
                                const transcript = audioTranscripts.find(t => t.audio_file_id === file.id);
                                if (transcript) {
                                  return (
                                    <button
                                      className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center gap-1 transition-colors"
                                      onClick={() => downloadTranscriptAsWord(
                                        transcript.transcript_text,
                                        file.file_name,
                                        transcript.transcription_confidence,
                                        transcript.audio_duration_seconds,
                                        file.ai_summary || null
                                      )}
                                    >
                                      <FileText className="h-3 w-3" />
                                      Download Full Transcript and call overview
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          )}
                          {!file.ai_summary && (file.evidence_type === 'audio' || file.file_type?.startsWith('audio/')) && audioTranscripts.some(t => t.audio_file_id === file.id) && (
                            <Button
                              size="sm"
                              variant="link"
                              className="h-auto p-0 text-xs text-primary mt-1"
                              onClick={() => generateReviewForFile(file)}
                              disabled={generatingReview === file.id}
                            >
                              <Loader2 className={`h-3 w-3 mr-1 ${generatingReview === file.id ? 'animate-spin' : 'hidden'}`} />
                              {generatingReview !== file.id && <Eye className="h-3 w-3 mr-1" />}
                              {generatingReview === file.id ? 'Generating AI Review…' : 'Generate AI Review'}
                            </Button>
                          )}
                          <div className="text-xs text-muted-foreground mt-1.5">
                            {formatFileSize(file.file_size)} • Uploaded {new Date(file.uploaded_at).toLocaleDateString('en-GB')} at {new Date(file.uploaded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {(file.evidence_type === 'audio' ||
                            file.file_type?.startsWith('audio/') ||
                            /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.file_name)) && (
                            <>
                              {(() => {
                                const transcript = audioTranscripts.find(t => t.audio_file_id === file.id);
                                if (transcript) {
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => downloadTranscriptAsWord(
                                        transcript.transcript_text,
                                        file.file_name,
                                        transcript.transcription_confidence,
                                        transcript.audio_duration_seconds,
                                        file.ai_summary || null
                                      )}
                                      title="Download transcript as Word"
                                    >
                                      <FileText className="h-4 w-4 mr-1" />
                                      Word
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => transcribeAudio(file)}
                                disabled={transcribing === file.id}
                              >
                                <Mic className="h-4 w-4 mr-1" />
                                {transcribing === file.id ? 'Transcribing…' : 'Transcribe'}
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" onClick={() => downloadFile(file)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          {!disabled && (
                            <Button size="sm" variant="outline" onClick={() => confirmDeleteFile(file)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
