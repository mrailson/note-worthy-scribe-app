import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlayCircle, Clock, Layers } from "lucide-react";
import { SlideAnimation } from "@/types/presentation";

interface AnimationPickerProps {
  slideIndex: number;
  currentAnimation?: SlideAnimation;
  onAnimationChange: (slideIndex: number, animation: SlideAnimation) => void;
}

const animationTypes = [
  { value: 'none', label: 'No Animation', description: 'Elements appear instantly' },
  { value: 'fade', label: 'Fade In', description: 'Elements fade in smoothly' },
  { value: 'slide', label: 'Slide In', description: 'Elements slide in from left' },
  { value: 'zoom', label: 'Zoom In', description: 'Elements zoom in from center' },
  { value: 'appear', label: 'Appear', description: 'Elements appear with subtle scale' }
];

export const AnimationPicker = ({ slideIndex, currentAnimation, onAnimationChange }: AnimationPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const animation: SlideAnimation = currentAnimation || {
    type: 'none',
    duration: 500,
    delay: 200,
    elementOrder: true
  };

  const updateAnimation = (updates: Partial<SlideAnimation>) => {
    const newAnimation = { ...animation, ...updates };
    onAnimationChange(slideIndex, newAnimation);
  };

  const selectedAnimationType = animationTypes.find(type => type.value === animation.type);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 px-2 text-xs hover-scale"
        >
          <PlayCircle className="w-3 h-3 mr-1" />
          {selectedAnimationType?.label || 'Animation'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PlayCircle className="w-4 h-4" />
              Slide Animation
            </CardTitle>
            <CardDescription className="text-xs">
              Configure how elements appear on slide {slideIndex + 1}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Animation Type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Animation Type</Label>
              <Select
                value={animation.type}
                onValueChange={(value) => updateAnimation({ type: value as SlideAnimation['type'] })}
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

            {animation.type !== 'none' && (
              <>
                <Separator />
                
                {/* Duration */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Duration
                    </Label>
                    <span className="text-xs text-muted-foreground">{animation.duration}ms</span>
                  </div>
                  <Slider
                    value={[animation.duration]}
                    onValueChange={([value]) => updateAnimation({ duration: value })}
                    min={100}
                    max={2000}
                    step={100}
                    className="w-full"
                  />
                </div>

                {/* Delay */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Delay Between Elements</Label>
                    <span className="text-xs text-muted-foreground">{animation.delay}ms</span>
                  </div>
                  <Slider
                    value={[animation.delay]}
                    onValueChange={([value]) => updateAnimation({ delay: value })}
                    min={0}
                    max={1000}
                    step={50}
                    className="w-full"
                  />
                </div>

                {/* Element Order */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="element-order" className="text-xs font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Animate in Order
                  </Label>
                  <Switch
                    id="element-order"
                    checked={animation.elementOrder}
                    onCheckedChange={(checked) => updateAnimation({ elementOrder: checked })}
                  />
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {animation.elementOrder 
                    ? "Elements appear one after another" 
                    : "All elements appear simultaneously"
                  }
                </div>

                <Separator />
                
                {/* Preview info */}
                <div className="bg-muted/30 p-2 rounded text-xs">
                  <div className="font-medium mb-1">Preview:</div>
                  <div className="text-muted-foreground">
                    {animation.type === 'fade' && 'Elements will fade in smoothly'}
                    {animation.type === 'slide' && 'Elements will slide in from the left'}
                    {animation.type === 'zoom' && 'Elements will zoom in from center'}
                    {animation.type === 'appear' && 'Elements will appear with subtle scaling'}
                    {animation.elementOrder && `, each waiting ${animation.delay}ms`}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};