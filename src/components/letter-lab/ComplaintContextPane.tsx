import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, FileText, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ComplaintRow {
  id: string;
  reference_number?: string | null;
  patient_name?: string | null;
  complaint_on_behalf?: boolean | null;
  complaint_description?: string | null;
  complaint_title?: string | null;
  status?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
}

interface Props {
  complaint: ComplaintRow;
}

const STATUS_COLOURS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
  closed: 'bg-slate-100 text-slate-700 border-slate-300',
};

export const ComplaintContextPane: React.FC<Props> = ({ complaint }) => {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const description = complaint.complaint_description ?? '';
  const tooLong = description.length > 500;
  const summary = expanded || !tooLong ? description : description.slice(0, 500) + '…';

  const dateReceived = complaint.submitted_at || complaint.created_at;

  // Derive bullet "issues raised" from sentence splits as a lightweight extract.
  const issues = description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 5);

  const handleReveal = async () => {
    const next = !revealed;
    setRevealed(next);
    if (next) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('complaint_audit_log').insert({
          complaint_id: complaint.id,
          action: 'patient_pii_revealed',
          details: { surface: 'letter_lab_context_pane' },
          performed_by: user?.id ?? null,
        });
      } catch (err) {
        console.warn('[ComplaintContextPane] audit log failed:', err);
      }
    }
  };

  const statusKey = (complaint.status ?? '').toLowerCase();
  const statusClass = STATUS_COLOURS[statusKey] ?? 'bg-muted text-foreground border-border';

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Complaint Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Reference</div>
            <div className="font-medium">{complaint.reference_number ?? '—'}</div>
          </div>
          <Badge variant="outline" className={statusClass}>
            {complaint.status ?? 'unknown'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span className="text-xs">
            Received{' '}
            {dateReceived ? format(new Date(dateReceived), 'dd/MM/yyyy') : '—'}
          </span>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Complainant</div>
          <div className="font-medium">
            {complaint.complaint_on_behalf
              ? 'On behalf of patient'
              : complaint.patient_name ?? '—'}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-muted-foreground">Patient details</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleReveal}
            >
              {revealed ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" /> Hide
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" /> Reveal
                </>
              )}
            </Button>
          </div>
          <div className="font-medium flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {revealed ? complaint.patient_name ?? '—' : '••••••••'}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Summary</div>
          <p className="text-sm leading-relaxed">{summary || '—'}</p>
          {tooLong && (
            <Button
              variant="link"
              size="sm"
              className="px-0 h-6 text-xs"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? 'Show less' : 'Read more'}
            </Button>
          )}
        </div>

        {issues.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Issues raised</div>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComplaintContextPane;
