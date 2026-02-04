import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Play, History, ArrowRight, Building2, Shield, Users, Heart, Clock, Trash2, Search, X, Zap, ShieldCheck } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useToast } from '@/hooks/use-toast';
import { InspectionDashboard } from '@/components/mock-cqc/InspectionDashboard';
import { useMockInspection, InspectionType } from '@/hooks/useMockInspection';
import { INSPECTION_TYPES, getItemCountsByType } from '@/components/mock-cqc/fundamentals';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface Practice {
  id: string;
  name: string;
  practice_code: string | null;
  postcode: string | null;
}

interface InProgressSession {
  id: string;
  practice_id: string;
  practice_name: string;
  started_at: string;
  progress: number;
  inspection_type: InspectionType;
}

const MockCQCInspection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('');
  const [practiceSearch, setPracticeSearch] = useState('');
  const [practiceSearchOpen, setPracticeSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingInspection, setStartingInspection] = useState(false);
  const [inProgressSessions, setInProgressSessions] = useState<InProgressSession[]>([]);
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);
  const [selectedInspectionType, setSelectedInspectionType] = useState<InspectionType>('short');

  const {
    activeSession,
    sessionElements,
    loadSession,
    createSession,
    upgradeInspectionType,
    isLoading: sessionLoading
  } = useMockInspection();

  const itemCounts = getItemCountsByType();

  useEffect(() => {
    if (user) {
      fetchPractices();
      fetchInProgressSessions();
    }
  }, [user]);

  const fetchPractices = async () => {
    if (!user) return;

    try {
      // Fetch all practices for the inspection picker
      const { data: practicesData, error } = await supabase
        .from('gp_practices')
        .select('id, name, practice_code, postcode')
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

  const fetchInProgressSessions = async () => {
    if (!user) return;

    try {
      // Fetch in-progress sessions for this user
      const { data: sessions, error } = await supabase
        .from('mock_inspection_sessions')
        .select(`
          id,
          practice_id,
          started_at,
          inspection_type,
          gp_practices!inner(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false });

      if (!error && sessions) {
        // For each session, calculate progress
        const sessionsWithProgress: InProgressSession[] = await Promise.all(
          sessions.map(async (session: any) => {
            const { count: totalCount } = await supabase
              .from('mock_inspection_elements')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.id);

            const { count: assessedCount } = await supabase
              .from('mock_inspection_elements')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.id)
              .neq('status', 'not_assessed');

            const progress = totalCount ? Math.round(((assessedCount || 0) / totalCount) * 100) : 0;

            return {
              id: session.id,
              practice_id: session.practice_id,
              practice_name: session.gp_practices?.name || 'Unknown Practice',
              started_at: session.started_at,
              progress,
              inspection_type: (session.inspection_type || 'long') as InspectionType
            };
          })
        );

        setInProgressSessions(sessionsWithProgress);
      }
    } catch (error) {
      console.error('Error fetching in-progress sessions:', error);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    setResumingSessionId(sessionId);
    try {
      await loadSession(sessionId);
      // Find practice name for display
      const session = inProgressSessions.find(s => s.id === sessionId);
      if (session) {
        setSelectedPracticeId(session.practice_id);
      }
    } catch (error) {
      console.error('Error resuming session:', error);
      toast({
        title: "Failed to resume session",
        variant: "destructive"
      });
    } finally {
      setResumingSessionId(null);
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

    // Check if there's already an in-progress session for this practice
    const existingSession = inProgressSessions.find(s => s.practice_id === selectedPracticeId);
    if (existingSession) {
      toast({
        title: "Inspection already in progress",
        description: `You already have an active inspection for this practice. Use 'Resume' to continue.`,
        variant: "destructive"
      });
      return;
    }

    setStartingInspection(true);
    try {
      const session = await createSession(selectedPracticeId, selectedInspectionType);
      if (session) {
        toast({
          title: "Mock inspection started",
          description: `Starting ${INSPECTION_TYPES[selectedInspectionType].label} inspection. Good luck!`
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

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Delete elements first (due to foreign key)
      await supabase
        .from('mock_inspection_elements')
        .delete()
        .eq('session_id', sessionId);

      // Then delete the session
      const { error } = await supabase
        .from('mock_inspection_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session deleted",
        description: "The inspection session has been removed."
      });

      // Refresh the list
      fetchInProgressSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: "Failed to delete session",
        variant: "destructive"
      });
    }
  };

  const selectedPracticeName = practices.find(p => p.id === selectedPracticeId)?.name || 
    inProgressSessions.find(s => s.id === activeSession?.id)?.practice_name || '';

  // If there's an active session, show the inspection dashboard
  if (activeSession) {
    return (
      <InspectionDashboard 
        session={activeSession}
        elements={sessionElements}
        practiceName={selectedPracticeName || 'Practice'}
        onClose={() => {
          loadSession(null);
          fetchInProgressSessions(); // Refresh list when returning
        }}
        onUpgradeType={upgradeInspectionType}
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
                <Popover open={practiceSearchOpen} onOpenChange={setPracticeSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={practiceSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedPracticeId ? (
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {practices.find(p => p.id === selectedPracticeId)?.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          {loading ? "Loading practices..." : "Search for a practice..."}
                        </span>
                      )}
                      {selectedPracticeId && (
                        <X 
                          className="h-4 w-4 opacity-50 hover:opacity-100" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPracticeId('');
                            setPracticeSearch('');
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Type to search practices..." 
                        value={practiceSearch}
                        onValueChange={setPracticeSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No practice found.</CommandEmpty>
                        <CommandGroup>
                          {practices
                            .filter(practice => {
                              if (!practiceSearch.trim()) return true;
                              const searchLower = practiceSearch.toLowerCase().trim();
                              const nameLower = practice.name.toLowerCase();
                              const codeLower = (practice.practice_code || '').toLowerCase();
                              const postcodeLower = (practice.postcode || '').toLowerCase();
                              
                              // Match by name
                              if (nameLower.includes(searchLower)) return true;
                              // Match by practice code (K code)
                              if (codeLower.includes(searchLower)) return true;
                              // Handle 'K' prefix searches (e.g., "K84001" or just "84001")
                              if (searchLower.startsWith('k') && codeLower.includes(searchLower.substring(1))) return true;
                              // Match by postcode
                              if (postcodeLower.includes(searchLower)) return true;
                              
                              return false;
                            })
                            .slice(0, 10)
                            .map(practice => (
                              <CommandItem
                                key={practice.id}
                                value={`${practice.name} ${practice.practice_code || ''} ${practice.postcode || ''}`}
                                onSelect={() => {
                                  setSelectedPracticeId(practice.id);
                                  setPracticeSearchOpen(false);
                                  setPracticeSearch('');
                                }}
                              >
                                <Building2 className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>{practice.name}</span>
                                  {(practice.practice_code || practice.postcode) && (
                                    <span className="text-xs text-muted-foreground">
                                      {[practice.practice_code, practice.postcode].filter(Boolean).join(' • ')}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Inspection Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Choose Inspection Depth</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(Object.keys(INSPECTION_TYPES) as InspectionType[]).map((type) => {
                    const config = INSPECTION_TYPES[type];
                    const isSelected = selectedInspectionType === type;
                    const count = type === 'short' ? itemCounts.short : type === 'mid' ? itemCounts.mid : itemCounts.long;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedInspectionType(type)}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all",
                          isSelected 
                            ? `${config.borderColor} ${config.bgColor}` 
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {type === 'short' && <Zap className={cn("h-5 w-5", isSelected ? config.color : "text-muted-foreground")} />}
                          {type === 'mid' && <ClipboardCheck className={cn("h-5 w-5", isSelected ? config.color : "text-muted-foreground")} />}
                          {type === 'long' && <ShieldCheck className={cn("h-5 w-5", isSelected ? config.color : "text-muted-foreground")} />}
                          <span className={cn("font-semibold", isSelected ? config.color : "")}>{config.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{config.duration}</p>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {count} fundamental items
                        </Badge>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 You can upgrade to a more comprehensive inspection at any time – your progress will be preserved.
                </p>
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
                    Start {INSPECTION_TYPES[selectedInspectionType].label} Inspection
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* In Progress Sessions */}
          {inProgressSessions.length > 0 && (
            <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Continue Your Mock Inspection
                </CardTitle>
                <CardDescription>
                  You have inspections in progress. Pick up where you left off.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {inProgressSessions.map(session => (
                  <div 
                    key={session.id}
                    className="flex items-center justify-between p-4 bg-background rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.practice_name}</p>
                          <Badge variant="outline" className={INSPECTION_TYPES[session.inspection_type].color}>
                            {INSPECTION_TYPES[session.inspection_type].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Started {new Date(session.started_at).toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} • {session.progress}% complete
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this inspection?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the inspection for {session.practice_name} and all associated data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteSession(session.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        onClick={() => handleResumeSession(session.id)}
                        disabled={resumingSessionId === session.id}
                        size="sm"
                      >
                        {resumingSessionId === session.id ? 'Loading...' : 'Resume'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past Inspections - Future Enhancement */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Completed Inspections
              </CardTitle>
              <CardDescription>
                View and download reports from completed mock inspections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-4">
                Your completed inspection reports will appear here.
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
