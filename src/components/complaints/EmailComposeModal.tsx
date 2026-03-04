import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Eye, Send, Code, RotateCcw } from "lucide-react";

export interface EmailComposeData {
  senderName: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  notes?: string | null;
  complaintReference: string;
  complaintTitle: string;
  complaintDescription: string;
  patientName: string;
  incidentDate: string;
  practiceName: string;
  acknowledgementText?: string | null;
  acknowledgementDate?: string | null;
}

interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EmailComposeData;
  onSend: (toggles: EmailToggles, senderName: string, customHtml?: string) => void;
  sending?: boolean;
}

export interface EmailToggles {
  includeDescription: boolean;
  includePatientName: boolean;
  includeAcknowledgement: boolean;
  includeDeadline: boolean;
}

function generateEmailHtml(data: EmailComposeData, toggles: EmailToggles, senderName: string): string {
  const patientRow = toggles.includePatientName ? `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Patient:</td>
        <td style="padding: 8px 0; color: #1f2937;">${data.patientName}</td>
      </tr>` : '';

  const descriptionSection = toggles.includeDescription ? `
  <div style="background-color: #fef9e7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0;">
    <h2 style="color: #92400e; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">📝 Complaint Description</h2>
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #fbbf24;">
      <p style="color: #374151; line-height: 1.6; margin: 0; white-space: pre-wrap;">${data.complaintDescription}</p>
    </div>
  </div>` : '';

  const acknowledgementSection = toggles.includeAcknowledgement && data.acknowledgementText ? `
  <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0;">
    <h2 style="color: #065f46; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">✅ Acknowledgement Sent to Patient</h2>
    ${data.acknowledgementDate ? `<p style="color: #374151; font-size: 14px; margin: 0 0 10px 0;"><strong>Sent:</strong> ${data.acknowledgementDate}</p>` : ''}
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #86efac; max-height: 300px; overflow-y: auto;">
      ${data.acknowledgementText}
    </div>
    <p style="color: #059669; font-size: 13px; margin: 10px 0 0 0; font-style: italic;">
      ℹ️ This acknowledgement letter has been sent to the patient. Your response should build upon this communication.
    </p>
  </div>` : '';

  const deadlineSection = toggles.includeDeadline ? `
  <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 25px 0;">
    <h3 style="color: #dc2626; font-size: 16px; margin: 0 0 10px 0; font-weight: bold;">⚠️ Important Information</h3>
    <ul style="color: #374151; line-height: 1.5; margin: 0; padding-left: 20px;">
      <li>Please review the complaint details carefully</li>
      <li><strong>Response deadline: within 5 working days</strong></li>
      <li>Your response will form part of the complaint investigation and outcome</li>
      <li>All information will be handled confidentially in line with NHS complaints guidance</li>
    </ul>
  </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #1f2937; margin: 0; font-size: 24px;">Complaint Input Request</h1>
    <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 16px;">${data.practiceName}</p>
  </div>

  <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Dear <strong>${data.staffName}</strong>,</p>
  
  <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-bottom: 15px;">
    You are requested to provide input as part of a formal complaint investigation and learning review being undertaken by ${data.practiceName}.
  </p>

  <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-bottom: 25px;">
    Your contribution will help us understand the events from different perspectives and support service improvement. This request is not a disciplinary process.
  </p>

  <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0;">
    <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0; font-weight: bold;">📋 Complaint Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 35%;">Reference:</td>
        <td style="padding: 8px 0; color: #1f2937; font-family: monospace; background-color: #fef3c7; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${data.complaintReference}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Title:</td>
        <td style="padding: 8px 0; color: #1f2937;">${data.complaintTitle}</td>
      </tr>
      ${patientRow}
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Incident Date:</td>
        <td style="padding: 8px 0; color: #1f2937;">${data.incidentDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Your Role:</td>
        <td style="padding: 8px 0; color: #1f2937; background-color: #dbeafe; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${data.staffRole}</td>
      </tr>
    </table>
  </div>

  ${descriptionSection}
  ${acknowledgementSection}

  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #374151; font-size: 15px; font-weight: bold; margin-bottom: 15px;">🔗 Provide Your Response</p>
    <p style="color: #374151; font-size: 14px; margin-bottom: 15px;">Please use the secure link below to submit your response:</p>
    <a href="#" 
       style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
      👉 Submit your response
    </a>
    <p style="color: #6b7280; font-size: 13px; margin-top: 15px;">
      (Link will be generated on send)
    </p>
  </div>

  ${deadlineSection}

  <p style="font-size: 14px; color: #374151; margin: 25px 0 5px 0;">
    If you have any concerns or require support in responding, please contact the Practice Manager.
  </p>

  <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 40px; text-align: center;">
    <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
      <strong>Kind regards,</strong><br>
      ${senderName}<br>
      Complaint Management System
    </p>
  </div>
</div>
</body>
</html>`;
}

