import React from 'react';
import { Card } from '@/components/ui/card';
import { 
  FileText, 
  MessageSquareWarning, 
  Users, 
  Megaphone 
} from 'lucide-react';
import { AdminDictationTemplate, AdminTemplateType } from '@/hooks/useAdminDictation';
import { cn } from '@/lib/utils';

interface AdminDictateTemplatesProps {
  templates: AdminDictationTemplate[];
  selectedTemplate: AdminTemplateType;
  onSelectTemplate: (template: AdminTemplateType) => void;
}

const TEMPLATE_ICONS: Record<AdminTemplateType, React.ElementType> = {
  'free': FileText,
  'complaint-response': MessageSquareWarning,
  'hr-record': Users,
  'briefing-note': Megaphone,
};

export const AdminDictateTemplates: React.FC<AdminDictateTemplatesProps> = ({
  templates,
  selectedTemplate,
  onSelectTemplate,
}) => {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground font-medium">
        Select a template to get started
      </p>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => {
          const Icon = TEMPLATE_ICONS[template.id];
          const isSelected = selectedTemplate === template.id;
          
          return (
            <Card
              key={template.id}
              className={cn(
                "p-2 cursor-pointer transition-all hover:shadow-md",
                isSelected 
                  ? "border-primary bg-primary/5 ring-1 ring-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => onSelectTemplate(template.id)}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-md",
                  isSelected ? "bg-primary/10" : "bg-muted"
                )}>
                  <Icon className={cn(
                    "w-3.5 h-3.5",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <h4 className={cn(
                  "font-medium text-sm truncate",
                  isSelected && "text-primary"
                )}>
                  {template.name}
                </h4>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
