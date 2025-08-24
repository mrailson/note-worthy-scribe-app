import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Copy, X, Maximize2, Minimize2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type Status =
  | "DOUBLE_RED" | "RED" | "SPECIALIST_INITIATED" | "SPECIALIST_RECOMMENDED"
  | "AMBER_2" | "AMBER_1" | "GREEN" | "GREY" | "UNKNOWN";

// Status classes with better semantic design system colors
const statusClass: Record<Status, string> = {
  DOUBLE_RED: "bg-destructive text-destructive-foreground",
  RED: "bg-destructive text-destructive-foreground",
  SPECIALIST_INITIATED: "bg-purple-600 text-white",
  SPECIALIST_RECOMMENDED: "bg-blue-600 text-white",
  AMBER_2: "bg-orange-600 text-white",
  AMBER_1: "bg-orange-500 text-white",
  GREEN: "bg-green-600 text-white",
  GREY: "bg-muted text-muted-foreground",
  UNKNOWN: "bg-muted text-muted-foreground"
};

function Chip({ status, href, tooltip }: { status: Status; href?: string; tooltip?: string }) {
  const label = status.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase());
  
  return (
    <span className="group relative inline-flex items-center">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[status]}`}>
        {label}
      </span>
      {tooltip && (
        <div className="pointer-events-none absolute z-50 mt-8 w-80 rounded-xl border bg-background p-3 text-sm shadow-lg opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-opacity">
          <div className="mb-1 font-semibold text-primary">Northamptonshire ICB</div>
          <p className="text-muted-foreground">{tooltip}</p>
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
      )}
    </span>
  );
}

type VocabItem = { id: string; name: string; tl_status?: Status; };

type DrugLookupResponse = {
  drug: string;
  traffic_light: {
    status: string;
    detail_url?: string;
    bnf_chapter?: string;
    notes?: string;
    status_tooltip?: string;
  } | null;
  prior_approval: {
    required: boolean;
    pdf_url?: string;
    page_ref?: string;
    criteria: Array<{
      id: string;
      criteria_text: string;
      category?: string;
      application_route?: string;
      application_url?: string;
      evidence_required?: string;
      icb_version?: string;
      icb_pdf_url?: string;
    }>;
  };
  formulary: Array<{
    name: string;
    status: string;
    therapeutic_area?: string;
    source_document?: string;
    source_page?: string;
    last_reviewed?: string;
    detail_url?: string;
    bnf_chapter?: string;
  }>;
  alternatives: Array<{
    name: string;
    status: string;
    therapeutic_area?: string;
  }>;
};

export function DrugQuickModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [sel, setSel] = useState<VocabItem | null>(null);
  const [data, setData] = useState<DrugLookupResponse | null>(null);
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

   // Enhanced logic for "Can GP initiate" based on formulary and traffic light data
   const canInitiate = useMemo(() => {
     // Check formulary data first
     if (data?.formulary && data.formulary.length > 0) {
       const status = data.formulary[0].status.toLowerCase();
       if (status.includes('green')) return 'YES';
       if (status.includes('formulary') && !status.includes('red')) return 'YES';
       if (status.includes('amber') || status.includes('specialist_recommended')) return 'ONLY_IF_SPECIALIST';
       if (status.includes('double_red') || status.includes('red') || status.includes('specialist_initiated')) return 'NO';
     }
     
     // Fall back to traffic light logic
     if (!data?.traffic_light?.status) return 'UNKNOWN';
     
     const status = data.traffic_light.status;
     if (status === 'GREEN' || status === 'GREY') return 'YES';
     if (status === 'AMBER_1' || status === 'AMBER_2' || status === 'SPECIALIST_RECOMMENDED') return 'ONLY_IF_SPECIALIST';
     if (status === 'DOUBLE_RED' || status === 'RED' || status === 'SPECIALIST_INITIATED') return 'NO';
     
     return 'UNKNOWN';
   }, [data]);

  const modalSizeClass = expandMode === 'expanded' ? "max-w-[90vw] max-h-[95vh]" : "max-w-[1170px] max-h-[85vh]";

  const handleCopySummary = () => {
    if (!data || !sel) return;
    
    const lines = [];
    lines.push(`Local policy: ${data.drug || sel.name} — ${data.traffic_light?.status || 'UNKNOWN'}.`);
    if (data.prior_approval.required) {
      lines.push(`Prior approval required.`);
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
          {/* Left: Results */}
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
                <div className="px-4 py-3 text-sm text-muted-foreground">Please begin the search by typing the drug name above</div>
              )}
            </div>
          </div>

          {/* Right: Details */}
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
                  <h2 className="text-lg font-semibold">{data.drug || sel.name}</h2>
                  {data.traffic_light?.status && (
                    <Chip 
                      status={data.traffic_light.status as Status} 
                      href={data.traffic_light.detail_url} 
                      tooltip={data.traffic_light.status_tooltip}
                    />
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
                </div>

                {/* Prior Approval Section */}
                {data.prior_approval.required ? (
                  <div className="rounded-xl border border-orange-300 p-3 bg-orange-50 dark:bg-orange-900/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <div className="text-sm font-semibold text-orange-800 dark:text-orange-200">Prior Approval Required</div>
                      <Badge variant="outline" className="bg-orange-100 border-orange-300 text-orange-800">
                        Prior Approval
                      </Badge>
                    </div>
                    
                    {/* Prior Approval Criteria */}
                    {data.prior_approval.criteria && data.prior_approval.criteria.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-sm font-medium">Approval Criteria:</div>
                        <ul className="space-y-2 text-sm">
                          {data.prior_approval.criteria.map((criterion, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-orange-600 mt-1">•</span>
                              <div>
                                <div>{criterion.criteria_text}</div>
                                {criterion.category && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Category: {criterion.category}
                                  </div>
                                )}
                                {criterion.application_route && (
                                  <div className="text-xs text-muted-foreground">
                                    Route: {criterion.application_route}
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {data.prior_approval.pdf_url && (
                        <a 
                          className="inline-flex items-center gap-2 text-primary hover:underline" 
                          href={data.prior_approval.pdf_url} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" /> Open ICB PDF
                        </a>
                      )}
                       <a 
                         className="inline-flex items-center gap-2 text-primary hover:underline" 
                         href="/prior-approval-northamptonshire-icb-august-2025.pdf"
                         target="_blank" 
                         rel="noreferrer"
                         title="Prior approval requirements document"
                       >
                         <ExternalLink className="h-4 w-4" /> Prior Approval Criteria - Northamptonshire ICB (August 2025)
                       </a>
                      {data.prior_approval.page_ref && (
                        <span className="text-xs text-muted-foreground">
                          {data.prior_approval.page_ref}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-green-300 p-3 bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-green-800 dark:text-green-200">No Prior Approval Required</div>
                      <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
                        No PA Required
                      </Badge>
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                      This medication does not require prior approval according to local guidelines.
                    </div>
                    <div className="mt-3">
                      <a 
                        className="inline-flex items-center gap-2 text-primary hover:underline" 
                        href="/prior-approval-northamptonshire-icb-august-2025.pdf"
                        target="_blank" 
                        rel="noreferrer"
                        title="Prior approval requirements document"
                      >
                        <ExternalLink className="h-4 w-4" /> Prior Approval Criteria - Northamptonshire ICB (August 2025)
                      </a>
                    </div>
                  </div>
                )}

                {/* Therapeutic Area */}
                {data.formulary?.[0]?.therapeutic_area && (
                  <div className="rounded-xl border p-3 bg-background">
                    <div className="mb-1 text-sm font-semibold">Therapeutic Area</div>
                    <div className="text-sm">
                      <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {data.formulary[0].therapeutic_area}
                      </span>
                    </div>
                  </div>
                )}

                {/* Formulary Information */}
                {data.formulary && data.formulary.length > 0 ? (
                  <div className="rounded-xl border p-3 bg-background">
                    <div className="mb-2 text-sm font-semibold">Formulary Information</div>
                    
                    <div className="space-y-3">
                      {data.formulary.map((item, i) => (
                        <div key={i} className="border-l-2 border-primary/20 pl-3">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.status && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {item.status}
                            </Badge>
                          )}
                          {item.bnf_chapter && (
                            <div className="text-xs text-muted-foreground mt-1">
                              BNF: {item.bnf_chapter}
                            </div>
                          )}
                          {item.source_document && (
                            <div className="text-xs text-muted-foreground">
                              Source: {item.source_document}
                            </div>
                          )}
                          {item.last_reviewed && (
                            <div className="text-xs text-muted-foreground">
                              Last reviewed: {format(new Date(item.last_reviewed), "do MMM yyyy")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      <div className="text-sm">No local formulary data stored</div>
                    </div>
                    <div className="mt-2">
                      <a 
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm" 
                        href={data.traffic_light?.detail_url || "https://www.icnorthamptonshire.org.uk/trafficlightdrugs"} 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" /> Check ICB page
                      </a>
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
                            {a.therapeutic_area && (
                              <div className="truncate text-xs text-muted-foreground">{a.therapeutic_area}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Chip status={a.status as Status} />
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
                <div className="mt-3">
                  <a 
                    className="inline-flex items-center gap-2 text-primary hover:underline" 
                    href="https://www.icnorthamptonshire.org.uk/trafficlightdrugs" 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" /> Check ICB website manually
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}