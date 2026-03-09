import { useState, useCallback, useRef } from 'react';
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
  GripVertical, FileText, Shield, CheckCircle2, Mail, Calendar, Hash, Stamp, FileSignature,
} from 'lucide-react';
import { useDocumentApproval, ApprovalContact } from '@/hooks/useDocumentApproval';
import { hashFile } from '@/utils/fileHash';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SignaturePositionPicker, StampPosition } from './SignaturePositionPicker';

interface SignatoryRow {
  id: string; // local key for drag
  name: string;
  email: string;
  role: string;
  organisation: string;
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
    contacts, contactGroups, saveContact, updateSignaturePlacement,
  } = useDocumentApproval();

  const [step, setStep] = useState<'upload' | 'stamp_position' | 'signatories' | 'review'>('upload');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

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
  const [documentId, setDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature placement
  const [signatureMethod, setSignatureMethod] = useState<'append' | 'stamp'>('append');
  const [stampPosition, setStampPosition] = useState<StampPosition>({ page: 1, x: 10, y: 55, width: 80, height: 40 });

  // ─── Step 2: Signatories ──────────────────────────────────────────
  const [signatories, setSignatories] = useState<SignatoryRow[]>([
    { id: localId(), name: '', email: '', role: '', organisation: '' },
  ]);
  const [saveNewContacts, setSaveNewContacts] = useState(true);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);

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
    try {
      const placement = signatureMethod === 'stamp'
        ? { method: 'stamp' as const, ...stampPosition }
        : { method: 'append' as const };

      const doc = await uploadDocument(file, {
        title, description, category,
        deadline: deadline || undefined,
        message: message || undefined,
        signaturePlacement: placement,
      });
      setDocumentId(doc.id);
      setFileUrl(doc.file_url);

      if (signatureMethod === 'stamp' && file.name.toLowerCase().endsWith('.pdf')) {
        setStep('stamp_position');
      } else {
        setStep('signatories');
      }
      toast.success('Document uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
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
    setSignatories(prev => [...prev, { id: localId(), name: '', email: '', role: '', organisation: '' }]);
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
        name: c.name,
        email: c.email,
        role: c.role || '',
        organisation: c.organisation || '',
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
        name: c.name,
        email: c.email,
        role: c.role || '',
        organisation: c.organisation || '',
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
          await saveContact({ name: s.name, email: s.email, role: s.role || undefined, organisation: s.organisation || undefined });
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
      await sendForApproval(documentId);
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
                        <Shield className="h-3 w-3" /> Word document — will be auto-converted to PDF for email attachment
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
                  !file?.name.toLowerCase().endsWith('.pdf') ? 'border-border opacity-50' : 'border-border hover:border-primary/50'
                }`}>
                  <RadioGroupItem value="stamp" id="sig-stamp" className="mt-0.5" disabled={!file?.name.toLowerCase().endsWith('.pdf')} />
                  <div>
                    <label htmlFor="sig-stamp" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                      <Stamp className="h-4 w-4 text-primary" /> Stamp signature block
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Places signatures onto a specific page in the document
                      {!file?.name.toLowerCase().endsWith('.pdf') && ' (PDF only)'}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={handleUploadAndContinue} disabled={uploading || !file || !title.trim()} className="w-full gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading & Hashing…' : 'Upload & Continue'}
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
            <div className="hidden md:grid grid-cols-[24px_1fr_1fr_1fr_1fr_32px] gap-2 px-3 text-xs font-medium text-muted-foreground">
              <span />
              <span>Name *</span>
              <span>Email *</span>
              <span>Role</span>
              <span>Organisation</span>
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
                  className={`grid grid-cols-1 md:grid-cols-[24px_1fr_1fr_1fr_1fr_32px] gap-2 p-3 bg-muted/50 rounded-lg items-center transition-opacity ${
                    dragIdx === idx ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab hidden md:block" />
                  <Input value={s.name} onChange={e => updateRow(s.id, 'name', e.target.value)} placeholder="Full name" className="text-sm" />
                  <Input type="email" value={s.email} onChange={e => updateRow(s.id, 'email', e.target.value)} placeholder="Email address" className="text-sm" />
                  <Input value={s.role} onChange={e => updateRow(s.id, 'role', e.target.value)} placeholder="Role" className="text-sm" />
                  <Input value={s.organisation} onChange={e => updateRow(s.id, 'organisation', e.target.value)} placeholder="Organisation" className="text-sm" />
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

            {/* Email preview */}
            <Card className="p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Email Preview
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border border-border">
                <p className="text-xs text-muted-foreground">Subject:</p>
                <p className="font-medium text-foreground">
                  Document Approval Required: {title}
                </p>
                <hr className="border-border" />
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
                <p className="text-primary underline text-xs">[Unique approval link]</p>
                <p className="text-xs text-muted-foreground mt-2">
                  This is an automated message from Notewell Document Approval Service.
                </p>
              </div>
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
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => {
                        setSelectedContactIds(prev => {
                          const next = new Set(prev);
                          checked ? next.delete(c.id) : next.add(c.id);
                          return next;
                        });
                      }}
                    >
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
