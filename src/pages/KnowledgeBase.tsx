import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronUp, FileText, ArrowLeft, ExternalLink, MessageSquare, BookOpen, Settings } from "lucide-react";
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

type SortMode = "newest" | "effective";

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);

      // Check admin
      const { data: adminCheck } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "system_admin",
      });
      setIsAdmin(!!adminCheck);

      // Load categories
      const { data: cats } = await supabase
        .from("kb_categories")
        .select("*")
        .order("sort_order");
      if (cats) setCategories(cats);

      // Load documents
      const { data: docs } = await supabase
        .from("kb_documents")
        .select("*, kb_categories(*)")
        .eq("is_active", true)
        .eq("status", "indexed")
        .order("uploaded_at", { ascending: false });
      if (docs) setDocuments(docs as unknown as KBDocument[]);

      setLoading(false);
    };

    loadData();
  }, [user]);

  const filtered = useMemo(() => {
    let result = documents;

    if (categoryFilter !== "all") {
      result = result.filter((d) => d.category_id === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.summary?.toLowerCase().includes(q) ||
          d.key_points?.some((kp) => kp.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      if (sortMode === "effective") {
        const da = a.effective_date || "";
        const db = b.effective_date || "";
        return db.localeCompare(da);
      }
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    });

    return result;
  }, [documents, categoryFilter, search, sortMode]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-3 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading Knowledge Base…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Knowledge Base | Notewell</title>
        <meta name="description" content="Northamptonshire Primary Care Knowledge Base — local formulary, guidance, DES/LES and neighbourhood information" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Northamptonshire Primary Care Knowledge Base
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Local formulary, guidance, DES/LES and neighbourhood information
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/knowledge-base/admin")}
                  className="gap-1.5"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Manage
                </Button>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[44px] sm:min-h-[40px]"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[44px] sm:min-h-[40px]"
              >
                <option value="newest">Newest first</option>
                <option value="effective">Effective date</option>
              </select>
            </div>
          </div>
        </div>

        {/* Document list */}
        <div className="max-w-5xl mx-auto px-4 py-6">
          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">No documents found.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact your administrator to add content.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((doc) => {
                const expanded = expandedIds.has(doc.id);
                const cat = doc.kb_categories;
                const isOutdated =
                  doc.effective_date &&
                  new Date(doc.effective_date) < new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

                return (
                  <Card key={doc.id} className="overflow-hidden">
                    <button
                      className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(doc.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {cat && (
                            <Badge
                              className="text-xs font-medium"
                              style={{
                                backgroundColor: `${cat.colour}15`,
                                color: cat.colour,
                                borderColor: `${cat.colour}40`,
                              }}
                            >
                              {cat.icon} {cat.name}
                            </Badge>
                          )}
                          {isOutdated && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">
                              May be outdated
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground text-sm leading-tight">
                          {doc.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          {doc.source && <span>{doc.source}</span>}
                          {doc.source && doc.effective_date && <span>·</span>}
                          {doc.effective_date && <span>Effective: {formatDate(doc.effective_date)}</span>}
                          <span>· Uploaded {formatDate(doc.uploaded_at)}</span>
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      )}
                    </button>

                    {expanded && (
                      <CardContent className="border-t bg-muted/10 pt-4">
                        {doc.summary && (
                          <p className="text-sm text-foreground leading-relaxed mb-3">
                            {doc.summary}
                          </p>
                        )}
                        {doc.key_points && doc.key_points.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Key Points
                            </h4>
                            <ul className="space-y-1">
                              {doc.key_points.map((kp, i) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                  <span className="text-primary mt-0.5">•</span>
                                  {kp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {doc.file_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(doc.file_url!, "_blank")}
                              className="gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open Document
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              navigate("/ask-ai", {
                                state: { prefill: `Tell me about: ${doc.title}` },
                              })
                            }
                            className="gap-1.5"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Ask Notewell about this
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
