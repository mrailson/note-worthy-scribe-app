import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Copy, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Status =
  | "DOUBLE_RED" | "RED" | "SPECIALIST_INITIATED" | "SPECIALIST_RECOMMENDED"
  | "AMBER_2" | "AMBER_1" | "GREEN" | "GREY" | "UNKNOWN";

const statusText: Record<Status, string> = {
  DOUBLE_RED: "Hospital-only. Do not prescribe in primary care. Prior Approval/IFR may be required.",
  RED: "Specialist service only. Do not initiate in primary care. Often Blueteq applies.",
  SPECIALIST_INITIATED: "Continue only after specialist start; agree responsibilities (check letter/shared-care). Do not initiate.",
  SPECIALIST_RECOMMENDED: "Primary care may prescribe when recommended by specialist and criteria met.",
  AMBER_2: "Shared-Care required before transfer.",
  AMBER_1: "Primary care prescribing following specialist advice; check criteria.",
  GREEN: "Suitable for primary-care prescribing per local formulary.",
  GREY: "Not routinely commissioned / not assessed. Check with Medicines Optimisation.",
  UNKNOWN: "Local status not found. Verify on ICB site."
};

const statusClass: Record<Status, string> = {
  DOUBLE_RED: "bg-red-800 text-white",
  RED: "bg-red-600 text-white",
  SPECIALIST_INITIATED: "bg-purple-700 text-white",
  SPECIALIST_RECOMMENDED: "bg-blue-600 text-white",
  AMBER_2: "bg-orange-600 text-white",
  AMBER_1: "bg-orange-500 text-white",
  GREEN: "bg-green-600 text-white",
  GREY: "bg-gray-600 text-white",
  UNKNOWN: "bg-gray-500 text-white"
};

