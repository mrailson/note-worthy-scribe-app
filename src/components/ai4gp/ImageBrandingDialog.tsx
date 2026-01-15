import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { PracticeContext } from '@/types/ai4gp';
import { Image, Building2, Phone, Mail, Globe, MapPin, Network, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BrandingLevel = 'none' | 'name-only' | 'name-contact' | 'full' | 'custom';

export interface CustomBrandingOptions {
  name: boolean;
  address: boolean;
  phone: boolean;
  email: boolean;
  website: boolean;
  pcn: boolean;
}

interface ImageBrandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceContext: PracticeContext | null;
  onConfirm: (brandingLevel: BrandingLevel, customBranding: CustomBrandingOptions, includeLogo: boolean) => void;
  onCancel: () => void;
  requestType: string;
  includePracticeLogo: boolean;
  onLogoToggleChange: (include: boolean) => void;
}

const DEFAULT_CUSTOM_OPTIONS: CustomBrandingOptions = {
  name: true,
  address: false,
  phone: false,
  email: false,
  website: false,
  pcn: false,
};

export const ImageBrandingDialog: React.FC<ImageBrandingDialogProps> = ({
  open,
  onOpenChange,
  practiceContext,
  onConfirm,
  onCancel,
  requestType,
  includePracticeLogo,
  onLogoToggleChange,
}) => {
  const [brandingLevel, setBrandingLevel] = useState<BrandingLevel>('name-only');
  const [customBranding, setCustomBranding] = useState<CustomBrandingOptions>(DEFAULT_CUSTOM_OPTIONS);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [logoImageError, setLogoImageError] = useState(false);

  // Reset to sensible defaults when dialog opens
  useEffect(() => {
    if (open) {
      setBrandingLevel('name-only');
      setCustomBranding(DEFAULT_CUSTOM_OPTIONS);
      setShowCustomOptions(false);
      setLogoImageError(false);
    }
  }, [open]);

  // Handle branding level change
  const handleBrandingLevelChange = (value: BrandingLevel) => {
    setBrandingLevel(value);
    setShowCustomOptions(value === 'custom');
  };

  // Toggle custom option
  const toggleCustomOption = (option: keyof CustomBrandingOptions) => {
    setCustomBranding(prev => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  // Get preview of what will be included
  const getPreviewDetails = (): string[] => {
    const details: string[] = [];
    const ctx = practiceContext;
    
    if (!ctx) return ['No practice details available'];

    switch (brandingLevel) {
      case 'none':
        return ['No practice branding will be included'];
      case 'name-only':
        if (ctx.practiceName) details.push(ctx.practiceName);
        break;
      case 'name-contact':
        if (ctx.practiceName) details.push(ctx.practiceName);
        if (ctx.practicePhone) details.push(ctx.practicePhone);
        if (ctx.practiceEmail) details.push(ctx.practiceEmail);
        break;
      case 'full':
        if (ctx.practiceName) details.push(ctx.practiceName);
        if (ctx.practiceAddress) details.push(ctx.practiceAddress);
        if (ctx.practicePhone) details.push(ctx.practicePhone);
        if (ctx.practiceEmail) details.push(ctx.practiceEmail);
        if (ctx.practiceWebsite) details.push(ctx.practiceWebsite);
        if (ctx.pcnName) details.push(`PCN: ${ctx.pcnName}`);
        break;
      case 'custom':
        if (customBranding.name && ctx.practiceName) details.push(ctx.practiceName);
        if (customBranding.address && ctx.practiceAddress) details.push(ctx.practiceAddress);
        if (customBranding.phone && ctx.practicePhone) details.push(ctx.practicePhone);
        if (customBranding.email && ctx.practiceEmail) details.push(ctx.practiceEmail);
        if (customBranding.website && ctx.practiceWebsite) details.push(ctx.practiceWebsite);
        if (customBranding.pcn && ctx.pcnName) details.push(`PCN: ${ctx.pcnName}`);
        break;
    }

    return details.length > 0 ? details : ['No details selected'];
  };

  // Check if an option is available (has value in practice context)
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

  const handleConfirm = () => {
    onConfirm(brandingLevel, customBranding, includePracticeLogo);
  };

  // Check if logo is available and valid
  const isLogoAvailable = !!practiceContext?.logoUrl && !logoImageError;

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const requestTypeLabels: Record<string, string> = {
    leaflet: 'patient leaflet',
    newsletter: 'newsletter',
    poster: 'poster',
    social: 'social media post',
    'waiting-room': 'waiting room display',
    'form-header': 'letterhead',
    campaign: 'campaign material',
    infographic: 'infographic',
    chart: 'chart',
    diagram: 'diagram',
    general: 'image',
  };

  const typeLabel = requestTypeLabels[requestType] || 'image';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Practice Branding Options
          </DialogTitle>
          <DialogDescription>
            Choose which practice details to include on your {typeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Standalone Logo Toggle Section */}
          <div className={cn(
            "rounded-lg border-2 p-4 space-y-3 transition-colors",
            isLogoAvailable 
              ? "border-primary/30 bg-primary/5" 
              : "border-dashed border-muted-foreground/30 bg-muted/30"
          )}>
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
                      ? "Leave space for your logo to be added after download" 
                      : "No logo uploaded in My Profile settings"
                    }
                  </p>
                </div>
              </div>
              <Switch
                checked={includePracticeLogo && isLogoAvailable}
                onCheckedChange={onLogoToggleChange}
                disabled={!isLogoAvailable}
              />
            </div>
            
            {/* Logo Preview when enabled and available */}
            {includePracticeLogo && isLogoAvailable && practiceContext?.logoUrl && (
              <div className="flex items-center gap-3 pt-3 border-t border-primary/20">
                <span className="text-sm text-muted-foreground">Your logo:</span>
                <div className="relative">
                  <img 
                    src={practiceContext.logoUrl} 
                    alt="Practice Logo" 
                    className="h-12 max-w-[150px] object-contain border rounded-md bg-white p-1.5 shadow-sm"
                    onError={() => setLogoImageError(true)}
                  />
                </div>
                <span className="text-xs text-muted-foreground italic">(add to image after download)</span>
              </div>
            )}
          </div>

          <Separator />

          <RadioGroup
            value={brandingLevel}
            onValueChange={(v) => handleBrandingLevelChange(v as BrandingLevel)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="none" id="none" />
              <Label htmlFor="none" className="flex-1 cursor-pointer">
                <span className="font-medium">No practice details</span>
                <p className="text-sm text-muted-foreground">Generate image without any branding</p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="name-only" id="name-only" />
              <Label htmlFor="name-only" className="flex-1 cursor-pointer">
                <span className="font-medium">Practice name only</span>
                <p className="text-sm text-muted-foreground">Just your practice/organisation name</p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="name-contact" id="name-contact" />
              <Label htmlFor="name-contact" className="flex-1 cursor-pointer">
                <span className="font-medium">Name + Contact</span>
                <p className="text-sm text-muted-foreground">Practice name, phone, and email</p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="full" id="full" />
              <Label htmlFor="full" className="flex-1 cursor-pointer">
                <span className="font-medium">All practice details</span>
                <p className="text-sm text-muted-foreground">Full branding including address, website, PCN</p>
              </Label>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div 
                className="flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleBrandingLevelChange('custom')}
              >
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex-1 cursor-pointer">
                  <span className="font-medium">Custom selection</span>
                  <p className="text-sm text-muted-foreground">Choose specific details to include</p>
                </Label>
                {brandingLevel === 'custom' && (
                  <button 
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

              {brandingLevel === 'custom' && showCustomOptions && (
                <div className="border-t bg-muted/30 p-3 space-y-2">
                  {([
                    { key: 'name', label: 'Practice Name', icon: Building2 },
                    { key: 'address', label: 'Address', icon: MapPin },
                    { key: 'phone', label: 'Phone', icon: Phone },
                    { key: 'email', label: 'Email', icon: Mail },
                    { key: 'website', label: 'Website', icon: Globe },
                    { key: 'pcn', label: 'PCN Name', icon: Network },
                  ] as const).map(({ key, label, icon: Icon }) => {
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
                          checked={customBranding[key]}
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

          <Separator />

          {/* Preview */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium mb-2">Will be included:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {getPreviewDetails().map((detail, idx) => (
                <li key={idx} className="truncate">• {detail}</li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Generate Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
