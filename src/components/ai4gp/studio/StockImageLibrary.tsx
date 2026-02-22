import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Search, Download, PenLine, X, Loader2, ImageIcon, Sprout, Wand2, Trash2, Sparkles, Mic, MicOff, Upload, FileImage, ChevronRight, Timer } from 'lucide-react';
import { useStockImages, STOCK_IMAGE_CATEGORIES, CATEGORY_GROUPS, StockImage } from '@/hooks/useStockImages';
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
  const [customCount, setCustomCount] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState<'custom' | 'batch'>('custom');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [showBatchInstructions, setShowBatchInstructions] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [batchInstructions, setBatchInstructions] = useState('');
  const [batchRefFile, setBatchRefFile] = useState<File | null>(null);
  const [batchRefPreview, setBatchRefPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockImage | null>(null);
  const [bulkDeleteUntil, setBulkDeleteUntil] = useState<number | null>(null);
  const [bulkTimeLeft, setBulkTimeLeft] = useState<string>('');
  const [showNewOnly, setShowNewOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const preVoiceTextRef = useRef<string>('');

  const handleVoiceInput = useCallback((target: 'custom' | 'batch' = 'custom') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-GB';
    recognitionRef.current = recognition;
    setListeningTarget(target);
    preVoiceTextRef.current = target === 'batch' ? batchInstructions : customPrompt;

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      if (transcript) {
        const base = preVoiceTextRef.current;
        const newText = base ? base + ' ' + transcript : transcript;
        if (target === 'batch') {
          setBatchInstructions(newText);
        } else {
          setCustomPrompt(newText);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'aborted') toast.error('Voice input error: ' + event.error);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
    toast.info('Listening... Speak your instructions');
  }, [isListening, customPrompt, batchInstructions]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    setReferenceFile(file);
    const reader = new FileReader();
    reader.onload = () => setReferencePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearReferenceFile = () => {
    setReferenceFile(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setBatchRefFile(file);
    const reader = new FileReader();
    reader.onload = () => setBatchRefPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearBatchRefFile = () => {
    setBatchRefFile(null);
    setBatchRefPreview(null);
    if (batchFileInputRef.current) batchFileInputRef.current.value = '';
  };

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
      
      // Upload batch reference image if provided
      let referenceImageUrl: string | undefined;
      if (batchRefFile) {
        const storagePath = `references/${Date.now()}-${batchRefFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('stock-images')
          .upload(storagePath, batchRefFile, { contentType: batchRefFile.type, upsert: false });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('stock-images').getPublicUrl(storagePath);
          referenceImageUrl = publicUrl;
        }
      }
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min timeout
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-stock-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            category, 
            count: 10, 
            model: generateModel,
            ...(batchInstructions.trim() && { batchInstructions: batchInstructions.trim() }),
            ...(referenceImageUrl && { referenceImageUrl }),
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Generation failed');
      
      toast.success(`Generated ${result.generated}/${result.total} images successfully`);
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Generation is taking a while — images may still be appearing. Refresh to check.', { duration: 8000 });
        queryClient.invalidateQueries({ queryKey: ['stock-images'] });
      } else {
        toast.error(`Generation failed: ${err.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomGenerate = async () => {
    if (!customPrompt.trim()) { toast.error('Please enter a prompt'); return; }
    setIsGenerating(true);
    const modelLabel = AI_MODELS.find(m => m.value === customModel)?.label;
    toast.info(`Creating ${customCount} custom image${customCount > 1 ? 's' : ''} with ${modelLabel}...`);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Upload reference image if provided
      let referenceImageUrl: string | undefined;
      if (referenceFile) {
        const storagePath = `references/${Date.now()}-${referenceFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('stock-images')
          .upload(storagePath, referenceFile, { contentType: referenceFile.type, upsert: false });
        
        if (uploadError) {
          console.error('Reference upload error:', uploadError);
          toast.error('Failed to upload reference image');
        } else {
          const { data: { publicUrl } } = supabase.storage.from('stock-images').getPublicUrl(storagePath);
          referenceImageUrl = publicUrl;
        }
      }
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-stock-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            category: customCategory, 
            count: customCount, 
            model: customModel, 
            customPrompt: customPrompt,
            referenceImageUrl,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Generation failed');
      
      toast.success(`${result.generated} custom image${result.generated > 1 ? 's' : ''} created successfully`);
      setCustomPrompt('');
      clearReferenceFile();
      setShowCustomPrompt(false);
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Generation is taking a while — images may still be appearing. Refresh to check.', { duration: 8000 });
        queryClient.invalidateQueries({ queryKey: ['stock-images'] });
      } else {
        toast.error(`Generation failed: ${err.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Bulk delete mode timer
  const isBulkDeleteActive = bulkDeleteUntil !== null && Date.now() < bulkDeleteUntil;

  useEffect(() => {
    if (!bulkDeleteUntil) return;
    const tick = () => {
      const remaining = bulkDeleteUntil - Date.now();
      if (remaining <= 0) {
        setBulkDeleteUntil(null);
        setBulkTimeLeft('');
        toast.info('Bulk delete mode has expired — confirmations resumed');
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setBulkTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [bulkDeleteUntil]);

  const handleDelete = (image: StockImage) => {
    if (isBulkDeleteActive) {
      deleteImage(image);
    } else {
      setDeleteTarget(image);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteImage(deleteTarget);
      if (lightboxImage?.id === deleteTarget.id) setLightboxImage(null);
      setDeleteTarget(null);
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

      {/* Category filter chips — collapsible groups */}
      <div className="space-y-1">
        <Badge
          variant={selectedCategory === null ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setSelectedCategory(null)}
        >
          All ({allImages.length})
        </Badge>

        {CATEGORY_GROUPS.map(group => {
          const visibleCats = group.categories.filter(cat => {
            const count = categoryCounts[cat] || 0;
            return count > 0 || isAdmin;
          });
          if (visibleCats.length === 0) return null;
          const groupCount = group.categories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0);
          const hasSelectedInGroup = group.categories.includes(selectedCategory as any);
          const isExpanded = expandedGroups.includes(group.label);
          return (
            <div key={group.label} className="border rounded-md overflow-hidden">
              <button
                type="button"
                className="flex items-center justify-between w-full px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedGroups(prev =>
                  prev.includes(group.label) ? prev.filter(g => g !== group.label) : [...prev, group.label]
                )}
              >
                <span className={cn(
                  "text-[11px] uppercase tracking-wider font-medium",
                  hasSelectedInGroup ? "text-primary" : "text-muted-foreground"
                )}>
                  {group.label} ({groupCount})
                </span>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-90"
                )} />
              </button>
              {isExpanded && (
                <div className="flex flex-wrap gap-1 px-2.5 pb-2">
                  {visibleCats.map(cat => (
                    <Badge
                      key={cat}
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    >
                      {cat} ({categoryCounts[cat] || 0})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
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

          {/* Bulk Delete Mode toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <Switch
              checked={isBulkDeleteActive}
              onCheckedChange={(checked) => {
                if (checked) {
                  setBulkDeleteUntil(Date.now() + 15 * 60 * 1000);
                  toast.success('Bulk delete mode enabled — confirmations skipped for 15 minutes');
                } else {
                  setBulkDeleteUntil(null);
                  setBulkTimeLeft('');
                  toast.info('Bulk delete mode disabled');
                }
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Bulk Delete Mode</p>
              <p className="text-[10px] text-muted-foreground">Skip confirmations for 15 min</p>
            </div>
            {isBulkDeleteActive && (
              <Badge variant="destructive" className="text-[10px] gap-1 shrink-0">
                <Timer className="h-3 w-3" />
                {bulkTimeLeft}
              </Badge>
            )}
          </div>

          {/* New images only toggle */}
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <Switch
              checked={showNewOnly}
              onCheckedChange={setShowNewOnly}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">New Images Only</p>
              <p className="text-[10px] text-muted-foreground">Show only images created in the last 24 hours</p>
            </div>
            {showNewOnly && (
              <Badge variant="secondary" className="text-[10px] shrink-0">Last 24h</Badge>
            )}
          </div>

          {/* Batch generate for current category */}
          <div className="border rounded-lg bg-muted/20 overflow-hidden">
            <div className="flex items-center gap-2 p-3">
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
            
            {/* Toggle for custom instructions */}
            <div className="px-3 pb-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={() => setShowBatchInstructions(!showBatchInstructions)}
              >
                <PenLine className="h-3 w-3 mr-1" />
                {showBatchInstructions ? 'Hide' : 'Add'} Custom Instructions
              </Button>
            </div>

            {/* Expandable batch instructions panel */}
            {showBatchInstructions && (
              <div className="px-3 pb-3 space-y-2 border-t pt-2">
                <Label className="text-xs text-muted-foreground">
                  Additional instructions applied to all 10 generated images
                </Label>
                <div className="relative">
                  <Textarea
                    value={batchInstructions}
                    onChange={(e) => setBatchInstructions(e.target.value)}
                    placeholder="e.g. 'Include NHS branding, ensure British spelling, show diverse staff, Northamptonshire setting...'"
                    rows={2}
                    className="pr-12 text-xs"
                  />
                  <Button
                    type="button"
                    variant={isListening && listeningTarget === 'batch' ? 'destructive' : 'ghost'}
                    size="icon"
                    className="absolute right-2 top-1.5 h-7 w-7"
                    onClick={() => handleVoiceInput('batch')}
                    title={isListening && listeningTarget === 'batch' ? 'Stop listening' : 'Voice input'}
                  >
                    {isListening && listeningTarget === 'batch' ? <MicOff className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {isListening && listeningTarget === 'batch' && (
                  <p className="text-[10px] text-primary animate-pulse">🎤 Listening...</p>
                )}
                
                {/* Batch reference file upload */}
                <div className="flex items-center gap-2">
                  <input ref={batchFileInputRef} type="file" accept="image/*" onChange={handleBatchFileSelect} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => batchFileInputRef.current?.click()} className="text-xs h-7">
                    <Upload className="h-3 w-3 mr-1" />
                    {batchRefFile ? 'Change' : 'Attach Logo/Image'}
                  </Button>
                  {batchRefFile && (
                    <div className="flex items-center gap-1.5">
                      <FileImage className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{batchRefFile.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={clearBatchRefFile}>
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {batchRefPreview && (
                  <div className="w-14 h-14 rounded border overflow-hidden bg-muted">
                    <img src={batchRefPreview} alt="Reference" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom prompt panel */}
          {showCustomPrompt && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4" />Create Custom Stock Image</h4>
              <div className="space-y-1">
                <Label className="text-xs">Prompt</Label>
                <div className="relative">
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe the image you want to create, e.g. 'A diverse group of NHS staff celebrating a team achievement in a modern GP surgery'"
                    rows={3}
                    className="pr-12"
                  />
                  <Button
                    type="button"
                    variant={isListening && listeningTarget === 'custom' ? 'destructive' : 'ghost'}
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8"
                    onClick={() => handleVoiceInput('custom')}
                    title={isListening && listeningTarget === 'custom' ? 'Stop listening' : 'Voice input'}
                  >
                    {isListening && listeningTarget === 'custom' ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
                {isListening && listeningTarget === 'custom' && (
                  <p className="text-xs text-primary animate-pulse">🎤 Listening... speak your prompt</p>
                )}
              </div>

              {/* Reference file upload */}
              <div className="space-y-1">
                <Label className="text-xs">Reference Image (optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {referenceFile ? 'Change File' : 'Upload Logo/Image'}
                  </Button>
                  {referenceFile && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileImage className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[120px]">{referenceFile.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={clearReferenceFile}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {referencePreview && (
                  <div className="mt-1.5 relative w-20 h-20 rounded border overflow-hidden bg-muted">
                    <img src={referencePreview} alt="Reference" className="w-full h-full object-contain" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Upload a logo or reference image to integrate into the generated image</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                <div className="space-y-1">
                  <Label className="text-xs">Variations: {customCount}</Label>
                  <Slider
                    value={[customCount]}
                    onValueChange={([v]) => setCustomCount(v)}
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-[10px] text-muted-foreground text-center">1–5 images</p>
                </div>
              </div>
              <Button onClick={handleCustomGenerate} disabled={isGenerating || !customPrompt.trim()} className="w-full" size="sm">
                {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating {customCount > 1 ? `${customCount} images` : ''}...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate {customCount > 1 ? `${customCount} Custom Images` : 'Custom Image'}</>}
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
      {(() => {
        const displayImages = showNewOnly
          ? images.filter(img => {
              const created = new Date(img.created_at).getTime();
              return Date.now() - created < 24 * 60 * 60 * 1000;
            })
          : images;
        return isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-2" />
            <p className="text-sm">{showNewOnly ? 'No images created in the last 24 hours' : 'No stock images found'}</p>
            {(searchQuery || showNewOnly) && (
              <div className="flex gap-2 mt-2">
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                )}
                {showNewOnly && (
                  <Button variant="ghost" size="sm" onClick={() => setShowNewOnly(false)}>
                    Show all images
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {displayImages.map(image => (
            <div
              key={image.id}
              className="group relative rounded-lg overflow-hidden border bg-muted/30 cursor-pointer aspect-[4/3]"
              onClick={(e) => {
                // Don't open lightbox if delete button was clicked
                if ((e.target as HTMLElement).closest('[data-delete-btn]')) return;
                setLightboxImage(image);
              }}
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
                   data-delete-btn
                   onClick={(e) => {
                     e.stopPropagation();
                     e.preventDefault();
                     handleDelete(image);
                   }}
                   className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                 >
                   <X className="h-3 w-3" />
                 </button>
              )}
            </div>
          ))}
        </div>
        );
      })()}

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl max-h-[95vh] w-fit p-4">
          {lightboxImage && (
            <div className="flex flex-col gap-4">
              <img
                src={lightboxImage.image_url}
                alt={lightboxImage.title}
                className="w-full max-h-[80vh] object-contain rounded-lg"
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
                    Edit in Image Studio
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      const imageToDelete = lightboxImage;
                      setLightboxImage(null);
                      // Delay to let lightbox fully close before opening AlertDialog
                      setTimeout(() => {
                        if (imageToDelete) handleDelete(imageToDelete);
                      }, 150);
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this image from the library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
              <img
                src={deleteTarget.image_url}
                alt={deleteTarget.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{deleteTarget.title}</p>
                <p className="text-xs text-muted-foreground">{deleteTarget.category}</p>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
