import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Copy, X, Maximize2, Minimize2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [expandMode, setExpandMode] = useState<'normal' | 'expanded'>('normal');

  useEffect(() => {
    if (open) {
      // Fetch vocabulary
      console.log('Fetching drug vocabulary...');
      supabase.functions.invoke('drug-vocabulary')
        .then(({ data: response, error }) => {
          console.log('Drug vocabulary response:', response, 'Error:', error);
          if (response?.items) {
            console.log(`Loaded ${response.items.length} vocabulary items`);
            setVocab(response.items);
          } else {
            console.error('No items in vocabulary response:', response);
          }
        })
        .catch((err) => {
          console.error('Drug vocabulary fetch error:', err);
        });
      
      setQ("");
      setSel(null);
      setData(null);
      setExpandMode('normal');
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

  const modalSizeClass = expandMode === 'expanded' ? "max-w-[90vw] max-h-[95vh]" : "max-w-[1170px] max-h-[85vh]";

  const handleCopySummary = () => {
    if (!data || !sel) return;
    
    const lines = [];
    lines.push(`Local policy: ${data.drug?.name || sel.name} — ${data.traffic_light?.status || 'UNKNOWN'}.`);
    if (data.prior_approval) {
      lines.push(`${data.prior_approval.status} ${data.prior_approval.route || ''}`);
    }
    navigator.clipboard.writeText(lines.join(" "));
  };

  const toggleExpand = () => {
    setExpandMode(current => current === 'expanded' ? 'normal' : 'expanded');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${modalSizeClass} overflow-hidden p-0 z-50 bg-background`} onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search local drug policies..."
              className="flex-1 border-0 focus-visible:ring-0 shadow-none"
            />
          </div>
          
          {/* Expansion Control */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpand}
              title={expandMode === 'expanded' ? "Minimize modal" : "Expand modal"}
              className={expandMode === 'expanded' ? 'bg-muted' : ''}
            >
              {expandMode === 'expanded' ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-12 gap-6 p-4 overflow-y-auto">
          {/* Left: Results - Reduced from col-span-8 to col-span-6 (25% narrower) */}
          <div className="col-span-6">
            <div className="rounded-xl border max-h-96 overflow-y-auto bg-background">
              {results.length ? (
                results.map(r => (
                  <div
                    key={r.id}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                      sel?.id === r.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                    onClick={() => setSel(r)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight break-words">{r.name}</div>
                    </div>
                    {r.tl_status && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold flex-shrink-0 whitespace-nowrap ${statusClass[r.tl_status as Status]}`}>
                        {r.tl_status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">Please begin search by typing the drug name above</div>
              )}
            </div>
          </div>

          {/* Right: Details - Expanded from col-span-4 to col-span-6 */}
          <div className="col-span-6">
            {!sel ? (
              <div className="text-muted-foreground p-4 text-center">
                <div className="mb-2 text-lg">👈</div>
                <p>Select a drug from the list to view detailed policy information</p>
              </div>
            ) : loading ? (
              <div className="text-muted-foreground p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p>Loading drug information...</p>
              </div>
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
                      Traffic-Light last updated: {format(new Date(data.traffic_light.last_modified), "do MMMM yyyy")}
                    </div>
                  )}
                </div>

                {/* Prior approval */}
                {data.prior_approval && (
                  <div className="rounded-xl border p-3 bg-background">
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
                  <div className="rounded-xl border p-3 bg-background">
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
                          Last published: {format(new Date(data.formulary.last_published), "do MMMM yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                <div className="rounded-xl border p-3 bg-background">
                  <div className="mb-2 text-sm font-semibold">Consider alternatives (local)</div>
                  {data.alternatives?.length ? (
                    <ul className="grid grid-cols-1 gap-2">
                      {data.alternatives.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 bg-background">
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
            ) : (
              <div className="text-muted-foreground p-4 text-center">
                <div className="mb-2 text-2xl">⚠️</div>
                <p>No policy information found for this drug</p>
                <p className="text-sm mt-1">Please check the ICB website manually</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}