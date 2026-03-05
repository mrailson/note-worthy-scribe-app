import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Search, 
  Download, 
  FileText, 
  Calendar, 
  Clock, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Eye,
  RefreshCw,
  XCircle,
  Sparkles,
  Info,
  Coffee,
  BookOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePolicyCompletions } from "@/hooks/usePolicyCompletions";
import { usePolicyJobs, PolicyJob, getStepLabel } from "@/hooks/usePolicyJobs";
import { generatePolicyDocx } from "@/utils/generatePolicyDocx";
import { toast } from "sonner";
import { format, parseISO, formatDistanceToNow, differenceInHours, differenceInMinutes } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { QuickGuideDialog, QuickGuideOutput } from "@/components/policy/QuickGuideDialog";

const EXPECTED_GENERATION_MINUTES = 10;

const getCountdownText = (job: PolicyJob): string | null => {
  if (!['pending', 'generating', 'enhancing'].includes(job.status)) return null;
  const elapsed = differenceInMinutes(new Date(), parseISO(job.created_at));
  const remaining = Math.max(0, EXPECTED_GENERATION_MINUTES - elapsed);
  if (remaining <= 0) return 'Should be ready very soon…';
  return `Expected ready in ~${remaining} min${remaining !== 1 ? 's' : ''}`;
};


const getJobStatusBadge = (job: PolicyJob) => {
  const label = getStepLabel(job);
  switch (job.status) {
    case 'pending':
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{label}</Badge>;
    case 'generating':
      return <Badge className="gap-1 bg-blue-600"><Loader2 className="h-3 w-3 animate-spin" />{label}</Badge>;
    case 'enhancing':
      return <Badge className="gap-1 bg-indigo-600"><Loader2 className="h-3 w-3 animate-spin" />{label}</Badge>;
    case 'completed':
      return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />{label}</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{label}</Badge>;
    default:
      return <Badge variant="secondary">{job.status}</Badge>;
  }
};

