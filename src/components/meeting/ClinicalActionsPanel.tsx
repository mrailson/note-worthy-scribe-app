import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pill, Microscope, Calendar, ClipboardList } from 'lucide-react';

export interface ClinicalAction {
  medications?: string[];
  investigations?: string[];
  followUp?: string[];
  other?: string[];
}

interface ClinicalActionsPanelProps {
  actions: ClinicalAction;
}

export const ClinicalActionsPanel: React.FC<ClinicalActionsPanelProps> = ({ actions }) => {
  const hasActions = 
    (actions.medications?.length || 0) > 0 ||
    (actions.investigations?.length || 0) > 0 ||
    (actions.followUp?.length || 0) > 0 ||
    (actions.other?.length || 0) > 0;

  if (!hasActions) return null;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Clinical Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {actions.medications && actions.medications.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-semibold">Prescriptions</h4>
            </div>
            <ul className="space-y-1 ml-6">
              {actions.medications.map((med, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{med}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions.investigations && actions.investigations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Microscope className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-semibold">Investigations Ordered</h4>
            </div>
            <div className="flex flex-wrap gap-2 ml-6">
              {actions.investigations.map((inv, idx) => (
                <Badge key={idx} variant="secondary">{inv}</Badge>
              ))}
            </div>
          </div>
        )}

        {actions.followUp && actions.followUp.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <h4 className="text-sm font-semibold">Follow-up</h4>
            </div>
            <ul className="space-y-1 ml-6">
              {actions.followUp.map((fu, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{fu}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actions.other && actions.other.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold ml-6">Other Actions</h4>
            <ul className="space-y-1 ml-6">
              {actions.other.map((action, idx) => (
                <li key={idx} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
