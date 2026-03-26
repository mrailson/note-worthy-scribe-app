import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, Upload, Plus, Trash2, Loader2, Send, UserPlus, Users, Building2,
  GripVertical, FileText, Shield, CheckCircle2, Mail, Calendar, Hash, Eye, ChevronDown, ChevronUp, Pencil, Search,
  Layers, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useDocumentApproval, ApprovalContact } from '@/hooks/useDocumentApproval';
import { useNotewellDirectory, NotewellUser } from '@/hooks/useNotewellDirectory';
import { hashFile } from '@/utils/fileHash';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SignaturePositionPicker, StampPosition, PerSignatoryPositions, PerSignatoryFieldPositions } from './SignaturePositionPicker';
import { BatchPracticeSelector, PracticeSelection } from './BatchPracticeSelector';

const TITLE_OPTIONS = ['', 'Dr', 'Mr', 'Mrs', 'Ms', 'Miss', 'Prof', 'Rev'];
const ORG_TYPE_OPTIONS = ['', 'Practice', 'PCN', 'Federation', 'ICB', 'Other'];

interface SignatoryRow {
  id: string;
  signatory_title: string;
  name: string;
  email: string;
  role: string;
  organisation: string;
  organisation_type: string;
}

interface CreateApprovalFlowProps {
  onBack: () => void;
}

interface DocFile {
  localId: string;
  file: File;
  hash: string | null;
  title: string;
  url: string | null;
  docId: string | null;
  hashing: boolean;
}

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA', dsa: 'DSA', mou: 'MOU', policy: 'Policy',
  contract: 'Contract', privacy_notice: 'Privacy Notice', other: 'Other',
};

let _localId = 0;
function localId() { return `sig-${++_localId}-${Date.now()}`; }
let _fileLocalId = 0;
function fileLocalId() { return `file-${++_fileLocalId}-${Date.now()}`; }