const PolicyServiceMyPolicies = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completions, isLoading, getDaysUntilReview, deleteCompletion, refreshCompletions } = usePolicyCompletions();
  const { jobs, activeJobCount, isLoading: jobsLoading, kickQueue, refetch: refetchJobs } = usePolicyJobs();
  const prevActiveJobCountRef = useRef(activeJobCount);

  // Auto-refresh completions when active jobs finish (count drops)
  useEffect(() => {
    if (prevActiveJobCountRef.current > 0 && activeJobCount < prevActiveJobCountRef.current) {
      refreshCompletions();
    }
    prevActiveJobCountRef.current = activeJobCount;
  }, [activeJobCount, refreshCompletions]);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [quickGuidePolicy, setQuickGuidePolicy] = useState<{ id: string; content: string; title: string } | null>(null);
  const [practiceLogoUrl, setPracticeLogoUrl] = useState<string | null>(null);
  const [practiceDetails, setPracticeDetails] = useState<{
    practice_name?: string;
    address?: string;
    postcode?: string;
    practice_manager_name?: string;
    lead_gp_name?: string;
  } | null>(null);

  // Fetch practice details and logo URL
  useEffect(() => {
    const fetchPractice = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('practice_details')
          .select('logo_url, practice_logo_url, practice_name, address, postcode, practice_manager_name, lead_gp_name')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setPracticeLogoUrl(data.practice_logo_url || data.logo_url || null);
          setPracticeDetails(data);
        }
      } catch (error) {
        console.error('Error fetching practice details:', error);
      }
    };
    fetchPractice();
  }, [user]);

  const filteredCompletions = completions.filter(c =>
    c.policy_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overdueCount = filteredCompletions.filter(c => getDaysUntilReview(c.review_date) < 0).length;
  const dueSoonCount = filteredCompletions.filter(c => {
    const days = getDaysUntilReview(c.review_date);
    return days >= 0 && days <= 30;
  }).length;

  const activeJobs = jobs.filter(j => ['pending', 'generating', 'enhancing'].includes(j.status));
  const recentFailedJobs = jobs.filter(j => j.status === 'failed');

  const handleDownload = async (completion: typeof completions[0]) => {
    setDownloadingId(completion.id);
    try {
      const metadata = completion.metadata as {
        title: string;
        version: string;
        effective_date: string;
        review_date: string;
        references: string[];
      };
      
      await generatePolicyDocx(
        completion.policy_content,
        metadata,
        completion.policy_title,
        {
          showLogo: true,
          logoUrl: practiceLogoUrl || undefined,
          practiceDetails: practiceDetails ? {
            name: practiceDetails.practice_name,
            address: practiceDetails.address,
            postcode: practiceDetails.postcode,
            practiceManagerName: practiceDetails.practice_manager_name,
            leadGpName: practiceDetails.lead_gp_name,
          } : undefined,
        }
      );
      toast.success("Policy downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download policy");
    } finally {
      setDownloadingId(null);
    }
  };


  const handleDelete = async (completionId: string) => {
    await deleteCompletion(completionId);
  };

  const getReviewStatusBadge = (reviewDate: string) => {
    const days = getDaysUntilReview(reviewDate);
    
    if (days < 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue by {Math.abs(days)} days
        </Badge>
      );
    } else if (days <= 30) {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 gap-1">
          <Clock className="h-3 w-3" />
          Due in {days} days
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {days} days remaining
        </Badge>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/policy-service')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Practice Policies
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">My Policies</h1>
              <p className="text-muted-foreground">
                {completions.length} completed {completions.length === 1 ? 'policy' : 'policies'}
                {activeJobCount > 0 && ` • ${activeJobCount} in progress`}
              </p>
            </div>
          </div>
        </div>

        {/* In Progress Jobs */}
        {(activeJobs.length > 0 || recentFailedJobs.length > 0) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${activeJobCount > 0 ? 'animate-spin' : ''}`} />
                In Progress
                {activeJobCount > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">Auto-refreshing every 10s</span>
                )}
              </h2>
              {activeJobCount > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Restart Queue
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <AlertDialogTitle>Restart Queue?</AlertDialogTitle>
                      </div>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <span className="block">
                            This is a diagnostic tool and should only be used if your policy has been stuck for more than 15 minutes.
                          </span>
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <span className="text-sm text-amber-700 dark:text-amber-300">
                              ⚠️ Under normal conditions, policies generate automatically. Only restart if there is a genuine issue.
                            </span>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          kickQueue();
                          toast.info('Queue processor restarted');
                        }}
                      >
                        Restart Queue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="space-y-2">
              {[...activeJobs, ...recentFailedJobs].map(job => (
                <Card key={job.id} className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{job.policy_title}</h3>
                          {getJobStatusBadge(job)}
                        </div>

                        {/* Progress bar for active jobs */}
                        {['generating', 'enhancing'].includes(job.status) && (
                          <div className="my-2">
                            <Progress value={job.progress_pct || 0} className="h-2" />
                          </div>
                        )}

                        {/* Countdown timer */}
                        {['pending', 'generating', 'enhancing'].includes(job.status) && (
                          <div className="flex items-center gap-2 my-2">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                              <Coffee className="h-3.5 w-3.5" />
                              <span>{getCountdownText(job)}</span>
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground transition-colors">
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="!w-[360px] text-sm !p-6" side="bottom" align="start" sideOffset={8}>
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-foreground text-[13px]">Why does this take so long?</h4>
                                  <p className="text-muted-foreground leading-relaxed text-[12.5px]">Each policy is a substantial document (typically 25–45 pages) that goes through several stages:</p>
                                  <ul className="text-muted-foreground space-y-2 list-disc pl-5 leading-relaxed text-[12.5px]">
                                    <li>Multi-part content generation tailored to your practice</li>
                                    <li>Cross-referencing against current CQC regulatory requirements</li>
                                    <li>Enhancement pass for professional language and completeness</li>
                                    <li>Placeholder replacement with your practice details</li>
                                    <li>Final quality checks and formatting</li>
                                  </ul>
                                  <div className="bg-muted/50 rounded-lg p-3.5 mt-2">
                                    <p className="text-muted-foreground leading-relaxed text-[12.5px]">☕ Feel free to leave this screen and come back later — your policy will continue generating in the background. Go and grab a coffee!</p>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Submitted: {format(parseISO(job.created_at), 'dd/MM/yyyy HH:mm')}</span>
                          {job.heartbeat_at && ['generating', 'enhancing'].includes(job.status) && (
                            <span>Last activity: {formatDistanceToNow(parseISO(job.heartbeat_at), { addSuffix: true })}</span>
                          )}
                          {job.email_when_ready && (
                            <span className="flex items-center gap-1">📧 Email notification on</span>
                          )}
                        </div>
                        {job.status === 'failed' && job.error_message && (
                          <p className="text-xs text-destructive mt-1">{job.error_message}</p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove from queue?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove "{job.policy_title}" from the queue. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('policy_generation_jobs')
                                    .delete()
                                    .eq('id', job.id);
                                  if (error) throw error;
                                  toast.success(`"${job.policy_title}" removed from queue`);
                                  refetchJobs();
                                } catch (e) {
                                  toast.error('Failed to remove job');
                                }
                              }}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-primary">{completions.length}</div>
              <div className="text-xs text-muted-foreground">Total Policies</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">{completions.length - overdueCount - dueSoonCount}</div>
              <div className="text-xs text-muted-foreground">Up to Date</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-amber-600">{dueSoonCount}</div>
              <div className="text-xs text-muted-foreground">Due Soon (30 days)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search completed policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Policy List */}
        {!isLoading && filteredCompletions.length > 0 && (
          <div className="space-y-3">
            {filteredCompletions.map(completion => (
              <Card key={completion.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium truncate">{completion.policy_title}</h3>
                        <Badge variant="secondary">v{completion.version}</Badge>
                        {differenceInHours(new Date(), parseISO(completion.created_at)) < 24 && (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white gap-0.5 text-[10px] px-1.5 py-0 h-4">
                            <Sparkles className="h-2.5 w-2.5" />
                            New
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Created: {format(parseISO(completion.created_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Effective: {format(parseISO(completion.effective_date), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Review: {format(parseISO(completion.review_date), 'dd/MM/yyyy')}</span>
                        </div>
                      </div>
                      
                      {getReviewStatusBadge(completion.review_date)}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/policy-service/my-policies/${completion.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuickGuidePolicy({ id: completion.id, content: completion.policy_content, title: completion.policy_title })}
                        title="Quick Guide"
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(completion)}
                        disabled={downloadingId === completion.id}
                      >
                        {downloadingId === completion.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Policy</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{completion.policy_title}" from your completed policies? 
                              This will not delete the policy document itself.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(completion.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && completions.length === 0 && activeJobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No Completed Policies</h3>
              <p className="text-muted-foreground mb-4">
                You haven't marked any policies as completed yet. Generate a policy and mark it as completed to see it here.
              </p>
              <Button onClick={() => navigate('/policy-service/create')}>
                Create New Policy
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Search Results */}
        {!isLoading && completions.length > 0 && filteredCompletions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No policies found matching "{searchQuery}"</p>
              <Button variant="link" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        )}

      </main>

      {quickGuidePolicy && (
        <QuickGuideDialog
          open={!!quickGuidePolicy}
          onOpenChange={(open) => { if (!open) setQuickGuidePolicy(null); }}
          policyContent={quickGuidePolicy.content}
          policyTitle={quickGuidePolicy.title}
          policyId={quickGuidePolicy.id}
          onGenerated={async (output: QuickGuideOutput) => {
            // Persist to policy metadata
            if (user && quickGuidePolicy) {
              try {
                const completion = completions.find(c => c.id === quickGuidePolicy.id);
                const currentMeta = (completion?.metadata || {}) as any;
                const updatedMeta = { ...currentMeta, last_quick_guide: output };
                await supabase
                  .from('policy_completions')
                  .update({ metadata: updatedMeta })
                  .eq('id', quickGuidePolicy.id)
                  .eq('user_id', user.id);
              } catch (err) {
                console.error('Failed to persist quick guide metadata:', err);
              }
            }
          }}
        />
      )}
    </div>
  );
};

export default PolicyServiceMyPolicies;
