import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, AlertTriangle, AlertOctagon, Loader2, Upload, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { UseLetterheadStatusResult } from '@/hooks/useLetterheadStatus';

interface Props {
  letterhead: UseLetterheadStatusResult;
  bodyHtml: string;
  recipientName: string | null;
  recipientAddress: string | null;
  reference: string | null;
  letterDate: Date;
  letterType: 'acknowledgement' | 'outcome';
}

export const LetterPreviewPane: React.FC<Props> = ({
  letterhead,
  bodyHtml,
  recipientName,
  recipientAddress,
  reference,
  letterDate,
  letterType,
}) => {
  const [printMode, setPrintMode] = useState(false);
  const lh = letterhead.letterhead;

  let pill: React.ReactNode;
  if (letterhead.status === 'loading') {
    pill = (
      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Checking letterhead…
      </Badge>
    );
  } else if (letterhead.status === 'active') {
    pill = (
      <Badge className="bg-green-100 text-green-800 border border-green-300 hover:bg-green-100">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Letterhead Active ✓
      </Badge>
    );
  } else if (letterhead.status === 'missing') {
    pill = (
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
          <AlertTriangle className="h-3 w-3 mr-1" /> Letterhead Missing ⚠ — using Notewell default
        </Badge>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to="/complaints/letterhead-settings">
            <Upload className="h-3 w-3 mr-1" /> Upload Letterhead
          </Link>
        </Button>
      </div>
    );
  } else {
    pill = (
      <div className="flex items-center gap-2">
        <Badge className="bg-red-100 text-red-800 border border-red-300 hover:bg-red-100">
          <AlertOctagon className="h-3 w-3 mr-1" /> Letterhead Error
        </Badge>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => letterhead.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 space-y-3 no-print">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Live Preview</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">A4</span>
            <Switch checked={printMode} onCheckedChange={setPrintMode} />
          </div>
        </div>
        {pill}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto bg-muted/30 p-4">
        <div
          className={cn(
            'letter-print-area mx-auto bg-white text-black shadow-md border border-border',
            printMode ? 'w-[210mm] min-h-[297mm] p-[20mm]' : 'w-full max-w-[640px] p-6',
          )}
          style={printMode ? { aspectRatio: '210 / 297' } : undefined}
        >
          {/* Letterhead */}
          {lh && lh.signed_url ? (
            <div
              className="mb-4"
              style={{
                textAlign: lh.alignment,
                marginTop: `${lh.top_margin_cm}cm`,
              }}
            >
              <img
                src={lh.signed_url}
                alt="Practice letterhead"
                style={{
                  height: `${lh.height_cm}cm`,
                  display: lh.alignment === 'center' ? 'inline-block' : 'block',
                  marginLeft: lh.alignment === 'right' ? 'auto' : undefined,
                  marginRight: lh.alignment === 'left' ? 'auto' : undefined,
                }}
              />
            </div>
          ) : (
            <div className="mb-4 border-b border-dashed border-muted-foreground/30 pb-3 text-center text-xs text-muted-foreground">
              [ Notewell default header ]
            </div>
          )}

          {/* Recipient block */}
          <div className="text-sm mb-4">
            {recipientName && <div>{recipientName}</div>}
            {recipientAddress &&
              recipientAddress.split(/\n|,/).map((line, i) => (
                <div key={i}>{line.trim()}</div>
              ))}
          </div>

          {/* Date + reference */}
          <div className="text-sm mb-4 flex flex-col gap-0.5">
            <div>{format(letterDate, 'd MMMM yyyy')}</div>
            {reference && <div>Our ref: {reference}</div>}
          </div>

          {/* Body */}
          <div
            className="text-sm leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html:
                bodyHtml ||
                `<p style="color:#888"><em>Start typing in the editor — your ${letterType} letter will appear here.</em></p>`,
            }}
          />

          {/* Signature block */}
          <div className="text-sm mt-8">
            <p>Yours sincerely,</p>
            <div className="h-12" />
            <p>[Signatory name]</p>
            <p className="text-xs text-muted-foreground">[Role]</p>
          </div>

          {/* Footer */}
          <div className="text-[10px] text-muted-foreground mt-6 pt-3 border-t text-center">
            This letter was generated using Notewell Letter Lab (experimental).
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LetterPreviewPane;
