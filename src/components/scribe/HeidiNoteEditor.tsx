import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HeidiNote, HeidiEditStates } from "@/types/scribe";
import { Copy, Pencil, Check, X, ClipboardList, Stethoscope, Brain, ListChecks } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeidiNoteEditorProps {
  heidiNote: HeidiNote;
  editStates: HeidiEditStates;
  editContent: Record<keyof HeidiNote, string>;
  onCopySection: (section: keyof HeidiNote) => void;
  onStartEdit: (section: keyof HeidiNote) => void;
  onCancelEdit: (section: keyof HeidiNote) => void;
  onSaveEdit: (section: keyof HeidiNote) => void;
  onEditContentChange: (section: keyof HeidiNote, content: string) => void;
}

interface SectionConfig {
  key: keyof HeidiNote;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const sections: SectionConfig[] = [
  { 
    key: 'consultationHeader', 
    title: 'Consultation', 
    subtitle: 'Type & Reason',
    icon: ClipboardList,
    color: 'border-l-slate-500',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400'
  },
  { 
    key: 'history', 
    title: 'History', 
    subtitle: 'HPC, ICE, PMH, DH, SH',
    icon: ClipboardList,
    color: 'border-l-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  },
  { 
    key: 'examination', 
    title: 'Examination', 
    subtitle: 'Vitals, O/E, Investigations',
    icon: Stethoscope,
    color: 'border-l-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  },
  { 
    key: 'impression', 
    title: 'Impression', 
    subtitle: 'Assessment & Differentials',
    icon: Brain,
    color: 'border-l-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  },
  { 
    key: 'plan', 
    title: 'Plan', 
    subtitle: 'Ix, Rx, Referrals, F/U, Safety Netting',
    icon: ListChecks,
    color: 'border-l-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
  }
];

export const HeidiNoteEditor = ({
  heidiNote,
  editStates,
  editContent,
  onCopySection,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange
}: HeidiNoteEditorProps) => {
  const isMobile = useIsMobile();

  const hasContent = (content: string | undefined) => {
    return content && content.trim().length > 0;
  };

  return (
    <div className="space-y-4">
      {sections.map(({ key, title, subtitle, icon: Icon, color, bgColor }) => {
        const content = heidiNote[key];
        const isEmpty = !hasContent(content);
        
        return (
          <Card 
            key={key} 
            className={`border-l-4 ${color} ${isEmpty ? 'opacity-60' : ''}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${bgColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span>{title}</span>
                      <span className="text-sm text-muted-foreground font-normal">
                        ({subtitle})
                      </span>
                    </CardTitle>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {editStates[key] ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelEdit(key)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSaveEdit(key)}
                        className="h-8 w-8 p-0 text-green-600"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onStartEdit(key)}
                        className="h-8 w-8 p-0"
                        title="Edit section"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!isEmpty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCopySection(key)}
                          className="h-8 w-8 p-0"
                          title="Copy section"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {editStates[key] ? (
                <Textarea
                  value={editContent[key]}
                  onChange={(e) => onEditContentChange(key, e.target.value)}
                  className="min-h-[120px] resize-y font-mono text-sm"
                  placeholder={`Enter ${title.toLowerCase()}...`}
                />
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {isEmpty ? (
                    <p className="text-muted-foreground/50 italic text-sm">
                      {/* Empty - no content (anti-hallucination: blank rather than "not documented") */}
                    </p>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 m-0">
                      {content}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
