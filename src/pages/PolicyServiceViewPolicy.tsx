import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  Settings2,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Printer,
  Copy,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generatePolicyDocx } from "@/utils/generatePolicyDocx";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { PolicyDocumentPreview } from "@/components/policy/PolicyDocumentPreview";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface PracticeDetails {
  practice_name?: string;
  address?: string;
  postcode?: string;
  phone?: string;
  practice_manager_name?: string;
  lead_gp_name?: string;
  logo_url?: string | null;
  practice_logo_url?: string | null;
}

const PolicyServiceViewPolicy = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [policy, setPolicy] = useState<any>(null);
  const [practiceDetails, setPracticeDetails] = useState<PracticeDetails | null>(null);
  const [practiceLogoUrl, setPracticeLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Document options with localStorage persistence
  const [showLogo, setShowLogo] = useState(() => {
    const saved = localStorage.getItem('policy_docx_show_logo');
    return saved !== null ? saved === 'true' : true;
  });
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right'>(() => {
    const saved = localStorage.getItem('policy_docx_logo_position');
    return (saved as 'left' | 'center' | 'right') || 'left';
  });
  const [showFooter, setShowFooter] = useState(() => {
    const saved = localStorage.getItem('policy_docx_show_footer');
    return saved !== null ? saved === 'true' : true;
  });
  const [showPageNumbers, setShowPageNumbers] = useState(() => {
    const saved = localStorage.getItem('policy_docx_show_page_numbers');
    return saved !== null ? saved === 'true' : true;
  });

  // Persist options
  useEffect(() => { localStorage.setItem('policy_docx_show_logo', String(showLogo)); }, [showLogo]);
  useEffect(() => { localStorage.setItem('policy_docx_logo_position', logoPosition); }, [logoPosition]);
  useEffect(() => { localStorage.setItem('policy_docx_show_footer', String(showFooter)); }, [showFooter]);
  useEffect(() => { localStorage.setItem('policy_docx_show_page_numbers', String(showPageNumbers)); }, [showPageNumbers]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !id) return;
      setIsLoading(true);

      try {
        // Fetch policy and practice details in parallel
        const [policyRes, practiceRes] = await Promise.all([
          supabase
            .from('policy_completions')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('practice_details')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (policyRes.error) throw policyRes.error;
        setPolicy(policyRes.data);

        if (practiceRes.data) {
          setPracticeDetails(practiceRes.data as any);
          setPracticeLogoUrl(
            (practiceRes.data as any).practice_logo_url ||
            (practiceRes.data as any).logo_url ||
            null
          );
        }
      } catch (error) {
        console.error('Error loading policy:', error);
        toast.error('Failed to load policy');
        navigate('/policy-service/my-policies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, id, navigate]);

  const handleDownload = async () => {
    if (!policy) return;
    setIsDownloading(true);
    try {
      await generatePolicyDocx(
        policy.policy_content,
        policy.metadata,
        policy.policy_title,
        {
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
        }
      );
      toast.success("Policy downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download policy");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyContent = async () => {
    if (!policy) return;
    try {
      await navigator.clipboard.writeText(policy.policy_content);
      setCopied(true);
      toast.success("Policy content copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy content");
    }
  };

  const handleDelete = async () => {
    if (!policy || !user) return;
    try {
      const { error } = await supabase
        .from('policy_completions')
        .delete()
        .eq('id', policy.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Policy removed');
      navigate('/policy-service/my-policies');
    } catch {
      toast.error('Failed to remove policy');
    }
  };

  const getDaysUntilReview = (reviewDate: string): number => {
    const review = new Date(reviewDate);
    const today = new Date();
    return Math.ceil((review.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getReviewBadge = (reviewDate: string) => {
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
    }
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {days} days remaining
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!policy) return null;

  const metadata = policy.metadata as {
    title: string;
    version: string;
    effective_date: string;
    review_date: string;
    references: string[];
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back + Title Row */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/policy-service/my-policies')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Policies
          </Button>
        </div>

        {/* Policy Info Header Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {practiceLogoUrl && (
                  <img
                    src={practiceLogoUrl}
                    alt="Practice Logo"
                    className="h-14 w-auto object-contain shrink-0 rounded"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold truncate">{policy.policy_title}</h1>
                    <Badge variant="secondary">v{policy.version}</Badge>
                  </div>

                  {practiceDetails?.practice_name && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {[practiceDetails.practice_name, practiceDetails.address, practiceDetails.postcode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Created: {format(parseISO(policy.created_at), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Effective: {policy.effective_date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Review: {policy.review_date}</span>
                    </div>
                  </div>

                  {getReviewBadge(policy.review_date)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyContent} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="default" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5">
                  {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download .doc
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Policy</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove "{policy.policy_title}" from your completed policies?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo Position Slider - Prominent inline control */}
        {showLogo && practiceLogoUrl && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
              <ImageIcon className="h-4 w-4" />
              Logo Position
            </div>
            <TooltipProvider delayDuration={200}>
              <div className="inline-flex items-center rounded-lg border bg-muted/50 p-1 gap-0.5">
                {([
                  { value: 'left' as const, icon: AlignLeft, label: 'Left' },
                  { value: 'center' as const, icon: AlignCenter, label: 'Centre' },
                  { value: 'right' as const, icon: AlignRight, label: 'Right' },
                ] as const).map(({ value, icon: Icon, label }) => (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setLogoPosition(value)}
                        className={`
                          relative flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                          ${logoPosition === value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="sm:hidden">
                      {label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* Additional Document Options (collapsed) */}
        <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground mb-2">
              <Settings2 className="h-4 w-4" />
              More Document Options
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mb-4">
            <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="view-show-logo" className="text-sm font-medium">
                    Include Practice Logo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add your practice logo to the document header
                  </p>
                </div>
                <Switch
                  id="view-show-logo"
                  checked={showLogo}
                  onCheckedChange={setShowLogo}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="view-show-footer" className="text-sm font-medium">
                    Include Practice Footer
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add practice name and address to the footer
                  </p>
                </div>
                <Switch
                  id="view-show-footer"
                  checked={showFooter}
                  onCheckedChange={setShowFooter}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="view-show-page-numbers" className="text-sm font-medium">
                    Include Page Numbers
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add page numbers to each page footer
                  </p>
                </div>
                <Switch
                  id="view-show-page-numbers"
                  checked={showPageNumbers}
                  onCheckedChange={setShowPageNumbers}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Document Preview */}
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-2 sm:p-6 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <PolicyDocumentPreview
              content={policy.policy_content}
              metadata={metadata}
              practiceDetails={practiceDetails ? {
                practice_name: practiceDetails.practice_name,
                address: practiceDetails.address,
                postcode: practiceDetails.postcode,
                practice_manager_name: practiceDetails.practice_manager_name,
                lead_gp_name: practiceDetails.lead_gp_name,
              } : undefined}
              practiceLogoUrl={practiceLogoUrl}
              showLogo={showLogo}
              logoPosition={logoPosition}
              showFooter={showFooter}
              showPageNumbers={showPageNumbers}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PolicyServiceViewPolicy;
