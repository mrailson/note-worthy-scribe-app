import React from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Palette, Layout, Paintbrush } from 'lucide-react';
import { 
  STYLE_PRESETS, 
  NHS_PALETTES, 
  LAYOUT_OPTIONS,
  CUSTOM_PALETTE_DEFAULTS 
} from '@/utils/colourPalettes';
import type { ImageStudioSettings } from '@/types/imageStudio';
import type { ColourPalette } from '@/utils/colourPalettes';
import { ColourPicker } from './ColourPicker';
import { cn } from '@/lib/utils';

interface StyleTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({ settings, onUpdate }) => {
  const handleStylePresetChange = (presetId: string) => {
    const preset = STYLE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    if (preset.defaultPalette) {
      const palette = NHS_PALETTES.find(p => p.id === preset.defaultPalette);
      if (palette) {
        onUpdate({ 
          stylePreset: presetId as ImageStudioSettings['stylePreset'],
          colourPalette: palette 
        });
      }
    } else {
      onUpdate({ 
        stylePreset: presetId as ImageStudioSettings['stylePreset'],
        colourPalette: CUSTOM_PALETTE_DEFAULTS
      });
    }
  };

  const handlePaletteChange = (palette: ColourPalette) => {
    onUpdate({ colourPalette: palette });
  };

  const handleCustomColourChange = (key: keyof ColourPalette, value: string) => {
    onUpdate({
      colourPalette: {
        ...settings.colourPalette,
        [key]: value,
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Style Presets */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4" />
          Style Preset
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {STYLE_PRESETS.map((preset) => (
            <Card 
              key={preset.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                settings.stylePreset === preset.id && "border-primary bg-primary/5 ring-1 ring-primary"
              )}
              onClick={() => handleStylePresetChange(preset.id)}
            >
              <CardContent className="p-4">
                <p className="font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Colour Palette Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Colour Palette
        </Label>
        
        {settings.stylePreset !== 'custom' ? (
          <div className="grid grid-cols-2 gap-3">
            {NHS_PALETTES.map((palette) => (
              <Card 
                key={palette.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  settings.colourPalette.id === palette.id && "border-primary ring-1 ring-primary"
                )}
                onClick={() => handlePaletteChange(palette)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-5 h-5 rounded-full border shadow-sm" 
                      style={{ backgroundColor: palette.primary }}
                    />
                    <div 
                      className="w-5 h-5 rounded-full border shadow-sm" 
                      style={{ backgroundColor: palette.secondary }}
                    />
                    <div 
                      className="w-5 h-5 rounded-full border shadow-sm" 
                      style={{ backgroundColor: palette.accent }}
                    />
                  </div>
                  <p className="font-medium text-sm">{palette.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Choose your custom colours:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ColourPicker
                label="Primary"
                value={settings.colourPalette.primary}
                onChange={(v) => handleCustomColourChange('primary', v)}
              />
              <ColourPicker
                label="Secondary"
                value={settings.colourPalette.secondary}
                onChange={(v) => handleCustomColourChange('secondary', v)}
              />
              <ColourPicker
                label="Accent"
                value={settings.colourPalette.accent}
                onChange={(v) => handleCustomColourChange('accent', v)}
              />
              <ColourPicker
                label="Background"
                value={settings.colourPalette.background}
                onChange={(v) => handleCustomColourChange('background', v)}
              />
              <ColourPicker
                label="Text"
                value={settings.colourPalette.text}
                onChange={(v) => handleCustomColourChange('text', v)}
              />
            </div>
          </div>
        )}

        {/* Current palette preview */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">Current:</span>
          <div className="flex items-center gap-1">
            <div 
              className="w-6 h-6 rounded border shadow-sm" 
              style={{ backgroundColor: settings.colourPalette.primary }}
              title="Primary"
            />
            <div 
              className="w-6 h-6 rounded border shadow-sm" 
              style={{ backgroundColor: settings.colourPalette.secondary }}
              title="Secondary"
            />
            <div 
              className="w-6 h-6 rounded border shadow-sm" 
              style={{ backgroundColor: settings.colourPalette.accent }}
              title="Accent"
            />
            <div 
              className="w-6 h-6 rounded border shadow-sm" 
              style={{ backgroundColor: settings.colourPalette.background }}
              title="Background"
            />
          </div>
          <span className="text-sm font-medium ml-2">{settings.colourPalette.name}</span>
        </div>
      </div>

      {/* Layout Preference */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Layout className="h-4 w-4" />
          Layout Preference
        </Label>
        <RadioGroup 
          value={settings.layoutPreference}
          onValueChange={(v) => onUpdate({ layoutPreference: v as ImageStudioSettings['layoutPreference'] })}
          className="flex gap-4"
        >
          {LAYOUT_OPTIONS.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <RadioGroupItem value={option.id} id={`layout-${option.id}`} />
              <Label htmlFor={`layout-${option.id}`} className="cursor-pointer">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground ml-1">({option.ratio})</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
};
