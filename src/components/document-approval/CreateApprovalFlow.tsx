import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, Plus, Trash2, Loader2, Send, UserPlus } from 'lucide-react';
import { useDocumentApproval } from '@/hooks/useDocumentApproval';
import { toast } from 'sonner';

interface Signatory {
  name: string;
  email: string;
  role: string;
  organisation: string;
}

interface CreateApprovalFlowProps {
  onBack: () => void;
}

export function CreateApprovalFlow({ onBack }: CreateApprovalFlowProps) {
  const { uploadDocument, addSignatories, sendForApproval, contacts, saveContact } = useDocumentApproval();
  const [step, setStep] = useState<'upload' | 'signatories' | 'review'>('upload');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // Upload step state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [deadline, setDeadline] = useState('');
  const [message, setMessage] = useState('');

  // Created document
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Signatories
  const [signatories, setSignatories] = useState<Signatory[]>([{ name: '', email: '', role: '', organisation: '' }]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Please select a file and enter a title');
      return;
    }
    setUploading(true);
    try {
      const doc = await uploadDocument(file, { title, description, category, deadline: deadline || undefined, message: message || undefined });
      setDocumentId(doc.id);
      setStep('signatories');
      toast.success('Document uploaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const addSignatory = () => {
    setSignatories(prev => [...prev, { name: '', email: '', role: '', organisation: '' }]);
  };

  const removeSignatory = (index: number) => {
    setSignatories(prev => prev.filter((_, i) => i !== index));
  };

  const updateSignatory = (index: number, field: keyof Signatory, value: string) => {
    setSignatories(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addFromContact = (contact: { name: string; email: string; role?: string | null; organisation?: string | null }) => {
    setSignatories(prev => [
      ...prev.filter(s => s.email || s.name),
      { name: contact.name, email: contact.email, role: contact.role || '', organisation: contact.organisation || '' },
    ]);
  };

  const handleAddSignatories = async () => {
    const valid = signatories.filter(s => s.name.trim() && s.email.trim());
    if (valid.length === 0) {
      toast.error('Please add at least one signatory');
      return;
    }
    if (!documentId) return;

    setSending(true);
    try {
      await addSignatories(documentId, valid);
      // Save contacts for re-use
      for (const s of valid) {
        await saveContact({ name: s.name, email: s.email, role: s.role || undefined, organisation: s.organisation || undefined });
      }
      setStep('review');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add signatories');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!documentId) return;
    setSending(true);
    try {
      await sendForApproval(documentId);
      onBack();
    } catch (err) {
      console.error(err);
      toast.error('Failed to send for approval');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">New Document Approval</h1>
            <p className="text-sm text-muted-foreground">
              {step === 'upload' ? 'Step 1: Upload document' : step === 'signatories' ? 'Step 2: Add signatories' : 'Step 3: Review & send'}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          {['upload', 'signatories', 'review'].map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${
              ['upload', 'signatories', 'review'].indexOf(step) >= i ? 'bg-primary' : 'bg-muted'
            }`} />
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Card className="p-6 space-y-4">
            <div>
              <Label>Document File *</Label>
              <div className="mt-1.5 border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById('approval-file-input')?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                {file ? (
                  <p className="text-sm font-medium text-foreground">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to select a document</p>
                )}
              </div>
              <input id="approval-file-input" type="file" className="hidden" accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt" onChange={handleFileChange} />
            </div>

            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Data Sharing Agreement v2.1" className="mt-1.5" />
            </div>

            <div>
              <Label>Category</Label>
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

            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the document..." className="mt-1.5" rows={3} />
            </div>

            <div>
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1.5" />
            </div>

            <div>
              <Label>Message to signatories</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Optional note to include in the approval request..." className="mt-1.5" rows={2} />
            </div>

            <Button onClick={handleUpload} disabled={uploading || !file || !title.trim()} className="w-full gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading & Hashing...' : 'Upload Document'}
            </Button>
          </Card>
        )}

        {/* Step 2: Signatories */}
        {step === 'signatories' && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Signatories</h2>
              <Button variant="outline" size="sm" onClick={addSignatory} className="gap-1">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            {contacts.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quick add from saved contacts</Label>
                <div className="flex flex-wrap gap-1">
                  {contacts.slice(0, 10).map(c => (
                    <Button key={c.id} variant="outline" size="sm" className="text-xs gap-1" onClick={() => addFromContact(c)}>
                      <UserPlus className="h-3 w-3" /> {c.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {signatories.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg relative">
                {signatories.length > 1 && (
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeSignatory(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input value={s.name} onChange={e => updateSignatory(i, 'name', e.target.value)} placeholder="Full name" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={s.email} onChange={e => updateSignatory(i, 'email', e.target.value)} placeholder="Email address" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Input value={s.role} onChange={e => updateSignatory(i, 'role', e.target.value)} placeholder="e.g. Caldicott Guardian" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Organisation</Label>
                  <Input value={s.organisation} onChange={e => updateSignatory(i, 'organisation', e.target.value)} placeholder="e.g. NHS Trust" className="mt-1" />
                </div>
              </div>
            ))}

            <Button onClick={handleAddSignatories} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue to Review
            </Button>
          </Card>
        )}

        {/* Step 3: Review & Send */}
        {step === 'review' && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Review & Send</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-foreground">Document:</span> <span className="text-muted-foreground">{title}</span></p>
              <p><span className="font-medium text-foreground">Category:</span> <span className="text-muted-foreground">{category.toUpperCase()}</span></p>
              <p><span className="font-medium text-foreground">File:</span> <span className="text-muted-foreground">{file?.name}</span></p>
              {deadline && <p><span className="font-medium text-foreground">Deadline:</span> <span className="text-muted-foreground">{deadline}</span></p>}
              <p><span className="font-medium text-foreground">Signatories:</span> <span className="text-muted-foreground">{signatories.filter(s => s.email).length} people</span></p>
            </div>

            <div className="space-y-2">
              {signatories.filter(s => s.email).map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <span className="text-muted-foreground">({s.email})</span>
                  {s.role && <span className="text-xs text-muted-foreground">· {s.role}</span>}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Each signatory will receive a unique approval link. The document's SHA-256 hash is recorded to verify integrity.
            </p>

            <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send for Approval
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
