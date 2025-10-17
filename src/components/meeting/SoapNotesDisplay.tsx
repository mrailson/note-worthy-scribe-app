import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface SoapNote {
  S: string; // Subjective
  O: string; // Objective
  A: string; // Assessment
  P: string; // Plan
}

interface SoapNotesDisplayProps {
  soapNotes: SoapNote | null;
  consultationType?: string;
  onCopySection?: (section: keyof SoapNote) => void;
  onCopyAll?: () => void;
  onExport?: () => void;
}

const soapSections = [
  {
    key: 'S' as const,
    title: 'S – Subjective',
    icon: '💬',
    description: 'Patient\'s perspective and symptoms',
    color: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
  },
  {
    key: 'O' as const,
    title: 'O – Objective',
    icon: '🩺',
    description: 'Clinical findings and observations',
    color: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
  },
  {
    key: 'A' as const,
    title: 'A – Assessment',
    icon: '🔎',
    description: 'Clinical impression and diagnosis',
    color: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
  },
  {
    key: 'P' as const,
    title: 'P – Plan',
    icon: '✅',
    description: 'Treatment and follow-up',
    color: 'border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
  }
];

export const SoapNotesDisplay: React.FC<SoapNotesDisplayProps> = ({
  soapNotes,
  consultationType,
  onCopySection,
  onCopyAll,
  onExport
}) => {
  const handleCopySection = (section: keyof SoapNote) => {
    if (!soapNotes) return;
    
    const text = `${section}: ${soapNotes[section]}`;
    navigator.clipboard.writeText(text);
    toast.success(`${section} section copied to clipboard`);
    
    if (onCopySection) {
      onCopySection(section);
    }
  };

  const handleCopyAll = () => {
    if (!soapNotes) return;
    
    const fullSoap = `S: ${soapNotes.S}\n\nO: ${soapNotes.O}\n\nA: ${soapNotes.A}\n\nP: ${soapNotes.P}`;
    navigator.clipboard.writeText(fullSoap);
    toast.success('Complete SOAP notes copied to clipboard');
    
    if (onCopyAll) {
      onCopyAll();
    }
  };

  if (!soapNotes) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Patient Consultation Notes</h3>
          {consultationType && (
            <p className="text-sm text-muted-foreground">
              Consultation Type: {consultationType}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy All
          </Button>
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* SOAP Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {soapSections.map(section => (
          <Card key={section.key} className={`border-l-4 ${section.color}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{section.icon}</span>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {section.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopySection(section.key)}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {soapNotes[section.key] || 'No information recorded'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>SOAP format consultation notes generated from meeting transcript</span>
      </div>
    </div>
  );
};
