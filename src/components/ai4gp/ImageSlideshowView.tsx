import React, { useCallback } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { UserGeneratedImage } from '@/hooks/useImageGallery';

interface ImageSlideshowViewProps {
  images: UserGeneratedImage[];
  selectedImage: UserGeneratedImage | null;
  onSelect: (image: UserGeneratedImage) => void;
  onToggleFavourite: (imageId: string) => void;
}

export const ImageSlideshowView: React.FC<ImageSlideshowViewProps> = ({
  images,
  selectedImage,
  onSelect,
  onToggleFavourite,
}) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    const onSelectSlide = () => {
      const idx = api.selectedScrollSnap();
      setCurrent(idx);
      if (images[idx]) {
        onSelect(images[idx]);
      }
    };

    api.on('select', onSelectSlide);
    onSelectSlide();

    return () => {
      api.off('select', onSelectSlide);
    };
  }, [api, images, onSelect]);

  // Scroll to selected image when it changes externally
  React.useEffect(() => {
    if (!api || !selectedImage) return;
    const idx = images.findIndex(img => img.id === selectedImage.id);
    if (idx !== -1 && idx !== api.selectedScrollSnap()) {
      api.scrollTo(idx);
    }
  }, [api, selectedImage, images]);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No images found.</p>
      </div>
    );
  }

  const currentImage = images[current];

  return (
    <div className="flex flex-col items-center gap-4 px-8">
      <Carousel
        setApi={setApi}
        className="w-full max-w-lg"
        opts={{ loop: true }}
      >
        <CarouselContent>
          {images.map((image) => (
            <CarouselItem key={image.id}>
              <div className="flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden" style={{ height: '50vh' }}>
                <img
                  src={image.image_url}
                  alt={image.alt_text || 'Gallery image'}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>

      {/* Image info */}
      {currentImage && (
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <p className="font-medium text-sm">
              {currentImage.title || 'Untitled'}
            </p>
            <button
              onClick={() => onToggleFavourite(currentImage.id)}
              className="p-1 rounded-full hover:bg-muted transition-colors"
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  currentImage.is_favourite
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-muted-foreground'
                )}
              />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(currentImage.created_at), 'dd MMM yyyy, HH:mm')}
          </p>
          <p className="text-xs text-muted-foreground">
            {current + 1} of {images.length}
          </p>
        </div>
      )}
    </div>
  );
};