function Chip({ status, href }: { status: Status; href?: string }) {
  const label = status.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase());
  
  return (
    <span className="group relative inline-flex items-center">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[status]}`}>
        {label}
      </span>
      <div className="pointer-events-none absolute z-50 mt-8 w-80 rounded-xl border bg-background p-3 text-sm shadow-lg opacity-0 group-hover:opacity-100 invisible group-hover:visible">
        <div className="mb-1 font-semibold text-primary">Northamptonshire ICB</div>
        <p className="text-muted-foreground">{statusText[status]}</p>
        <div className="mt-2">
          <a 
            className="inline-flex items-center gap-2 text-primary hover:underline" 
            target="_blank" 
            rel="noreferrer" 
            href={href || "https://www.icnorthamptonshire.org.uk/trafficlightdrugs"}
          >
            <ExternalLink className="h-4 w-4" /> Open ICB policy
          </a>
        </div>
      </div>
    </span>
  );
}

type VocabItem = { id: string; name: string; tl_status?: Status; };

type ResolveResp = {
  drug: { name: string } | null;
  traffic_light: null | { status: Status; detail_url?: string; last_modified?: string };
  prior_approval: null | { status: Status; route: "PRIOR_APPROVAL" | "IFR" | "BLUETEQ"; bullets?: string[]; link?: string };
  formulary: null | {
    bnf_chapter?: string;
    section?: string;
    preferred: { item_name: string; rank: number; notes?: string }[];
    page_url?: string;
    last_published?: string;
  };
  alternatives: { name: string; notes?: string; status: Status; detail_url?: string }[];
};

export function DrugQuickModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [sel, setSel] = useState<VocabItem | null>(null);
  const [data, setData] = useState<ResolveResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Fetch vocabulary
      supabase.functions.invoke('drug-vocabulary')
        .then(({ data: response }) => {
          if (response?.items) {
            setVocab(response.items);
          }
        })
        .catch(console.error);
      
      setQ("");
      setSel(null);
      setData(null);
    }
  }, [open]);

  useEffect(() => {
    if (sel) {
      setLoading(true);
      supabase.functions.invoke('comprehensive-drug-lookup', {
        body: { name: sel.name }
      })
        .then(({ data: response }) => {
          if (response) {
            setData(response);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [sel]);

  const results = useMemo(() => {
    if (!q) return [];
    const n = q.toLowerCase();
    return vocab.filter(v => v.name.toLowerCase().includes(n)).slice(0, 10);
  }, [q, vocab]);

  const canInitiate = (() => {
    const s = data?.traffic_light?.status;
    if (!s) return "UNKNOWN";
    if (s === "DOUBLE_RED" || s === "RED") return "NO";
    if (s === "SPECIALIST_INITIATED") return "ONLY_IF_SPECIALIST";
    return "YES";
  })();

  const handleCopySummary = () => {
    if (!data || !sel) return;
    
    const lines = [];
    lines.push(`Local policy: ${data.drug?.name || sel.name} — ${data.traffic_light?.status || 'UNKNOWN'}.`);
    if (data.prior_approval) {
      lines.push(`${data.prior_approval.status} ${data.prior_approval.route || ''}`);
    }
    navigator.clipboard.writeText(lines.join(" "));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[85vh] overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search local drug…"
              className="w-[420px]"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-12 gap-4 p-4 overflow-y-auto">
          {/* Left: Results */}
          <div className="col-span-4">
            <div className="rounded-xl border">
              {results.length ? (
                results.map(r => (
                  <div
                    key={r.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 ${sel?.id === r.id ? 'bg-muted/50' : ''}`}
                    onClick={() => setSel(r)}
                  >
                    <span className="text-sm">{r.name}</span>
                    {r.tl_status && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass[r.tl_status as Status]}`}>
                        {r.tl_status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">Start typing…</div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="col-span-8">
            {!sel ? (
              <div className="text-muted-foreground">Select a drug to view local policy.</div>
            ) : loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : data ? (
              <div className="space-y-4">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">{data.drug?.name || sel.name}</h2>
                  {data.traffic_light?.status && (
                    <Chip status={data.traffic_light.status} href={data.traffic_light.detail_url} />
                  )}
                </div>

                {/* Can GP initiate */}
                <div className={`rounded-xl border p-3 ${
                  canInitiate === 'NO' ? 'border-destructive/50 bg-destructive/10' : 
                  canInitiate === 'ONLY_IF_SPECIALIST' ? 'border-purple-600/40 bg-purple-50 dark:bg-purple-900/20' : 
                  'border-green-600/30 bg-green-50 dark:bg-green-900/20'
                }`}>
                  <div className="text-sm font-semibold">Can GP initiate?</div>
                  <div className="text-base">
                    {canInitiate === 'NO' && <>No – restricted by local policy.</>}
                    {canInitiate === 'ONLY_IF_SPECIALIST' && <>Only if <strong>specialist-initiated</strong>; do not start in primary care.</>}
                    {canInitiate === 'YES' && <>Yes – no local initiation restriction found.</>}
                    {canInitiate === 'UNKNOWN' && <>Unknown – verify on ICB site.</>}
                  </div>
                  {data.traffic_light?.last_modified && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Traffic-Light last updated: {data.traffic_light.last_modified}
                    </div>
                  )}
                </div>

                {/* Prior approval */}
                {data.prior_approval && (
                  <div className="rounded-xl border p-3">
                    <div className="mb-1 text-sm font-semibold">Prior-Approval / IFR / Blueteq</div>
                    <div className="text-sm">
                      <strong>{data.prior_approval.status}</strong>
                      {data.prior_approval.route ? ` — ${data.prior_approval.route.replace('_', ' ')}` : ""}
                    </div>
                    {data.prior_approval.bullets?.length && (
                      <ul className="mt-2 list-disc pl-5 text-sm">
                        {data.prior_approval.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {data.prior_approval.link && (
                      <a 
                        className="mt-2 inline-flex items-center gap-2 text-primary hover:underline" 
                        href={data.prior_approval.link} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" /> Open form/policy
                      </a>
                    )}
                  </div>
                )}

                {/* Formulary */}
                {data.formulary && (
                  <div className="rounded-xl border p-3">
                    <div className="mb-1 text-sm font-semibold">Formulary (Northamptonshire)</div>
                    <div className="text-sm text-muted-foreground">
                      {data.formulary.bnf_chapter} — {data.formulary.section}
                    </div>
                    <ol className="mt-2 list-decimal pl-5 text-sm">
                      {data.formulary.preferred.map((p, i) => (
                        <li key={i}>
                          <strong>{p.item_name}</strong>{p.notes ? ` — ${p.notes}` : ""}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-2 flex items-center gap-4">
                      {data.formulary.page_url && (
                        <a 
                          className="inline-flex items-center gap-2 text-primary hover:underline" 
                          target="_blank" 
                          rel="noreferrer" 
                          href={data.formulary.page_url}
                        >
                          <ExternalLink className="h-4 w-4" /> Open Formulary
                        </a>
                      )}
                      {data.formulary.last_published && (
                        <span className="text-xs text-muted-foreground">
                          Last published: {data.formulary.last_published}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                <div className="rounded-xl border p-3">
                  <div className="mb-2 text-sm font-semibold">Consider alternatives (local)</div>
                  {data.alternatives?.length ? (
                    <ul className="grid grid-cols-1 gap-2">
                      {data.alternatives.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{a.name}</div>
                            {a.notes && <div className="truncate text-xs text-muted-foreground">{a.notes}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Chip status={a.status as Status} href={a.detail_url} />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSel({ id: a.name, name: a.name, tl_status: a.status as Status })}
                            >
                              View
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground">No local alternatives found for this section.</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleCopySummary}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy summary
                  </Button>
                  {data.traffic_light?.detail_url && (
                    <Button variant="outline" asChild>
                      <a href={data.traffic_light.detail_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open ICB Traffic-Light
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}