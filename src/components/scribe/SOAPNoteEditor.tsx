import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SOAPNote, ScribeEditStates } from "@/types/scribe";
import { Copy, Pencil, Check, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface SOAPNoteEditorProps {
  soapNote: SOAPNote;
  editStates: ScribeEditStates;
  editContent: Record<keyof SOAPNote, string>;
  onCopySection: (section: keyof SOAPNote) => void;
  onStartEdit: (section: keyof SOAPNote) => void;
  onCancelEdit: (section: keyof SOAPNote) => void;
  onSaveEdit: (section: keyof SOAPNote) => void;
  onEditContentChange: (section: keyof SOAPNote, content: string) => void;
}

interface SectionConfig {
  key: keyof SOAPNote;
  title: string;
  subtitle: string;
  color: string;
}

const sections: SectionConfig[] = [
  { 
    key: 'S', 
    title: 'Subjective', 
    subtitle: 'History',
    color: 'border-l-blue-500'
  },
  { 
    key: 'O', 
    title: 'Objective', 
    subtitle: 'Examination',
    color: 'border-l-green-500'
  },
  { 
    key: 'A', 
    title: 'Assessment', 
    subtitle: 'Diagnosis',
    color: 'border-l-amber-500'
  },
  { 
    key: 'P', 
    title: 'Plan', 
    subtitle: 'Management',
    color: 'border-l-purple-500'
  }
];

export const SOAPNoteEditor = ({
  soapNote,
  editStates,
  editContent,
  onCopySection,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange
}: SOAPNoteEditorProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      {sections.map(({ key, title, subtitle, color }) => (
        <Card key={key} className={`border-l-4 ${color}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="font-bold text-primary">{key}</span>
                  <span className="text-muted-foreground font-normal">–</span>
                  <span>{title}</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    ({subtitle})
                  </span>
                </CardTitle>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopySection(key)}
                      className="h-8 w-8 p-0"
                      title="Copy section"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
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
                className="min-h-[120px] resize-y"
                placeholder={`Enter ${title.toLowerCase()}...`}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {soapNote[key] ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {soapNote[key]}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic text-sm">
                    No content for this section
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
