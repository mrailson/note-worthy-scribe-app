import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Palette, Layout, Paintbrush, ChevronDown, ChevronRight } from 'lucide-react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StyleTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
}

export const StyleTab: React.FC<StyleTabProps> = ({ settings, onUpdate }) => {
  const [stylePresetOpen, setStylePresetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    setStylePresetOpen(false);
  };

  const handlePaletteChange = (palette: ColourPalette) => {
    onUpdate({ colourPalette: palette });
    setPaletteOpen(false);
  };

  const handleCustomColourChange = (key: keyof ColourPalette, value: string) => {
    onUpdate({
      colourPalette: {
        ...settings.colourPalette,
        [key]: value,
      }
    });
  };

  const selectedPreset = STYLE_PRESETS.find(p => p.id === settings.stylePreset);

  return (
    <div className="space-y-6">
      {/* Style Presets - Collapsible */}
      <Collapsible open={stylePresetOpen} onOpenChange={setStylePresetOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Style Preset</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedPreset?.name || 'Select'}</span>
              {stylePresetOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
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
        </CollapsibleContent>
      </Collapsible>

      {/* Colour Palette Selection - Collapsible */}
      <Collapsible open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Colour Palette</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div 
                  className="w-4 h-4 rounded-full border shadow-sm" 
                  style={{ backgroundColor: settings.colourPalette.primary }}
                />
                <div 
                  className="w-4 h-4 rounded-full border shadow-sm" 
                  style={{ backgroundColor: settings.colourPalette.secondary }}
                />
                <div 
                  className="w-4 h-4 rounded-full border shadow-sm" 
                  style={{ backgroundColor: settings.colourPalette.accent }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{settings.colourPalette.name}</span>
              {paletteOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
        
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
        </CollapsibleContent>
      </Collapsible>

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
