import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AGEWELL_PRACTICES } from "@/data/agewellPractices";

interface Row {
  id: string;
  submitted_at: string;
  channel: "web" | "paper" | "telephony";
  practice_canonical: string | null;
  practice_label_freeform: string | null;
  branch_site: string | null;
  support_worker_rating: number | null;
  equipment_provided: string | null;
  signposted: string | null;
  online_meeting_concerns_discussed: string | null;
  medicine_review_beneficial: string | null;
  listened_to_concerns: string | null;
  more_independent: string | null;
  most_significant_difference: string | null;
  overall_rating: number | null;
  would_recommend: string | null;
  suggestions_concerns: string | null;
  completed_with_support: string | null;
  call_duration_seconds: number | null;
  transcript_json: any | null;
}

const RATING_COLOUR = (r: number | null) => r == null ? "#64748B" : r >= 4 ? "#2A9D8F" : r === 3 ? "#ED8B00" : "#E76F51";

const YN_LABEL: Record<string, string> = { yes: "Yes", no: "No", unsure: "Unsure", not_applicable: "N/A" };
const AGREE_LABEL: Record<string, string> = { agree: "Agree", neutral: "Neutral", disagree: "Disagree" };
const COMPLETED_LABEL: Record<string, string> = {
  with_support_worker: "With support worker",
  on_my_own: "On my own",
  phone_with_automated_assistant: "Phone (automated)",
};
const CHANNEL_LABEL: Record<string, string> = { web: "Web", paper: "Paper", telephony: "Phone" };

function formatUK(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London", hour12: false,
  }).format(new Date(iso));
}

function practiceLabel(r: Row): string {
  return r.practice_canonical || r.practice_label_freeform || "—";
}

function toCsv(rows: Row[]): string {
  const headers = [
    "Submitted", "Channel", "Practice", "Branch",
    "Support worker /5", "Equipment", "Signposted",
    "Online meeting", "Medicine review",
    "Listened", "More independent",
    "Most significant difference", "Overall /5",
    "Recommend", "Suggestions", "Completed",
  ];
  const escape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push([
      escape(formatUK(r.submitted_at)),
      escape(CHANNEL_LABEL[r.channel] || r.channel),
      escape(practiceLabel(r)),
      escape(r.branch_site || ""),
      escape(r.support_worker_rating?.toString() || ""),
      escape(YN_LABEL[r.equipment_provided || ""] || ""),
      escape(YN_LABEL[r.signposted || ""] || ""),
      escape(YN_LABEL[r.online_meeting_concerns_discussed || ""] || ""),
      escape(YN_LABEL[r.medicine_review_beneficial || ""] || ""),
      escape(AGREE_LABEL[r.listened_to_concerns || ""] || ""),
      escape(AGREE_LABEL[r.more_independent || ""] || ""),
      escape(r.most_significant_difference || ""),
      escape(r.overall_rating?.toString() || ""),
      escape(YN_LABEL[r.would_recommend || ""] || ""),
      escape(r.suggestions_concerns || ""),
      escape(COMPLETED_LABEL[r.completed_with_support || ""] || ""),
    ].join(","));
  });
  return lines.join("\n");
}

