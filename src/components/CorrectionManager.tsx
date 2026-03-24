import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { medicalTermCorrector } from "@/utils/MedicalTermCorrector";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trash2,
  Search,
  Plus,
  BookOpen,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
  FlaskConical,
  ArrowRight,
} from "lucide-react";

/* ── Types ── */
type CorrectionCategory =
  | "place"
  | "person"
  | "practice"
  | "clinical"
  | "acronym"
  | "other";

const CATEGORIES: CorrectionCategory[] = [
  "place",
  "person",
  "practice",
  "clinical",
  "acronym",
  "other",
];

const CATEGORY_META: Record<
  CorrectionCategory,
  { label: string; colour: string; bg: string }
> = {
  place: {
    label: "Place",
    colour: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-100 dark:bg-sky-900/40",
  },
  person: {
    label: "Person",
    colour: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-100 dark:bg-violet-900/40",
  },
  practice: {
    label: "Practice",
    colour: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-900/40",
  },
  clinical: {
    label: "Clinical",
    colour: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  acronym: {
    label: "Acronym",
    colour: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-900/40",
  },
  other: {
    label: "Other",
    colour: "text-muted-foreground",
    bg: "bg-muted",
  },
};

const FILTER_TABS: { value: CorrectionCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "place", label: "Places" },
  { value: "person", label: "People" },
  { value: "practice", label: "Practices" },
  { value: "clinical", label: "Clinical" },
  { value: "acronym", label: "Acronyms" },
  { value: "other", label: "Other" },
];

interface Correction {
  id: string;
  incorrect_term: string;
  correct_term: string;
  category: CorrectionCategory;
  usage_count: number;
  created_at: string;
}

/* ── Props ── */
interface CorrectionManagerProps {
  onClose: () => void;
  onCorrectionApplied?: (find: string, replace: string) => void;
  onCorrectionsChanged?: () => void;
}

