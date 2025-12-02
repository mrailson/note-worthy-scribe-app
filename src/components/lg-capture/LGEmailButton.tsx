import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Mail, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LGPatient } from '@/hooks/useLGCapture';
import { toast } from 'sonner';

interface LGEmailButtonProps {
  patient: LGPatient;
}

export function LGEmailButton({ patient }: LGEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('lg-send-email', {
        body: {
          patientId: patient.id,
          recipientEmail: email.trim(),
          recipientName: name.trim() || undefined,
        },
      });

      if (error) throw error;

      toast.success('Email sent successfully');
      setOpen(false);
    } catch (err) {
      console.error('Failed to send email:', err);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
  const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || patient.id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Mail className="mr-2 h-4 w-4" />
          Email Records
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Patient Records</DialogTitle>
          <DialogDescription>
            Send the Lloyd George PDF, clinical summary, and SNOMED codes to an email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium">{patientName}</p>
            <p className="text-muted-foreground font-mono text-xs">NHS: {nhsNumber}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="doctor@nhs.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Recipient Name (optional)</Label>
            <Input
              id="name"
              placeholder="Dr. Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Attachments:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Lloyd George PDF ({patient.images_count} pages)</li>
              <li>Clinical Summary (Word document)</li>
              <li>SNOMED Codes (CSV)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
