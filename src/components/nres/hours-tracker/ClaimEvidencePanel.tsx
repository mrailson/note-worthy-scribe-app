import { useRef } from 'react';
import { Upload, FileText, Trash2, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig, type EvidenceConfigRow } from '@/hooks/useNRESEvidenceConfig';

interface ClaimEvidencePanelProps {
  claimId: string;
  claimCategory: 'buyback' | 'new_sda' | 'mixed';
  canEdit: boolean;
  /** Pass shared evidence state to avoid duplicate hook instances */
  sharedEvidence?: {
    uploadedTypes: Record<string, any>;
    uploading: boolean;
    uploadEvidence: (evidenceType: string, file: File) => Promise<any>;
    deleteEvidence: (id: string) => Promise<void>;
    getDownloadUrl: (filePath: string) => Promise<string | null>;
  };
}

export function ClaimEvidencePanel({ claimId, claimCategory, canEdit, sharedEvidence }: ClaimEvidencePanelProps) {
  const internalEvidence = useNRESClaimEvidence(claimId);
  const { uploadedTypes, uploading, uploadEvidence, deleteEvidence, getDownloadUrl } = sharedEvidence || internalEvidence;
  const { getConfigForCategory, loading: configLoading } = useNRESEvidenceConfig();

  const applicableConfig = getConfigForCategory(claimCategory);

  if (configLoading) {
    return (
      <div className="px-3 py-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading evidence requirements…
      </div>
    );
  }

  if (applicableConfig.length === 0) return null;

  return (
    <div className="border-t">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-primary">Supporting Evidence</span>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {Object.keys(uploadedTypes).length}/{applicableConfig.length} uploaded
        </Badge>
      </div>
      <div className="divide-y">
        {applicableConfig.map(cfg => (
          <EvidenceSlot
            key={cfg.id}
            config={cfg}
            uploadedFile={uploadedTypes[cfg.evidence_type]}
            canEdit={canEdit}
            uploading={uploading}
            onUpload={(file) => uploadEvidence(cfg.evidence_type, file)}
            onDelete={(id) => deleteEvidence(id)}
            onDownload={getDownloadUrl}
          />
        ))}
      </div>
    </div>
  );
}

function EvidenceSlot({
  config,
  uploadedFile,
  canEdit,
  uploading,
  onUpload,
  onDelete,
  onDownload,
}: {
  config: EvidenceConfigRow;
  uploadedFile?: { id: string; file_name: string; file_path: string; file_size: number | null };
  canEdit: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onDownload: (path: string) => Promise<string | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFile = !!uploadedFile;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = '';
  };

  const handleDownload = async () => {
    if (!uploadedFile) return;
    const url = await onDownload(uploadedFile.file_path);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="px-3 py-2 flex items-center gap-3 text-xs">
      {/* Status icon */}
      {hasFile ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      ) : config.is_mandatory ? (
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{config.label}</span>
          {config.is_mandatory && <span className="text-red-500 text-[10px]">Required</span>}
        </div>
        {config.description && (
          <p className="text-muted-foreground text-[10px] truncate">{config.description}</p>
        )}
        {hasFile && (
          <p className="text-muted-foreground text-[10px] mt-0.5">
            {uploadedFile!.file_name}
            {uploadedFile!.file_size && ` (${(uploadedFile!.file_size / 1024).toFixed(0)} KB)`}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {hasFile && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleDownload}>
            <Download className="w-3 h-3 mr-1" /> View
          </Button>
        )}
        {hasFile && canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive"
            onClick={() => onDelete(uploadedFile!.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
        {!hasFile && canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.gif"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
              Upload
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Hook-like helper to check if all mandatory evidence is uploaded for a claim */
export function useEvidenceComplete(claimId: string, claimCategory: 'buyback' | 'new_sda' | 'mixed', externalUploadedTypes?: Record<string, any>) {
  const { uploadedTypes: internalUploadedTypes } = useNRESClaimEvidence(claimId);
  const { getMandatoryForCategory } = useNRESEvidenceConfig();

  const uploadedTypes = externalUploadedTypes ?? internalUploadedTypes;
  const mandatory = getMandatoryForCategory(claimCategory);
  const allUploaded = mandatory.length > 0 ? mandatory.every(cfg => !!uploadedTypes[cfg.evidence_type]) : false;

  return { allUploaded, mandatoryCount: mandatory.length, uploadedCount: Object.keys(uploadedTypes).filter(t => mandatory.some(m => m.evidence_type === t)).length };
}
