import React, { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ChevronUp,
  Upload,
  X
} from 'lucide-react';
import { LOGO_PLACEMENTS } from '@/utils/colourPalettes';
import type { ImageStudioSettings } from '@/types/imageStudio';
import type { BrandingLevel, CustomBrandingOptions } from '@/components/ai4gp/ImageBrandingDialog';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BrandingTabProps {
  settings: ImageStudioSettings;
  onUpdate: (updates: Partial<ImageStudioSettings>) => void;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({ settings, onUpdate }) => {
  const { practiceContext } = usePracticeContext();
  const [showCustomOptions, setShowCustomOptions] = React.useState(settings.brandingLevel === 'custom');
  const [logoError, setLogoError] = React.useState(false);
  const [brandingOpen, setBrandingOpen] = React.useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const profileLogoUrl = practiceContext?.logoUrl;
  const hasProfileLogo = !!profileLogoUrl && !logoError;
  const hasCustomLogo = !!settings.customLogoData;
  const hasAnyLogo = hasProfileLogo || hasCustomLogo;

  const handleBrandingLevelChange = (value: BrandingLevel) => {
    if (value === 'custom') {
      const anySelected = Object.values(settings.customBranding).some(Boolean);
      const nextCustomBranding = anySelected
        ? settings.customBranding
        : { ...settings.customBranding, name: true };

      onUpdate({ brandingLevel: value, customBranding: nextCustomBranding });
    } else {
      onUpdate({ brandingLevel: value });
    }
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
    if (option === 'name') {
      return Boolean((settings.customPracticeName || '').trim() || practiceContext?.practiceName);
    }

    if (!practiceContext) return false;
    switch (option) {
      case 'address': return !!practiceContext.practiceAddress;
      case 'phone': return !!practiceContext.practicePhone;
      case 'email': return !!practiceContext.practiceEmail;
      case 'website': return !!practiceContext.practiceWebsite;
      case 'pcn': return !!practiceContext.pcnName;
      default: return false;
    }
  };

  const handleLogoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUpdate({ 
          customLogoData: dataUrl,
          logoSource: 'custom',
          includeLogo: true
        });
        setIsUploadingLogo(false);
        toast.success('Logo uploaded successfully');
      };
      reader.onerror = () => {
        toast.error('Failed to read logo file');
        setIsUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error('Failed to upload logo');
      setIsUploadingLogo(false);
    }

    // Reset the input
    event.target.value = '';
  }, [onUpdate]);

  const handleRemoveCustomLogo = useCallback(() => {
    onUpdate({ 
      customLogoData: null,
      logoSource: hasProfileLogo ? 'profile' : 'custom'
    });
  }, [onUpdate, hasProfileLogo]);

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
      {/* Logo Integration Section */}
      <Card className={cn(
        "transition-colors",
        settings.includeLogo && hasAnyLogo
          ? "border-primary/30 bg-primary/5" 
          : "border-dashed border-muted-foreground/30 bg-muted/30"
      )}>
        <CardContent className="p-4 space-y-4">
          {/* Toggle Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon className={cn(
                "h-5 w-5",
                settings.includeLogo && hasAnyLogo ? "text-primary" : "text-muted-foreground"
              )} />
              <div>
                <p className="font-medium">Include Logo in Design</p>
                <p className="text-sm text-muted-foreground">
                  {hasAnyLogo 
                    ? "Your logo will be integrated directly into the generated image" 
                    : "Upload a logo or add one in My Profile settings"
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={settings.includeLogo && hasAnyLogo}
              onCheckedChange={(checked) => onUpdate({ includeLogo: checked })}
              disabled={!hasAnyLogo}
            />
          </div>
          
          {/* Logo Selection (when enabled) */}
          {settings.includeLogo && hasAnyLogo && (
            <div className="pt-3 border-t border-primary/20 space-y-4">
              {/* Logo Source Selection */}
              <RadioGroup
                value={settings.logoSource}
                onValueChange={(value: 'profile' | 'custom') => onUpdate({ logoSource: value })}
                className="space-y-3"
              >
                {/* Profile Logo Option */}
                {hasProfileLogo && (
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    settings.logoSource === 'profile' 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:bg-muted/50"
                  )}>
                    <RadioGroupItem value="profile" id="logo-profile" />
                    <Label htmlFor="logo-profile" className="flex items-center gap-3 flex-1 cursor-pointer">
                      <img 
                        src={profileLogoUrl} 
                        alt="Profile Logo" 
                        className="h-10 max-w-[100px] object-contain border rounded bg-white p-1"
                        onError={() => setLogoError(true)}
                      />
                      <span className="text-sm">Use profile logo</span>
                    </Label>
                  </div>
                )}

                {/* Custom Logo Option */}
                <div className={cn(
                  "p-3 rounded-lg border transition-colors",
                  settings.logoSource === 'custom' 
                    ? "border-primary bg-primary/5" 
                    : "border-muted hover:bg-muted/50"
                )}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="custom" id="logo-custom" />
                    <Label htmlFor="logo-custom" className="flex-1 cursor-pointer">
                      <span className="text-sm">
                        {hasCustomLogo ? 'Use uploaded logo' : 'Upload a different logo'}
                      </span>
                    </Label>
                  </div>

                  {/* Custom Logo Preview / Upload */}
                  {settings.logoSource === 'custom' && (
                    <div className="mt-3 ml-6">
                      {hasCustomLogo ? (
                        <div className="flex items-center gap-3">
                          <img 
                            src={settings.customLogoData!} 
                            alt="Custom Logo" 
                            className="h-12 max-w-[120px] object-contain border rounded bg-white p-1.5"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveCustomLogo}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="logo-upload-input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('logo-upload-input')?.click()}
                            disabled={isUploadingLogo}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                          </Button>
                          <span className="text-xs text-muted-foreground">PNG, JPG, SVG (max 5MB)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </RadioGroup>

              {/* Logo Placement */}
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
            </div>
          )}

          {/* No logo available message */}
          {!hasAnyLogo && (
            <div className="pt-3 border-t border-muted-foreground/20">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload-input-empty"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('logo-upload-input-empty')?.click()}
                  disabled={isUploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </Button>
                <span className="text-xs text-muted-foreground">or add one in My Profile</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Practice Name */}
      <div className="space-y-2">
        <Label htmlFor="custom-practice-name">Custom Practice Name</Label>
        <Input
          id="custom-practice-name"
          placeholder={practiceContext?.practiceName || "Enter practice name"}
          value={settings.customPracticeName || ''}
          onChange={(e) => {
            const nextName = e.target.value;
            if (settings.brandingLevel === 'custom' && nextName.trim() && !settings.customBranding.name) {
              onUpdate({
                customPracticeName: nextName,
                customBranding: { ...settings.customBranding, name: true },
              });
              return;
            }
            onUpdate({ customPracticeName: nextName });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to use your default practice name
          {practiceContext?.practiceName && ` (${practiceContext.practiceName})`}
        </p>
      </div>

      {/* Practice Details Collapsible */}
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