export function CreateApprovalFlow({ onBack }: CreateApprovalFlowProps) {
  const {
    uploadDocument, addSignatories, sendForApproval, sendMultiDocForApproval, sendBatchForApproval,
    contacts, contactGroups, saveContact, deleteContact, updateContact, updateSignaturePlacement,
  } = useDocumentApproval();
  const { practiceGroups, loading: directoryLoading, loaded: directoryLoaded, fetchDirectory } = useNotewellDirectory();

  // Send mode: single or batch
  const [sendMode, setSendMode] = useState<'single' | 'batch'>('single');
  const [batchSelections, setBatchSelections] = useState<PracticeSelection[]>([]);

  const [step, setStep] = useState<'upload' | 'stamp_position' | 'signatories' | 'review'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [autoSendOnCompletion, setAutoSendOnCompletion] = useState(true);

  // ─── Step 1: Files & metadata ──────────────────────────────────────
  const [files, setFiles] = useState<DocFile[]>([]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [customEmailBody, setCustomEmailBody] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-document DB signatories (keyed by file localId)
  const [perDocSignatories, setPerDocSignatories] = useState<Record<string, { id: string; name: string; email: string }[]>>({});

  // Signature placement — per document (keyed by file localId)
  const signatureMethod = 'stamp' as const;
  const [allStampPositions, setAllStampPositions] = useState<Record<string, PerSignatoryPositions>>({});
  const [allPlacementModes, setAllPlacementModes] = useState<Record<string, 'block' | 'separated'>>({});
  const [allFieldPositions, setAllFieldPositions] = useState<Record<string, PerSignatoryFieldPositions>>({});
  const [allSeparatedFontSizes, setAllSeparatedFontSizes] = useState<Record<string, number>>({});
  const [allTextAnnotations, setAllTextAnnotations] = useState<Record<string, import('@/utils/generateSignedPdf').TextAnnotation[]>>({});

  // Active document in stamp positioning step
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  // ─── Step 2: Signatories ──────────────────────────────────────────
  const [signatories, setSignatories] = useState<SignatoryRow[]>([
    { id: localId(), signatory_title: '', name: '', email: '', role: '', organisation: '', organisation_type: '' },
  ]);
  const [saveNewContacts, setSaveNewContacts] = useState(true);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editingContact, setEditingContact] = useState<ApprovalContact | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', organisation: '', title: '', organisation_type: '' });
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [selectedDirectoryUsers, setSelectedDirectoryUsers] = useState<Set<string>>(new Set());
  const [expandedPractices, setExpandedPractices] = useState<Set<string>>(new Set());
  const [directorySearch, setDirectorySearch] = useState('');

  // Derived
  const groupTitle = files.length === 1 ? files[0]?.title || '' : files.map(f => f.title).filter(Boolean).join(', ') || 'Untitled';
  const activeFile = files[activeDocIndex] || null;

  // Current doc's signature state helpers
  const currentStampPositions = activeFile ? (allStampPositions[activeFile.localId] || {}) : {};
  const currentPlacementMode = activeFile ? (allPlacementModes[activeFile.localId] || 'block') : 'block';
  const currentFieldPositions = activeFile ? (allFieldPositions[activeFile.localId] || {}) : {};
  const currentSeparatedFontSize = activeFile ? (allSeparatedFontSizes[activeFile.localId] || 14) : 14;
  const currentTextAnnotations = activeFile ? (allTextAnnotations[activeFile.localId] || []) : [];
  const currentDocSignatories = activeFile ? (perDocSignatories[activeFile.localId] || []) : [];

  // ─── File handling ────────────────────────────────────────────────

  const processAndAddFiles = useCallback(async (newFiles: File[]) => {
    const pdfOrDocFiles = newFiles.filter(f => /\.(pdf|docx?|doc)$/i.test(f.name));
    if (pdfOrDocFiles.length === 0) {
      toast.error('Please select PDF or Word documents');
      return;
    }

    const newDocFiles: DocFile[] = pdfOrDocFiles.map(f => ({
      localId: fileLocalId(),
      file: f,
      hash: null,
      title: f.name.replace(/\.[^.]+$/, ''),
      url: null,
      docId: null,
      hashing: true,
    }));

    setFiles(prev => [...prev, ...newDocFiles]);

    // Hash each file in background
    for (const df of newDocFiles) {
      try {
        const hash = await hashFile(df.file);
        setFiles(prev => prev.map(f => f.localId === df.localId ? { ...f, hash, hashing: false } : f));
      } catch {
        setFiles(prev => prev.map(f => f.localId === df.localId ? { ...f, hashing: false } : f));
      }
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    processAndAddFiles(droppedFiles);
  }, [processAndAddFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      processAndAddFiles(Array.from(selected));
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (localId: string) => {
    setFiles(prev => prev.filter(f => f.localId !== localId));
    // Clean up per-doc state
    setAllStampPositions(prev => { const copy = { ...prev }; delete copy[localId]; return copy; });
    setAllPlacementModes(prev => { const copy = { ...prev }; delete copy[localId]; return copy; });
    setAllFieldPositions(prev => { const copy = { ...prev }; delete copy[localId]; return copy; });
    setAllSeparatedFontSizes(prev => { const copy = { ...prev }; delete copy[localId]; return copy; });
    setAllTextAnnotations(prev => { const copy = { ...prev }; delete copy[localId]; return copy; });
    setPerDocSignatories(prev => { const copy = { ...prev }; delete copy[localId]; return copy; });
  };

  const updateFileTitle = (localId: string, newTitle: string) => {
    setFiles(prev => prev.map(f => f.localId === localId ? { ...f, title: newTitle } : f));
  };

  const handleUploadAndContinue = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }
    // Validate titles
    const untitled = files.filter(f => !f.title.trim());
    if (untitled.length > 0) {
      toast.error('Please provide a title for each document');
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setUploadStatus(`Uploading ${i + 1}/${files.length}: ${f.file.name}…`);
        const placement = { method: 'stamp' as const, positions: {} };

        const doc = await uploadDocument(f.file, {
          title: f.title,
          description,
          category,
          deadline: deadline || undefined,
          message: message || undefined,
          signaturePlacement: placement,
        }, (status) => setUploadStatus(`${i + 1}/${files.length}: ${status}`));

        setFiles(prev => prev.map(pf => pf.localId === f.localId ? { ...pf, docId: doc.id, url: doc.file_url } : pf));
      }

      setStep('signatories');
      toast.success(files.length === 1 ? 'Document uploaded successfully' : `${files.length} documents uploaded successfully`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const handleStampPositionContinue = async () => {
    try {
      // Save positions for all documents
      for (const f of files) {
        if (!f.docId) continue;
        const mode = allPlacementModes[f.localId] || 'block';
        const placement = mode === 'separated'
          ? { method: 'separated' as const, fieldPositions: allFieldPositions[f.localId] || {}, separatedFontSize: allSeparatedFontSizes[f.localId] || 14, textAnnotations: allTextAnnotations[f.localId] || [] }
          : { method: 'stamp' as const, positions: allStampPositions[f.localId] || {}, textAnnotations: allTextAnnotations[f.localId] || [] };
        await updateSignaturePlacement(f.docId, placement);
      }
      setStep('review');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save signature positions');
    }
  };

  // ─── Signatory management ────────────────────────────────────────

  const addRow = () => {
    setSignatories(prev => [...prev, { id: localId(), signatory_title: '', name: '', email: '', role: '', organisation: '', organisation_type: '' }]);
  };

  const removeRow = (id: string) => {
    setSignatories(prev => prev.filter(s => s.id !== id));
  };

  const updateRow = (id: string, field: keyof SignatoryRow, value: string) => {
    setSignatories(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addContactsFromModal = () => {
    const selected = contacts.filter(c => selectedContactIds.has(c.id));
    const existingEmails = new Set(signatories.map(s => s.email.toLowerCase()));
    const newRows: SignatoryRow[] = selected
      .filter(c => !existingEmails.has(c.email.toLowerCase()))
      .map(c => ({
        id: localId(),
        signatory_title: c.title || '',
        name: c.name,
        email: c.email,
        role: c.role || '',
        organisation: c.organisation || '',
        organisation_type: c.organisation_type || '',
      }));

    setSignatories(prev => [...prev.filter(s => s.email || s.name), ...newRows]);
    setShowContactsModal(false);
    setSelectedContactIds(new Set());
    if (newRows.length > 0) toast.success(`Added ${newRows.length} contact(s)`);
  };

  const addGroup = (groupId: string) => {
    const group = contactGroups.find(g => g.id === groupId);
    if (!group) return;
    const existingEmails = new Set(signatories.map(s => s.email.toLowerCase()));
    const newRows: SignatoryRow[] = group.members
      .filter(c => !existingEmails.has(c.email.toLowerCase()))
      .map(c => ({
        id: localId(),
        signatory_title: c.title || '',
        name: c.name,
        email: c.email,
        role: c.role || '',
        organisation: c.organisation || '',
        organisation_type: c.organisation_type || '',
      }));

    setSignatories(prev => [...prev.filter(s => s.email || s.name), ...newRows]);
    toast.success(`Added ${newRows.length} from "${group.name}"`);
  };

  const openDirectoryModal = () => {
    if (!directoryLoaded) fetchDirectory();
    setSelectedDirectoryUsers(new Set());
    setExpandedPractices(new Set());
    setDirectorySearch('');
    setShowDirectoryModal(true);
  };

  const addFromDirectory = () => {
    const existingEmails = new Set(signatories.map(s => s.email.toLowerCase()));
    const allUsers = practiceGroups.flatMap(g => g.users);
    const selected = allUsers.filter(u => selectedDirectoryUsers.has(u.user_id));
    const newRows: SignatoryRow[] = selected
      .filter(u => !existingEmails.has(u.email.toLowerCase()))
      .map(u => ({
        id: localId(),
        signatory_title: u.title || '',
        name: u.full_name,
        email: u.email,
        role: u.practice_role || u.role || '',
        organisation: u.practice_name,
        organisation_type: u.organisation_type === 'Management' ? 'Other' : u.organisation_type || '',
      }));

    setSignatories(prev => [...prev.filter(s => s.email || s.name), ...newRows]);
    setShowDirectoryModal(false);
    setSelectedDirectoryUsers(new Set());
    if (newRows.length > 0) toast.success(`Added ${newRows.length} Notewell user(s)`);
  };

  // Drag reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setSignatories(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIdx, 1);
      copy.splice(idx, 0, moved);
      return copy;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const validSignatories = signatories.filter(s => s.name.trim() && s.email.trim());

  const handleContinueToReview = async () => {
    if (validSignatories.length === 0) {
      toast.error('Please add at least one signatory');
      return;
    }

    setSending(true);
    try {
      // Add signatories to ALL documents
      const newPerDocSigs: Record<string, { id: string; name: string; email: string }[]> = {};
      for (const f of files) {
        if (!f.docId) continue;
        const inserted = await addSignatories(f.docId, validSignatories);
        if (inserted) {
          newPerDocSigs[f.localId] = inserted.map(s => ({ id: s.id, name: s.name, email: s.email }));
        }
      }
      setPerDocSignatories(newPerDocSigs);

      if (saveNewContacts) {
        for (const s of validSignatories) {
          await saveContact({ name: s.name, email: s.email, role: s.role || undefined, organisation: s.organisation || undefined, title: s.signatory_title || undefined, organisation_type: s.organisation_type || undefined });
        }
      }

      setActiveDocIndex(0);
      setStep('stamp_position');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save signatories');
    } finally {
      setSending(false);
    }
  };

  // ─── Send ────────────────────────────────────────────────────────

  const handleSend = async () => {
    const docIds = files.map(f => f.docId).filter(Boolean) as string[];
    if (docIds.length === 0) return;
    setSending(true);
    try {
      if (sendMode === 'batch') {
        // Batch send (uses first doc)
        const practiceSignatories = batchSelections.map(s => ({
          practiceName: s.practiceName,
          signatories: s.signatories.filter(sig => sig.name.trim() && sig.email.trim()).map(sig => ({
            name: sig.name, email: sig.email, role: sig.role || undefined,
            organisation: sig.organisation || undefined, signatory_title: sig.signatory_title || undefined,
            organisation_type: sig.organisation_type || undefined,
          })),
        })).filter(ps => ps.signatories.length > 0);

        const { results } = await sendBatchForApproval(docIds[0], practiceSignatories, customEmailBody || undefined);
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        if (failCount > 0) {
          toast.warning(`Sent to ${successCount} practice${successCount !== 1 ? 's' : ''}. ${failCount} failed.`);
        } else {
          toast.success(`Document sent to ${successCount} practice${successCount !== 1 ? 's' : ''}! Track progress in the dashboard.`);
        }
      } else if (docIds.length === 1) {
        // Single document
        await sendForApproval(docIds[0], customEmailBody || undefined);
        toast.success('Document sent for approval! You can track progress in the dashboard.');
      } else {
        // Multi-document
        await sendMultiDocForApproval(docIds, customEmailBody || undefined);
        toast.success(`${docIds.length} documents sent for approval! Track progress in the dashboard.`);
      }
      onBack();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send for approval');
    } finally {
      setSending(false);
    }
  };

  // Batch continue to review
  const handleBatchContinueToReview = () => {
    const validBatch = batchSelections.filter(s => s.signatories.some(sig => sig.name.trim() && sig.email.trim()));
    if (validBatch.length === 0) {
      toast.error('Please add at least one signatory to at least one practice');
      return;
    }
    setStep('review');
  };

  // ─── Render ──────────────────────────────────────────────────────

  const stepLabel = step === 'upload' ? 'Step 1: Upload documents'
    : step === 'signatories' ? (sendMode === 'batch' ? 'Step 2: Select practices & signatories' : 'Step 2: Add signatories')
    : step === 'stamp_position' ? `Step 3: Position signatures${files.length > 1 ? ` (${activeDocIndex + 1}/${files.length})` : ''}`
    : (sendMode === 'batch' ? 'Step 3: Review & send batch' : 'Step 4: Review & send');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">New Approval Request</h1>
            <p className="text-sm text-muted-foreground">{stepLabel}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {['upload', 'signatories', 'stamp_position', 'review'].map((s, i, arr) => {
            const currentIdx = arr.indexOf(step);
            return (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${
                currentIdx >= i ? 'bg-primary' : 'bg-muted'
              }`} />
            );
          })}
        </div>

        {/* ═══ STEP 1: Upload ═══ */}
        {step === 'upload' && (
          <Card className="p-6 space-y-5">
            {/* Drop zone */}
            <div>
              <Label className="text-sm font-medium">Document Files *</Label>
              <div
                className="mt-2 border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleFileDrop}
                onDragOver={e => e.preventDefault()}
              >
                {files.length === 0 ? (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground mb-1">Drop your documents here</p>
                    <p className="text-xs text-muted-foreground">or click to browse — PDF, DOCX, DOC accepted. You can upload multiple files.</p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <Plus className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Drop or click to add more files</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} multiple />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{files.length} document{files.length !== 1 ? 's' : ''}</Label>
                {files.map((f, idx) => (
                  <div key={f.localId} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                    <FileText className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Input
                        value={f.title}
                        onChange={e => updateFileTitle(f.localId, e.target.value)}
                        placeholder="Document title"
                        className="text-sm h-8"
                      />
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{f.file.name}</span>
                        <span>{(f.file.size / 1024 / 1024).toFixed(2)} MB</span>
                        {f.hashing ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Hashing…
                          </span>
                        ) : f.hash ? (
                          <span className="font-mono">SHA-256: {f.hash.substring(0, 12)}…</span>
                        ) : null}
                      </div>
                      {f.file.name.toLowerCase().endsWith('.docx') && (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Will be converted to PDF
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeFile(f.localId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Category */}
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dpia">DPIA</SelectItem>
                  <SelectItem value="dsa">DSA</SelectItem>
                  <SelectItem value="mou">MOU</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="privacy_notice">Privacy Notice</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium">Description / Message to Signatories</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description or message to include in the approval email…"
                className="mt-1.5" rows={3} />
            </div>

            {/* Deadline */}
            <div>
              <Label className="text-sm font-medium">Deadline</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1.5" />
            </div>

            {/* Send Mode */}
            <div>
              <Label className="text-sm font-medium">Send mode</Label>
              <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as 'single' | 'batch')} className="mt-2 space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <RadioGroupItem value="single" id="mode-single" className="mt-0.5" />
                  <div>
                    <label htmlFor="mode-single" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" /> Single request
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">Send to one set of signatories</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <RadioGroupItem value="batch" id="mode-batch" className="mt-0.5" />
                  <div>
                    <label htmlFor="mode-batch" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" /> Batch to practices
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">Send the same document to multiple practices, each with their own signatories</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={handleUploadAndContinue} disabled={uploading || files.length === 0 || files.some(f => !f.title.trim())} className="w-full gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? (uploadStatus || 'Processing…') : `Upload${files.length > 1 ? ` ${files.length} Documents` : ''} & Continue`}
            </Button>
          </Card>
        )}

        {/* ═══ STEP 3: Stamp Position ═══ */}
        {step === 'stamp_position' && activeFile?.url && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-foreground mb-1">Position Signature Block</h2>
              <p className="text-xs text-muted-foreground">Drag each signatory's block to position it on the document</p>
            </div>

            {/* Document tab bar for multi-doc */}
            {files.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {files.map((f, idx) => (
                  <Button
                    key={f.localId}
                    variant={activeDocIndex === idx ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs gap-1.5 flex-shrink-0"
                    onClick={() => setActiveDocIndex(idx)}
                  >
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[120px] truncate">{f.title || `Doc ${idx + 1}`}</span>
                    {/* Show check if positions have been set */}
                    {(() => {
                      const mode = allPlacementModes[f.localId] || 'block';
                      const hasPositions = mode === 'block'
                        ? Object.keys(allStampPositions[f.localId] || {}).length > 0
                        : Object.keys(allFieldPositions[f.localId] || {}).length > 0;
                      return hasPositions ? <CheckCircle2 className="h-3 w-3 text-[hsl(var(--approval-approved))]" /> : null;
                    })()}
                  </Button>
                ))}
              </div>
            )}

            <SignaturePositionPicker
              fileUrl={activeFile.url}
              signatories={currentDocSignatories.length > 0
                ? currentDocSignatories.map(s => ({ id: s.id, name: s.name }))
                : validSignatories.map(s => ({ id: s.id, name: s.name }))
              }
              value={currentStampPositions}
              onChange={(positions) => setAllStampPositions(prev => ({ ...prev, [activeFile.localId]: positions }))}
              placementMode={currentPlacementMode}
              onPlacementModeChange={(mode) => setAllPlacementModes(prev => ({ ...prev, [activeFile.localId]: mode }))}
              fieldPositions={currentFieldPositions}
              onFieldPositionsChange={(positions) => setAllFieldPositions(prev => ({ ...prev, [activeFile.localId]: positions }))}
              separatedFontSize={currentSeparatedFontSize}
              onSeparatedFontSizeChange={(size) => setAllSeparatedFontSizes(prev => ({ ...prev, [activeFile.localId]: size }))}
              textAnnotations={currentTextAnnotations}
              onTextAnnotationsChange={(annotations) => setAllTextAnnotations(prev => ({ ...prev, [activeFile.localId]: annotations }))}
            />

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('signatories')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {files.length > 1 && activeDocIndex < files.length - 1 ? (
                <Button onClick={() => setActiveDocIndex(prev => prev + 1)} className="flex-1 gap-2">
                  Next Document <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleStampPositionContinue} className="flex-1 gap-2">
                  Continue to Review
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* ═══ STEP 2: Signatories (Batch) ═══ */}
        {step === 'signatories' && sendMode === 'batch' && (
          <div className="space-y-5">
            <BatchPracticeSelector
              selections={batchSelections}
              onChange={setBatchSelections}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleBatchContinueToReview}
                disabled={batchSelections.length === 0 || !batchSelections.some(s => s.signatories.some(sig => sig.name.trim() && sig.email.trim()))}
                className="flex-1 gap-2"
              >
                Continue to Review
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Signatories (Single) ═══ */}
        {step === 'signatories' && sendMode === 'single' && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-foreground">Signatories</h2>
                <p className="text-xs text-muted-foreground">
                  {validSignatories.length} signator{validSignatories.length !== 1 ? 'ies' : 'y'} added
                  {files.length > 1 && ` — shared across ${files.length} documents`}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setShowContactsModal(true)} className="gap-1 text-xs">
                  <UserPlus className="h-3 w-3" /> Add from Contacts
                </Button>
                <Button variant="outline" size="sm" onClick={openDirectoryModal} className="gap-1 text-xs">
                  <Building2 className="h-3 w-3" /> Notewell Users
                </Button>
                {contactGroups.length > 0 && (
                  <Select onValueChange={addGroup}>
                    <SelectTrigger className="h-8 text-xs w-auto gap-1">
                      <Users className="h-3 w-3" />
                      <SelectValue placeholder="Add Group" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactGroups.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} ({g.members.length})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-[24px_80px_1fr_1fr_1fr_1fr_120px_32px] gap-2 px-3 text-xs font-medium text-muted-foreground">
              <span />
              <span>Title</span>
              <span>Name *</span>
              <span>Email *</span>
              <span>Role</span>
              <span>Organisation</span>
              <span>Org Type</span>
              <span />
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {signatories.map((s, idx) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`grid grid-cols-1 md:grid-cols-[24px_80px_1fr_1fr_1fr_1fr_120px_32px] gap-2 p-3 bg-muted/50 rounded-lg items-center transition-opacity ${
                    dragIdx === idx ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab hidden md:block" />
                  <Select value={s.signatory_title} onValueChange={v => updateRow(s.id, 'signatory_title', v)}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Title" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map(t => (
                        <SelectItem key={t || '__none'} value={t || ' '}>{t || '—'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={s.name} onChange={e => updateRow(s.id, 'name', e.target.value)} placeholder="Full name" className="text-sm" />
                  <Input type="email" value={s.email} onChange={e => updateRow(s.id, 'email', e.target.value)} placeholder="Email address" className="text-sm" />
                  <Input value={s.role} onChange={e => updateRow(s.id, 'role', e.target.value)} placeholder="Role" className="text-sm" />
                  <Input value={s.organisation} onChange={e => updateRow(s.id, 'organisation', e.target.value)} placeholder="Organisation" className="text-sm" />
                  <Select value={s.organisation_type} onValueChange={v => updateRow(s.id, 'organisation_type', v)}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORG_TYPE_OPTIONS.map(t => (
                        <SelectItem key={t || '__none'} value={t || ' '}>{t || '—'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(s.id)} disabled={signatories.length <= 1}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Save contacts checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-contacts"
                checked={saveNewContacts}
                onCheckedChange={(v) => setSaveNewContacts(!!v)}
              />
              <Label htmlFor="save-contacts" className="text-sm text-muted-foreground cursor-pointer">
                Save new contacts for future use
              </Label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleContinueToReview} disabled={sending || validSignatories.length === 0} className="flex-1 gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue to Position Signatures
              </Button>
            </div>
          </Card>
        )}

        {/* ═══ STEP 4: Review & Send ═══ */}
        {step === 'review' && (
          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Review & Send
              </h2>

              {/* Documents list */}
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">
                  {files.length === 1 ? 'Document:' : `${files.length} Documents:`}
                </span>
                {files.map((f, idx) => (
                  <div key={f.localId} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-foreground flex-1 min-w-0 truncate">{f.title}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{f.file.name}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>{' '}
                  <Badge variant="outline" className="text-xs">{categoryLabels[category] || category}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Deadline:</span>{' '}
                  <span className="text-foreground">
                    {deadline ? format(new Date(deadline), 'dd MMM yyyy') : 'No deadline set'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Signatories list */}
            {sendMode === 'batch' ? (
              <Card className="p-6 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Batch: {batchSelections.length} practice{batchSelections.length !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-3">
                  {batchSelections.map(sel => {
                    const validSigs = sel.signatories.filter(s => s.name.trim() && s.email.trim());
                    return (
                      <div key={sel.practiceKey} className="border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-medium text-foreground">{sel.practiceName}</span>
                          <Badge variant="secondary" className="text-[10px]">{validSigs.length} signator{validSigs.length !== 1 ? 'ies' : 'y'}</Badge>
                        </div>
                        {validSigs.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-2 pl-5 text-sm">
                            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium">{i + 1}</span>
                            <span className="font-medium text-foreground">{s.name}</span>
                            <span className="text-muted-foreground">({s.email})</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="p-6 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {validSignatories.length} Signator{validSignatories.length !== 1 ? 'ies' : 'y'}
                </h3>
                <div className="space-y-2">
                  {validSignatories.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded text-sm">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="text-muted-foreground ml-2">({s.email})</span>
                        {s.role && <span className="text-xs text-muted-foreground ml-2">· {s.role}</span>}
                        {s.organisation && <span className="text-xs text-muted-foreground ml-1">· {s.organisation}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Auto-send toggle */}
            <Card className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-send signed document on completion</Label>
                  <p className="text-xs text-muted-foreground">
                    When all parties have signed, automatically email the signed document to everyone
                  </p>
                </div>
                <Switch
                  checked={autoSendOnCompletion}
                  onCheckedChange={setAutoSendOnCompletion}
                />
              </div>
            </Card>

            {/* Email preview / editor */}
            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Email Preview
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!editingEmail) {
                      const deadlineText = deadline ? `\nDeadline: ${format(new Date(deadline), 'dd MMMM yyyy')}` : '';
                      const descText = description ? `\n\n"${description}"` : '';
                      const docList = files.length > 1
                        ? `\n\nDocuments:\n${files.map((f, i) => `  ${i + 1}. ${f.title}`).join('\n')}`
                        : '';
                      setCustomEmailBody(
                        `Dear [Signatory Name],\n\nYou have been asked to review and approve the following document${files.length > 1 ? 's' : ''}:\n\n${files[0]?.title || 'Untitled'}\nCategory: ${categoryLabels[category] || category}${deadlineText}${descText}${docList}\n\nPlease click the link below to review the document and record your approval:`
                      );
                    }
                    setEditingEmail(!editingEmail);
                  }}
                  className="text-xs gap-1"
                >
                  {editingEmail ? 'Preview' : 'Edit'}
                </Button>
              </div>

              {editingEmail ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Subject:</p>
                  <p className="font-medium text-foreground text-sm">
                    Document Approval Requested: {files[0]?.title || 'Untitled'}
                    {files.length > 1 && ` (+${files.length - 1} more)`}
                  </p>
                  <hr className="border-border" />
                  <Textarea
                    value={customEmailBody}
                    onChange={e => setCustomEmailBody(e.target.value)}
                    rows={10}
                    className="text-sm font-mono"
                  />
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs text-muted-foreground border border-border">
                    <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                    The unique approval link and footer are added automatically and cannot be removed.
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border border-border">
                  <p className="text-xs text-muted-foreground">Subject:</p>
                  <p className="font-medium text-foreground">
                    Document Approval Requested: {files[0]?.title || 'Untitled'}
                    {files.length > 1 && ` (+${files.length - 1} more)`}
                  </p>
                  <hr className="border-border" />
                  {customEmailBody ? (
                    <div className="whitespace-pre-wrap text-muted-foreground">{customEmailBody}</div>
                  ) : (
                    <>
                      <p className="text-muted-foreground">Dear <span className="italic">[Signatory Name]</span>,</p>
                      <p className="text-muted-foreground">
                        You have been asked to review and approve the following document{files.length > 1 ? 's' : ''}:
                      </p>
                      <div className="pl-4 border-l-2 border-primary/30 space-y-1">
                        {files.map((f, idx) => (
                          <p key={f.localId} className="text-foreground font-medium">{f.title}</p>
                        ))}
                        <p className="text-xs text-muted-foreground">Category: {categoryLabels[category] || category}</p>
                        {deadline && <p className="text-xs text-muted-foreground">Deadline: {format(new Date(deadline), 'dd MMMM yyyy')}</p>}
                      </div>
                      {description && (
                        <p className="text-muted-foreground italic">"{description}"</p>
                      )}
                      <p className="text-muted-foreground">
                        Please click the link below to review the document and record your approval:
                      </p>
                    </>
                  )}
                  <p className="text-primary underline text-xs">[Unique approval link]</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    This is an automated message from Notewell Document Approval Service.
                  </p>
                </div>
              )}
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(sendMode === 'batch' ? 'signatories' : 'stamp_position')} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSend} disabled={sending} className="flex-1 gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendMode === 'batch'
                  ? `Send to ${batchSelections.length} Practice${batchSelections.length !== 1 ? 's' : ''}`
                  : files.length > 1
                    ? `Send ${files.length} Documents for Approval`
                    : 'Send for Approval'
                }
              </Button>
            </div>

            {/* ─── Collapsible Document Preview ─── */}
            {files.some(f => f.url) && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={async () => {
                    const opening = !showDocPreview;
                    setShowDocPreview(opening);
                    if (opening && previewPages.length === 0 && !previewLoading) {
                      setPreviewLoading(true);
                      try {
                        const pdfjsLib = await import('pdfjs-dist');
                        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                          'pdfjs-dist/build/pdf.worker.min.mjs',
                          import.meta.url
                        ).toString();

                        const firstFileUrl = files[0]?.url;
                        if (!firstFileUrl) throw new Error('No file URL');

                        let arrayBuffer: ArrayBuffer;
                        const pathMatch = firstFileUrl.match(/approval-documents\/(.+)$/);
                        const storagePath = pathMatch?.[1];
                        if (storagePath) {
                          const { data, error } = await supabase.storage.from('approval-documents').download(storagePath);
                          if (error || !data) {
                            const { data: signedData } = await supabase.storage.from('approval-documents').createSignedUrl(storagePath, 300);
                            if (signedData?.signedUrl) {
                              const res = await fetch(signedData.signedUrl);
                              arrayBuffer = await res.arrayBuffer();
                            } else {
                              throw error || new Error('Download failed');
                            }
                          } else {
                            arrayBuffer = await data.arrayBuffer();
                          }
                        } else {
                          const res = await fetch(firstFileUrl);
                          arrayBuffer = await res.arrayBuffer();
                        }
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        const pages: string[] = [];
                        const maxPages = Math.min(pdf.numPages, 5);
                        for (let i = 1; i <= maxPages; i++) {
                          const page = await pdf.getPage(i);
                          const viewport = page.getViewport({ scale: 1.5 });
                          const canvas = document.createElement('canvas');
                          canvas.width = viewport.width;
                          canvas.height = viewport.height;
                          const ctx = canvas.getContext('2d')!;
                          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
                          pages.push(canvas.toDataURL('image/png'));
                        }
                        setPreviewPages(pages);
                      } catch (err) {
                        console.error('Failed to load preview:', err);
                        toast.error('Could not load document preview');
                      } finally {
                        setPreviewLoading(false);
                      }
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Preview Document
                  </span>
                  {showDocPreview
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
                {showDocPreview && (
                  <div className="bg-muted/20 p-2 space-y-2 max-h-[600px] overflow-y-auto">
                    {previewLoading && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Rendering preview…</span>
                      </div>
                    )}
                    {previewPages.map((src, i) => (
                      <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full rounded border bg-white shadow-sm" />
                    ))}
                    {previewPages.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center">Showing first {previewPages.length} page(s)</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Contacts Modal ═══ */}
        <Dialog open={showContactsModal} onOpenChange={setShowContactsModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Contacts</DialogTitle>
            </DialogHeader>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No saved contacts yet. Contacts are saved automatically when you add signatories.
              </p>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => {
                  const checked = selectedContactIds.has(c.id);
                  const isEditing = editingContact?.id === c.id;

                  if (isEditing) {
                    return (
                      <div key={c.id} className="p-3 rounded-lg border-2 border-primary/30 bg-muted/30 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          <Input placeholder="Email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                          <Input placeholder="Role" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} />
                          <Input placeholder="Organisation" value={editForm.organisation} onChange={e => setEditForm(f => ({ ...f, organisation: e.target.value }))} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingContact(null)}>Cancel</Button>
                          <Button size="sm" onClick={async () => {
                            if (!editForm.name.trim() || !editForm.email.trim()) { toast.error('Name and email are required'); return; }
                            await updateContact(c.id, editForm);
                            setEditingContact(null);
                          }}>Save</Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className="cursor-pointer flex items-center gap-3 flex-1 min-w-0" onClick={() => {
                        setSelectedContactIds(prev => {
                          const next = new Set(prev);
                          checked ? next.delete(c.id) : next.add(c.id);
                          return next;
                        });
                      }}>
                        <Checkbox checked={checked} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                          {(c.role || c.organisation) && (
                            <p className="text-xs text-muted-foreground">
                              {c.role}{c.role && c.organisation ? ' · ' : ''}{c.organisation}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                          e.stopPropagation();
                          setEditingContact(c);
                          setEditForm({ name: c.name, email: c.email, role: c.role || '', organisation: c.organisation || '', title: c.title || '', organisation_type: c.organisation_type || '' });
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async (e) => {
                          e.stopPropagation();
                          await deleteContact(c.id);
                          setSelectedContactIds(prev => { const next = new Set(prev); next.delete(c.id); return next; });
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowContactsModal(false)}>Cancel</Button>
              <Button onClick={addContactsFromModal} disabled={selectedContactIds.size === 0} className="gap-1">
                <UserPlus className="h-4 w-4" /> Add {selectedContactIds.size} Contact{selectedContactIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ Notewell Directory Modal ═══ */}
        <Dialog open={showDirectoryModal} onOpenChange={setShowDirectoryModal}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Notewell Users
              </DialogTitle>
            </DialogHeader>
            {directoryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading directory…</span>
              </div>
            ) : practiceGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No Notewell users found.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name…"
                    value={directorySearch}
                    onChange={e => setDirectorySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(() => {
                  const searchLower = directorySearch.toLowerCase().trim();
                  const filteredGroups = searchLower
                    ? practiceGroups
                        .map(g => ({
                          ...g,
                          users: g.users.filter(u =>
                            u.full_name.toLowerCase().includes(searchLower) ||
                            u.email.toLowerCase().includes(searchLower)
                          ),
                        }))
                        .filter(g => g.users.length > 0)
                    : practiceGroups;

                  if (filteredGroups.length === 0) {
                    return <p className="text-sm text-muted-foreground text-center py-4">No users match "{directorySearch}"</p>;
                  }

                  return filteredGroups.map(group => {
                  const isExpanded = expandedPractices.has(group.practice_name);
                  const selectedInGroup = group.users.filter(u => selectedDirectoryUsers.has(u.user_id)).length;
                  const orgLabel = group.organisation_type === 'Practice' ? 'NRES Practice'
                    : group.organisation_type === 'Management' ? 'PML'
                    : group.organisation_type;

                  return (
                    <div key={group.practice_name} className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedPractices(prev => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(group.practice_name) : next.add(group.practice_name);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5 rotate-180" />}
                          <span className="font-medium text-foreground">{group.practice_name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{orgLabel}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedInGroup > 0 && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">{selectedInGroup}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{group.users.length} user{group.users.length !== 1 ? 's' : ''}</span>
                        </div>
                      </button>
                      {(isExpanded || searchLower) && (
                        <div className="divide-y">
                          {group.users.map(u => {
                            const isSelected = selectedDirectoryUsers.has(u.user_id);
                            const alreadyAdded = signatories.some(s => s.email.toLowerCase() === u.email.toLowerCase());
                            return (
                              <div
                                key={u.user_id}
                                onClick={() => {
                                  if (alreadyAdded) return;
                                  setSelectedDirectoryUsers(prev => {
                                    const next = new Set(prev);
                                    isSelected ? next.delete(u.user_id) : next.add(u.user_id);
                                    return next;
                                  });
                                }}
                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                  alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/30'
                                }`}
                              >
                                <Checkbox checked={isSelected} disabled={alreadyAdded} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {u.title ? `${u.title} ` : ''}{u.full_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                  {u.practice_role && (
                                    <p className="text-xs text-muted-foreground">{u.practice_role}</p>
                                  )}
                                </div>
                                {alreadyAdded && (
                                  <Badge variant="secondary" className="text-[10px]">Added</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
                })()}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowDirectoryModal(false)}>Cancel</Button>
              <Button onClick={addFromDirectory} disabled={selectedDirectoryUsers.size === 0} className="gap-1">
                <UserPlus className="h-4 w-4" /> Add {selectedDirectoryUsers.size} User{selectedDirectoryUsers.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
