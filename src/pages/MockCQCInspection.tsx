import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, Play, History, ArrowRight, Building2, Shield, Users, Heart, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useToast } from '@/hooks/use-toast';
import { InspectionDashboard } from '@/components/mock-cqc/InspectionDashboard';
import { useMockInspection } from '@/hooks/useMockInspection';

interface Practice {
  id: string;
  name: string;
}

const MockCQCInspection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [startingInspection, setStartingInspection] = useState(false);

  const {
    activeSession,
    sessionElements,
    loadSession,
    createSession,
    isLoading: sessionLoading
  } = useMockInspection();

  useEffect(() => {
    fetchPractices();
  }, [user]);

  const fetchPractices = async () => {
    if (!user) return;

    try {
      // Fetch all practices for the inspection picker
      const { data: practicesData, error } = await supabase
        .from('gp_practices')
        .select('id, name')
        .order('name');

      if (!error && practicesData) {
        setPractices(practicesData);
        if (practicesData.length === 1) {
          setSelectedPracticeId(practicesData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching practices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInspection = async () => {
    if (!selectedPracticeId) {
      toast({
        title: "Please select a practice",
        variant: "destructive"
      });
      return;
    }

    setStartingInspection(true);
    try {
      const session = await createSession(selectedPracticeId);
      if (session) {
        toast({
          title: "Mock inspection started",
          description: "Good luck! Remember, this is a supportive learning exercise."
        });
      }
    } catch (error) {
      console.error('Error starting inspection:', error);
      toast({
        title: "Failed to start inspection",
        variant: "destructive"
      });
    } finally {
      setStartingInspection(false);
    }
  };

  const selectedPracticeName = practices.find(p => p.id === selectedPracticeId)?.name || '';

  // If there's an active session, show the inspection dashboard
  if (activeSession) {
    return (
      <InspectionDashboard 
        session={activeSession}
        elements={sessionElements}
        practiceName={selectedPracticeName || 'Practice'}
        onClose={() => loadSession(null)}
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>Mock CQC Inspection | Meeting Magic</title>
        <meta name="description" content="Conduct a mock CQC inspection to identify compliance gaps and prepare for real inspections." />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <ClipboardCheck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Mock CQC Inspection</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your critical friend to help identify compliance gaps before a real CQC inspection. 
              Work through key areas systematically and receive a priority action report.
            </p>
          </div>

          {/* Domain Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <Shield className="h-6 w-6 text-red-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Safe</p>
                <p className="text-xs text-muted-foreground">Priority</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Well-led</p>
                <p className="text-xs text-muted-foreground">Priority</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <ClipboardCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Effective</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <Heart className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Caring</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Responsive</p>
              </CardContent>
            </Card>
          </div>

          {/* Start Inspection Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Start New Inspection
              </CardTitle>
              <CardDescription>
                Select a practice/site and begin your mock inspection. You'll work through elements from each CQC domain, 
                with Safe and Well-led domains prioritised. There's no time limit – take as long as you need.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Practice/Site</label>
                <Select value={selectedPracticeId} onValueChange={setSelectedPracticeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loading ? "Loading practices..." : "Choose a practice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {practices.map(practice => (
                      <SelectItem key={practice.id} value={practice.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {practice.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleStartInspection}
                disabled={!selectedPracticeId || startingInspection || sessionLoading}
                className="w-full"
              >
                {startingInspection ? (
                  "Preparing inspection..."
                ) : (
                  <>
                    Start Mock Inspection
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Past Inspections - Future Enhancement */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Previous Inspections
              </CardTitle>
              <CardDescription>
                View and download reports from previous mock inspections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-4">
                Your inspection history will appear here after you complete your first mock inspection.
              </p>
            </CardContent>
          </Card>

          {/* Tips Section */}
          <div className="mt-8 p-6 bg-muted/30 rounded-lg border">
            <h3 className="font-semibold mb-3">💡 Tips for a productive mock inspection</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• <strong>Be honest</strong> – this is a learning exercise, not a test to pass</li>
              <li>• <strong>Gather your team</strong> – different perspectives help identify gaps</li>
              <li>• <strong>Have documents ready</strong> – policies, training records, audit logs</li>
              <li>• <strong>Take notes</strong> – capture improvement ideas as you go</li>
              <li>• <strong>Focus on priority domains</strong> – Safe and Well-led are weighted heavily by CQC</li>
            </ul>
          </div>
        </main>
      </div>
    </>
  );
};

export default MockCQCInspection;
