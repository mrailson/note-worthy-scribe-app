import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Type, Zap, Clock } from "lucide-react";
import { SlideAnimation } from "@/types/presentation";

interface GlobalDesignControlsProps {
  titleFontSize: number;
  contentFontSize: number;
  globalAnimation: SlideAnimation;
  onTitleFontSizeChange: (size: number) => void;
  onContentFontSizeChange: (size: number) => void;
  onGlobalAnimationChange: (animation: SlideAnimation) => void;
}

const animationTypes = [
  { value: 'none', label: 'No Animation', description: 'All elements appear instantly' },
  { value: 'fade', label: 'Fade In', description: 'Elements fade in on click' },
  { value: 'slide', label: 'Slide In', description: 'Elements slide in from left on click' },
  { value: 'zoom', label: 'Zoom In', description: 'Elements zoom in from center on click' },
  { value: 'appear', label: 'Appear', description: 'Elements appear with scaling on click' }
];

export const GlobalDesignControls = ({
  titleFontSize,
  contentFontSize,
  globalAnimation,
  onTitleFontSizeChange,
  onContentFontSizeChange,
  onGlobalAnimationChange
}: GlobalDesignControlsProps) => {

  const updateGlobalAnimation = (updates: Partial<SlideAnimation>) => {
    const newAnimation = { ...globalAnimation, ...updates };
    onGlobalAnimationChange(newAnimation);
  };

  return (
    <div className="space-y-6">
      {/* Font Size Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Type className="w-4 h-4" />
            Font Sizes
          </CardTitle>
          <CardDescription className="text-xs">
            Adjust text sizes for titles and content across all slides
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Title Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Title Font Size</Label>
              <span className="text-xs text-muted-foreground">{titleFontSize}pt</span>
            </div>
            <Slider
              value={[titleFontSize]}
              onValueChange={([value]) => onTitleFontSizeChange(value)}
              min={20}
              max={48}
              step={2}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>

          <Separator />

          {/* Content Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Content Font Size</Label>
              <span className="text-xs text-muted-foreground">{contentFontSize}pt</span>
            </div>
            <Slider
              value={[contentFontSize]}
              onValueChange={([value]) => onContentFontSizeChange(value)}
              min={10}
              max={24}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Animation Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Global Animation
          </CardTitle>
          <CardDescription className="text-xs">
            Apply animations to all content slides (excludes title slide)
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Animation Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Animation Style</Label>
            <Select
              value={globalAnimation.type}
              onValueChange={(value) => updateGlobalAnimation({ type: value as SlideAnimation['type'] })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {animationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium text-xs">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {globalAnimation.type !== 'none' && (
            <>
              <Separator />
              
              {/* Animation Duration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Animation Speed
                  </Label>
                  <span className="text-xs text-muted-foreground">{globalAnimation.duration}ms</span>
                </div>
                <Slider
                  value={[globalAnimation.duration]}
                  onValueChange={([value]) => updateGlobalAnimation({ duration: value })}
                  min={200}
                  max={1000}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fast</span>
                  <span>Slow</span>
                </div>
              </div>

              {/* Click to Advance */}
              <div className="flex items-center justify-between">
                <Label htmlFor="click-advance" className="text-xs font-medium">
                  Click to Advance
                </Label>
                <Switch
                  id="click-advance"
                  checked={globalAnimation.elementOrder}
                  onCheckedChange={(checked) => updateGlobalAnimation({ elementOrder: checked })}
                />
              </div>
              
              <div className="text-xs text-muted-foreground">
                {globalAnimation.elementOrder 
                  ? "Each bullet point appears on click" 
                  : "All bullet points appear together"
                }
              </div>

              <Separator />
              
              {/* Preview info */}
              <div className="bg-muted/30 p-2 rounded text-xs">
                <div className="font-medium mb-1">Presentation Flow:</div>
                <div className="text-muted-foreground">
                  Title slide appears normally, then each content slide will{' '}
                  {globalAnimation.type === 'fade' && 'fade in bullet points'}
                  {globalAnimation.type === 'slide' && 'slide in bullet points from left'}
                  {globalAnimation.type === 'zoom' && 'zoom in bullet points from center'}
                  {globalAnimation.type === 'appear' && 'appear bullet points with scaling'}
                  {globalAnimation.elementOrder && ' one by one on click'}
                  {!globalAnimation.elementOrder && ' all at once'}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};