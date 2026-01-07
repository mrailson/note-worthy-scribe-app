import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, GitCompare, ListChecks, Combine, Table, Mic, FileAudio, ClipboardList } from 'lucide-react';
import { UploadedFile } from '@/types/ai4gp';

interface FileQuickActionsProps {
  uploadedFiles: UploadedFile[];
  onSelectAction: (prompt: string) => void;
  disabled?: boolean;
}

const FILE_ACTIONS = [
  {
    id: 'summarise',
    label: 'Summarise All',
    icon: FileText,
    prompt: 'Please summarise all the uploaded documents, highlighting the key points from each',
    minFiles: 1,
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: GitCompare,
    prompt: 'Please compare these documents and highlight the key differences between them',
    minFiles: 2,
  },
  {
    id: 'keypoints',
    label: 'Key Points',
    icon: ListChecks,
    prompt: 'Extract the key points and action items from these documents as bullet points',
    minFiles: 1,
  },
  {
    id: 'merge',
    label: 'Merge & Consolidate',
    icon: Combine,
    prompt: 'Please merge and consolidate these documents into a single comprehensive document',
    minFiles: 2,
  },
  {
    id: 'table',
    label: 'Create Table',
    icon: Table,
    prompt: 'Create a table summarising the key information from each document',
    minFiles: 1,
  },
];

const AUDIO_ACTIONS = [
  {
    id: 'transcribe',
    label: 'Transcribe',
    icon: Mic,
    prompt: 'Please transcribe this audio file and provide a clean, formatted transcript with proper punctuation and paragraphs',
    minFiles: 1,
  },
  {
    id: 'audio-report',
    label: 'Audio Report',
    icon: FileAudio,
    prompt: 'Create a detailed report on this audio including: any dates/times mentioned, estimated duration, full transcription, key topics discussed, participants (if identifiable), any action items mentioned, and a brief summary',
    minFiles: 1,
  },
  {
    id: 'meeting-minutes',
    label: 'Meeting Minutes',
    icon: ClipboardList,
    prompt: 'Convert this audio into formal meeting minutes with: attendees (if mentioned), date/time, agenda items discussed, key decisions made, action points with owners, and next steps',
    minFiles: 1,
  },
  {
    id: 'action-items',
    label: 'Action Items',
    icon: ListChecks,
    prompt: 'Extract all action items, tasks, follow-ups, and commitments mentioned in this audio recording. List each with the responsible person if mentioned',
    minFiles: 1,
  },
  {
    id: 'summarise-audio',
    label: 'Summarise',
    icon: FileText,
    prompt: 'Provide a concise summary of this audio recording, highlighting the main points, key decisions, and any important details',
    minFiles: 1,
  },
  {
    id: 'compare-audio',
    label: 'Compare Recordings',
    icon: GitCompare,
    prompt: 'Compare these audio recordings and highlight any differences, contradictions, common themes, or progression of topics between them',
    minFiles: 2,
  },
];

// Helper to check if a file is an audio file
const isAudioFile = (file: UploadedFile) => {
  return file.type.startsWith('audio/') || 
    ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'].some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
};

export const FileQuickActions: React.FC<FileQuickActionsProps> = ({
  uploadedFiles,
  onSelectAction,
  disabled = false,
}) => {
  const fileCount = uploadedFiles.length;
  const isAnyFileLoading = uploadedFiles.some(f => f.isLoading);

  if (fileCount === 0) return null;

  // Check if ALL files are audio files
  const allFilesAreAudio = uploadedFiles.every(isAudioFile);
  
  // Select appropriate actions based on file types
  const actionsToShow = allFilesAreAudio ? AUDIO_ACTIONS : FILE_ACTIONS;
  const availableActions = actionsToShow.filter(action => fileCount >= action.minFiles);

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      <span className="text-xs text-muted-foreground self-center mr-1">
        {allFilesAreAudio ? 'Audio actions:' : 'Quick actions:'}
      </span>
      {availableActions.map(action => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            onClick={() => onSelectAction(action.prompt)}
            disabled={disabled || isAnyFileLoading}
            className="h-7 px-2.5 text-xs gap-1.5 bg-background hover:bg-accent"
          >
            <Icon className="w-3.5 h-3.5" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
};