export function EmailComposeModal({ open, onOpenChange, data, onSend, sending = false }: EmailComposeModalProps) {
  const [senderName, setSenderName] = useState(data.senderName);
  const [toggles, setToggles] = useState<EmailToggles>({
    includeDescription: false,
    includePatientName: false,
    includeAcknowledgement: false,
    includeDeadline: false,
  });
  const [editMode, setEditMode] = useState<'preview' | 'edit'>('preview');
  const [customHtml, setCustomHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSenderName(data.senderName);
    setToggles({
      includeDescription: false,
      includePatientName: false,
      includeAcknowledgement: false,
      includeDeadline: false,
    });
    setCustomHtml(null);
    setEditMode('preview');
  }, [open, data.senderName, data.acknowledgementText]);

  const generatedHtml = useMemo(
    () => generateEmailHtml(data, toggles, senderName),
    [data, toggles, senderName]
  );

  // When toggles or sender change, reset custom edits so user sees fresh output
  useEffect(() => {
    setCustomHtml(null);
  }, [toggles, senderName]);

  const previewHtml = customHtml ?? generatedHtml;
  const hasAcknowledgement = !!data.acknowledgementText;
  const isEdited = customHtml !== null;

  const handleResetToDefault = () => {
    setCustomHtml(null);
    setEditMode('preview');
  };

  const handleSwitchToEdit = () => {
    if (customHtml === null) {
      setCustomHtml(generatedHtml);
    }
    setEditMode('edit');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email to {data.staffName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 overflow-hidden px-6 py-4">
          {/* Left column — Controls */}
          <div className="space-y-5 overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="sender-name">Sender Name</Label>
              <Input
                id="sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground mb-3">Email Sections</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="toggle-description" className="cursor-pointer">Complaint Description</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Include the full complaint text</p>
                  </div>
                  <Switch
                    id="toggle-description"
                    checked={toggles.includeDescription}
                    onCheckedChange={(v) => setToggles({ ...toggles, includeDescription: v })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="toggle-patient" className="cursor-pointer">Patient Name</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Show the patient's name in details</p>
                  </div>
                  <Switch
                    id="toggle-patient"
                    checked={toggles.includePatientName}
                    onCheckedChange={(v) => setToggles({ ...toggles, includePatientName: v })}
                  />
                </div>

                <div className={`flex items-center justify-between rounded-lg border p-3 ${!hasAcknowledgement ? 'opacity-50' : ''}`}>
                  <div>
                    <Label htmlFor="toggle-ack" className="cursor-pointer">Acknowledgement Letter</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasAcknowledgement ? 'Include the acknowledgement sent to patient' : 'No acknowledgement letter available'}
                    </p>
                  </div>
                  <Switch
                    id="toggle-ack"
                    checked={toggles.includeAcknowledgement}
                    onCheckedChange={(v) => setToggles({ ...toggles, includeAcknowledgement: v })}
                    disabled={!hasAcknowledgement}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="toggle-deadline" className="cursor-pointer">Response Deadline</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Show deadline and important info</p>
                  </div>
                  <Switch
                    id="toggle-deadline"
                    checked={toggles.includeDeadline}
                    onCheckedChange={(v) => setToggles({ ...toggles, includeDeadline: v })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                <strong>To:</strong> {data.staffEmail}<br />
                <strong>Role:</strong> {data.staffRole}<br />
                <strong>Ref:</strong> {data.complaintReference}
              </p>
            </div>
          </div>

          {/* Right column — Live preview / Edit */}
          <div className="flex flex-col overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                {editMode === 'preview' ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Code className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {editMode === 'preview' ? 'Email Preview' : 'Edit HTML'}
                </span>
                {isEdited && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">Edited</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isEdited && (
                  <Button variant="ghost" size="sm" onClick={handleResetToDefault} className="h-7 text-xs gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                )}
                {editMode === 'preview' ? (
                  <Button variant="ghost" size="sm" onClick={handleSwitchToEdit} className="h-7 text-xs gap-1">
                    <Code className="h-3 w-3" />
                    Edit HTML
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditMode('preview')} className="h-7 text-xs gap-1">
                    <Eye className="h-3 w-3" />
                    Preview
                  </Button>
                )}
              </div>
            </div>

            {editMode === 'preview' ? (
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                sandbox=""
                className="flex-1 w-full bg-white"
                style={{ minHeight: 400 }}
              />
            ) : (
              <Textarea
                value={customHtml ?? generatedHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                className="flex-1 w-full font-mono text-xs border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ minHeight: 400 }}
              />
            )}
          </div>
        </div>

        <DialogFooter className="px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => onSend(toggles, senderName, customHtml ?? undefined)} disabled={sending} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
