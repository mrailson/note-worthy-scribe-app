import { useEffect, useMemo, useState } from 'react';
import { FileText, Trash2, Download, Eye, CheckCircle2, AlertCircle, Loader2, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNRESClaimEvidence, type ClaimEvidenceFile } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig, type EvidenceConfigRow } from '@/hooks/useNRESEvidenceConfig';
import { SmartUploadZone } from './SmartUploadZone';
import { generateEvidenceSummaryFallback } from '@/utils/evidenceAiSummary';
import { EvidenceViewerModal } from './EvidenceViewerModal';

/** SNO-approved evidence checklist per claim type (v1.0 — Andrew Moore, PML/SNO, 29 Apr 2026). */
const SNO_EVIDENCE_CHECKLIST: Record<'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'mixed', string[]> = {
  buyback: [
    'Existing contract of employment (redacted as needed)',
    'Signed timesheet or rota screenshot for the claim month',
    'Clinical system slot type screenshot showing SDA slots',
    'Part B (LTC) substantiation — rota / SDA slot evidence proving backfill',
    'Pay slip extract may be requested (redaction policy applies)',
  ],
  new_sda: [
    'Contract of employment',
    'Job description',
    'Start date evidence (offer letter or payroll record)',
    'Signed timesheet or rota screenshot for the claim month',
    'Clinical system slot type screenshot showing SDA slots',
    'GMC number (optional, where applicable)',
  ],
  gp_locum: [
    'Locum invoice from the locum to the practice',
    'Signed timesheet or rota screenshot showing dates and sessions worked',
    'Clinical system slot type screenshot showing SDA slots',
    'GMC number',
    'Indemnity confirmation (where requested by the SNO)',
  ],
  management: [
    'NRES management activity log / monthly hours summary',
    'Meeting agenda, minutes or attendance list (optional, supporting)',
  ],
  mixed: [
    'Provide the evidence that applies to each category included in this claim.',
    'Buy-Back lines need contract + Part B substantiation.',
    'New SDA lines need contract, JD and start date evidence.',
    'GP Locum lines need locum invoice and GMC number.',
  ],
};

/** Universal data items captured by the NRES Verifier and printed on the invoice. */
const SNO_INVOICE_DATA_ITEMS = [
  'Name (or unique identifier), role and GL category',
  'Date(s) and hours worked',
  'Sessions claimed (where applicable) and rate being claimed',
  'Practice bank details, ODS code and invoice sequence (auto)',
];

interface ClaimEvidencePanelProps {
  claimId: string;
  claimCategory: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'mixed';
  canEdit: boolean;
  sharedEvidence?: {
    uploadedTypes: Record<string, any>;
    uploading: boolean;
    uploadEvidence: (evidenceType: string, file: File, staffIndex?: number) => Promise<any>;
    deleteEvidence: (id: string) => Promise<void>;
    getDownloadUrl: (filePath: string) => Promise<string | null>;
  };
}

