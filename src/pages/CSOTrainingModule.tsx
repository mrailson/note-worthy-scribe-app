import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCSORegistration } from '@/hooks/useCSORegistration';
import { useCSOProgress } from '@/hooks/useCSOProgress';
import { getModuleById } from '@/data/csoTrainingContent';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CheckCircle2, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function CSOTrainingModule() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { registration, isLoading: regLoading } = useCSORegistration();
  const { updateProgress, completeModule, isLoading: progressLoading } = useCSOProgress(registration?.id);
  
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime] = useState(Date.now());

  const module = moduleId ? getModuleById(moduleId) : null;

  useEffect(() => {
    if (!regLoading && !registration) {
      navigate('/cso-training-register');
    }
  }, [registration, regLoading, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeSpent(elapsed);
      
      // Auto-save progress every 30 seconds
      if (elapsed % 30 === 0 && module && registration?.id) {
        updateProgress(module.id, elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, module, registration?.id]);

  if (regLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading module...</p>
        </div>
      </div>
    );
  }

  if (!registration || !module) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-lg mb-4">Module not found</p>
          <Button onClick={() => navigate('/cso-training-dashboard')}>Return to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const currentSection = module.sections[currentSectionIndex];
  const progressPercentage = ((currentSectionIndex + 1) / module.sections.length) * 100;
  const isLastSection = currentSectionIndex === module.sections.length - 1;

  const handleNext = () => {
    if (!isLastSection) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleComplete = async () => {
    if (module && registration?.id) {
      await completeModule(module.id, timeSpent);
      navigate('/cso-training-dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={() => navigate('/cso-training-dashboard')}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Badge variant="secondary">
              Section {currentSectionIndex + 1} of {module.sections.length}
            </Badge>
          </div>

          <h1 className="text-3xl font-bold mb-2">{module.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{module.duration} minutes</span>
            <span>•</span>
            <span>{Math.floor(timeSpent / 60)} mins spent</span>
          </div>

          <Progress value={progressPercentage} className="mt-4" />
        </div>

        {/* Content */}
        <Card className="p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-6">{currentSection.title}</h2>
          
          <div className="prose prose-slate max-w-none mb-8">
            <ReactMarkdown
              components={{
                h1: ({...props}) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                h2: ({...props}) => <h2 className="text-2xl font-semibold mt-6 mb-3" {...props} />,
                h3: ({...props}) => <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                p: ({...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                strong: ({...props}) => <strong className="font-semibold text-foreground" {...props} />,
                ul: ({...props}) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                ol: ({...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                li: ({...props}) => <li className="leading-relaxed" {...props} />,
                code: ({...props}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
                pre: ({...props}) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
              }}
            >
              {currentSection.content}
            </ReactMarkdown>
          </div>

          {currentSection.keyPoints && currentSection.keyPoints.length > 0 && (
            <div className="bg-primary/5 border-l-4 border-primary p-6 rounded-r-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Key Takeaways
              </h3>
              <ul className="space-y-2">
                {currentSection.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSectionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-1">
            {module.sections.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSectionIndex(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentSectionIndex 
                    ? 'bg-primary w-6' 
                    : index < currentSectionIndex
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
                aria-label={`Go to section ${index + 1}`}
              />
            ))}
          </div>

          {isLastSection ? (
            <Button onClick={handleComplete}>
              Complete Module
              <CheckCircle2 className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
