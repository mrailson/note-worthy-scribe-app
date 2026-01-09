import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { stripMarkdown } from '@/utils/stripMarkdown';
import { useAuth } from '@/contexts/AuthContext';

interface UserTemplatePreference {
  themeId: string;
  themeName: string;
  source: 'gamma' | 'local';
}

export const useGammaPowerPoint = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [templatePreference, setTemplatePreference] = useState<UserTemplatePreference | null>(null);

  // Fetch user's template preference on mount
  useEffect(() => {
    const fetchPreference = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('user_id', user.id)
          .eq('setting_key', 'presentation_template')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching template preference:', error);
          return;
        }

        if (data?.setting_value) {
          setTemplatePreference(data.setting_value as unknown as UserTemplatePreference);
        }
      } catch (error) {
        console.error('Error fetching template preference:', error);
      }
    };

    fetchPreference();
  }, [user]);

  const downloadBase64AsPptx = (base64: string, title: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const prepareContentForGamma = (content: string, title?: string): { topic: string; supportingContent: string } => {
    // Extract topic from first heading or use provided title
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
    const topic = title || titleMatch?.[1]?.slice(0, 100) || 'AI Generated Presentation';
    
    // Clean markdown for supporting content
    const supportingContent = stripMarkdown(content);
    
    return { topic, supportingContent };
  };

  const generateWithGamma = async (content: string, title?: string) => {
    if (!content?.trim()) {
      toast.error('No content to generate presentation from');
      return;
    }

    setIsGenerating(true);

    try {
      const { topic, supportingContent } = prepareContentForGamma(content, title);

      const requestBody: any = {
        topic,
        supportingContent,
        slideCount: 10,
        presentationType: 'Professional Healthcare Presentation',
        audience: 'healthcare professionals'
      };

      // Include theme ID if user has a preference and it's from Gamma
      if (templatePreference?.themeId && templatePreference?.source === 'gamma') {
        requestBody.themeId = templatePreference.themeId;
      }

      const { data, error } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: requestBody
      });

      if (error) {
        throw new Error(error.message || 'Edge function error');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Generation failed');
      }

      // Download the PPTX
      downloadBase64AsPptx(data.pptxBase64, data.title || topic);
      
      toast.success('Professional presentation downloaded!');
    } catch (error) {
      console.error('Gamma generation failed:', error);
      toast.error('Gamma generation failed, using local generator...');
      
      // Fallback to local generation
      try {
        const { generatePowerPoint } = await import('@/utils/documentGenerators');
        await generatePowerPoint(content, title);
        toast.success('Presentation downloaded (local fallback)');
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        toast.error('Failed to generate presentation');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateWithGamma, isGenerating, templatePreference };
};
