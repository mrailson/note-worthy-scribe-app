import React from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { GripVertical, Mic } from 'lucide-react';
import {
  SLIDE_TYPES,
  COMPLEXITY_LEVELS,
  SLIDE_COUNT_PRESETS,
  type PresentationStudioSettings,
  type SlideTypeId,
} from '@/types/presentationStudio';

interface SlidesTabProps {
  settings: PresentationStudioSettings;
  onUpdate: (updates: Partial<PresentationStudioSettings>) => void;
  onToggleSlideType: (slideType: SlideTypeId) => void;
}

export const SlidesTab: React.FC<SlidesTabProps> = ({
  settings,
  onUpdate,
  onToggleSlideType,
}) => {
  const getSlideCountPreset = () => {
    const count = settings.slideCount;
    if (count >= 5 && count <= 6) return 'Quick (5-6)';
    if (count >= 8 && count <= 10) return 'Standard (8-10)';
    if (count >= 12 && count <= 15) return 'Comprehensive (12-15)';
    return 'Custom';
  };

  const enabledCount = settings.slideTypes.filter(st => st.enabled).length;

  return (
    <div className="space-y-6">
      {/* Slide Count */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Number of Slides</Label>
          <span className="text-sm font-medium text-primary">{settings.slideCount} slides</span>
        </div>
        
        {/* Quick Presets */}
        <div className="grid grid-cols-4 gap-2">
          {SLIDE_COUNT_PRESETS.map((preset) => (
            <Card 
              key={preset.label}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                getSlideCountPreset() === preset.label && "border-primary bg-primary/5"
              )}
              onClick={() => onUpdate({ slideCount: Math.round((preset.min + preset.max) / 2) })}
            >
              <CardContent className="p-2 text-center">
                <p className="text-xs font-medium">{preset.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Slider
          value={[settings.slideCount]}
          onValueChange={(value) => onUpdate({ slideCount: value[0] })}
          min={3}
          max={20}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>3</span>
          <span>20</span>
        </div>
      </div>

      {/* Slide Types to Include */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Slide Types to Include</Label>
          <span className="text-xs text-muted-foreground">{enabledCount} selected</span>
        </div>
        <div className="space-y-2 border rounded-lg p-3">
          {settings.slideTypes
            .sort((a, b) => a.order - b.order)
            .map((slideType) => {
              const typeInfo = SLIDE_TYPES.find(st => st.id === slideType.type);
              return (
                <div
                  key={slideType.type}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md transition-colors",
                    slideType.enabled ? "bg-primary/5" : "bg-muted/30"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Checkbox
                    id={slideType.type}
                    checked={slideType.enabled}
                    onCheckedChange={() => onToggleSlideType(slideType.type)}
                    disabled={typeInfo?.required}
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={slideType.type}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {typeInfo?.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{typeInfo?.description}</p>
                  </div>
                  {typeInfo?.required && (
                    <span className="text-xs text-muted-foreground">Required</span>
                  )}
                </div>
              );
            })}
        </div>
        <p className="text-xs text-muted-foreground">
          Select which slide types to include. Drag to reorder.
        </p>
      </div>

      {/* Complexity Level */}
      <div className="space-y-3">
        <Label>Content Complexity</Label>
        <div className="grid grid-cols-3 gap-2">
          {COMPLEXITY_LEVELS.map((level) => (
            <Card 
              key={level.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                settings.complexityLevel === level.id && "border-primary bg-primary/5"
              )}
              onClick={() => onUpdate({ complexityLevel: level.id })}
            >
              <CardContent className="p-3">
                <p className="font-medium text-sm">{level.label}</p>
                <p className="text-xs text-muted-foreground">{level.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-4">
        <Label>Additional Options</Label>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label htmlFor="speaker-notes" className="text-sm">Include Speaker Notes</Label>
            <p className="text-xs text-muted-foreground">Detailed notes for each slide</p>
          </div>
          <Switch
            id="speaker-notes"
            checked={settings.includeSpeakerNotes}
            onCheckedChange={(checked) => onUpdate({ includeSpeakerNotes: checked })}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label htmlFor="generate-images" className="text-sm">Generate AI Images</Label>
            <p className="text-xs text-muted-foreground">Add AI-generated visuals to slides</p>
          </div>
          <Switch
            id="generate-images"
            checked={settings.generateImages}
            onCheckedChange={(checked) => onUpdate({ generateImages: checked })}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="voiceover" className="text-sm">Include Voiceover</Label>
              <p className="text-xs text-muted-foreground">AI narration for each slide</p>
            </div>
          </div>
          <Switch
            id="voiceover"
            checked={settings.includeVoiceover}
            onCheckedChange={(checked) => onUpdate({ includeVoiceover: checked })}
          />
        </div>
      </div>
    </div>
  );
};
