import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Image, 
  Upload, 
  Trash2, 
  Loader2,
  Save,
  Hash,
  Maximize2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

export interface BrandingPreference {
  logoUrl: string | null;
  logoPosition: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
  showCardNumbers: boolean;
  cardNumberPosition: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
  dimensions: 'fluid' | 'standard' | 'wide';
}

const DEFAULT_BRANDING: BrandingPreference = {
  logoUrl: null,
  logoPosition: 'topRight',
  showCardNumbers: true,
  cardNumberPosition: 'bottomRight',
  dimensions: 'fluid'
};

const POSITION_OPTIONS = [
  { value: 'topLeft', label: 'Top Left' },
  { value: 'topRight', label: 'Top Right' },
  { value: 'bottomLeft', label: 'Bottom Left' },
  { value: 'bottomRight', label: 'Bottom Right' },
];

const DIMENSION_OPTIONS = [
  { value: 'fluid', label: 'Fluid (Auto-fit)' },
  { value: 'standard', label: 'Standard (4:3)' },
  { value: 'wide', label: 'Wide (16:9)' },
];

export function PresentationBrandingSettings() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingPreference>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current branding settings
  useEffect(() => {
    const fetchBranding = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('user_id', user.id)
          .eq('setting_key', 'presentation_branding')
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data?.setting_value) {
          setBranding({ ...DEFAULT_BRANDING, ...(data.setting_value as unknown as BrandingPreference) });
        }
      } catch (error) {
        console.error('Error fetching branding:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, [user]);

  // Handle logo upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      // Delete old logo if exists
      if (branding.logoUrl) {
        const oldPath = branding.logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('presentation-logos')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new logo
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('presentation-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('presentation-logos')
        .getPublicUrl(filePath);

      setBranding(prev => ({ ...prev, logoUrl: publicUrl }));
      setHasChanges(true);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  }, [user, branding.logoUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] },
    maxFiles: 1,
    disabled: uploading
  });

  // Remove logo
  const handleRemoveLogo = async () => {
    if (!user || !branding.logoUrl) return;

    try {
      const pathParts = branding.logoUrl.split('/presentation-logos/');
      if (pathParts[1]) {
        await supabase.storage
          .from('presentation-logos')
          .remove([pathParts[1]]);
      }

      setBranding(prev => ({ ...prev, logoUrl: null }));
      setHasChanges(true);
      toast.success('Logo removed');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    }
  };

  // Save settings
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .eq('setting_key', 'presentation_branding')
        .single();

      let error;
      if (existing?.id) {
        const result = await supabase
          .from('user_settings')
          .update({
            setting_value: JSON.parse(JSON.stringify(branding)),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('user_settings')
          .insert([{
            user_id: user.id,
            setting_key: 'presentation_branding',
            setting_value: JSON.parse(JSON.stringify(branding))
          }]);
        error = result.error;
      }

      if (error) throw error;

      setHasChanges(false);
      toast.success('Branding settings saved');
    } catch (error) {
      console.error('Error saving branding:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Update branding field
  const updateBranding = <K extends keyof BrandingPreference>(
    key: K,
    value: BrandingPreference[K]
  ) => {
    setBranding(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Branding Options
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Customise logos, slide numbers, and layout for your presentations
            </p>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Organisation Logo</Label>
          
          {branding.logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-32 bg-muted rounded-lg overflow-hidden border">
                <img
                  src={branding.logoUrl}
                  alt="Logo preview"
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div {...getRootProps()}>
                  <input {...getInputProps()} />
                  <Button variant="outline" size="sm" disabled={uploading}>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Replace
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {isDragActive
                  ? "Drop your logo here..."
                  : "Drag & drop your logo, or click to select"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, SVG up to 2MB
              </p>
            </div>
          )}

          {/* Logo Position */}
          {branding.logoUrl && (
            <div className="flex items-center gap-4 pt-2">
              <Label className="text-sm min-w-24">Position:</Label>
              <Select
                value={branding.logoPosition}
                onValueChange={(value) => updateBranding('logoPosition', value as BrandingPreference['logoPosition'])}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Slide Numbers */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Slide Numbers</Label>
            </div>
            <Switch
              checked={branding.showCardNumbers}
              onCheckedChange={(checked) => updateBranding('showCardNumbers', checked)}
            />
          </div>

          {branding.showCardNumbers && (
            <div className="flex items-center gap-4 pl-6">
              <Label className="text-sm min-w-24">Position:</Label>
              <Select
                value={branding.cardNumberPosition}
                onValueChange={(value) => updateBranding('cardNumberPosition', value as BrandingPreference['cardNumberPosition'])}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Slide Dimensions */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Slide Dimensions</Label>
          </div>
          <Select
            value={branding.dimensions}
            onValueChange={(value) => updateBranding('dimensions', value as BrandingPreference['dimensions'])}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This sets the default aspect ratio for generated presentations.
          </p>
        </div>

        {/* Preview */}
        <div className="pt-4 border-t">
          <Label className="text-sm font-medium mb-3 block">Preview</Label>
          <div className="relative bg-muted rounded-lg border overflow-hidden aspect-video max-w-md">
            {/* Slide preview */}
            <div className="absolute inset-4 bg-background rounded shadow-sm border flex flex-col">
              {/* Header area */}
              <div className="flex justify-between items-start p-3 border-b">
                {branding.logoPosition === 'topLeft' && branding.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-6 object-contain" />
                )}
                <div className="flex-1" />
                {branding.logoPosition === 'topRight' && branding.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-6 object-contain" />
                )}
              </div>

              {/* Content area */}
              <div className="flex-1 p-4">
                <div className="h-3 w-32 bg-muted rounded mb-2" />
                <div className="h-2 w-48 bg-muted/60 rounded mb-1" />
                <div className="h-2 w-40 bg-muted/60 rounded" />
              </div>

              {/* Footer area */}
              <div className="flex justify-between items-end p-3 border-t">
                {branding.logoPosition === 'bottomLeft' && branding.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-5 object-contain" />
                )}
                {branding.showCardNumbers && branding.cardNumberPosition === 'bottomLeft' && !branding.logoUrl && (
                  <span className="text-xs text-muted-foreground">1/10</span>
                )}
                <div className="flex-1" />
                {branding.logoPosition === 'bottomRight' && branding.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-5 object-contain" />
                )}
                {branding.showCardNumbers && branding.cardNumberPosition === 'bottomRight' && (
                  <span className="text-xs text-muted-foreground">1/10</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
