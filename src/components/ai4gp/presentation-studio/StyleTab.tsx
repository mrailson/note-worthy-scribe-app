import React from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ColourPicker } from '../studio/ColourPicker';
import { NHS_PALETTES } from '@/utils/colourPalettes';
import {
  PRESENTATION_TEMPLATES,
  FONT_STYLES,
  type PresentationStudioSettings,
} from '@/types/presentationStudio';

interface StyleTabProps {
  settings: PresentationStudioSettings;
  onUpdate: (updates: Partial<PresentationStudioSettings>) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({ settings, onUpdate }) => {
  const getTemplatePreviewColour = (preview: string) => {
    switch (preview) {
      case 'blue': return 'bg-[#005EB8]';
      case 'white': return 'bg-white border';
      case 'dark': return 'bg-gray-800';
      case 'teal': return 'bg-[#00A499]';
      case 'warm': return 'bg-[#78BE20]';
      default: return 'bg-primary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div className="space-y-3">
        <Label>Template</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESENTATION_TEMPLATES.map((template) => (
            <Card 
              key={template.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50 overflow-hidden",
                settings.templateId === template.id && "border-primary ring-2 ring-primary/20"
              )}
              onClick={() => onUpdate({ templateId: template.id })}
            >
              <div className={cn("h-16 w-full", getTemplatePreviewColour(template.preview))} />
              <CardContent className="p-3">
                <p className="font-medium text-sm">{template.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{template.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Colour Palette */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Colour Palette</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="custom-colours" className="text-sm text-muted-foreground">
              Custom colours
            </Label>
            <Switch
              id="custom-colours"
              checked={settings.useCustomColours}
              onCheckedChange={(checked) => onUpdate({ useCustomColours: checked })}
            />
          </div>
        </div>
        
        {!settings.useCustomColours ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NHS_PALETTES.map((palette) => (
              <Card 
                key={palette.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  settings.colourPalette.id === palette.id && "border-primary ring-2 ring-primary/20"
                )}
                onClick={() => onUpdate({ colourPalette: palette })}
              >
                <CardContent className="p-2">
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="w-6 h-6 rounded" 
                      style={{ backgroundColor: palette.primary }}
                      title="Primary"
                    />
                    <div 
                      className="w-6 h-6 rounded" 
                      style={{ backgroundColor: palette.secondary }}
                      title="Secondary"
                    />
                    <div 
                      className="w-6 h-6 rounded" 
                      style={{ backgroundColor: palette.accent }}
                      title="Accent"
                    />
                  </div>
                  <p className="text-xs font-medium">{palette.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <ColourPicker
              label="Primary"
              value={settings.colourPalette.primary}
              onChange={(colour) => onUpdate({
                colourPalette: { ...settings.colourPalette, primary: colour }
              })}
            />
            <ColourPicker
              label="Secondary"
              value={settings.colourPalette.secondary}
              onChange={(colour) => onUpdate({
                colourPalette: { ...settings.colourPalette, secondary: colour }
              })}
            />
            <ColourPicker
              label="Accent"
              value={settings.colourPalette.accent}
              onChange={(colour) => onUpdate({
                colourPalette: { ...settings.colourPalette, accent: colour }
              })}
            />
            <ColourPicker
              label="Background"
              value={settings.colourPalette.background}
              onChange={(colour) => onUpdate({
                colourPalette: { ...settings.colourPalette, background: colour }
              })}
            />
          </div>
        )}
      </div>

      {/* Font Style */}
      <div className="space-y-3">
        <Label>Font Style</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FONT_STYLES.map((font) => (
            <Card 
              key={font.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                settings.fontStyle === font.id && "border-primary bg-primary/5"
              )}
              onClick={() => onUpdate({ fontStyle: font.id })}
            >
              <CardContent className="p-3 text-center">
                <p 
                  className="text-lg font-medium"
                  style={{ fontFamily: font.fontFamily }}
                >
                  Aa
                </p>
                <p className="text-xs text-muted-foreground">{font.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
