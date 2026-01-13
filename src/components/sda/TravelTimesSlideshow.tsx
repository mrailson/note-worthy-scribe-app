import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import Slide1 from "@/assets/travel-times/Slide1.jpg";
import Slide2 from "@/assets/travel-times/Slide2.jpg";
import Slide3 from "@/assets/travel-times/Slide3.jpg";
import Slide4 from "@/assets/travel-times/Slide4.jpg";
import Slide5 from "@/assets/travel-times/Slide5.jpg";
import Slide6 from "@/assets/travel-times/Slide6.jpg";
import Slide7 from "@/assets/travel-times/Slide7.jpg";
import Slide8 from "@/assets/travel-times/Slide8.jpg";
import Slide9 from "@/assets/travel-times/Slide9.jpg";
import Slide10 from "@/assets/travel-times/Slide10.jpg";

const slides = [
  { src: Slide1, title: "NRES SDA Pilot: Practice Drive Time Analysis" },
  { src: Slide2, title: "Purpose and Methodology" },
  { src: Slide3, title: "Drive Time Categories: What They Mean for Service Delivery" },
  { src: Slide4, title: "Key Finding: Strong Central Cluster" },
  { src: Slide5, title: "Secondary Cluster: Roade, Grange Park and Blisworth" },
  { src: Slide6, title: "Geographical Outliers: Planning Considerations" },
  { src: Slide7, title: "Strategic Model: Hub-and-Spoke Approach" },
  { src: Slide8, title: "Operational Impact: Travel Time vs Service Efficiency" },
  { src: Slide9, title: "Key Recommendations for the SDA Pilot" },
  { src: Slide10, title: "Next Steps and Board Considerations" },
];

interface TravelTimesSlideshowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TravelTimesSlideshow = ({ isOpen, onClose }: TravelTimesSlideshowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handlePrevious = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrevious();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-white overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">
          Travel Times Analysis - {slides[currentSlide].title}
        </DialogTitle>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 pr-14">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">
              Slide {currentSlide + 1} of {slides.length}
            </span>
            <span className="text-sm text-slate-500">|</span>
            <span className="text-sm text-slate-700 font-medium">
              {slides[currentSlide].title}
            </span>
          </div>
        </div>

        {/* Slide Content */}
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-100 relative h-[calc(90vh-120px)]">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            className="absolute left-4 h-12 w-12 rounded-full bg-white/90 hover:bg-white shadow-lg z-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <img
            src={slides[currentSlide].src}
            alt={slides[currentSlide].title}
            className="max-h-full max-w-full object-contain rounded-lg shadow-xl"
          />

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="absolute right-4 h-12 w-12 rounded-full bg-white/90 hover:bg-white shadow-lg z-10"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Slide Indicators */}
        <div className="flex items-center justify-center gap-2 py-3 border-t bg-white">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide
                  ? "bg-primary w-6"
                  : "bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TravelTimesThumbnailProps {
  onClick: () => void;
}

export const TravelTimesThumbnail = ({ onClick }: TravelTimesThumbnailProps) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full rounded-lg overflow-hidden border-2 border-slate-200 hover:border-primary transition-all shadow-sm hover:shadow-md"
    >
      <img
        src={Slide1}
        alt="Travel Times Analysis - Click to view presentation"
        className="w-full h-auto object-cover"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 transition-all bg-white/90 px-4 py-2 rounded-full text-sm font-medium text-slate-700 shadow-lg">
          View Presentation
        </span>
      </div>
    </button>
  );
};
