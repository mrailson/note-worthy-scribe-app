import React, { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, X, Image as ImageIcon, History, Pencil, Copy } from 'lucide-react';
import { REFERENCE_MODES } from '@/utils/colourPalettes';
import type { ImageStudioSettings, ReferenceImage } from '@/types/imageStudio';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';

interface ReferenceTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
  onAddReference: (image: ReferenceImage) => void;
  onRemoveReference: (id: string) => void;
  onLoadPrevious: () => void;
  hasPreviousResult: boolean;
}

export const ReferenceTab: React.FC<ReferenceTabProps> = ({ 
  settings, 
  onUpdate,
  onAddReference,
  onRemoveReference,
  onLoadPrevious,
  hasPreviousResult
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        onAddReference({
          id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          content: base64,
          type: file.type,
          mode: settings.referenceMode,
        });
      };
      reader.readAsDataURL(file);
    });
  }, [onAddReference, settings.referenceMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 3,
  });

  const hasReferenceImages = settings.referenceImages.length > 0;
  const isEditMode = hasReferenceImages && (settings.referenceMode === 'edit-source' || settings.referenceMode === 'update-previous');

  return (
    <div className="space-y-6">
      {/* PROMINENT INSTRUCTIONS - Show at top when editing */}
      {hasReferenceImages && (
        <Card className={cn(
          "border-2 transition-colors",
          isEditMode ? "border-primary bg-primary/5" : "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
        )}>
          <CardContent className="p-4 space-y-3">
            <Label htmlFor="refInstructions" className="flex items-center gap-2 text-base font-semibold">
              <Pencil className="h-5 w-5" />
              {isEditMode ? "What changes do you want to make?" : "Style instructions (optional)"}
            </Label>
            <Textarea
              id="refInstructions"
              placeholder={isEditMode 
                ? "e.g., 'Add the practice phone number', 'Change background to blue', 'Make it landscape format'..."
                : "e.g., 'Use similar colour scheme', 'Match the layout style'..."
              }
              value={settings.referenceInstructions}
              onChange={(e) => onUpdate({ referenceInstructions: e.target.value })}
              className="min-h-[100px] resize-none text-base"
              autoFocus={isEditMode}
            />
            {isEditMode && (
              <p className="text-xs text-muted-foreground">
                💡 Tip: Be specific about what you want changed. The AI will preserve everything else.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Uploaded References - Show inline when images exist */}
      {hasReferenceImages && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Reference Image{settings.referenceImages.length > 1 ? 's' : ''} ({settings.referenceImages.length})
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {settings.referenceImages.map((img) => (
              <Card key={img.id} className="relative overflow-hidden">
                <CardContent className="p-2">
                  <img 
                    src={img.content} 
                    alt={img.name}
                    className="w-full h-24 object-cover rounded"
                  />
                  <p className="text-xs truncate mt-1">{img.name}</p>
                  <button
                    type="button"
                    onClick={() => onRemoveReference(img.id)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reference Mode */}
      <div className="space-y-3">
        <Label>How should the reference be used?</Label>
        <RadioGroup
          value={settings.referenceMode}
          onValueChange={(v) => onUpdate({ referenceMode: v as ImageStudioSettings['referenceMode'] })}
          className="space-y-2"
        >
          {REFERENCE_MODES.map((mode) => (
            <div key={mode.id} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value={mode.id} id={`mode-${mode.id}`} />
              <Label htmlFor={`mode-${mode.id}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{mode.label}</span>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Upload Zone */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {hasReferenceImages ? 'Add More Images' : 'Reference Images'}
        </Label>
        
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? "Drop images here..." : "Drag & drop images, or click to select"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
        </div>

        {/* Load Previous Result Button */}
        {hasPreviousResult && (
          <Button variant="outline" className="w-full" onClick={onLoadPrevious}>
            <History className="h-4 w-4 mr-2" />
            Load Previous Result for Editing
          </Button>
        )}
      </div>
    </div>
  );
};
