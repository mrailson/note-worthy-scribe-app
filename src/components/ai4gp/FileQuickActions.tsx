import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, GitCompare, ListChecks, Combine, Table } from 'lucide-react';
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

export const FileQuickActions: React.FC<FileQuickActionsProps> = ({
  uploadedFiles,
  onSelectAction,
  disabled = false,
}) => {
  const fileCount = uploadedFiles.length;
  const isAnyFileLoading = uploadedFiles.some(f => f.isLoading);

  if (fileCount === 0) return null;

  const availableActions = FILE_ACTIONS.filter(action => fileCount >= action.minFiles);

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      <span className="text-xs text-muted-foreground self-center mr-1">Quick actions:</span>
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
