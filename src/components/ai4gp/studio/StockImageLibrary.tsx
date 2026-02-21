import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search, Download, PenLine, X, Loader2, ImageIcon, Sprout, Wand2, Trash2, Sparkles } from 'lucide-react';
import { useStockImages, STOCK_IMAGE_CATEGORIES, StockImage } from '@/hooks/useStockImages';
import { useQueryClient } from '@tanstack/react-query';
import { StockImageUploader } from './StockImageUploader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AI_MODELS = [
  { value: 'gemini-flash', label: 'Gemini Flash Image', description: 'Fast, good quality' },
  { value: 'gemini-pro', label: 'Gemini Pro Image', description: 'Best quality, slower' },
  { value: 'runware', label: 'Runware FLUX', description: 'Fast, photorealistic' },
] as const;

interface StockImageLibraryProps {
  onUseInStudio?: (imageUrl: string, imageName: string) => void;
}

export const StockImageLibrary: React.FC<StockImageLibraryProps> = ({ onUseInStudio }) => {
  const {
    images,
    allImages,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categoryCounts,
    isAdmin,
    uploadImage,
    isUploading,
    deleteImage,
    isDeleting,
  } = useStockImages();
  const queryClient = useQueryClient();

  const [lightboxImage, setLightboxImage] = useState<StockImage | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateModel, setGenerateModel] = useState<string>('gemini-flash');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [customCategory, setCustomCategory] = useState<string>(selectedCategory || 'Patients');
  const [customModel, setCustomModel] = useState<string>('gemini-pro');

  const SEED_IMAGES = [
    { file: 'patients-consultation.jpg', title: 'Patient Consultation', category: 'Patients', description: 'Patient having a friendly consultation with their GP doctor', tags: ['consultation', 'patient', 'GP', 'doctor', 'diverse'] },
    { file: 'buildings-gp-surgery.jpg', title: 'GP Surgery Exterior', category: 'Buildings', description: 'Modern NHS GP surgery building exterior with brick facade', tags: ['building', 'surgery', 'exterior', 'NHS', 'Northamptonshire'] },
    { file: 'reception-waiting-area.jpg', title: 'Reception & Waiting Area', category: 'Reception & Waiting Areas', description: 'Modern GP practice reception area with check-in screens', tags: ['reception', 'waiting room', 'check-in', 'front desk'] },
    { file: 'clinical-room.jpg', title: 'Clinical Consultation Room', category: 'Clinical Rooms', description: 'GP consultation room with examination bed and equipment', tags: ['clinical', 'consultation room', 'examination', 'equipment'] },
    { file: 'staff-team.jpg', title: 'Primary Care Team', category: 'Staff & Teams', description: 'Diverse NHS primary care team of healthcare professionals', tags: ['team', 'staff', 'GP', 'nurse', 'multidisciplinary'] },
    { file: 'technology-screen.jpg', title: 'Clinical Software System', category: 'Technology', description: 'Medical professional using electronic health records', tags: ['technology', 'computer', 'EHR', 'clinical system', 'digital'] },
    { file: 'community-wellbeing.jpg', title: 'Community Walking Group', category: 'Community & Wellbeing', description: 'Community health walking group outdoors', tags: ['community', 'wellbeing', 'walking', 'social prescribing', 'outdoor'] },
    { file: 'meetings-training.jpg', title: 'NHS Board Meeting', category: 'Meetings & Training', description: 'Professional NHS meeting around boardroom table', tags: ['meeting', 'training', 'boardroom', 'presentation', 'NHS'] },
    { file: 'branding-nhs.jpg', title: 'NHS Branding Elements', category: 'Branding & Logos', description: 'NHS logos and primary care branding elements', tags: ['NHS', 'logo', 'branding', 'primary care', 'PCN'] },
    { file: 'infographic-elements.jpg', title: 'Medical Infographic Elements', category: 'Infographic Elements', description: 'Medical infographic design elements with icons and charts', tags: ['infographic', 'icons', 'charts', 'design', 'medical'] },
  ];

  const handleSeedImages = async () => {
    setIsSeeding(true);
    let success = 0;
    try {
      for (const img of SEED_IMAGES) {
        const existing = images.find(i => i.title === img.title) || allImages.find(i => i.title === img.title);
        if (existing) continue;
        const response = await fetch(`/stock-images/${img.file}`);
        if (!response.ok) continue;
        const blob = await response.blob();
        const storagePath = `${img.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}/${img.file}`;
        const { error: uploadError } = await supabase.storage.from('stock-images').upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) continue;
        const { data: { publicUrl } } = supabase.storage.from('stock-images').getPublicUrl(storagePath);
        const { error: insertError } = await (supabase as any).from('stock_images').insert({ title: img.title, description: img.description, category: img.category, tags: img.tags, image_url: publicUrl, storage_path: storagePath, file_size: blob.size, is_active: true });
        if (insertError) continue;
        success++;
      }
      if (success > 0) { toast.success(`Seeded ${success} stock image(s)`); queryClient.invalidateQueries({ queryKey: ['stock-images'] }); }
      else toast.info('All seed images already exist');
    } catch (err) { toast.error('Seed failed: ' + String(err)); }
    finally { setIsSeeding(false); }
  };

  const handleGenerateBatch = async () => {
    const category = selectedCategory || 'Patients';
    setIsGenerating(true);
    toast.info(`Generating 10 images for "${category}" using ${AI_MODELS.find(m => m.value === generateModel)?.label}... This may take a few minutes.`);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-stock-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ category, count: 10, model: generateModel }),
        }
      );
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Generation failed');
      
      toast.success(`Generated ${result.generated}/${result.total} images successfully`);
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomGenerate = async () => {
    if (!customPrompt.trim()) { toast.error('Please enter a prompt'); return; }
    setIsGenerating(true);
    toast.info(`Creating custom image with ${AI_MODELS.find(m => m.value === customModel)?.label}...`);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-stock-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ category: customCategory, count: 1, model: customModel, customPrompt: customPrompt }),
        }
      );
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Generation failed');
      
      toast.success('Custom image created successfully');
      setCustomPrompt('');
      setShowCustomPrompt(false);
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (image: StockImage) => {
    const link = document.createElement('a');
    link.href = image.image_url;
    link.download = image.title || 'stock-image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stock images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={selectedCategory === null ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setSelectedCategory(null)}
        >
          All ({allImages.length})
        </Badge>
        {STOCK_IMAGE_CATEGORIES.map(cat => {
          const count = categoryCounts[cat] || 0;
          if (count === 0 && !isAdmin) return null;
          return (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {cat} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowUploader(!showUploader)}>
              {showUploader ? 'Hide Uploader' : 'Upload Stock Images'}
            </Button>
            {allImages.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleSeedImages} disabled={isSeeding}>
                {isSeeding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Seeding...</> : <><Sprout className="h-4 w-4 mr-2" />Seed Sample Images</>}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowCustomPrompt(!showCustomPrompt)} disabled={isGenerating}>
              <Wand2 className="h-4 w-4 mr-2" />
              Custom Image
            </Button>
          </div>

          {/* Batch generate for current category */}
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium shrink-0">
              Generate 10 for "{selectedCategory || 'Patients'}"
            </span>
            <Select value={generateModel} onValueChange={setGenerateModel}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="text-xs">{m.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleGenerateBatch} disabled={isGenerating}>
              {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : 'Generate'}
            </Button>
          </div>

          {/* Custom prompt panel */}
          {showCustomPrompt && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4" />Create Custom Stock Image</h4>
              <div className="space-y-1">
                <Label className="text-xs">Prompt</Label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe the image you want to create, e.g. 'A diverse group of NHS staff celebrating a team achievement in a modern GP surgery'"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={customCategory} onValueChange={setCustomCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STOCK_IMAGE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">AI Model</Label>
                  <Select value={customModel} onValueChange={setCustomModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          <div>
                            <span className="text-xs font-medium">{m.label}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({m.description})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCustomGenerate} disabled={isGenerating || !customPrompt.trim()} className="w-full" size="sm">
                {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Custom Image</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Admin uploader */}
      {isAdmin && showUploader && (
        <StockImageUploader onUpload={uploadImage} isUploading={isUploading} />
      )}

      {/* Image grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ImageIcon className="h-10 w-10 mb-2" />
          <p className="text-sm">No stock images found</p>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="mt-2">
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map(image => (
            <div
              key={image.id}
              className="group relative rounded-lg overflow-hidden border bg-muted/30 cursor-pointer aspect-[4/3]"
              onClick={() => setLightboxImage(image)}
            >
              <img
                src={image.image_url}
                alt={image.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">{image.title}</p>
                  <p className="text-white/70 text-[10px]">{image.category}</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this stock image?')) deleteImage(image);
                  }}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-2xl p-4">
          {lightboxImage && (
            <div className="flex flex-col gap-4">
              <img
                src={lightboxImage.image_url}
                alt={lightboxImage.title}
                className="w-full max-h-[60vh] object-contain rounded-lg"
              />
              <div>
                <h3 className="font-semibold text-lg">{lightboxImage.title}</h3>
                {lightboxImage.description && (
                  <p className="text-sm text-muted-foreground mt-1">{lightboxImage.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="secondary" className="text-xs">{lightboxImage.category}</Badge>
                  {lightboxImage.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleDownload(lightboxImage)} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                {onUseInStudio && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onUseInStudio(lightboxImage.image_url, lightboxImage.title);
                      setLightboxImage(null);
                    }}
                    className="flex-1"
                  >
                    <PenLine className="h-4 w-4 mr-2" />
                    Use in Studio
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      if (confirm('Delete this stock image?')) {
                        deleteImage(lightboxImage);
                        setLightboxImage(null);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
