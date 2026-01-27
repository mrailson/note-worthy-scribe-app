import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePolicyCompletions } from "@/hooks/usePolicyCompletions";
import { generatePolicyDocx } from "@/utils/generatePolicyDocx";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PolicyDocumentPreview } from "@/components/policy/PolicyDocumentPreview";

const PolicyServiceMyPolicies = () => {
  const navigate = useNavigate();
  const { completions, isLoading, getDaysUntilReview, deleteCompletion } = usePolicyCompletions();
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewPolicy, setPreviewPolicy] = useState<typeof completions[0] | null>(null);

  const filteredCompletions = completions.filter(c =>
    c.policy_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by review status
  const overdueCount = filteredCompletions.filter(c => getDaysUntilReview(c.review_date) < 0).length;
  const dueSoonCount = filteredCompletions.filter(c => {
    const days = getDaysUntilReview(c.review_date);
    return days >= 0 && days <= 30;
  }).length;

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
        {}
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
          Back to Policy Service
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">My Policies</h1>
              <p className="text-muted-foreground">
                {completions.length} completed {completions.length === 1 ? 'policy' : 'policies'}
              </p>
            </div>
          </div>
        </div>

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
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Created: {format(parseISO(completion.created_at), 'dd/MM/yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Effective: {completion.effective_date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Review: {completion.review_date}</span>
                        </div>
                      </div>
                      
                      {getReviewStatusBadge(completion.review_date)}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewPolicy(completion)}
                      >
                        <Eye className="h-4 w-4" />
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
        {!isLoading && completions.length === 0 && (
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

        {/* Preview Dialog */}
        <Dialog open={!!previewPolicy} onOpenChange={() => setPreviewPolicy(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{previewPolicy?.policy_title}</DialogTitle>
              <DialogDescription>
                Version {previewPolicy?.version} • Effective {previewPolicy?.effective_date}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
              {previewPolicy && (
                <PolicyDocumentPreview
                  content={previewPolicy.policy_content}
                  metadata={previewPolicy.metadata as any}
                  showLogo={false}
                  logoPosition="left"
                  showFooter={false}
                  showPageNumbers={false}
                />
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default PolicyServiceMyPolicies;
