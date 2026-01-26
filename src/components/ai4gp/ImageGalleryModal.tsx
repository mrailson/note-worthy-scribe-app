import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Images,
  Star,
  Search,
  Download,
  Trash2,
  MoreVertical,
  Tag,
  ExternalLink,
  Sparkles,
  FileImage,
  BarChart3,
  Loader2,
  X,
  Calendar,
  Check,
  Maximize2,
  PenLine,
} from 'lucide-react';
import { useImageGallery, UserGeneratedImage } from '@/hooks/useImageGallery';
import { useImageDefaults, TEMPLATE_TYPES } from '@/hooks/useImageDefaults';
import { ImageLightbox } from './ImageLightbox';
import { ImageStudioModal } from './ImageStudioModal';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ImageGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage?: (image: UserGeneratedImage) => void;
  selectionMode?: boolean;
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  'image-studio': { label: 'Image Studio', icon: <Sparkles className="h-3 w-3" /> },
  'infographic': { label: 'Infographic', icon: <BarChart3 className="h-3 w-3" /> },
};

export const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({
  open,
  onOpenChange,
  onSelectImage,
  selectionMode = false,
}) => {
  const {
    images,
    favourites,
    categories,
    isLoading,
    fetchImages,
    toggleFavourite,
    deleteImage,
    updateCategory,
    updateTitle,
  } = useImageGallery();

  const { setDefault, defaults } = useImageDefaults();

  const [activeTab, setActiveTab] = useState<'all' | 'favourites' | 'categories'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<UserGeneratedImage | null>(null);
  const [deleteConfirmImage, setDeleteConfirmImage] = useState<UserGeneratedImage | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editImageData, setEditImageData] = useState<{ url: string; name: string } | null>(null);

  // Filter images based on current view
  const getFilteredImages = () => {
    let filtered = activeTab === 'favourites' ? favourites : images;

    if (selectedSource) {
      filtered = filtered.filter(img => img.source === selectedSource);
    }

    if (selectedCategory) {
      filtered = filtered.filter(img => img.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img =>
        img.title?.toLowerCase().includes(query) ||
        img.prompt?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredImages = getFilteredImages();

  const handleDownload = (image: UserGeneratedImage) => {
    if (!image?.image_url) return;
    
    try {
      const a = document.createElement('a');
      a.href = image.image_url;
      a.download = `${image.title || 'image'}-${Date.now()}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download image');
    }
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const handleOpenFullSize = (image: UserGeneratedImage) => {
    // Open lightbox instead of new window
    const index = filteredImages.findIndex(img => img.id === image.id);
    if (index !== -1) {
      setLightboxIndex(index);
    }
  };

  const handleLightboxNavigate = (index: number) => {
    setLightboxIndex(index);
    // Also update selected image to keep sidebar in sync
    const newImage = filteredImages[index];
    if (newImage) {
      setSelectedImage(newImage);
    }
  };

  const handleSaveTitle = async (imageId: string) => {
    if (newTitle.trim()) {
      await updateTitle(imageId, newTitle.trim());
    }
    setEditingTitle(null);
    setNewTitle('');
  };

  const handleAddCategory = async (imageId: string) => {
    if (newCategory.trim()) {
      await updateCategory(imageId, newCategory.trim());
      setNewCategory('');
    }
  };

  const handleSetAsDefault = async (image: UserGeneratedImage, templateType: string) => {
    await setDefault(templateType, image.id);
  };

  const handleSelectImage = (image: UserGeneratedImage) => {
    if (selectionMode && onSelectImage) {
      onSelectImage(image);
      onOpenChange(false);
    } else {
      setSelectedImage(image);
    }
  };

  const isDefaultFor = (imageId: string): string[] => {
    return Object.entries(defaults)
      .filter(([_, d]) => d.image_id === imageId)
      .map(([type]) => type);
  };

  useEffect(() => {
    if (open) {
      fetchImages();
    }
  }, [open, fetchImages]);

  // Close modal when lightbox opens to avoid z-index conflicts
  const handleOpenLightbox = (image: UserGeneratedImage) => {
    const index = filteredImages.findIndex(img => img.id === image.id);
    if (index !== -1) {
      setLightboxIndex(index);
    }
  };

  return (
    <>
      <Dialog open={open && lightboxIndex === null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Images className="h-5 w-5 text-primary" />
                {selectionMode ? 'Select an Image' : 'My Image Gallery'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Panel - Image Grid */}
            <div className="flex-1 flex flex-col min-w-0 border-r">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="p-3 border-b space-y-3 flex-shrink-0">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="all">All Images</TabsTrigger>
                    <TabsTrigger value="favourites" className="gap-1">
                      <Star className="h-3.5 w-3.5" />
                      Favourites
                    </TabsTrigger>
                    <TabsTrigger value="categories">
                      <Tag className="h-3.5 w-3.5 mr-1" />
                      Categories
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search images..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {selectedSource ? SOURCE_LABELS[selectedSource]?.label : 'All Sources'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setSelectedSource(null)}>
                          All Sources
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {Object.entries(SOURCE_LABELS).map(([key, { label, icon }]) => (
                          <DropdownMenuItem key={key} onClick={() => setSelectedSource(key)}>
                            {icon}
                            <span className="ml-2">{label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {activeTab === 'categories' && categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant={selectedCategory === null ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSelectedCategory(null)}
                      >
                        All
                      </Badge>
                      {categories.map(cat => (
                        <Badge
                          key={cat}
                          variant={selectedCategory === cat ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <TabsContent value="all" className="mt-0 p-3">
                    <ImageGrid
                      images={filteredImages}
                      isLoading={isLoading}
                      selectedImage={selectedImage}
                      onSelect={handleSelectImage}
                      onDoubleClick={handleOpenLightbox}
                      onToggleFavourite={toggleFavourite}
                      isDefaultFor={isDefaultFor}
                    />
                  </TabsContent>

                  <TabsContent value="favourites" className="mt-0 p-3">
                    <ImageGrid
                      images={filteredImages}
                      isLoading={isLoading}
                      selectedImage={selectedImage}
                      onSelect={handleSelectImage}
                      onDoubleClick={handleOpenLightbox}
                      onToggleFavourite={toggleFavourite}
                      isDefaultFor={isDefaultFor}
                      emptyMessage="No favourite images yet. Star images to add them here."
                    />
                  </TabsContent>

                  <TabsContent value="categories" className="mt-0 p-3">
                    <ImageGrid
                      images={filteredImages}
                      isLoading={isLoading}
                      selectedImage={selectedImage}
                      onSelect={handleSelectImage}
                      onDoubleClick={handleOpenLightbox}
                      onToggleFavourite={toggleFavourite}
                      isDefaultFor={isDefaultFor}
                    />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>

            {/* Right Panel - Image Details */}
            {selectedImage && !selectionMode && (
              <div className="w-80 flex flex-col bg-muted/30">
                <div className="p-3 border-b flex items-center justify-between">
                  <h3 className="font-medium text-sm">Image Details</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {/* Preview */}
                    <div 
                      className="rounded-lg overflow-hidden border bg-background cursor-pointer"
                      onDoubleClick={() => handleOpenLightbox(selectedImage)}
                    >
                      <img
                        src={selectedImage.image_url}
                        alt={selectedImage.alt_text || 'Generated image'}
                        className="w-full h-auto"
                      />
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      {editingTitle === selectedImage.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Enter title..."
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(selectedImage.id);
                              if (e.key === 'Escape') setEditingTitle(null);
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleSaveTitle(selectedImage.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p
                          className="text-sm cursor-pointer hover:text-primary"
                          onClick={() => {
                            setEditingTitle(selectedImage.id);
                            setNewTitle(selectedImage.title || '');
                          }}
                        >
                          {selectedImage.title || 'Click to add title...'}
                        </p>
                      )}
                    </div>

                    {/* Prompt */}
                    {selectedImage.prompt && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Prompt</label>
                        <p className="text-sm text-muted-foreground line-clamp-4">
                          {selectedImage.prompt}
                        </p>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Source</label>
                        <div className="flex items-center gap-1 mt-0.5">
                          {SOURCE_LABELS[selectedImage.source || 'quick-pick']?.icon}
                          <span>{SOURCE_LABELS[selectedImage.source || 'quick-pick']?.label}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Created</label>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(selectedImage.created_at), 'dd MMM yyyy')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Category</label>
                      {selectedImage.category ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{selectedImage.category}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => updateCategory(selectedImage.id, null)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Input
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Add category..."
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCategory(selectedImage.id);
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleAddCategory(selectedImage.id)}
                            disabled={!newCategory.trim()}
                          >
                            Add
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Default For */}
                    {isDefaultFor(selectedImage.id).length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Default for
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {isDefaultFor(selectedImage.id).map(type => (
                            <Badge key={type} variant="default" className="capitalize">
                              {type.replace('-', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => toggleFavourite(selectedImage.id)}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4 mr-2",
                            selectedImage.is_favourite && "fill-yellow-500 text-yellow-500"
                          )}
                        />
                        {selectedImage.is_favourite ? 'Remove from Favourites' : 'Add to Favourites'}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            <Check className="h-4 w-4 mr-2" />
                            Set as Default...
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {TEMPLATE_TYPES.map(({ value, label }) => (
                            <DropdownMenuItem
                              key={value}
                              onClick={() => handleSetAsDefault(selectedImage, value)}
                            >
                              {label}
                              {isDefaultFor(selectedImage.id).includes(value) && (
                                <Check className="h-4 w-4 ml-auto" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleDownload(selectedImage)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          setEditImageData({
                            url: selectedImage.image_url,
                            name: selectedImage.title || 'Gallery Image',
                          });
                        }}
                      >
                        <PenLine className="h-4 w-4 mr-2" />
                        Edit Image
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleOpenLightbox(selectedImage)}
                      >
                        <Maximize2 className="h-4 w-4 mr-2" />
                        View Fullscreen
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmImage(selectedImage)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Image
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmImage}
        onOpenChange={(open) => !open && setDeleteConfirmImage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this image from your gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteConfirmImage) {
                  const success = await deleteImage(deleteConfirmImage.id);
                  if (success) {
                    if (selectedImage?.id === deleteConfirmImage.id) {
                      setSelectedImage(null);
                    }
                    // Refetch to ensure gallery is updated
                    await fetchImages();
                  }
                  setDeleteConfirmImage(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Lightbox - rendered outside Dialog to avoid z-index issues */}
      {lightboxIndex !== null && open && (
        <ImageLightbox
          images={filteredImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={handleLightboxNavigate}
        />
      )}

      {/* Image Studio Modal for editing */}
      <ImageStudioModal
        open={!!editImageData}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditImageData(null);
            // Refresh gallery in case edits were saved
            fetchImages();
          }
        }}
        initialEditImage={editImageData}
      />
    </>
  );
};

// Image Grid Component
interface ImageGridProps {
  images: UserGeneratedImage[];
  isLoading: boolean;
  selectedImage: UserGeneratedImage | null;
  onSelect: (image: UserGeneratedImage) => void;
  onDoubleClick: (image: UserGeneratedImage) => void;
  onToggleFavourite: (imageId: string) => void;
  isDefaultFor: (imageId: string) => string[];
  emptyMessage?: string;
}

const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  isLoading,
  selectedImage,
  onSelect,
  onDoubleClick,
  onToggleFavourite,
  isDefaultFor,
  emptyMessage = "No images found.",
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Images className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {images.map((image) => (
        <Card
          key={image.id}
          className={cn(
            "group relative overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
            selectedImage?.id === image.id && "ring-2 ring-primary"
          )}
          onClick={() => onSelect(image)}
          onDoubleClick={() => onDoubleClick(image)}
        >
          <div className="aspect-square relative">
            <img
              src={image.image_url}
              alt={image.alt_text || 'Generated image'}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Favourite Star */}
            <button
              className={cn(
                "absolute top-2 right-2 p-1.5 rounded-full transition-all",
                image.is_favourite
                  ? "bg-yellow-500/90 text-white"
                  : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavourite(image.id);
              }}
            >
              <Star
                className={cn("h-3.5 w-3.5", image.is_favourite && "fill-current")}
              />
            </button>

            {/* Default badge */}
            {isDefaultFor(image.id).length > 0 && (
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  Default
                </Badge>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-white text-xs font-medium truncate">
                  {image.title || 'Untitled'}
                </p>
                <p className="text-white/70 text-xs">
                  {format(new Date(image.created_at), 'dd MMM yyyy')}
                </p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
