import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string;
  submitted_at: string;
  practice_id: string;
  practice_label: string;
  rating: "better" | "same" | "worse";
  followup_reason: string | null;
  followup_label: string | null;
  comment: string | null;
}

const RATING_LABEL: Record<string, string> = { better: "Better", same: "The same", worse: "Worse" };
const RATING_COLOUR: Record<string, string> = { better: "#2A9D8F", same: "#64748B", worse: "#E76F51" };

const PRACTICE_OPTIONS = [
  { id: "brackley", name: "Brackley Medical Centre" },
  { id: "brook", name: "Brook Health Centre" },
  { id: "bugbrooke", name: "Bugbrooke Medical Centre" },
  { id: "denton", name: "Denton Village Surgery" },
  { id: "springfield", name: "Springfield Surgery" },
  { id: "parks", name: "The Parks Medical Practice" },
  { id: "towcester", name: "Towcester Medical Centre" },
  { id: "unsure", name: "Unsure / Prefer not to say" },
];

function formatUK(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", hour12: false,
  }).format(new Date(iso));
}

function toCsv(rows: Row[]): string {
  const headers = ["Submitted", "Practice", "Rating", "Main issue", "Comment"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push([
      escape(formatUK(r.submitted_at)),
      escape(r.practice_label),
      escape(RATING_LABEL[r.rating] || r.rating),
      escape(r.rating === "worse" ? (r.followup_label || "") : "Not Applicable"),
      escape(r.comment || ""),
    ].join(","));
  });
  return lines.join("\n");
}

export default function AdminNRESResponses() {
  const { user, isSystemAdmin, loading } = useAuth() as any;
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [practiceFilter, setPracticeFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isSystemAdmin) {
      setError("You do not have access to this page.");
      setFetching(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("nres_ppg_responses")
        .select("id, submitted_at, practice_id, practice_label, rating, followup_reason, followup_label, comment")
        .order("submitted_at", { ascending: false })
        .limit(1000);
      if (error) setError(error.message);
      else setRows((data ?? []) as Row[]);
      setFetching(false);
    })();
  }, [user, isSystemAdmin, loading, navigate]);

  const filtered = useMemo(() => rows.filter((r) =>
    (practiceFilter === "all" || r.practice_id === practiceFilter) &&
    (ratingFilter === "all" || r.rating === ratingFilter)
  ), [rows, practiceFilter, ratingFilter]);

  const total = filtered.length;
  const pct = (v: string) => total === 0 ? 0 : Math.round((filtered.filter((r) => r.rating === v).length / total) * 100);

  const downloadCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nres-ppg-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || fetching) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  if (error) {
    return <div className="p-8 text-destructive">{error}</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">NRES PPG — Patient Survey Responses</h1>
        <p className="text-sm text-muted-foreground mt-1">Anonymous feedback. No patient identifiers stored.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Better</div>
          <div className="text-2xl font-bold mt-1" style={{ color: RATING_COLOUR.better }}>{pct("better")}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">The same</div>
          <div className="text-2xl font-bold mt-1" style={{ color: RATING_COLOUR.same }}>{pct("same")}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Worse</div>
          <div className="text-2xl font-bold mt-1" style={{ color: RATING_COLOUR.worse }}>{pct("worse")}%</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Practice:</span>
        <button
          className={`text-xs px-3 py-1 rounded-full border ${practiceFilter === "all" ? "bg-foreground text-background" : "bg-background"}`}
          onClick={() => setPracticeFilter("all")}
        >
          All
        </button>
        {PRACTICE_OPTIONS.map((p) => (
          <button
            key={p.id}
            className={`text-xs px-3 py-1 rounded-full border ${practiceFilter === p.id ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setPracticeFilter(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Rating:</span>
        {(["all", "better", "same", "worse"] as const).map((r) => (
          <button
            key={r}
            className={`text-xs px-3 py-1 rounded-full border ${ratingFilter === r ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setRatingFilter(r)}
          >
            {r === "all" ? "All" : RATING_LABEL[r]}
          </button>
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={downloadCsv}>Download CSV</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Submitted</th>
                <th className="px-4 py-2 font-semibold">Practice</th>
                <th className="px-4 py-2 font-semibold">Rating</th>
                <th className="px-4 py-2 font-semibold">Main issue</th>
                <th className="px-4 py-2 font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No responses yet.</td></tr>
              )}
              {filtered.map((r) => {
                const isExpanded = expanded[r.id];
                const c = r.comment || "";
                const truncated = c.length > 80 ? c.slice(0, 80) + "…" : c;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 whitespace-nowrap">{formatUK(r.submitted_at)}</td>
                    <td className="px-4 py-2">{r.practice_label}</td>
                    <td className="px-4 py-2">
                      <Badge style={{ background: RATING_COLOUR[r.rating] + "20", color: RATING_COLOUR[r.rating] }}>
                        {RATING_LABEL[r.rating]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.rating === "worse" ? (r.followup_label || "—") : "Not Applicable"}</td>
                    <td className="px-4 py-2 max-w-md">
                      {!c && <span className="text-muted-foreground">—</span>}
                      {c && (
                        <span>
                          {isExpanded ? c : truncated}
                          {c.length > 80 && (
                            <button
                              className="ml-2 text-primary text-xs underline"
                              onClick={() => setExpanded((p) => ({ ...p, [r.id]: !isExpanded }))}
                            >
                              {isExpanded ? "less" : "more"}
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
