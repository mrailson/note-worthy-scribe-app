import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';

interface QRCodeGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QRCodeOptions {
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  color: {
    dark: string;
    light: string;
  };
  margin: number;
}

export function QRCodeGeneratorModal({ open, onOpenChange }: QRCodeGeneratorModalProps) {
  const [url, setUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<QRCodeOptions>({
    size: 512,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    margin: 4,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setLogoFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setLogoPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file for the logo.",
          variant: "destructive",
        });
      }
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const generateQRCode = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL to generate a QR code.",
        variant: "destructive",
      });
      return;
    }

    if (!validateUrl(url)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL (including http:// or https://).",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Generate base QR code
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: options.size,
        errorCorrectionLevel: options.errorCorrectionLevel,
        color: options.color,
        margin: options.margin,
      });

      if (includeLogo && logoFile && logoPreview) {
        // Create canvas to embed logo
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = options.size;
        canvas.height = options.size;

        // Draw QR code
        const qrImage = new Image();
        qrImage.onload = () => {
          ctx?.drawImage(qrImage, 0, 0, options.size, options.size);

          // Draw logo in center
          const logoImage = new Image();
          logoImage.onload = () => {
            const logoSize = options.size * 0.2; // 20% of QR code size
            const x = (options.size - logoSize) / 2;
            const y = (options.size - logoSize) / 2;

            // Add white background circle for logo
            if (ctx) {
              ctx.fillStyle = 'white';
              ctx.beginPath();
              ctx.arc(options.size / 2, options.size / 2, logoSize / 2 + 5, 0, 2 * Math.PI);
              ctx.fill();

              // Draw logo
              ctx.drawImage(logoImage, x, y, logoSize, logoSize);
            }

            setQrCodeDataUrl(canvas.toDataURL('image/png'));
          };
          logoImage.src = logoPreview;
        };
        qrImage.src = qrDataUrl;
      } else {
        setQrCodeDataUrl(qrDataUrl);
      }

      toast({
        title: "QR Code Generated",
        description: "Your QR code has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrCodeDataUrl;
    link.click();

    toast({
      title: "Download Started",
      description: "Your QR code is being downloaded.",
    });
  };

  const saveToGallery = async () => {
    if (!qrCodeDataUrl) return;

    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      
      // Create file name
      const fileName = `qr-code-${Date.now()}.png`;
      
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('user_images')
        .upload(fileName, blob, {
          contentType: 'image/png',
        });

      if (uploadError) throw uploadError;

      toast({
        title: "Saved to Gallery",
        description: "QR code has been saved to your image gallery.",
      });
    } catch (error) {
      console.error('Error saving to gallery:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save QR code to gallery. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setUrl('');
    setLogoFile(null);
    setLogoPreview(null);
    setQrCodeDataUrl(null);
    setIncludeLogo(false);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>QR Code Generator</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="url">Website URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            {/* Logo Options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-logo"
                  checked={includeLogo}
                  onCheckedChange={setIncludeLogo}
                />
                <Label htmlFor="include-logo">Include Logo</Label>
              </div>

              {includeLogo && (
                <div className="space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                  
                  {logoPreview && (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-16 h-16 object-contain border rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 w-6 h-6 p-0"
                        onClick={removeLogo}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Size Options */}
            <div className="space-y-2">
              <Label>Size</Label>
              <Select
                value={options.size.toString()}
                onValueChange={(value) =>
                  setOptions(prev => ({ ...prev, size: parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="256">256x256 px</SelectItem>
                  <SelectItem value="512">512x512 px</SelectItem>
                  <SelectItem value="1024">1024x1024 px</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error Correction Level */}
            <div className="space-y-2">
              <Label>Error Correction</Label>
              <Select
                value={options.errorCorrectionLevel}
                onValueChange={(value: 'L' | 'M' | 'Q' | 'H') =>
                  setOptions(prev => ({ ...prev, errorCorrectionLevel: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Low (7%)</SelectItem>
                  <SelectItem value="M">Medium (15%)</SelectItem>
                  <SelectItem value="Q">Quartile (25%)</SelectItem>
                  <SelectItem value="H">High (30%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateQRCode}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? 'Generating...' : 'Generate QR Code'}
            </Button>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <Label>Preview</Label>
            <Card>
              <CardContent className="p-4">
                {qrCodeDataUrl ? (
                  <div className="space-y-4 text-center">
                    <img
                      src={qrCodeDataUrl}
                      alt="Generated QR Code"
                      className="mx-auto border rounded"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                    <div className="flex gap-2 justify-center">
                      <Button onClick={downloadQRCode} variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button onClick={saveToGallery} variant="outline">
                        Save to Gallery
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Enter a URL and click Generate to create your QR code
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={resetForm}>
            Reset
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}