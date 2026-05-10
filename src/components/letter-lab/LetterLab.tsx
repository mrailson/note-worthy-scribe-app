import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlaskConical } from 'lucide-react';

interface LetterLabProps {
  complaintId: string;
}

/**
 * Letter Lab — experimental, parallel acknowledgement & outcome letter generator.
 * Runs alongside the live tools so we can compare output and iterate safely.
 *
 * TODO: Wire up draft list, editor, tone/length controls, version history,
 * AI generation pipeline, readability + compliance scoring, and export.
 */
export const LetterLab: React.FC<LetterLabProps> = ({ complaintId }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-purple-600" />
              Letter Lab (Experimental)
            </CardTitle>
            <CardDescription className="mt-1">
              New acknowledgement and outcome letter generator — under development.
              Run alongside the live tools to test.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-purple-300 text-purple-700">
            Beta
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* TODO: Letter Lab UI — drafts, editor, AI controls, versions. */}
        <div className="rounded-md border border-dashed border-muted-foreground/30 p-8 text-center text-sm text-muted-foreground">
          Letter Lab will appear here. Complaint ID:{' '}
          <code className="text-xs">{complaintId}</code>
        </div>
      </CardContent>
    </Card>
  );
};

export default LetterLab;
