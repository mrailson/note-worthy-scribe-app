import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCSORegistration } from '@/hooks/useCSORegistration';
import { useCSOProgress } from '@/hooks/useCSOProgress';
import { useCSOAssessment } from '@/hooks/useCSOAssessment';
import { csoTrainingModules } from '@/data/csoTrainingContent';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Shield, Factory, AlertTriangle, TrendingUp, 
  FileText, Activity, AlertCircle, CheckCircle2, Clock, Award 
} from 'lucide-react';

const moduleIcons: Record<string, any> = {
  introduction: BookOpen,
  dcb0129: Shield,
  dcb0160: Factory,
  hazard_identification: AlertTriangle,
  risk_assessment: TrendingUp,
  safety_case: FileText,
  incident_management: AlertCircle,
  post_deployment: Activity
};

export default function CSOTrainingDashboard() {
  const navigate = useNavigate();
  const { registration, isLoading: regLoading } = useCSORegistration();
  const { progress, getCompletionPercentage, areAllModulesComplete, getModuleStatus, isLoading: progressLoading } = useCSOProgress(registration?.id);
  const { fetchAttempts, attempts, getPassedAttempt } = useCSOAssessment(registration?.id);

  useEffect(() => {
    if (!regLoading && !registration) {
      navigate('/cso-training-register');
    }
  }, [registration, regLoading, navigate]);

  useEffect(() => {
    if (registration?.id) {
      fetchAttempts();
    }
  }, [registration?.id]);

  if (regLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading training dashboard...</p>
        </div>
      </div>
    );
  }

  if (!registration) {
    return null;
  }

  const completionPercentage = getCompletionPercentage();
  const allModulesComplete = areAllModulesComplete();
  const passedAttempt = getPassedAttempt();
  const hasPassedAssessment = !!passedAttempt;

  const getNextModule = () => {
    for (const module of csoTrainingModules) {
      const status = getModuleStatus(module.id);
      if (status !== 'completed') {
        return module;
      }
    }
    return null;
  };

  const nextModule = getNextModule();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Clinical Safety Officer Training</h1>
              <p className="text-muted-foreground">Welcome back, {registration.full_name}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Main Site
            </Button>
          </div>

          {/* Overall Progress */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Your Progress</h2>
              <Badge variant={completionPercentage === 100 ? 'default' : 'secondary'}>
                {completionPercentage}% Complete
              </Badge>
            </div>
            <Progress value={completionPercentage} className="mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Modules Completed</p>
                <p className="text-2xl font-bold">{Object.values(progress).filter(p => p.completed).length} / {csoTrainingModules.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Assessment Attempts</p>
                <p className="text-2xl font-bold">{attempts.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">
                  {hasPassedAssessment ? 'Certified ✓' : allModulesComplete ? 'Ready for Assessment' : 'In Progress'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Time Invested</p>
                <p className="text-2xl font-bold">
                  {Math.round(Object.values(progress).reduce((sum, p) => sum + p.time_spent_seconds, 0) / 60)} mins
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Certificate Section (if passed) */}
        {hasPassedAssessment && passedAttempt && (
          <Card className="p-6 mb-8 border-primary bg-primary/5">
            <div className="flex items-center gap-4">
              <Award className="h-12 w-12 text-primary" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1">Congratulations! You've completed the training</h3>
                <p className="text-muted-foreground">
                  Assessment passed with {passedAttempt.percentage}% on {new Date(passedAttempt.completed_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <Button onClick={() => navigate(`/cso-certificate/${passedAttempt.id}`)}>
                View Certificate
              </Button>
            </div>
          </Card>
        )}

        {/* Quick Continue */}
        {!hasPassedAssessment && nextModule && (
          <Card className="p-6 mb-8 border-primary">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                {(() => {
                  const Icon = moduleIcons[nextModule.id] || BookOpen;
                  return <Icon className="h-8 w-8 text-primary" />;
                })()}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1">Continue Training</h3>
                <p className="text-muted-foreground">{nextModule.title} • {nextModule.duration} minutes</p>
              </div>
              <Button onClick={() => navigate(`/cso-training-module/${nextModule.id}`)}>
                {getModuleStatus(nextModule.id) === 'not-started' ? 'Start Module' : 'Continue'}
              </Button>
            </div>
          </Card>
        )}

        {/* External e-Learning Resource */}
        <Card className="p-6 mb-8 bg-accent/5 border-accent">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <BookOpen className="h-8 w-8 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-1">Stage 1 - Essentials of Digital Clinical Safety</h3>
              <p className="text-muted-foreground">Complete the official e-Learning for Healthcare (e-LfH) module</p>
            </div>
            <Button 
              variant="outline"
              onClick={() => window.open('https://portal.e-lfh.org.uk/Component/Details/794802', '_blank')}
            >
              Access e-LfH Portal
            </Button>
          </div>
        </Card>

        {/* Training Modules */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Training Modules</h2>
          <div className="grid gap-4">
            {csoTrainingModules.map((module) => {
              const Icon = moduleIcons[module.id] || BookOpen;
              const status = getModuleStatus(module.id);
              const moduleProgress = progress[module.id];

              return (
                <Card key={module.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${
                      status === 'completed' ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-6 w-6 ${status === 'completed' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold mb-1">{module.title}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {module.duration} minutes • {module.sections.length} sections
                          </p>
                        </div>
                        <Badge variant={
                          status === 'completed' ? 'default' : 
                          status === 'in-progress' ? 'secondary' : 
                          'outline'
                        }>
                          {status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {status === 'completed' ? 'Completed' : 
                           status === 'in-progress' ? 'In Progress' : 
                           'Not Started'}
                        </Badge>
                      </div>
                      
                      {status === 'in-progress' && moduleProgress && (
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground mb-1">
                            {Math.round(moduleProgress.time_spent_seconds / 60)} minutes spent
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          variant={status === 'not-started' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => navigate(`/cso-training-module/${module.id}`)}
                        >
                          {status === 'not-started' ? 'Start' : status === 'in-progress' ? 'Continue' : 'Review'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Assessment Section */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${allModulesComplete ? 'bg-primary/10' : 'bg-muted'}`}>
              <Award className={`h-6 w-6 ${allModulesComplete ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Final Assessment</h3>
              <p className="text-muted-foreground mb-4">
                {allModulesComplete 
                  ? 'All modules completed! You can now take the assessment.'
                  : 'Complete all training modules to unlock the assessment.'
                }
              </p>
              
              <div className="bg-muted/50 p-4 rounded-lg mb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                  <span>10 multiple choice questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                  <span>80% pass mark (8 out of 10 correct)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                  <span>Unlimited retakes available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                  <span>Certificate issued upon passing</span>
                </div>
              </div>

              {attempts.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Previous Attempts</h4>
                  <div className="space-y-2">
                    {attempts.slice(0, 3).map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between text-sm bg-muted/30 p-3 rounded">
                        <div>
                          <span className="font-medium">Attempt {attempt.attempt_number}</span>
                          <span className="text-muted-foreground ml-2">
                            {new Date(attempt.completed_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={attempt.passed ? 'default' : 'destructive'}>
                            {attempt.percentage}%
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/cso-training-results/${attempt.id}`)}
                          >
                            View Results
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                disabled={hasPassedAssessment}
                onClick={() => navigate('/cso-training-assessment')}
              >
                {hasPassedAssessment ? 'Assessment Passed' : 'Take Assessment'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
