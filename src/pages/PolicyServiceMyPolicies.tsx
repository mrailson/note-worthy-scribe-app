import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Mail,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePolicyCompletions } from "@/hooks/usePolicyCompletions";
import { usePolicyJobs, PolicyJob, getStepLabel } from "@/hooks/usePolicyJobs";
import { usePolicyVersions, PolicyVersion, ChangeType } from "@/hooks/usePolicyVersions";
import { VersionHistoryPanel } from "@/components/policy/VersionHistoryPanel";
import { CreateNewVersionModal } from "@/components/policy/CreateNewVersionModal";
import { HistoricalVersionViewer } from "@/components/policy/HistoricalVersionViewer";
import { PolicyProfileFlagBadge } from "@/components/policy/PolicyProfileFlagBadge";
import { useProfileFlags } from "@/hooks/useProfileFlags";
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
import { QuickGuideDialog, QuickGuideOutput, SavedQuickGuide } from "@/components/policy/QuickGuideDialog";
import { SavedGuidesPopover } from "@/components/policy/SavedGuidesPopover";

const getExpectedMinutes = (job: PolicyJob): number => {
  const length = (job.metadata as any)?.policy_length;
  switch (length) {
    case 'compact': return 1;
    case 'concise': return 2;
    case 'standard': return 3;
    default: return 3;
  }
};

