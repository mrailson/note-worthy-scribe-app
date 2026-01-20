import React, { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import {
  LOGO_PLACEMENTS,
  type PresentationStudioSettings,
} from '@/types/presentationStudio';

// Branding levels
const BRANDING_LEVELS = [
  { id: 'none', label: 'None', description: 'No branding' },
  { id: 'logo-only', label: 'Logo Only', description: 'Just the logo' },
  { id: 'name-only', label: 'Name Only', description: 'Practice name' },
  { id: 'name-contact', label: 'Name + Contact', description: 'Name, phone, email' },
  { id: 'full', label: 'Full Details', description: 'All practice info' },
] as const;

interface BrandingTabProps {
  settings: PresentationStudioSettings;
  onUpdate: (updates: Partial<PresentationStudioSettings>) => void;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({ settings, onUpdate }) => {
  const { practiceContext } = usePracticeContext();

  const onLogoDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUpdate({ logoImage: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onUpdate]);

  const { getRootProps: getLogoProps, getInputProps: getLogoInputProps, isDragActive: isLogoDragActive } = useDropzone({
    onDrop: onLogoDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
    },
    maxSize: 2 * 1024 * 1024, // 2MB
    multiple: false,
  });

  return (
    <div className="space-y-6">
      {/* Include Branding Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label className="text-base">Include Practice Branding</Label>
          <p className="text-sm text-muted-foreground">
            Add your practice details to the presentation
          </p>
        </div>
        <Switch
          checked={settings.includeBranding}
          onCheckedChange={(checked) => onUpdate({ includeBranding: checked })}
        />
      </div>

      {settings.includeBranding && (
        <>
          {/* Custom Practice Name */}
          <div className="space-y-2">
            <Label htmlFor="custom-practice-name">Custom Practice Name</Label>
            <Input
              id="custom-practice-name"
              placeholder={practiceContext?.practiceName || "Enter practice name"}
              value={settings.customPracticeName || ''}
              onChange={(e) => onUpdate({ customPracticeName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use your default practice name
              {practiceContext?.practiceName && ` (${practiceContext.practiceName})`}
            </p>
          </div>

          {/* Branding Level */}
          <div className="space-y-3">
            <Label>Branding Level</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BRANDING_LEVELS.map((level) => (
                <Card 
                  key={level.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    settings.brandingLevel === level.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => onUpdate({ brandingLevel: level.id as any })}
                >
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-3">
            <Label>Practice Logo</Label>
            {settings.logoImage ? (
              <div className="relative w-fit">
                <img 
                  src={settings.logoImage} 
                  alt="Logo preview" 
                  className="max-h-24 max-w-48 object-contain border rounded-lg p-2"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => onUpdate({ logoImage: null })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                {...getLogoProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isLogoDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getLogoInputProps()} />
                <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop logo here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG or SVG (max 2MB)
                </p>
              </div>
            )}
          </div>

          {/* Logo Placement */}
          <div className="space-y-3">
            <Label>Logo Placement</Label>
            <div className="grid grid-cols-3 gap-2">
              {LOGO_PLACEMENTS.map((placement) => (
                <Card 
                  key={placement.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    settings.logoPlacement === placement.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => onUpdate({ logoPlacement: placement.id })}
                >
                  <CardContent className="p-2 text-center">
                    <p className="text-sm">{placement.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Footer Options */}
          <div className="space-y-4">
            <Label>Footer Options</Label>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="footer-date" className="text-sm">Include date</Label>
              <Switch
                id="footer-date"
                checked={settings.includeFooterDate}
                onCheckedChange={(checked) => onUpdate({ includeFooterDate: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="page-numbers" className="text-sm">Include page numbers</Label>
              <Switch
                id="page-numbers"
                checked={settings.includePageNumbers}
                onCheckedChange={(checked) => onUpdate({ includePageNumbers: checked })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="custom-footer" className="text-sm">Custom footer text</Label>
              <Input
                id="custom-footer"
                placeholder="e.g., Confidential - For internal use only"
                value={settings.customFooterText}
                onChange={(e) => onUpdate({ customFooterText: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
