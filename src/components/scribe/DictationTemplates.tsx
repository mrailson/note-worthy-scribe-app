import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileText, Stethoscope, Mail, ClipboardList, FileCheck } from 'lucide-react';
import type { DictationTemplate, TemplateType } from '@/hooks/useDictation';

interface DictationTemplatesProps {
  templates: DictationTemplate[];
  selectedTemplate: TemplateType;
  onSelectTemplate: (template: TemplateType) => void;
}

const TEMPLATE_ICONS: Record<TemplateType, React.ElementType> = {
  'free': FileText,
  'consultation': Stethoscope,
  'referral': Mail,
  'patient-letter': Mail,
  'clinical-note': ClipboardList,
  'sick-note': FileCheck,
};

export function DictationTemplates({
  templates,
  selectedTemplate,
  onSelectTemplate,
}: DictationTemplatesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Choose a template</h3>
        <Badge variant="outline" className="text-xs">Optional</Badge>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {templates.map((template) => {
          const Icon = TEMPLATE_ICONS[template.id];
          const isSelected = selectedTemplate === template.id;
          
          return (
            <Card
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className={cn(
                'p-3 cursor-pointer transition-all hover:border-primary/50',
                'flex flex-col gap-1.5',
                isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/20'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn(
                  'h-4 w-4',
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'text-sm font-medium',
                  isSelected && 'text-primary'
                )}>
                  {template.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {template.description}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
