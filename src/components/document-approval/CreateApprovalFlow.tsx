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
  ArrowLeft, Upload, Plus, Trash2, Loader2, Send, UserPlus, Users,
  GripVertical, FileText, Shield, CheckCircle2, Mail, Calendar, Hash, Stamp, FileSignature, Eye, ChevronDown, ChevronUp, Pencil,
} from 'lucide-react';
import { useDocumentApproval, ApprovalContact } from '@/hooks/useDocumentApproval';
import { hashFile } from '@/utils/fileHash';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SignaturePositionPicker, StampPosition } from './SignaturePositionPicker';

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

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA', dsa: 'DSA', mou: 'MOU', policy: 'Policy',
  contract: 'Contract', privacy_notice: 'Privacy Notice', other: 'Other',
};

let _localId = 0;
function localId() { return `sig-${++_localId}-${Date.now()}`; }

export function CreateApprovalFlow({ onBack }: CreateApprovalFlowProps) {
  const {
    uploadDocument, addSignatories, sendForApproval,
    contacts, contactGroups, saveContact, deleteContact, updateContact, updateSignaturePlacement,
  } = useDocumentApproval();

  const [step, setStep] = useState<'upload' | 'stamp_position' | 'signatories' | 'review'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [convertedToPdf, setConvertedToPdf] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ─── Step 1: File & metadata ──────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [customEmailBody, setCustomEmailBody] = useState('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature placement
  const [signatureMethod, setSignatureMethod] = useState<'append' | 'stamp'>('append');
  const [stampPosition, setStampPosition] = useState<StampPosition>({ page: 1, x: 10, y: 55, width: 80, height: 40 });

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

  // ─── File handling ────────────────────────────────────────────────

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = Array.from(e.dataTransfer.files).find(
      f => /\.(pdf|docx?|doc)$/i.test(f.name)
    );
    if (f) processFile(f);
    else toast.error('Please drop a PDF or Word document');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const processFile = async (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    setFileHash(null);
    setHashing(true);
    try {
      const hash = await hashFile(f);
      setFileHash(hash);
    } catch {
      toast.error('Failed to calculate file hash');
    } finally {
      setHashing(false);
    }
  };

  const handleUploadAndContinue = async () => {
    if (!file || !title.trim()) {
      toast.error('Please select a file and enter a title');
      return;
    }
    setUploading(true);
    setUploadStatus(null);
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    try {
      const placement = signatureMethod === 'stamp'
        ? { method: 'stamp' as const, ...stampPosition }
        : { method: 'append' as const };

      const doc = await uploadDocument(file, {
        title, description, category,
        deadline: deadline || undefined,
        message: message || undefined,
        signaturePlacement: placement,
      }, (status) => setUploadStatus(status));

      setDocumentId(doc.id);
      setFileUrl(doc.file_url);

      if (isDocx) {
        setConvertedToPdf(true);
        toast.success('Converted from Word to PDF successfully');
      }

      // After conversion, the stored file is always PDF, so stamp is available
      const storedIsPdf = isDocx || file.name.toLowerCase().endsWith('.pdf');
      if (signatureMethod === 'stamp' && storedIsPdf) {
        setStep('stamp_position');
      } else {
        setStep('signatories');
      }
      toast.success('Document uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  };

  const handleStampPositionContinue = async () => {
    if (!documentId) return;
    try {
      await updateSignaturePlacement(documentId, { method: 'stamp', ...stampPosition });
      setStep('signatories');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save signature position');
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
    if (!documentId) return;

    setSending(true);
    try {
      await addSignatories(documentId, validSignatories);

      if (saveNewContacts) {
        for (const s of validSignatories) {
          await saveContact({ name: s.name, email: s.email, role: s.role || undefined, organisation: s.organisation || undefined, title: s.signatory_title || undefined, organisation_type: s.organisation_type || undefined });
        }
      }

      setStep('review');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save signatories');
    } finally {
      setSending(false);
    }
  };

  // ─── Send ────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!documentId) return;
    setSending(true);
    try {
      await sendForApproval(documentId, customEmailBody || undefined);
      toast.success('Document sent for approval! You can track progress in the dashboard.');
      onBack();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send for approval');
    } finally {
      setSending(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

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
            <p className="text-sm text-muted-foreground">
              {step === 'upload' ? 'Step 1: Upload document' : step === 'stamp_position' ? 'Step 1b: Position signatures' : step === 'signatories' ? 'Step 2: Add signatories' : 'Step 3: Review & send'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {['upload', 'signatories', 'review'].map((s, i) => {
            const stepOrder = ['upload', 'stamp_position', 'signatories', 'review'];
            const currentIdx = stepOrder.indexOf(step);
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
              <Label className="text-sm font-medium">Document File *</Label>
              <div
                className="mt-2 border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleFileDrop}
                onDragOver={e => e.preventDefault()}
              >
                {file ? (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 text-primary mx-auto" />
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                    {/* Hash display */}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {hashing ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Calculating integrity hash…
                        </span>
                      ) : fileHash ? (
                        <span className="text-xs font-mono text-muted-foreground break-all">
                          SHA-256: {fileHash.substring(0, 16)}…{fileHash.substring(fileHash.length - 16)}
                        </span>
                      ) : null}
                    </div>

                    {/* DOCX notice */}
                    {file.name.toLowerCase().endsWith('.docx') && (
                      <p className="text-xs text-primary flex items-center justify-center gap-1 mt-1">
                        <Shield className="h-3 w-3" /> Word document — will be automatically converted to PDF before sending
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground mb-1">Drop your document here</p>
                    <p className="text-xs text-muted-foreground">or click to browse — PDF, DOCX, DOC accepted</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
            </div>

            {/* Title */}
            <div>
              <Label className="text-sm font-medium">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Data Sharing Agreement v2.1" className="mt-1.5" />
            </div>

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

            {/* Signature Placement */}
            <div>
              <Label className="text-sm font-medium">Signature placement</Label>
              <RadioGroup value={signatureMethod} onValueChange={(v) => setSignatureMethod(v as 'append' | 'stamp')} className="mt-2 space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <RadioGroupItem value="append" id="sig-append" className="mt-0.5" />
                  <div>
                    <label htmlFor="sig-append" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-primary" /> Append signature page
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">Adds a professional signature page as the final page of the document</p>
                  </div>
                </div>
                <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  !(file?.name.toLowerCase().endsWith('.pdf') || file?.name.toLowerCase().endsWith('.docx')) ? 'border-border opacity-50' : 'border-border hover:border-primary/50'
                }`}>
                  <RadioGroupItem value="stamp" id="sig-stamp" className="mt-0.5" disabled={!(file?.name.toLowerCase().endsWith('.pdf') || file?.name.toLowerCase().endsWith('.docx'))} />
                  <div>
                    <label htmlFor="sig-stamp" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                      <Stamp className="h-4 w-4 text-primary" /> Stamp signature block
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Places signatures onto a specific page in the document
                      {!(file?.name.toLowerCase().endsWith('.pdf') || file?.name.toLowerCase().endsWith('.docx')) && ' (PDF or DOCX only)'}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={handleUploadAndContinue} disabled={uploading || !file || !title.trim()} className="w-full gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? (uploadStatus || 'Processing…') : 'Upload & Continue'}
            </Button>
          </Card>
        )}

        {/* ═══ STEP 1b: Stamp Position ═══ */}
        {step === 'stamp_position' && fileUrl && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-foreground mb-1">Position Signature Block</h2>
              <p className="text-xs text-muted-foreground">Select the page and drag the overlay to define where signatures will appear</p>
            </div>
            <SignaturePositionPicker
              fileUrl={fileUrl}
              value={stampPosition}
              onChange={setStampPosition}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleStampPositionContinue} className="flex-1 gap-2">
                Continue to Signatories
              </Button>
            </div>
          </Card>
        )}

        {/* ═══ STEP 2: Signatories ═══ */}
        {step === 'signatories' && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-foreground">Signatories</h2>
                <p className="text-xs text-muted-foreground">
                  {validSignatories.length} signator{validSignatories.length !== 1 ? 'ies' : 'y'} added
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setShowContactsModal(true)} className="gap-1 text-xs">
                  <UserPlus className="h-3 w-3" /> Add from Contacts
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
                Continue to Review
              </Button>
            </div>
          </Card>
        )}

        {/* ═══ STEP 3: Review & Send ═══ */}
        {step === 'review' && (
          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Review & Send
              </h2>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Document:</span>{' '}
                  <span className="font-medium text-foreground">{title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>{' '}
                  <Badge variant="outline" className="text-xs">{categoryLabels[category] || category}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">File:</span>{' '}
                  <span className="text-foreground">{file?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Deadline:</span>{' '}
                  <span className="text-foreground">
                    {deadline ? format(new Date(deadline), 'dd MMM yyyy') : 'No deadline set'}
                  </span>
                </div>
              </div>

              {fileHash && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  SHA-256: {fileHash}
                </p>
              )}
            </Card>

            {/* Signatories list */}
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
                      // Initialise custom body with default text
                      const deadlineText = deadline ? `\nDeadline: ${format(new Date(deadline), 'dd MMMM yyyy')}` : '';
                      const descText = description ? `\n\n"${description}"` : '';
                      setCustomEmailBody(
                        `Dear [Signatory Name],\n\nYou have been asked to review and approve the following document:\n\n${title}\nCategory: ${categoryLabels[category] || category}${deadlineText}${descText}\n\nPlease click the link below to review the document and record your approval:`
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
                    Document Approval Requested: {title}
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
                    Document Approval Requested: {title}
                  </p>
                  <hr className="border-border" />
                  {customEmailBody ? (
                    <div className="whitespace-pre-wrap text-muted-foreground">{customEmailBody}</div>
                  ) : (
                    <>
                      <p className="text-muted-foreground">Dear <span className="italic">[Signatory Name]</span>,</p>
                      <p className="text-muted-foreground">
                        You have been asked to review and approve the following document:
                      </p>
                      <div className="pl-4 border-l-2 border-primary/30 space-y-1">
                        <p className="text-foreground font-medium">{title}</p>
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
              <Button variant="outline" onClick={() => setStep('signatories')} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSend} disabled={sending} className="flex-1 gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send for Approval
              </Button>
            </div>

            {/* ─── Collapsible Document Preview ─── */}
            {fileUrl && (
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
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
                        
                        // Use Supabase SDK to download file (bypasses browser extension blocking)
                        const storagePath = fileUrl!.split('/approval-documents/')[1];
                        let arrayBuffer: ArrayBuffer;
                        if (storagePath) {
                          const { data, error } = await supabase.storage.from('approval-documents').download(storagePath);
                          if (error || !data) throw error || new Error('Download failed');
                          arrayBuffer = await data.arrayBuffer();
                        } else {
                          const res = await fetch(fileUrl!);
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
                      <p className="text-xs text-muted-foreground text-centre">Showing first {previewPages.length} page(s)</p>
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
      </div>
    </div>
  );
}
