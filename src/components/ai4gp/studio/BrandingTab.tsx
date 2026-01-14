import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Network, 
  ImageIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { LOGO_PLACEMENTS } from '@/utils/colourPalettes';
import type { ImageStudioSettings } from '@/types/imageStudio';
import type { BrandingLevel, CustomBrandingOptions } from '@/components/ai4gp/ImageBrandingDialog';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { cn } from '@/lib/utils';

interface BrandingTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({ settings, onUpdate }) => {
  const { practiceContext } = usePracticeContext();
  const [showCustomOptions, setShowCustomOptions] = React.useState(settings.brandingLevel === 'custom');
  const [logoError, setLogoError] = React.useState(false);
  const [brandingOpen, setBrandingOpen] = React.useState(false);

  const isLogoAvailable = !!practiceContext?.logoUrl && !logoError;

  const handleBrandingLevelChange = (value: BrandingLevel) => {
    onUpdate({ brandingLevel: value });
    setShowCustomOptions(value === 'custom');
  };

  const toggleCustomOption = (option: keyof CustomBrandingOptions) => {
    onUpdate({
      customBranding: {
        ...settings.customBranding,
        [option]: !settings.customBranding[option],
      }
    });
  };

  const isOptionAvailable = (option: keyof CustomBrandingOptions): boolean => {
    if (!practiceContext) return false;
    switch (option) {
      case 'name': return !!practiceContext.practiceName;
      case 'address': return !!practiceContext.practiceAddress;
      case 'phone': return !!practiceContext.practicePhone;
      case 'email': return !!practiceContext.practiceEmail;
      case 'website': return !!practiceContext.practiceWebsite;
      case 'pcn': return !!practiceContext.pcnName;
      default: return false;
    }
  };

  const customOptions = [
    { key: 'name' as const, label: 'Practice Name', icon: Building2 },
    { key: 'address' as const, label: 'Address', icon: MapPin },
    { key: 'phone' as const, label: 'Phone', icon: Phone },
    { key: 'email' as const, label: 'Email', icon: Mail },
    { key: 'website' as const, label: 'Website', icon: Globe },
    { key: 'pcn' as const, label: 'PCN Name', icon: Network },
  ];

  return (
    <div className="space-y-6">
      {/* Logo Section */}
      <Card className={cn(
        "transition-colors",
        isLogoAvailable 
          ? "border-primary/30 bg-primary/5" 
          : "border-dashed border-muted-foreground/30 bg-muted/30"
      )}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon className={cn(
                "h-5 w-5",
                isLogoAvailable ? "text-primary" : "text-muted-foreground"
              )} />
              <div>
                <p className="font-medium">Reserve Logo Space</p>
                <p className="text-sm text-muted-foreground">
                  {isLogoAvailable 
                    ? "Leave space for your logo to be added" 
                    : "No logo uploaded in My Profile settings"
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={settings.includeLogo && isLogoAvailable}
              onCheckedChange={(checked) => onUpdate({ includeLogo: checked })}
              disabled={!isLogoAvailable}
            />
          </div>
          
          {settings.includeLogo && isLogoAvailable && practiceContext?.logoUrl && (
            <div className="flex items-center gap-3 pt-3 border-t border-primary/20">
              <span className="text-sm text-muted-foreground">Your logo:</span>
              <img 
                src={practiceContext.logoUrl} 
                alt="Practice Logo" 
                className="h-12 max-w-[150px] object-contain border rounded-md bg-white p-1.5 shadow-sm"
                onError={() => setLogoError(true)}
              />
            </div>
          )}

          {/* Logo Placement */}
          {settings.includeLogo && isLogoAvailable && (
            <div className="pt-3 border-t border-primary/20">
              <Label className="text-sm mb-2 block">Logo Placement</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOGO_PLACEMENTS.map((placement) => (
                  <button
                    key={placement.id}
                    type="button"
                    onClick={() => onUpdate({ logoPlacement: placement.id })}
                    className={cn(
                      "p-2 text-sm border rounded-md transition-all",
                      settings.logoPlacement === placement.id 
                        ? "border-primary bg-primary/10 font-medium" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    {placement.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branding Level - Collapsible */}
      <Collapsible open={brandingOpen} onOpenChange={setBrandingOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">Practice Details to Include</span>
              <Badge variant="secondary" className="ml-2">
                {settings.brandingLevel === 'none' ? 'None' :
                 settings.brandingLevel === 'name-only' ? 'Name only' :
                 settings.brandingLevel === 'name-contact' ? 'Name + Contact' :
                 settings.brandingLevel === 'full' ? 'Full details' : 'Custom'}
              </Badge>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              brandingOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <RadioGroup
            value={settings.brandingLevel}
            onValueChange={(v) => handleBrandingLevelChange(v as BrandingLevel)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="none" id="brand-none" />
              <Label htmlFor="brand-none" className="flex-1 cursor-pointer">
                <span className="font-medium">No practice details</span>
                <p className="text-sm text-muted-foreground">Generate without text branding</p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="name-only" id="brand-name" />
              <Label htmlFor="brand-name" className="flex-1 cursor-pointer">
                <span className="font-medium">Practice name only</span>
                <p className="text-sm text-muted-foreground">Just your practice/organisation name</p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="name-contact" id="brand-contact" />
              <Label htmlFor="brand-contact" className="flex-1 cursor-pointer">
                <span className="font-medium">Name + Contact</span>
                <p className="text-sm text-muted-foreground">Practice name, phone, and email</p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="full" id="brand-full" />
              <Label htmlFor="brand-full" className="flex-1 cursor-pointer">
                <span className="font-medium">All practice details</span>
                <p className="text-sm text-muted-foreground">Full branding including address, website, PCN</p>
              </Label>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div 
                className="flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleBrandingLevelChange('custom')}
              >
                <RadioGroupItem value="custom" id="brand-custom" />
                <Label htmlFor="brand-custom" className="flex-1 cursor-pointer">
                  <span className="font-medium">Custom selection</span>
                  <p className="text-sm text-muted-foreground">Choose specific details</p>
                </Label>
                {settings.brandingLevel === 'custom' && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomOptions(!showCustomOptions);
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {showCustomOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {settings.brandingLevel === 'custom' && showCustomOptions && (
                <div className="border-t bg-muted/30 p-3 space-y-2">
                  {customOptions.map(({ key, label, icon: Icon }) => {
                    const available = isOptionAvailable(key);
                    return (
                      <div 
                        key={key}
                        className={cn(
                          "flex items-center space-x-2 py-1",
                          !available && "opacity-50"
                        )}
                      >
                        <Checkbox
                          id={`custom-${key}`}
                          checked={settings.customBranding[key]}
                          disabled={!available}
                          onCheckedChange={() => toggleCustomOption(key)}
                        />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Label 
                          htmlFor={`custom-${key}`} 
                          className={cn("cursor-pointer", !available && "cursor-not-allowed")}
                        >
                          {label}
                          {!available && <span className="text-xs text-muted-foreground ml-1">(not set)</span>}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