/* ── Helpers ── */
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function CategoryBadge({ cat }: { cat: CorrectionCategory }) {
  const m = CATEGORY_META[cat];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.bg} ${m.colour}`}
    >
      {m.label}
    </span>
  );
}

/* ── Component ── */
export function CorrectionManager({
  onClose,
  onCorrectionApplied,
  onCorrectionsChanged,
}: CorrectionManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<CorrectionCategory | "all">("all");

  // Add form
  const [newWrong, setNewWrong] = useState("");
  const [newCorrect, setNewCorrect] = useState("");
  const [newCategory, setNewCategory] = useState<CorrectionCategory>("other");

  // Test panel
  const [testOpen, setTestOpen] = useState(false);
  const [testText, setTestText] = useState("");

  /* ── Load ── */
  const loadCorrections = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("medical_term_corrections")
        .select("id, incorrect_term, correct_term, category, usage_count, created_at")
        .eq("user_id", user.id)
        .order("usage_count", { ascending: false });

      if (error) throw error;

      setCorrections(
        (data ?? []).map((r: any) => ({
          id: r.id,
          incorrect_term: r.incorrect_term,
          correct_term: r.correct_term,
          category: (r.category as CorrectionCategory) || "other",
          usage_count: r.usage_count ?? 0,
          created_at: r.created_at,
        }))
      );
    } catch {
      toast({ title: "Load failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCorrections();
  }, [loadCorrections]);

  /* ── Add ── */
  const addCorrection = async () => {
    if (!newWrong.trim() || !newCorrect.trim() || !user?.id) return;
    try {
      const { error } = await supabase
        .from("medical_term_corrections")
        .upsert(
          {
            user_id: user.id,
            incorrect_term: newWrong.trim(),
            correct_term: newCorrect.trim(),
            category: newCategory,
            usage_count: 0,
          },
          { onConflict: "user_id,incorrect_term" }
        );
      if (error) throw error;

      await medicalTermCorrector.refreshCorrections(user.id);
      await loadCorrections();
      onCorrectionsChanged?.();
      setNewWrong("");
      setNewCorrect("");
      setNewCategory("other");
      toast({ title: "Correction added", description: `"${newWrong}" → "${newCorrect}"` });
    } catch {
      toast({ title: "Add failed", variant: "destructive" });
    }
  };

  /* ── Delete ── */
  const deleteCorrection = async (id: string, term: string) => {
    try {
      const { error } = await supabase
        .from("medical_term_corrections")
        .delete()
        .eq("id", id);
      if (error) throw error;

      await medicalTermCorrector.refreshCorrections(user?.id);
      await loadCorrections();
      onCorrectionsChanged?.();
      toast({ title: "Deleted", description: `Removed "${term}"` });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  /* ── Apply single correction ── */
  const applyNow = (wrong: string, correct: string) => {
    if (onCorrectionApplied) {
      onCorrectionApplied(wrong, correct);
    }
  };

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    return corrections
      .filter((c) => {
        if (activeTab !== "all" && c.category !== activeTab) return false;
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          return (
            c.incorrect_term.toLowerCase().includes(s) ||
            c.correct_term.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => b.usage_count - a.usage_count);
  }, [corrections, activeTab, searchTerm]);

  /* ── Test panel highlighting ── */
  const highlightedTest = useMemo(() => {
    if (!testText || corrections.length === 0) return null;

    const sorted = [...corrections].sort(
      (a, b) => b.incorrect_term.length - a.incorrect_term.length
    );

    interface Segment {
      text: string;
      replaced?: string;
    }

    let segments: Segment[] = [{ text: testText }];

    for (const c of sorted) {
      const pattern = new RegExp(
        `\\b${escapeRegex(c.incorrect_term)}\\b`,
        "gi"
      );
      const newSegments: Segment[] = [];

      for (const seg of segments) {
        if (seg.replaced !== undefined) {
          newSegments.push(seg);
          continue;
        }
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(seg.text)) !== null) {
          if (match.index > lastIndex) {
            newSegments.push({ text: seg.text.slice(lastIndex, match.index) });
          }
          newSegments.push({
            text: match[0],
            replaced: c.correct_term,
          });
          lastIndex = pattern.lastIndex;
        }
        if (lastIndex < seg.text.length) {
          newSegments.push({ text: seg.text.slice(lastIndex) });
        }
      }
      segments = newSegments;
    }

    return segments;
  }, [testText, corrections]);

  /* ── Render ── */
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Correction Library
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── Add form ── */}
          <div className="px-6 pb-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Heard as (wrong)
                </label>
                <Input
                  value={newWrong}
                  onChange={(e) => setNewWrong(e.target.value)}
                  placeholder="e.g. Toaster"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Should be (correct)
                </label>
                <Input
                  value={newCorrect}
                  onChange={(e) => setNewCorrect(e.target.value)}
                  placeholder="e.g. Towcester"
                  className="font-mono text-sm"
                />
              </div>
              <div className="w-[130px] flex-shrink-0">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as CorrectionCategory)
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={addCorrection}
                disabled={!newWrong.trim() || !newCorrect.trim()}
                size="default"
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <Separator />

          {/* ── Filter bar ── */}
          <div className="px-6 py-3 flex flex-wrap items-center gap-2">
            {/* Category tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTab === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {tab.label}
                  {tab.value !== "all" && (
                    <span className="ml-1 opacity-70">
                      {corrections.filter((c) => c.category === tab.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search terms…"
                className="pl-9 h-9"
              />
            </div>
          </div>

          <Separator />

          {/* ── Corrections list ── */}
          <div className="flex-1 overflow-hidden px-6">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 py-3 pr-2">
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading corrections…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <BookOpen className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm || activeTab !== "all"
                        ? "No corrections match your filters"
                        : "No corrections yet — add terms that speech-to-text gets wrong"}
                    </p>
                    {!searchTerm && activeTab === "all" && (
                      <div className="flex flex-wrap gap-2 justify-center pt-2">
                        {[
                          { w: "Toaster", r: "Towcester", cat: "place" as CorrectionCategory },
                          { w: "Anshul", r: "Anshal", cat: "person" as CorrectionCategory },
                          { w: "System One", r: "SystmOne", cat: "clinical" as CorrectionCategory },
                          { w: "LNC", r: "LMC", cat: "acronym" as CorrectionCategory },
                        ].map((ex) => (
                          <Button
                            key={ex.w}
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => {
                              setNewWrong(ex.w);
                              setNewCorrect(ex.r);
                              setNewCategory(ex.cat);
                            }}
                          >
                            <span className="line-through text-muted-foreground">
                              {ex.w}
                            </span>
                            <span>→</span>
                            <span>{ex.r}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  filtered.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/40 transition-colors group"
                    >
                      {/* Category badge */}
                      <CategoryBadge cat={c.category} />

                      {/* Wrong → Correct */}
                      <span className="font-mono text-sm px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        {c.incorrect_term}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-sm px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        {c.correct_term}
                      </span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Usage */}
                      <Badge variant="secondary" className="text-[11px] gap-1 flex-shrink-0">
                        <TrendingUp className="h-3 w-3" />
                        {c.usage_count}
                      </Badge>

                      {/* Actions */}
                      {onCorrectionApplied && (
                        <Button
                          onClick={() => applyNow(c.incorrect_term, c.correct_term)}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Zap className="h-3 w-3" />
                          Apply now
                        </Button>
                      )}
                      <Button
                        onClick={() => deleteCorrection(c.id, c.incorrect_term)}
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ── Test panel ── */}
          <Collapsible open={testOpen} onOpenChange={setTestOpen}>
            <Separator />
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <FlaskConical className="h-4 w-4" />
                Test on text
                {testOpen ? (
                  <ChevronDown className="h-4 w-4 ml-auto" />
                ) : (
                  <ChevronUp className="h-4 w-4 ml-auto" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-4 space-y-3">
                <Textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Paste any text here to preview corrections in real time…"
                  className="min-h-[80px] font-mono text-sm"
                  rows={3}
                />
                {highlightedTest && highlightedTest.length > 0 && (
                  <div className="p-3 rounded-lg border bg-muted/30 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {highlightedTest.map((seg, i) =>
                      seg.replaced !== undefined ? (
                        <span
                          key={i}
                          className="bg-green-200 dark:bg-green-800/50 text-green-900 dark:text-green-200 rounded px-0.5"
                          title={`"${seg.text}" → "${seg.replaced}"`}
                        >
                          {seg.replaced}
                        </span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ── Status bar ── */}
          <Separator />
          <div className="px-6 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            {corrections.length} correction{corrections.length !== 1 ? "s" : ""}{" "}
            active — applied to every new note automatically
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
