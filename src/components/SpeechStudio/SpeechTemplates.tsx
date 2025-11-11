import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  FileText, 
  Trash2, 
  Edit, 
  Copy,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: string;
  template_name: string;
  template_content: string;
  is_system_template: boolean;
  created_at: string;
}

interface SpeechTemplatesProps {
  onTemplateSelect: (content: string) => void;
}

export const SpeechTemplates = ({ onTemplateSelect }: SpeechTemplatesProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['speech-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai4pm_speech_templates' as any)
        .select('*')
        .order('is_system_template', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Template[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ai4pm_speech_templates' as any)
        .insert({
          template_name: newTemplateName,
          template_content: newTemplateContent,
          is_system_template: false
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speech-templates'] });
      setIsCreateOpen(false);
      setNewTemplateName('');
      setNewTemplateContent('');
      toast({
        title: 'Template created',
        description: 'Your template has been saved successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create template',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai4pm_speech_templates' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speech-templates'] });
      toast({
        title: 'Template deleted',
        description: 'Template has been removed'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleUseTemplate = (content: string) => {
    onTemplateSelect(content);
    toast({
      title: 'Template loaded',
      description: 'Edit the text and generate speech'
    });
  };

  const systemTemplates = templates.filter(t => t.is_system_template);
  const userTemplates = templates.filter(t => !t.is_system_template);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Templates</CardTitle>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Appointment Confirmation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-content">Template Content</Label>
                  <Textarea
                    id="template-content"
                    value={newTemplateContent}
                    onChange={(e) => setNewTemplateContent(e.target.value)}
                    placeholder="Enter your template text here..."
                    className="min-h-[200px]"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !newTemplateName || !newTemplateContent}
                  className="w-full"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Template'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-6">
            {/* System Templates */}
            {systemTemplates.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">NHS Templates</h3>
                </div>
                <div className="space-y-2">
                  {systemTemplates.map((template) => (
                    <Card key={template.id} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">{template.template_name}</div>
                            <Badge variant="secondary" className="text-xs mt-1">System</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {template.template_content}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(template.template_content)}
                          className="w-full"
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Use Template
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* User Templates */}
            {userTemplates.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <h3 className="font-medium text-sm">My Templates</h3>
                </div>
                <div className="space-y-2">
                  {userTemplates.map((template) => (
                    <Card key={template.id} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="font-medium text-sm">{template.template_name}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => deleteMutation.mutate(template.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {template.template_content}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(template.template_content)}
                          className="w-full"
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Use Template
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {templates.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No templates yet</p>
                <p className="text-xs mt-2">Create your first template to get started</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