export default function AdminAgewellResponses() {
  const { user, isSystemAdmin, loading } = useAuth() as any;
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [practiceFilter, setPracticeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [recommendFilter, setRecommendFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [drawerRow, setDrawerRow] = useState<Row | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (!isSystemAdmin) { setError("You do not have access to this page."); setFetching(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("agewell_responses")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(1000);
      if (error) setError(error.message);
      else setRows((data ?? []) as Row[]);
      setFetching(false);
    })();
  }, [user, isSystemAdmin, loading, navigate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (practiceFilter !== "all") {
        const pl = practiceLabel(r);
        if (pl !== practiceFilter) return false;
      }
      if (channelFilter !== "all" && r.channel !== channelFilter) return false;
      if (recommendFilter !== "all" && r.would_recommend !== recommendFilter) return false;
      if (q) {
        const hay = [r.most_significant_difference, r.suggestions_concerns, practiceLabel(r)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, practiceFilter, channelFilter, recommendFilter, search]);

  // Last 30 days summary stats (computed off filtered rows)
  const stats = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = filtered.filter((r) => new Date(r.submitted_at).getTime() >= cutoff);
    const total = recent.length;
    const avg = total === 0 ? 0
      : recent.filter((r) => r.overall_rating != null)
          .reduce((s, r) => s + (r.overall_rating ?? 0), 0) /
        (recent.filter((r) => r.overall_rating != null).length || 1);
    const recCount = (v: string) => recent.filter((r) => r.would_recommend === v).length;
    const channelCount = (v: string) => recent.filter((r) => r.channel === v).length;
    const pct = (n: number) => total === 0 ? 0 : Math.round((n / total) * 100);
    return {
      total,
      avg: avg ? avg.toFixed(2) : "—",
      yes: pct(recCount("yes")),
      unsure: pct(recCount("unsure")),
      no: pct(recCount("no")),
      web: channelCount("web"),
      phone: channelCount("telephony"),
      paper: channelCount("paper"),
    };
  }, [filtered]);

  const practiceOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { const p = practiceLabel(r); if (p && p !== "—") set.add(p); });
    return Array.from(set).sort();
  }, [rows]);

  const downloadCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agewell-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || fetching) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ageing Well — Patient Feedback Responses</h1>
        <p className="text-sm text-muted-foreground mt-1">Anonymous feedback. No patient identifiers stored.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total (30 days)</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Avg overall</div>
          <div className="text-2xl font-bold mt-1">{stats.avg} <span className="text-base text-muted-foreground">/ 5</span></div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommend</div>
          <div className="text-sm font-semibold mt-1">
            <span style={{ color: "#2A9D8F" }}>{stats.yes}% Yes</span>{" · "}
            <span style={{ color: "#ED8B00" }}>{stats.unsure}% Unsure</span>{" · "}
            <span style={{ color: "#E76F51" }}>{stats.no}% No</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Channels</div>
          <div className="text-sm font-semibold mt-1">
            Web {stats.web} · Phone {stats.phone} · Paper {stats.paper}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Practice:</span>
        <select
          value={practiceFilter}
          onChange={(e) => setPracticeFilter(e.target.value)}
          className="text-xs px-3 py-1 rounded-md border bg-background"
        >
          <option value="all">All</option>
          {practiceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <span className="text-xs font-semibold text-muted-foreground ml-3 mr-1">Channel:</span>
        {(["all", "web", "telephony", "paper"] as const).map((c) => (
          <button
            key={c}
            className={`text-xs px-3 py-1 rounded-full border ${channelFilter === c ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setChannelFilter(c)}
          >{c === "all" ? "All" : CHANNEL_LABEL[c]}</button>
        ))}

        <span className="text-xs font-semibold text-muted-foreground ml-3 mr-1">Recommend:</span>
        {(["all", "yes", "unsure", "no"] as const).map((r) => (
          <button
            key={r}
            className={`text-xs px-3 py-1 rounded-full border ${recommendFilter === r ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setRecommendFilter(r)}
          >{r === "all" ? "All" : YN_LABEL[r]}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search comments…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border bg-background flex-1 min-w-[200px] max-w-md"
        />
        <div className="ml-auto">
          <Button size="sm" onClick={downloadCsv}>Download CSV</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Submitted</th>
                <th className="px-3 py-2 font-semibold">Channel</th>
                <th className="px-3 py-2 font-semibold">Practice</th>
                <th className="px-3 py-2 font-semibold">Branch</th>
                <th className="px-3 py-2 font-semibold text-center">Worker ★</th>
                <th className="px-3 py-2 font-semibold text-center">Overall ★</th>
                <th className="px-3 py-2 font-semibold">Recommend</th>
                <th className="px-3 py-2 font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No responses yet.</td></tr>
              )}
              {filtered.map((r) => {
                const c = r.most_significant_difference || r.suggestions_concerns || "";
                const truncated = c.length > 80 ? c.slice(0, 80) + "…" : c;
                return (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDrawerRow(r)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{formatUK(r.submitted_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{CHANNEL_LABEL[r.channel] || r.channel}</td>
                    <td className="px-3 py-2">{practiceLabel(r)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.branch_site || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge style={{ background: RATING_COLOUR(r.support_worker_rating) + "20", color: RATING_COLOUR(r.support_worker_rating) }}>
                        {r.support_worker_rating ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge style={{ background: RATING_COLOUR(r.overall_rating) + "20", color: RATING_COLOUR(r.overall_rating) }}>
                        {r.overall_rating ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{YN_LABEL[r.would_recommend || ""] || "—"}</td>
                    <td className="px-3 py-2 max-w-md text-muted-foreground">{truncated || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Side drawer */}
      {drawerRow && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex justify-end"
          onClick={() => setDrawerRow(null)}
        >
          <div
            className="w-full max-w-xl bg-background h-full overflow-y-auto p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Response details</h2>
              <button onClick={() => setDrawerRow(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <Field label="Submitted" value={formatUK(drawerRow.submitted_at)} />
              <Field label="Channel" value={CHANNEL_LABEL[drawerRow.channel] || drawerRow.channel} />
              <Field label="Practice" value={practiceLabel(drawerRow)} />
              {drawerRow.branch_site && <Field label="Branch" value={drawerRow.branch_site} />}
              <Field label="Support worker rating" value={drawerRow.support_worker_rating ? `${drawerRow.support_worker_rating} / 5` : "—"} />
              <Field label="Equipment" value={YN_LABEL[drawerRow.equipment_provided || ""] || "—"} />
              <Field label="Signposted" value={YN_LABEL[drawerRow.signposted || ""] || "—"} />
              <Field label="Online meeting — needs discussed" value={YN_LABEL[drawerRow.online_meeting_concerns_discussed || ""] || "—"} />
              <Field label="Medicine review beneficial" value={YN_LABEL[drawerRow.medicine_review_beneficial || ""] || "—"} />
              <Field label="Felt listened to" value={AGREE_LABEL[drawerRow.listened_to_concerns || ""] || "—"} />
              <Field label="More independent" value={AGREE_LABEL[drawerRow.more_independent || ""] || "—"} />
              <Field label="Overall rating" value={drawerRow.overall_rating ? `${drawerRow.overall_rating} / 5` : "—"} />
              <Field label="Would recommend" value={YN_LABEL[drawerRow.would_recommend || ""] || "—"} />
              <Field label="Completed" value={COMPLETED_LABEL[drawerRow.completed_with_support || ""] || "—"} />
              <Quote label="Most significant difference" text={drawerRow.most_significant_difference} />
              <Quote label="Suggestions / concerns" text={drawerRow.suggestions_concerns} />
              {drawerRow.transcript_json && Array.isArray(drawerRow.transcript_json) && drawerRow.transcript_json.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Call transcript</div>
                  <div className="bg-muted/40 rounded p-3 text-xs space-y-1">
                    {drawerRow.transcript_json.map((t: any, i: number) => (
                      <div key={i}><strong>{t.speaker || "Speaker"}:</strong> {t.text}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="col-span-2 font-medium">{value}</div>
    </div>
  );
}

function Quote({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <blockquote className="border-l-4 border-primary/40 pl-3 text-sm italic text-foreground/80">
        {text || <span className="text-muted-foreground">(none provided)</span>}
      </blockquote>
    </div>
  );
}