export function ClaimEvidencePanel({ claimId, claimCategory, canEdit, sharedEvidence }: ClaimEvidencePanelProps) {
  const internalEvidence = useNRESClaimEvidence(claimId);
  const evidenceState = sharedEvidence || internalEvidence;
  const { uploadedTypes, uploading, uploadEvidence, deleteEvidence, getDownloadUrl } = evidenceState;
  const filesByType = useMemo(() => {
    const files = 'files' in evidenceState ? evidenceState.files as ClaimEvidenceFile[] : [];
    return files.reduce<Record<string, ClaimEvidenceFile[]>>((acc, file) => {
      acc[file.evidence_type] = [...(acc[file.evidence_type] || []), file];
      return acc;
    }, {});
  }, [evidenceState]);
  const { getConfigForCategory, loading: configLoading } = useNRESEvidenceConfig();

  const applicableConfig = getConfigForCategory(claimCategory);

  // Only show mandatory types + 'other_supporting' to keep the UI clean
  const visibleConfig = applicableConfig.filter(cfg => cfg.is_mandatory || cfg.evidence_type === 'other_supporting');
  const claimTypeLabel = ({ buyback: 'Buy-Back', new_sda: 'New SDA', management: 'NRES Management', gp_locum: 'GP Locum', mixed: 'Mixed' } as Record<typeof claimCategory, string>)[claimCategory];
  const tooltipRows = visibleConfig.length > 0 ? visibleConfig : applicableConfig;

  // Ordered list of all visible files for prev/next navigation in the viewer
  const orderedFiles = useMemo<ClaimEvidenceFile[]>(() => {
    const list: ClaimEvidenceFile[] = [];
    visibleConfig.forEach(cfg => {
      if (cfg.evidence_type === 'other_supporting') {
        (filesByType[cfg.evidence_type] || []).forEach(f => list.push(f));
      } else {
        const single = uploadedTypes[cfg.evidence_type];
        if (single) list.push(single as ClaimEvidenceFile);
      }
    });
    return list;
  }, [visibleConfig, filesByType, uploadedTypes]);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const openViewer = (file: ClaimEvidenceFile) => {
    const idx = orderedFiles.findIndex(f => f.id === file.id);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  if (configLoading) {
    return (
      <div className="px-3 py-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading evidence requirements…
      </div>
    );
  }

  if (visibleConfig.length === 0) return null;

  return (
    <div className="border-t">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary">Supporting Evidence</span>
        <TooltipProvider>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label={`${claimTypeLabel} supporting evidence requirements`}>
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="start" className="max-w-md p-3 text-xs">
              <div className="space-y-2">
                <p className="font-semibold text-sm">{claimTypeLabel} — what the SNO expects</p>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Supporting evidence (upload here)</p>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {SNO_EVIDENCE_CHECKLIST[claimCategory].map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Captured automatically on the invoice</p>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
                    {SNO_INVOICE_DATA_ITEMS.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-[10px] text-muted-foreground italic">Source: SDA Claims Evidence Requirements v1.0 — agreed with Andrew Moore (PML/SNO).</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {Object.values(filesByType).reduce((total, files) => total + files.length, 0) || Object.keys(uploadedTypes).length} uploaded
        </Badge>
      </div>
      <div className="divide-y">
        {visibleConfig.map(cfg => (
          <EvidenceSlot
            key={cfg.id}
            config={cfg}
            uploadedFile={uploadedTypes[cfg.evidence_type]}
            uploadedFiles={filesByType[cfg.evidence_type]}
            canEdit={canEdit}
            uploading={uploading}
            onUpload={(file) => uploadEvidence(cfg.evidence_type, file)}
            onUploadFiles={(files) => files.forEach(file => uploadEvidence(cfg.evidence_type, file))}
            onDelete={(id) => deleteEvidence(id)}
            onDownload={getDownloadUrl}
            onView={openViewer}
            allowMultiple={cfg.evidence_type === 'other_supporting'}
          />
        ))}
      </div>
      <EvidenceViewerModal
        open={viewerOpen}
        files={orderedFiles}
        initialIndex={viewerIndex}
        getDownloadUrl={getDownloadUrl}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}

/** Reusable evidence slot component */
export function EvidenceSlot({
  config,
  uploadedFile,
  uploadedFiles,
  canEdit,
  uploading,
  onUpload,
  onUploadFiles,
  onDelete,
  onDownload,
  onView,
  allowMultiple = false,
}: {
  config: EvidenceConfigRow;
  uploadedFile?: { id: string; file_name: string; file_path: string; file_size: number | null };
  uploadedFiles?: ClaimEvidenceFile[];
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onUploadFiles?: (files: File[]) => void;
  onDelete: (id: string) => void;
  onDownload: (path: string) => Promise<string | null>;
  onView?: (file: ClaimEvidenceFile) => void;
  allowMultiple?: boolean;
}) {
  const filesToShow = allowMultiple ? (uploadedFiles || []) : (uploadedFile ? [uploadedFile] : []);
  const hasFile = filesToShow.length > 0;
  const isOtherSupporting = config.evidence_type === 'other_supporting';
  const displayLabel = isOtherSupporting ? '' : config.label;
  const displayDescription = isOtherSupporting
    ? 'Any documentation to support the claim is added below. You can view or download the evidence as needed.'
    : config.description;

  const handleDownload = async (filePath: string) => {
    const url = await onDownload(filePath);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="px-3 py-2 flex items-center gap-3 text-xs">
      {!hasFile && (
        config.is_mandatory ? (
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
        )
      )}

      <div className="flex-1 min-w-0">
        {displayLabel && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{displayLabel}</span>
            {config.is_mandatory && <span className="text-red-500 text-[10px]">Required</span>}
          </div>
        )}
        {displayDescription && (
          <p className="text-muted-foreground text-[10px] truncate">{displayDescription}</p>
        )}
        {hasFile && (
          <div className="mt-1 space-y-1">
            {filesToShow.map(file => (
              <div key={file.id} className="flex items-center gap-1.5 text-muted-foreground text-[10px]">
                <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                <span className="truncate">{file.file_name}</span>
                {file.file_size && <span className="shrink-0">({(file.file_size / 1024).toFixed(0)} KB)</span>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-[10px]"
                  onClick={() => onView ? onView(file as ClaimEvidenceFile) : handleDownload(file.file_path)}
                >
                  <Eye className="w-3 h-3 mr-1" /> View
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-[10px]"
                  onClick={() => handleDownload(file.file_path)}
                  title="Download"
                >
                  <Download className="w-3 h-3" />
                </Button>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="h-5 px-1 text-destructive" onClick={() => onDelete(file.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canEdit && (!hasFile || allowMultiple) && (
          <SmartUploadZone
            compact
            onFilesSelected={(files) => allowMultiple && onUploadFiles ? onUploadFiles(files) : files[0] && onUpload(files[0])}
            uploading={uploading}
            multiple={allowMultiple}
            accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.gif"
          />
        )}
      </div>
    </div>
  );
}

/** Inline evidence component for a single staff member row */
export function StaffLineEvidence({
  staffCategory,
  staffIndex,
  staffName,
  staffRole,
  uploadedTypesForStaff,
  allFilesForStaff,
  canEdit,
  uploading,
  onUpload,
  onDelete,
  onDownload,
  hideHeader = false,
  triggerOpenAt,
}: {
  staffCategory: 'buyback' | 'new_sda' | 'management' | 'gp_locum';
  staffIndex: number;
  staffName?: string;
  staffRole?: string;
  uploadedTypesForStaff: Record<string, ClaimEvidenceFile>;
  allFilesForStaff?: ClaimEvidenceFile[];
  canEdit: boolean;
  uploading: boolean;
  onUpload: (evidenceType: string, file: File, staffIndex: number) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  onDownload: (filePath: string) => Promise<string | null>;
  hideHeader?: boolean;
  /** When this number changes, opens the viewer modal at file index 0 (or value if >=0) */
  triggerOpenAt?: number;
}) {
  const { getConfigForCategory } = useNRESEvidenceConfig();
  const allTypes = getConfigForCategory(staffCategory);

  // Only show mandatory evidence types + 'other_supporting' to reduce clutter
  const visibleTypes = allTypes.filter(t => t.is_mandatory || t.evidence_type === 'other_supporting');

  const uploadedCount = allFilesForStaff?.length || Object.keys(uploadedTypesForStaff).length;
  const mandatoryTypes = allTypes.filter(t => t.is_mandatory);
  const mandatoryUploaded = mandatoryTypes.filter(t => !!uploadedTypesForStaff[t.evidence_type]).length;
  const staffClaimTypeLabel = ({ buyback: 'Buy-Back', new_sda: 'New SDA', management: 'NRES Management', gp_locum: 'GP Locum' } as Record<typeof staffCategory, string>)[staffCategory];
  const tooltipRows = visibleTypes.length > 0 ? visibleTypes : allTypes;

  // Generate fallback AI summary
  const aiSummary = useMemo(() => {
    const files = allFilesForStaff || Object.values(uploadedTypesForStaff);
    if (files.length === 0) return '';
    const summaryCat = staffCategory === 'gp_locum' ? 'buyback' : staffCategory;
    return generateEvidenceSummaryFallback(
      staffName || 'Staff',
      staffRole || 'Unknown',
      summaryCat,
      files.map(f => ({ file_name: f.file_name, evidence_type: f.evidence_type, file_size: f.file_size })),
    );
  }, [uploadedTypesForStaff, allFilesForStaff, staffName, staffRole, staffCategory]);

  // Handle multi-file drop/paste — assign to 'other_supporting' by default
  const handleSmartUpload = async (files: File[]) => {
    const missingMandatory = mandatoryTypes.filter(t => !uploadedTypesForStaff[t.evidence_type]);

    for (let i = 0; i < files.length; i++) {
      const targetType = (files.length === 1 && missingMandatory.length === 1)
        ? missingMandatory[0].evidence_type
        : 'other_supporting';
      await onUpload(targetType, files[i], staffIndex);
    }
  };

  // Ordered list of all uploaded files for this staff line — drives prev/next in viewer
  const orderedFiles = useMemo<ClaimEvidenceFile[]>(() => {
    const list: ClaimEvidenceFile[] = [];
    visibleTypes.forEach(cfg => {
      if (cfg.evidence_type === 'other_supporting') {
        (allFilesForStaff || []).filter(f => f.evidence_type === 'other_supporting').forEach(f => list.push(f));
      } else {
        const single = uploadedTypesForStaff[cfg.evidence_type];
        if (single) list.push(single);
      }
    });
    return list;
  }, [visibleTypes, allFilesForStaff, uploadedTypesForStaff]);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const openViewer = (file: ClaimEvidenceFile) => {
    const idx = orderedFiles.findIndex(f => f.id === file.id);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerOpen(true);
  };

  // External trigger (from collapsible card header "View Evidence" link)
  useEffect(() => {
    if (triggerOpenAt === undefined) return;
    if (orderedFiles.length === 0) return;
    setViewerIndex(triggerOpenAt >= 0 && triggerOpenAt < orderedFiles.length ? triggerOpenAt : 0);
    setViewerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerOpenAt]);

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/30">
      {!hideHeader && (
      <div className="px-4 py-1.5 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-primary">Evidence</span>
        <TooltipProvider>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label={`${staffClaimTypeLabel} supporting evidence requirements`}>
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="start" className="max-w-md p-3 text-xs">
              <div className="space-y-2">
                <p className="font-semibold text-sm">{staffClaimTypeLabel} — what the SNO expects</p>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Supporting evidence (upload here)</p>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {SNO_EVIDENCE_CHECKLIST[staffCategory].map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Captured automatically on the invoice</p>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
                    {SNO_INVOICE_DATA_ITEMS.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-[10px] text-muted-foreground italic">Source: SDA Claims Evidence Requirements v1.0 — agreed with Andrew Moore (PML/SNO).</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {uploadedCount} uploaded
          {mandatoryUploaded < mandatoryTypes.length && (
            <span className="ml-1 text-red-500">({mandatoryTypes.length - mandatoryUploaded} required)</span>
          )}
        </Badge>
      </div>
      )}
      <div className="divide-y">
        {visibleTypes.map(cfg => {
          // For 'other_supporting', render inline SmartUploadZone instead of separate section
          if (cfg.evidence_type === 'other_supporting' && canEdit) {
            const otherSupportingFiles = (allFilesForStaff || []).filter(file => file.evidence_type === 'other_supporting');
            return (
              <div key={`${staffIndex}-${cfg.evidence_type}`} className="px-3 py-2 flex items-center gap-3 text-xs">
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground text-[10px]">Any documentation to support the claim is added below. You can view or download the evidence as needed.</p>
                  {otherSupportingFiles.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {otherSupportingFiles.map(file => (
                        <div key={file.id} className="flex items-center gap-1.5 text-muted-foreground text-[10px]">
                          <span className="truncate">{file.file_name}</span>
                          {file.file_size && <span className="shrink-0">({(file.file_size / 1024).toFixed(0)} KB)</span>}
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={() => openViewer(file)}>
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={async () => { const url = await onDownload(file.file_path); if (url) window.open(url, '_blank'); }} title="Download">
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-destructive" onClick={() => onDelete(file.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <SmartUploadZone
                    onFilesSelected={handleSmartUpload}
                    uploading={uploading}
                    multiple
                    compact
                  />
                </div>
              </div>
            );
          }
          const isMulti = cfg.evidence_type === 'other_supporting';
          const filesForType = isMulti
            ? (allFilesForStaff || []).filter(f => f.evidence_type === 'other_supporting')
            : undefined;
          return (
            <EvidenceSlot
              key={`${staffIndex}-${cfg.evidence_type}`}
              config={cfg}
              uploadedFile={uploadedTypesForStaff[cfg.evidence_type]}
              uploadedFiles={filesForType}
              canEdit={canEdit}
              uploading={uploading}
              onUpload={(file) => onUpload(cfg.evidence_type, file, staffIndex)}
              onDelete={(id) => onDelete(id)}
              onDownload={onDownload}
              onView={openViewer}
              allowMultiple={isMulti}
            />
          );
        })}
      </div>

      {aiSummary && (
        <div className="px-4 py-2 border-t flex items-start gap-2 bg-blue-50/50 dark:bg-blue-950/20">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-blue-700 dark:text-blue-300">Summary: </span>
            {aiSummary}
          </p>
        </div>
      )}

      <EvidenceViewerModal
        open={viewerOpen}
        files={orderedFiles}
        initialIndex={viewerIndex}
        getDownloadUrl={onDownload}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}

/** Hook-like helper to check if all mandatory evidence is uploaded per staff line — now config-driven */
export function useStaffLineEvidenceComplete(
  staffDetails: any[],
  getUploadedTypesForStaff: (staffIndex: number) => Record<string, ClaimEvidenceFile>,
  getConfigForCategory: (category: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'mixed') => EvidenceConfigRow[],
) {
  let allComplete = true;
  let totalMandatory = 0;
  let totalUploaded = 0;

  for (let i = 0; i < staffDetails.length; i++) {
    const s = staffDetails[i];
    const cat = (s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management' | 'gp_locum';
    const uploaded = getUploadedTypesForStaff(i);

    const mandatoryTypes = getConfigForCategory(cat).filter(t => t.is_mandatory);

    totalMandatory += mandatoryTypes.length;
    const staffUploaded = mandatoryTypes.filter(t => !!uploaded[t.evidence_type]).length;
    totalUploaded += staffUploaded;

    if (staffUploaded < mandatoryTypes.length) {
      allComplete = false;
    }
  }

  return { allComplete, totalMandatory, totalUploaded };
}

/** Legacy hook-like helper for claim-level evidence (kept for backward compat) */
export function useEvidenceComplete(claimId: string, claimCategory: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'mixed', externalUploadedTypes?: Record<string, any>) {
  const { uploadedTypes: internalUploadedTypes } = useNRESClaimEvidence(claimId);
  const { getMandatoryForCategory } = useNRESEvidenceConfig();

  const uploadedTypes = externalUploadedTypes ?? internalUploadedTypes;
  const mandatory = getMandatoryForCategory(claimCategory);
  const allUploaded = mandatory.length > 0 ? mandatory.every(cfg => !!uploadedTypes[cfg.evidence_type]) : false;

  return { allUploaded, mandatoryCount: mandatory.length, uploadedCount: Object.keys(uploadedTypes).filter(t => mandatory.some(m => m.evidence_type === t)).length };
}
