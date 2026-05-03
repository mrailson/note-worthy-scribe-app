import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Mail, Search, RefreshCw, Eye, ExternalLink, AlertCircle, CheckCircle2, Clock, XCircle, Download, Paperclip, FileText, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { showToast } from "@/utils/toastWrapper";
import { useNavigate } from "react-router-dom";

interface AttachmentMeta {
  name: string;
  path: string;
  size: number;
  content_type: string;
  ai_summary?: string;
}

interface InboundEmail {
  id: string;
  email_id: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  has_attachments: boolean;
  attachment_count: number;
  attachments: AttachmentMeta[] | null;
  classification: string | null;
  record_id: string | null;
  record_type: string | null;
  processing_status: string;
  processing_notes: string | null;
  practice_id: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Pending", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  processed: { label: "Processed", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  manual_review: { label: "Manual Review", variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
};

const classificationConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  complaint: { label: "Complaint", variant: "destructive" },
  compliment: { label: "Compliment", variant: "default" },
  unknown: { label: "Unknown", variant: "outline" },
};

export const InboundEmailLog = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<InboundEmail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmails((data || []) as unknown as InboundEmail[]);
    } catch (error) {
      console.error("Error fetching inbound emails:", error);
      showToast.error("Failed to load inbound emails", { section: "complaints" });
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async (email: InboundEmail) => {
    try {
      setReprocessing(true);
      const { data, error } = await supabase.functions.invoke("process-inbound-email", {
        body: { reprocess: true, inbound_email_id: email.id },
      });

      if (error) throw error;

      showToast.success("Email re-processed successfully", { section: "complaints" });
      // Fetch fresh data and update selected email
      const { data: freshData } = await supabase
        .from("inbound_emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (freshData) {
        setEmails(freshData as unknown as InboundEmail[]);
        const updated = freshData.find((e: any) => e.id === email.id);
        if (updated) setSelectedEmail(updated as unknown as InboundEmail);
        else setSelectedEmail(null);
      }
    } catch (err) {
      console.error("Reprocess error:", err);
      showToast.error("Failed to re-process email", { section: "complaints" });
    } finally {
      setReprocessing(false);
    }
  };

  const handleDelete = async (email: InboundEmail) => {
    try {
      setDeleting(true);

      // Delete any stored attachments first
      if (email.has_attachments && Array.isArray(email.attachments) && email.attachments.length > 0) {
        const paths = email.attachments.map(att => att.path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from("inbound-email-attachments").remove(paths);
        }
      }

      const { error } = await supabase
        .from("inbound_emails")
        .delete()
        .eq("id", email.id);

      if (error) throw error;

      showToast.success("Email deleted successfully", { section: "complaints" });
      setEmails(prev => prev.filter(e => e.id !== email.id));
      if (selectedEmail?.id === email.id) setSelectedEmail(null);
    } catch (err) {
      console.error("Delete error:", err);
      showToast.error("Failed to delete email", { section: "complaints" });
    } finally {
      setDeleting(false);
      setEmailToDelete(null);
    }
  };

  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      !searchTerm ||
      email.from_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.from_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.subject?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || email.processing_status === statusFilter;
    const matchesClassification = classificationFilter === "all" || email.classification === classificationFilter;

    return matchesSearch && matchesStatus && matchesClassification;
  });

  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage);
  const paginatedEmails = filteredEmails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const navigateToRecord = (email: InboundEmail) => {
    if (!email.record_id || !email.record_type) return;
    if (email.record_type === "complaint") {
      // Scroll to complaints view tab and highlight
      showToast.success(`Navigate to complaint record`, { section: "complaints" });
    } else if (email.record_type === "compliment") {
      navigate(`/compliments/${email.record_id}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Inbound Email Log
              </CardTitle>
              <CardDescription>
                Emails received and automatically processed as complaints or compliments
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by sender, subject..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="manual_review">Manual Review</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classificationFilter} onValueChange={(v) => { setClassificationFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="compliment">Compliment</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline">{filteredEmails.length} email{filteredEmails.length !== 1 ? "s" : ""}</Badge>
            <Badge variant="default">{emails.filter(e => e.processing_status === "processed").length} processed</Badge>
            <Badge variant="secondary">{emails.filter(e => e.processing_status === "manual_review").length} awaiting review</Badge>
            {emails.filter(e => e.processing_status === "failed").length > 0 && (
              <Badge variant="destructive">{emails.filter(e => e.processing_status === "failed").length} failed</Badge>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No inbound emails found</p>
              <p className="text-sm mt-1">
                Emails sent to your configured address will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Received</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmails.map((email) => {
                      const status = statusConfig[email.processing_status] || statusConfig.pending;
                      const cls = email.classification ? classificationConfig[email.classification] : null;

                      return (
                        <TableRow key={email.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmail(email)}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(email.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate">
                              <span className="font-medium">{email.from_name || email.from_email}</span>
                              {email.from_name && (
                                <span className="text-muted-foreground text-xs block truncate">{email.from_email}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="max-w-[250px] truncate block">{email.subject || "(No subject)"}</span>
                          </TableCell>
                          <TableCell>
                            {cls ? (
                              <Badge variant={cls.variant}>{cls.label}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                              {status.icon}
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {email.record_id && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigateToRecord(email); }}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => { e.stopPropagation(); setEmailToDelete(email); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink isActive={page === currentPage} onClick={() => setCurrentPage(page)} className="cursor-pointer">
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Inbound Email Details
            </DialogTitle>
            <DialogDescription>
              Received {selectedEmail ? format(new Date(selectedEmail.created_at), "dd MMMM yyyy 'at' HH:mm") : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedEmail && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">From</p>
                  <p className="text-sm">{selectedEmail.from_name} &lt;{selectedEmail.from_email}&gt;</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">To</p>
                  <p className="text-sm">{selectedEmail.to_email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{selectedEmail.subject || "(No subject)"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                  <p className="text-sm">{selectedEmail.has_attachments ? `${selectedEmail.attachment_count} attachment(s)` : "None"}</p>
                </div>
              </div>

              {/* Classification & Status */}
              <div className="flex flex-wrap gap-2">
                {selectedEmail.classification && (
                  <Badge variant={classificationConfig[selectedEmail.classification]?.variant || "outline"}>
                    {classificationConfig[selectedEmail.classification]?.label || selectedEmail.classification}
                  </Badge>
                )}
                <Badge variant={statusConfig[selectedEmail.processing_status]?.variant || "outline"} className="flex items-center gap-1">
                  {statusConfig[selectedEmail.processing_status]?.icon}
                  {statusConfig[selectedEmail.processing_status]?.label || selectedEmail.processing_status}
                </Badge>
                {selectedEmail.record_type && (
                  <Badge variant="outline">
                    Linked: {selectedEmail.record_type}
                  </Badge>
                )}
              </div>

              {/* Email Body — shown prominently */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Email Content
                </p>
                {selectedEmail.text_body ? (
                  <div className="bg-muted/30 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {selectedEmail.text_body}
                    </pre>
                  </div>
                ) : selectedEmail.html_body ? (
                  <div
                    className="bg-muted/30 rounded-lg p-3 max-h-[300px] overflow-y-auto prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(selectedEmail.html_body, {
                        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
                        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'style'],
                      }),
                    }}
                  />
                ) : (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground italic">(No text content available)</p>
                  </div>
                )}
              </div>

              {/* Processing Notes */}
              {selectedEmail.processing_notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Processing Notes</p>
                  <p className="text-sm">{selectedEmail.processing_notes}</p>
                </div>
              )}

              {/* Attachments list with download and AI summary */}
              {selectedEmail.has_attachments && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({selectedEmail.attachment_count})
                  </p>
                  <div className="space-y-2">
                    {Array.isArray(selectedEmail.attachments) && selectedEmail.attachments.length > 0 ? (
                      selectedEmail.attachments.map((att, idx) => (
                        <div key={idx} className="rounded border bg-muted/30">
                          <div className="flex items-center justify-between gap-2 p-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{att.name}</span>
                              {att.size > 0 && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({(att.size / 1024).toFixed(0)} KB)
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 shrink-0"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const { data, error } = await supabase.storage
                                    .from("inbound-email-attachments")
                                    .createSignedUrl(att.path, 3600);
                                  if (error) throw error;
                                  window.open(data.signedUrl, "_blank");
                                } catch (err) {
                                  console.error("Download error:", err);
                                  showToast.error("Failed to download attachment", { section: "complaints" });
                                }
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {att.ai_summary && (
                            <div className="px-2 pb-2">
                              <p className="text-xs text-muted-foreground italic leading-relaxed">
                                {att.ai_summary}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {selectedEmail.attachment_count} attachment(s) received — files were not stored (received before storage was enabled)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Re-process button for stuck emails */}
              {(selectedEmail.processing_status === "manual_review" || selectedEmail.processing_status === "failed") && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleReprocess(selectedEmail)}
                  disabled={reprocessing}
                >
                  {reprocessing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  {reprocessing ? "Re-processing..." : "Re-process Email"}
                </Button>
              )}

              {/* Link to record */}
              {selectedEmail.record_id && selectedEmail.record_type && (
                <Button variant="outline" className="w-full" onClick={() => navigateToRecord(selectedEmail)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View {selectedEmail.record_type === "complaint" ? "Complaint" : "Compliment"} Record
                </Button>
              )}

              {/* Delete button */}
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => { setEmailToDelete(selectedEmail); setSelectedEmail(null); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Email
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!emailToDelete} onOpenChange={(open) => !open && setEmailToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inbound email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the email from <strong>{emailToDelete?.from_name || emailToDelete?.from_email}</strong>
              {emailToDelete?.subject && <> with subject "<strong>{emailToDelete.subject}</strong>"</>}.
              {emailToDelete?.has_attachments && " Any stored attachments will also be removed."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => emailToDelete && handleDelete(emailToDelete)}
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
