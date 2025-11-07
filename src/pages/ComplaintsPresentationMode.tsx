import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TitleSlide } from '@/components/complaints-presentation/TitleSlide';
import { ChallengeSlide } from '@/components/complaints-presentation/ChallengeSlide';
import { SolutionSlide } from '@/components/complaints-presentation/SolutionSlide';
import { WorkflowSlide } from '@/components/complaints-presentation/WorkflowSlide';
import { CallToActionSlide } from '@/components/complaints-presentation/CallToActionSlide';

const SLIDES = [
  { id: 1, component: TitleSlide },
  { id: 2, component: ChallengeSlide },
  { id: 3, component: SolutionSlide },
  { id: 4, component: WorkflowSlide },
  { id: 5, component: CallToActionSlide },
];

const ComplaintsPresentationMode = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const totalSlides = SLIDES.length;

  useEffect(() => {
    const savedSlide = localStorage.getItem('complaints-presentation-slide');
    if (savedSlide) {
      setCurrentSlide(parseInt(savedSlide, 10));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('complaints-presentation-slide', currentSlide.toString());
  }, [currentSlide]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          nextSlide();
          break;
        case 'ArrowLeft':
          prevSlide();
          break;
        case 'Home':
          setCurrentSlide(0);
          break;
        case 'End':
          setCurrentSlide(totalSlides - 1);
          break;
        case 'Escape':
          navigate('/complaints');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlide, navigate]);

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
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

  const CurrentSlideComponent = SLIDES[currentSlide].component;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>

      {/* Header Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-medium">
          {currentSlide + 1} / {totalSlides}
        </div>
        <Button
          onClick={() => navigate('/complaints')}
          variant="ghost"
          size="icon"
          className="bg-background/80 backdrop-blur-sm hover:bg-background"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Slide Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full h-full max-w-7xl animate-fade-in">
          <CurrentSlideComponent />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute inset-y-0 left-0 flex items-center">
        <Button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          variant="ghost"
          size="icon"
          className="ml-4 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background disabled:opacity-30"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute inset-y-0 right-0 flex items-center">
        <Button
          onClick={nextSlide}
          disabled={currentSlide === totalSlides - 1}
          variant="ghost"
          size="icon"
          className="mr-4 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background disabled:opacity-30"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Slide Indicators */}
      <div className="pb-6 flex justify-center gap-2">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide 
                ? 'w-8 bg-primary' 
                : 'w-2 bg-muted hover:bg-muted-foreground/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ComplaintsPresentationMode;
