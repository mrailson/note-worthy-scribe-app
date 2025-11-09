import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { TitleSlide } from "@/components/federation-presentation/TitleSlide";
import { SystemsOverviewSlide } from "@/components/federation-presentation/SystemsOverviewSlide";
import { BenefitsROISlide } from "@/components/federation-presentation/BenefitsROISlide";
import { StrategicValueSlide } from "@/components/federation-presentation/StrategicValueSlide";
import { ImplementationSlide } from "@/components/federation-presentation/ImplementationSlide";
import { CallToActionSlide } from "@/components/federation-presentation/CallToActionSlide";

const SLIDES = [
  { id: 'title', component: TitleSlide },
  { id: 'systems', component: SystemsOverviewSlide },
  { id: 'benefits', component: BenefitsROISlide },
  { id: 'strategic', component: StrategicValueSlide },
  { id: 'implementation', component: ImplementationSlide },
  { id: 'cta', component: CallToActionSlide },
];

const FederationPresentationMode = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Load last viewed slide from localStorage
  useEffect(() => {
    const lastSlide = localStorage.getItem('federationPresentationSlide');
    if (lastSlide) {
      setCurrentSlide(parseInt(lastSlide, 10));
    }
  }, []);

  // Save current slide to localStorage
  useEffect(() => {
    localStorage.setItem('federationPresentationSlide', currentSlide.toString());
  }, [currentSlide]);

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentSlide(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentSlide(SLIDES.length - 1);
          break;
        case 'Escape':
          navigate('/executive-overview');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlide, navigate]);

  const CurrentSlideComponent = SLIDES[currentSlide].component;
  const progress = ((currentSlide + 1) / SLIDES.length) * 100;

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Progress bar */}
      <Progress value={progress} className="h-2 rounded-none" />

      {/* Header controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-4">
        <span className="text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded">
          {currentSlide + 1} / {SLIDES.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/executive-overview')}
          className="bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main slide content */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 animate-fade-in">
          <CurrentSlideComponent />
        </div>
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
        <Button
          variant="secondary"
          size="icon"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Slide indicators */}
        <div className="flex gap-2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant="secondary"
          size="icon"
          onClick={nextSlide}
          disabled={currentSlide === SLIDES.length - 1}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};

export default FederationPresentationMode;