const getCountdownText = (job: PolicyJob): string | null => {
  if (!['pending', 'generating', 'enhancing', 'optimising'].includes(job.status)) return null;
  const expected = getExpectedMinutes(job);
  const elapsed = differenceInMinutes(new Date(), parseISO(job.created_at));
  const remaining = Math.max(0, expected - elapsed);
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
    case 'optimising':
      return <Badge className="gap-1 bg-purple-600"><Loader2 className="h-3 w-3 animate-spin" />{label}</Badge>;
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
  const { versions, fetchVersions, ensureInitialVersion, createVersion, saveDraft } = usePolicyVersions();
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
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [quickGuidePolicy, setQuickGuidePolicy] = useState<{ id: string; content: string; title: string } | null>(null);
  const [practiceLogoUrl, setPracticeLogoUrl] = useState<string | null>(null);
  const [expandedVersionHistory, setExpandedVersionHistory] = useState<Set<string>>(new Set());
  const [newVersionModal, setNewVersionModal] = useState<{ id: string; content: string; version: string; metadata: any } | null>(null);
  const [viewingVersion, setViewingVersion] = useState<{ version: PolicyVersion; currentVersion: string } | null>(null);
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

  const getPersistedDocxOptions = () => {
    const showLogo = localStorage.getItem('policy_docx_show_logo') !== 'false';
    const logoPosition = (localStorage.getItem('policy_docx_logo_position') as 'left' | 'center' | 'right') || 'left';
    const showFooter = localStorage.getItem('policy_docx_show_footer') !== 'false';
    const showPageNumbers = localStorage.getItem('policy_docx_show_page_numbers') !== 'false';
    return {
      showLogo,
      logoPosition,
      showFooter,
      showPageNumbers,
      logoUrl: practiceLogoUrl || undefined,
      practiceDetails: practiceDetails ? {
        name: practiceDetails.practice_name,
        address: practiceDetails.address,
        postcode: practiceDetails.postcode,
        practiceManagerName: practiceDetails.practice_manager_name,
        leadGpName: practiceDetails.lead_gp_name,
      } : undefined,
    };
  };

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
        getPersistedDocxOptions()
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

  const handleRerun = async (completion: typeof completions[0]) => {
    if (!user) return;
    setRerunningId(completion.id);
    try {
      // Fetch practice details for the job
      const { data: practiceData } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      const meta = (completion.metadata || {}) as any;
      const selectedModel = meta.generation_model || 'gemini-2.5-flash';
      const policyLength = meta.policy_length || 'full';

      const practiceDetailsPayload = practiceData ? {
        practice_name: practiceData.practice_name || '',
        address: practiceData.address || '',
        postcode: practiceData.postcode || '',
        ods_code: practiceData.ods_code || '',
        practice_manager_name: practiceData.practice_manager_name || '',
        lead_gp_name: practiceData.lead_gp_name || '',
        senior_gp_partner: (practiceData as any).senior_gp_partner || '',
        caldicott_guardian: (practiceData as any).caldicott_guardian || '',
        dpo_name: (practiceData as any).dpo_name || '',
        siro: (practiceData as any).siro || '',
        safeguarding_lead_adults: (practiceData as any).safeguarding_lead_adults || '',
        safeguarding_lead_children: (practiceData as any).safeguarding_lead_children || '',
        infection_control_lead: (practiceData as any).infection_control_lead || '',
        complaints_lead: (practiceData as any).complaints_lead || '',
        health_safety_lead: (practiceData as any).health_safety_lead || '',
        fire_safety_officer: (practiceData as any).fire_safety_officer || '',
        list_size: (practiceData as any).list_size || null,
        services_offered: (practiceData as any).services_offered || {},
        clinical_system: (practiceData as any).clinical_system || '',
        has_branch_site: (practiceData as any).has_branch_site || false,
        branch_site_name: (practiceData as any).branch_site_name || '',
        branch_site_address: (practiceData as any).branch_site_address || '',
        branch_site_postcode: (practiceData as any).branch_site_postcode || '',
        branch_site_phone: (practiceData as any).branch_site_phone || '',
      } : null;

      const { error: insertError } = await supabase
        .from('policy_generation_jobs')
        .insert({
          user_id: user.id,
          policy_reference_id: completion.policy_reference_id,
          policy_title: completion.policy_title,
          practice_details: practiceDetailsPayload as any,
          email_when_ready: false,
          status: 'pending' as const,
          metadata: { generation_model: selectedModel, policy_length: policyLength, auto_quality_loop: meta.auto_quality_loop ?? false } as any,
        });

      if (insertError) throw insertError;

      // Kick queue
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        fetch(`${supabaseUrl}/functions/v1/generate-policy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: 'process-job', job_user_id: user.id }),
        }).catch(() => {});
      }

      refetchJobs();
      toast.success(`${completion.policy_title} queued for regeneration`);
    } catch (error) {
      console.error('Rerun error:', error);
      toast.error('Failed to queue policy for regeneration');
    } finally {
      setRerunningId(null);
    }
  };

  const handleEmailToMe = async (completion: typeof completions[0]) => {
    const userEmail = user?.email;
    if (!userEmail) {
      toast.error('No email address found on your account');
      return;
    }

    setEmailingId(completion.id);
    try {
      toast.info('Generating and emailing policy document...');

      const metadata = completion.metadata as {
        title: string;
        version: string;
        effective_date: string;
        review_date: string;
        references: string[];
      };

      const { blob, filename } = await generatePolicyDocx(
        completion.policy_content,
        metadata,
        completion.policy_title,
        getPersistedDocxOptions(),
        true // skip download
      );

      // Convert blob to base64
      const reader = new FileReader();
      const base64Content = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const practiceName = practiceDetails?.practice_name || 'Your Practice';
      const now = new Date();
      const sentDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const sentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #005eb8; margin-bottom: 4px;">Policy Document</h2>
          <p style="color: #666; font-size: 13px; margin-top: 0;">Sent ${sentDate} at ${sentTime}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #f0f4f5; font-weight: bold; width: 140px; border: 1px solid #d8dde0;">Policy Title</td>
              <td style="padding: 8px 12px; border: 1px solid #d8dde0;">${completion.policy_title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f0f4f5; font-weight: bold; border: 1px solid #d8dde0;">Version</td>
              <td style="padding: 8px 12px; border: 1px solid #d8dde0;">${metadata.version}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f0f4f5; font-weight: bold; border: 1px solid #d8dde0;">Practice</td>
              <td style="padding: 8px 12px; border: 1px solid #d8dde0;">${practiceName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f0f4f5; font-weight: bold; border: 1px solid #d8dde0;">Effective Date</td>
              <td style="padding: 8px 12px; border: 1px solid #d8dde0;">${metadata.effective_date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f0f4f5; font-weight: bold; border: 1px solid #d8dde0;">Review Date</td>
              <td style="padding: 8px 12px; border: 1px solid #d8dde0;">${metadata.review_date}</td>
            </tr>
            ${metadata.references?.length ? `<tr>
              <td style="padding: 8px 12px; background: #f0f4f5; font-weight: bold; border: 1px solid #d8dde0;">References</td>
              <td style="padding: 8px 12px; border: 1px solid #d8dde0;">${metadata.references.join(', ')}</td>
            </tr>` : ''}
          </table>
          
          <p>The full policy document is attached as a Word file for your records.</p>
          
          <hr style="border: none; border-top: 1px solid #d8dde0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #666;">This email was generated by Notewell AI Policy Service on behalf of ${practiceName}.</p>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          to_email: userEmail,
          subject: `Policy Document: ${completion.policy_title} (v${metadata.version}) — ${practiceName}`,
          html_content: htmlContent,
          from_name: 'Notewell AI',
          reply_to: 'noreply@bluepcn.co.uk',
          attachments: [{
            content: base64Content,
            filename,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }],
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      toast.success(`Policy emailed to ${userEmail}`);
    } catch (error: any) {
      console.error('Email failed:', error);
      toast.error(error.message || 'Failed to email policy');
    } finally {
      setEmailingId(null);
    }
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
      <main className="container mx-auto px-4 py-8 max-w-6xl">
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
                        {['generating', 'enhancing', 'optimising'].includes(job.status) && (
                          <div className="my-2">
                            <Progress value={job.progress_pct || 0} className="h-2" />
                          </div>
                        )}

                        {/* Countdown timer */}
                        {['pending', 'generating', 'enhancing', 'optimising'].includes(job.status) && (
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

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>Submitted: {format(parseISO(job.created_at), 'dd/MM/yyyy HH:mm')}</span>
                          {job.heartbeat_at && ['generating', 'enhancing', 'optimising'].includes(job.status) && (
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
                      {job.status === 'failed' && (
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
                      )}
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
                        <TooltipProvider>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <button
                                className="cursor-pointer"
                                onClick={async () => {
                                  const id = completion.id;
                                  // Ensure initial version exists
                                  await ensureInitialVersion(id, completion.policy_content, completion.metadata, completion.created_at);
                                  await fetchVersions(id);
                                  setExpandedVersionHistory(prev => {
                                    const next = new Set(prev);
                                    if (next.has(id)) next.delete(id); else next.add(id);
                                    return next;
                                  });
                                }}
                              >
                                <Badge variant="secondary" className="gap-0.5 cursor-pointer hover:bg-secondary/80 transition-colors">
                                  v{completion.version}
                                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedVersionHistory.has(completion.id) ? 'rotate-180' : ''}`} />
                                </Badge>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>View version history</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {completion.policy_content && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                            📝 {(() => {
                              const count = completion.policy_content.split(/\s+/).filter(Boolean).length;
                              return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : `${count}`;
                            })()}  words
                          </Badge>
                        )}
                        {(completion.metadata as any)?.generation_duration_seconds && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {Math.floor((completion.metadata as any).generation_duration_seconds / 60)}m {(completion.metadata as any).generation_duration_seconds % 60}s
                          </Badge>
                        )}
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
                      {/* Auto Quality Loop badge */}
                      {(() => {
                        const meta = (completion.metadata as any);
                        const score = meta?.auto_quality_score;
                        const reachedTarget = meta?.auto_quality_reached_target;
                        if (score == null) return null;
                        if (reachedTarget) {
                          return (
                            <Badge className="bg-green-600 hover:bg-green-600 text-white gap-0.5 text-[10px] px-1.5 py-0 h-4">
                              ✓ Auto-optimised · {score}/100
                            </Badge>
                          );
                        }
                        return (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white gap-0.5 text-[10px] px-1.5 py-0 h-4">
                            ⚠ Optimised · {score}/100 — review recommended
                          </Badge>
                        );
                      })()}
                      {/* Profile change flag badge */}
                      {(profileFlags[completion.id] || []).length > 0 && (
                        <PolicyProfileFlagBadge
                          flags={profileFlags[completion.id]}
                          onCreateVersion={(summary) => {
                            setNewVersionModal({
                              id: completion.id,
                              content: completion.policy_content,
                              version: completion.version,
                              metadata: completion.metadata,
                              prefilledSummary: summary,
                              prefilledChangeType: 'staff_update',
                            });
                          }}
                          onDismissAll={() => dismissAllForPolicy(completion.id)}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/policy-service/my-policies/${completion.id}`)}
                        title="View policy"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewVersionModal({
                          id: completion.id,
                          content: completion.policy_content,
                          version: completion.version,
                          metadata: completion.metadata,
                        })}
                        title="Create new version"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <SavedGuidesPopover
                        guides={((completion.metadata as any)?.quick_guides || []) as SavedQuickGuide[]}
                        policyTitle={completion.policy_title}
                        onDelete={async (guideId) => {
                          try {
                            const meta = (completion.metadata || {}) as any;
                            const guides = (meta.quick_guides || []).filter((g: any) => g.id !== guideId);
                            // Also delete from storage
                            const deleted = (meta.quick_guides || []).find((g: any) => g.id === guideId);
                            if (deleted?.storagePath) {
                              await supabase.storage.from('quick-guides').remove([deleted.storagePath]);
                            }
                            await supabase
                              .from('policy_completions')
                              .update({ metadata: { ...meta, quick_guides: guides } })
                              .eq('id', completion.id)
                              .eq('user_id', user!.id);
                            refreshCompletions();
                            toast.success('Quick guide removed');
                          } catch { toast.error('Failed to remove guide'); }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuickGuidePolicy({ id: completion.id, content: completion.policy_content, title: completion.policy_title })}
                        title="Create Quick Guide"
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEmailToMe(completion)}
                        disabled={emailingId === completion.id}
                        title="Email policy to me"
                      >
                        {emailingId === completion.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
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

                  {/* Version History Panel */}
                  <VersionHistoryPanel
                    versions={versions[completion.id] || []}
                    isOpen={expandedVersionHistory.has(completion.id)}
                    onViewVersion={(version) => setViewingVersion({ version, currentVersion: completion.version })}
                    onDownloadVersion={async (version) => {
                      try {
                        const vContent = (version.content as any)?.policy_content || '';
                        const vMeta = (version.content as any)?.metadata || completion.metadata;
                        await generatePolicyDocx(vContent, vMeta, completion.policy_title, getPersistedDocxOptions());
                        toast.success(`Version ${version.version_number} downloaded`);
                      } catch { toast.error('Failed to download version'); }
                    }}
                  />
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
          logoUrl={practiceLogoUrl}
          onGenerated={async (output: QuickGuideOutput) => {
            if (user && quickGuidePolicy) {
              try {
                const completion = completions.find(c => c.id === quickGuidePolicy.id);
                const currentMeta = (completion?.metadata || {}) as any;
                const existingGuides: SavedQuickGuide[] = currentMeta.quick_guides || [];
                const newGuide: SavedQuickGuide = {
                  id: crypto.randomUUID(),
                  type: output.type,
                  audience: output.audience,
                  fileName: output.fileName,
                  storagePath: output.storagePath || '',
                  generatedAt: output.generatedAt,
                };
                // Cap at 10 guides, remove oldest if needed
                const updatedGuides = [...existingGuides, newGuide].slice(-10);
                const updatedMeta = { ...currentMeta, quick_guides: updatedGuides, last_quick_guide: output };
                await supabase
                  .from('policy_completions')
                  .update({ metadata: updatedMeta })
                  .eq('id', quickGuidePolicy.id)
                  .eq('user_id', user.id);
                refreshCompletions();
              } catch (err) {
                console.error('Failed to persist quick guide metadata:', err);
              }
            }
          }}
        />
      )}

      {/* Create New Version Modal */}
      {newVersionModal && (
        <CreateNewVersionModal
          open={!!newVersionModal}
          onOpenChange={(open) => { if (!open) setNewVersionModal(null); }}
          currentVersion={newVersionModal.version}
          policyContent={newVersionModal.content}
          metadata={newVersionModal.metadata}
          onPublish={async (data) => {
            await createVersion({
              policyId: newVersionModal.id,
              currentVersion: newVersionModal.version,
              changeType: data.changeType,
              changeSummary: data.changeSummary,
              policyContent: data.policyContent,
              metadata: { ...newVersionModal.metadata, version: undefined },
              approvedBy: data.approvedBy,
              nextReviewDate: data.nextReviewDate,
            });
            refreshCompletions();
          }}
          onSaveDraft={async (data) => {
            await saveDraft({
              policyId: newVersionModal.id,
              currentVersion: newVersionModal.version,
              changeType: data.changeType,
              changeSummary: data.changeSummary,
              policyContent: data.policyContent,
              metadata: { ...newVersionModal.metadata, version: undefined },
              approvedBy: data.approvedBy,
              nextReviewDate: data.nextReviewDate,
            });
          }}
        />
      )}

      {/* Historical Version Viewer */}
      <HistoricalVersionViewer
        open={!!viewingVersion}
        onOpenChange={(open) => { if (!open) setViewingVersion(null); }}
        version={viewingVersion?.version || null}
        currentVersion={viewingVersion?.currentVersion || '1.0'}
        practiceLogoUrl={practiceLogoUrl}
        practiceDetails={practiceDetails}
        onDownload={async (version) => {
          try {
            const vContent = (version.content as any)?.policy_content || '';
            const vMeta = (version.content as any)?.metadata || {};
            await generatePolicyDocx(vContent, vMeta, 'Policy', getPersistedDocxOptions());
            toast.success(`Version ${version.version_number} downloaded`);
          } catch { toast.error('Failed to download version'); }
        }}
      />
    </div>
  );
};

export default PolicyServiceMyPolicies;
