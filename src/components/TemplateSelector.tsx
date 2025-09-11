import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Palette, FileText, Presentation, Users, Moon } from 'lucide-react';
import { PRESENTATION_TEMPLATES, PresentationTemplate } from '@/utils/presentationTemplates';

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
  showPreview?: boolean;
}

const getTemplateIcon = (style: PresentationTemplate['style']) => {
  switch (style) {
    case 'professional': return <FileText className="w-4 h-4" />;
    case 'modern': return <Palette className="w-4 h-4" />;
    case 'clean': return <Presentation className="w-4 h-4" />;
    case 'bright': return <Users className="w-4 h-4" />;
    case 'dark': return <Moon className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

const getStyleColor = (style: PresentationTemplate['style']) => {
  switch (style) {
    case 'professional': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'modern': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'clean': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'bright': return 'bg-green-100 text-green-800 border-green-200';
    case 'dark': return 'bg-slate-100 text-slate-800 border-slate-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
  showPreview = true
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Choose Presentation Template</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESENTATION_TEMPLATES.map((template) => (
          <Card 
            key={template.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedTemplate === template.id 
                ? 'ring-2 ring-primary ring-offset-2 shadow-md' 
                : 'hover:ring-1 hover:ring-muted-foreground/30'
            }`}
            onClick={() => onTemplateSelect(template.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTemplateIcon(template.style)}
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                {selectedTemplate === template.id && (
                  <Check className="w-4 h-4 text-primary bg-primary/10 rounded-full p-0.5" />
                )}
              </div>
              <CardDescription className="text-xs">
                {template.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Template Preview */}
              {showPreview && (
                <div 
                  className="h-20 rounded-md border p-2 relative overflow-hidden"
                  style={{
                    background: template.gradients.secondary,
                    borderColor: template.primaryColor + '20'
                  }}
                >
                  <div 
                    className="text-xs font-semibold mb-1"
                    style={{ color: template.headingColor }}
                  >
                    Slide Title
                  </div>
                  <div className="space-y-1">
                    <div 
                      className="h-1 rounded"
                      style={{ 
                        backgroundColor: template.primaryColor, 
                        width: '80%',
                        opacity: 0.7
                      }}
                    />
                    <div 
                      className="h-1 rounded"
                      style={{ 
                        backgroundColor: template.accentColor, 
                        width: '60%',
                        opacity: 0.5
                      }}
                    />
                    <div 
                      className="h-1 rounded"
                      style={{ 
                        backgroundColor: template.secondaryColor, 
                        width: '70%',
                        opacity: 0.3
                      }}
                    />
                  </div>
                  
                  {/* Corner gradient accent */}
                  <div 
                    className="absolute top-0 right-0 w-8 h-8 opacity-20"
                    style={{ background: template.gradients.primary }}
                  />
                </div>
              )}
              
              {/* Color Palette */}
              <div className="flex items-center gap-1">
                <div className="flex gap-1">
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: template.primaryColor }}
                    title="Primary Color"
                  />
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: template.accentColor }}
                    title="Accent Color"
                  />
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: template.secondaryColor }}
                    title="Secondary Color"
                  />
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-xs ml-auto ${getStyleColor(template.style)}`}
                >
                  {template.style}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {selectedTemplate && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              {getTemplateIcon(PRESENTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.style || 'professional')}
            </div>
            <div>
              <h4 className="font-medium">
                {PRESENTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {PRESENTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.preview}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};