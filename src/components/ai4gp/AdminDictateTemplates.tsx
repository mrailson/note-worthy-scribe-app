import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  ClipboardList, 
  MessageSquareWarning, 
  Mail, 
  Users, 
  AlertTriangle, 
  BookOpen,
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
  'meeting-minutes': ClipboardList,
  'complaint-response': MessageSquareWarning,
  'staff-letter': Mail,
  'hr-record': Users,
  'significant-event': AlertTriangle,
  'policy-draft': BookOpen,
  'briefing-note': Megaphone,
};

export const AdminDictateTemplates: React.FC<AdminDictateTemplatesProps> = ({
  templates,
  selectedTemplate,
  onSelectTemplate,
}) => {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground font-medium">
        Select a template to get started
      </p>
      <ScrollArea className="h-[280px]">
        <div className="grid grid-cols-2 gap-3 pr-4">
          {templates.map((template) => {
            const Icon = TEMPLATE_ICONS[template.id];
            const isSelected = selectedTemplate === template.id;
            
            return (
              <Card
                key={template.id}
                className={cn(
                  "p-3 cursor-pointer transition-all hover:shadow-md",
                  isSelected 
                    ? "border-primary bg-primary/5 ring-1 ring-primary" 
                    : "hover:border-primary/50"
                )}
                onClick={() => onSelectTemplate(template.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-primary/10" : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "w-4 h-4",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "font-medium text-sm truncate",
                      isSelected && "text-primary"
                    )}>
                      {template.name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {template.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
