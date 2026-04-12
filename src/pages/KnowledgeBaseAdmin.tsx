import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Upload, Loader2, Trash2, RefreshCw, CalendarIcon, BookOpen, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Helmet } from "react-helmet-async";

interface KBCategory {
  id: string;
  name: string;
  colour: string;
  icon: string;
  sort_order: number;
}

interface KBDocument {
  id: string;
  title: string;
  category_id: string | null;
  source: string | null;
  effective_date: string | null;
  uploaded_at: string;
  summary: string | null;
  key_points: string[] | null;
  file_url: string | null;
  file_type: string | null;
  status: string;
  is_active: boolean;
  kb_categories: KBCategory | null;
}

export default function KnowledgeBaseAdmin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [source, setSource] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>();
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "system_admin",
      });
      if (!data) {
        navigate("/knowledge-base");
        return;
      }
      setIsAdmin(true);
    };

    checkAdmin();
  }, [authLoading, user, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catsRes, docsRes] = await Promise.all([
      supabase.from("kb_categories").select("*").order("sort_order"),
      supabase.from("kb_documents").select("*, kb_categories(*)").order("uploaded_at", { ascending: false }),
    ]);
    if (catsRes.data) setCategories(catsRes.data);
    if (docsRes.data) setDocuments(docsRes.data as unknown as KBDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const readFileAsText = async (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(f);
    });
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!file && !urlInput.trim()) {
      toast.error("Please upload a file or paste a URL");
      return;
    }
    if (!user) return;

    setUploading(true);
    try {
      let fileUrl = urlInput.trim() || null;
      let fileType = urlInput.trim() ? "url" : "pdf";
      let documentText = "";

      // Upload file if provided
      if (file) {
        fileType = file.name.endsWith(".docx") ? "docx" : "pdf";
        const fileName = `kb-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

        const { error: uploadError } = await supabase.storage
          .from("knowledge-base")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("knowledge-base")
          .getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;

        // Read file text for summarisation
        try {
          documentText = await readFileAsText(file);
        } catch {
          documentText = `[File uploaded: ${file.name}. Manual text extraction needed.]`;
        }
      }

      // Insert document record
      const { data: doc, error: insertError } = await supabase
        .from("kb_documents")
        .insert({
          title: title.trim(),
          category_id: categoryId || null,
          source: source.trim() || null,
          effective_date: effectiveDate ? format(effectiveDate, "yyyy-MM-dd") : null,
          uploaded_by: user.id,
          file_url: fileUrl,
          file_type: fileType,
          status: "processing",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call summarisation edge function
      if (documentText.length > 50) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { data: { session } } = await supabase.auth.getSession();

        fetch(`${supabaseUrl}/functions/v1/kb-summarise`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            document_id: doc.id,
            document_text: documentText,
          }),
        }).then(async (resp) => {
          if (resp.ok) {
            toast.success("Document summarised successfully");
            loadData();
          } else {
            const err = await resp.json().catch(() => ({}));
            toast.error(`Summarisation failed: ${err.error || "Unknown error"}`);
            loadData();
          }
        }).catch(() => {
          toast.error("Summarisation request failed");
          loadData();
        });
      } else {
        // For URLs or files we couldn't read, mark as indexed with no summary
        await supabase
          .from("kb_documents")
          .update({ status: "indexed", summary: "Document uploaded — manual review required." })
          .eq("id", doc.id);
      }

      toast.success("Document uploaded successfully");

      // Reset form
      setTitle("");
      setCategoryId("");
      setSource("");
      setEffectiveDate(undefined);
      setFile(null);
      setUrlInput("");
      loadData();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    const { error } = await supabase.from("kb_documents").delete().eq("id", docId);
    if (error) {
      toast.error("Failed to delete document");
    } else {
      toast.success("Document deleted");
      loadData();
    }
  };

  const handleReprocess = async (doc: KBDocument) => {
    toast.info("Re-processing not yet implemented for stored documents. Please re-upload the file.");
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Manage Knowledge Base | Notewell</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/knowledge-base")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Manage Knowledge Base
                </h1>
                <p className="text-xs text-muted-foreground">Upload and manage documents for the AI knowledge base</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Upload Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Title *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. NWEH Formulary Update April 2026"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm min-h-[44px] sm:min-h-[40px]"
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Source / Publisher</label>
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. NWEH ICB Medicines Team"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Effective Date</label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {effectiveDate ? format(effectiveDate, "dd MMM yyyy") : "Select date…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={effectiveDate}
                        onSelect={(d) => {
                          setEffectiveDate(d);
                          setCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Upload File (PDF or DOCX)
                  </label>
                  <Input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      if (e.target.files?.[0]) setUrlInput("");
                    }}
                    className="cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Or paste a URL</label>
                  <Input
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (e.target.value) setFile(null);
                    }}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload & Auto-Summarise
                    </>
                  )}
                </Button>
                {uploading && (
                  <p className="text-xs text-muted-foreground">
                    Summarisation may take a few seconds…
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                </div>
              ) : documents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No documents uploaded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="hidden sm:table-cell">Source</TableHead>
                        <TableHead className="hidden md:table-cell">Effective</TableHead>
                        <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => {
                        const cat = doc.kb_categories;
                        return (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium text-sm max-w-[200px] truncate">
                              {doc.title}
                            </TableCell>
                            <TableCell>
                              {cat ? (
                                <Badge
                                  className="text-xs"
                                  style={{
                                    backgroundColor: `${cat.colour}15`,
                                    color: cat.colour,
                                    borderColor: `${cat.colour}40`,
                                  }}
                                >
                                  {cat.icon} {cat.name}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {doc.source || "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {formatDate(doc.effective_date)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {formatDate(doc.uploaded_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  doc.status === "indexed"
                                    ? "default"
                                    : doc.status === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {doc.status === "processing" && (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                )}
                                {doc.status === "error" && (
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                )}
                                {doc.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleReprocess(doc)}
                                  title="Re-process"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(doc.id)}
                                  title="Delete"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
