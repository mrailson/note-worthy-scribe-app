import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronUp, 
  ChevronDown, 
  Pencil, 
  Trash2,
  Loader2,
  Check
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SectionRichTextEditor from './SectionRichTextEditor';

export interface Section {
  id: string;
  heading: string;
  content: string;
  originalIndex: number;
}

interface EditableSectionProps {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  viewMode: 'plain' | 'formatted';
  fontSize: number;
  formatContent: (text: string) => string;
  onContentChange: (sectionId: string, newContent: string) => void;
  onDelete: (sectionId: string) => void;
  onMoveUp: (sectionId: string) => void;
  onMoveDown: (sectionId: string) => void;
  isSaving: boolean;
  onSave: () => void;
}

const EditableSection: React.FC<EditableSectionProps> = ({
  section,
  isFirst,
  isLast,
  viewMode,
  fontSize,
  formatContent,
  onContentChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isSaving,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleBlur = (newContent: string) => {
    onContentChange(section.id, newContent);
    setIsEditing(false);
    onSave();
    
    // Show saved indicator briefly
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDelete = () => {
    setShowDeleteDialog(false);
    onDelete(section.id);
  };

  // Format the section content for display
  const formattedContent = viewMode === 'formatted' 
    ? formatContent(section.content)
    : section.content;

  return (
    <>
      <div 
        className="group relative rounded-lg border bg-card transition-all hover:border-primary/30 hover:shadow-sm"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Section Header with Controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            {section.heading}
            {isEditing && (
              <span className="text-xs font-normal text-muted-foreground">(editing...)</span>
            )}
            {justSaved && !isEditing && (
              <span className="text-xs font-normal text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
            {isSaving && !isEditing && (
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
          </h3>
          
          {/* Controls - visible on hover */}
          <div 
            className={`flex items-center gap-1 transition-opacity ${
              isHovered || isEditing ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Move Up */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onMoveUp(section.id)}
              disabled={isFirst || isEditing}
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            
            {/* Move Down */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onMoveDown(section.id)}
              disabled={isLast || isEditing}
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            
            {/* Edit */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? "Cancel edit" : "Edit section"}
            >
              <Pencil className={`h-4 w-4 ${isEditing ? 'text-primary' : ''}`} />
            </Button>
            
            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isEditing}
              title="Delete section"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Section Content */}
        <div className="p-4">
          {isEditing ? (
            <SectionRichTextEditor
              content={section.content}
              onBlur={handleBlur}
              isSaving={isSaving}
            />
          ) : viewMode === 'plain' ? (
            <pre 
              className="whitespace-pre-wrap font-sans text-foreground leading-relaxed"
              style={{ fontSize: `${fontSize}px` }}
            >
              {section.content}
            </pre>
          ) : (
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              style={{ fontSize: `${fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{section.heading}" section? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditableSection;
