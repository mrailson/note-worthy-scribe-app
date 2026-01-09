import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Presentation, 
  Check, 
  Loader2, 
  Building, 
  Sparkles, 
  Palette,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Theme {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  style: string;
  preview?: string | null;
  source: 'gamma' | 'local';
}

interface UserTemplatePreference {
  themeId: string;
  themeName: string;
  source: 'gamma' | 'local';
}

const getStyleIcon = (style: string) => {
  switch (style) {
    case 'professional':
      return Building;
    case 'modern':
      return Sparkles;
    case 'clean':
      return Palette;
    case 'bright':
      return Sparkles;
    case 'dark':
      return Building;
    default:
      return Presentation;
  }
};

const getStyleBadgeClass = (style: string) => {
  switch (style) {
    case 'professional':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'modern':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'clean':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'bright':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    case 'dark':
      return 'bg-slate-800 text-slate-200 dark:bg-slate-900 dark:text-slate-200';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export function PresentationTemplateSettings() {
  const { user } = useAuth();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<UserTemplatePreference | null>(null);

  // Fetch themes from edge function
  const fetchThemes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-gamma-themes');
      
      if (error) throw error;
      
      if (data?.themes) {
        setThemes(data.themes);
      }
    } catch (error) {
      console.error('Error fetching themes:', error);
      toast.error('Failed to load presentation themes');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's current preference
  const fetchUserPreference = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'presentation_template')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.setting_value) {
        setSelectedTheme(data.setting_value as unknown as UserTemplatePreference);
      }
    } catch (error) {
      console.error('Error fetching user preference:', error);
    }
  };

  // Save user's template preference
  const savePreference = async (theme: Theme) => {
    if (!user) return;

    setSaving(true);
    try {
      const preference: UserTemplatePreference = {
        themeId: theme.id,
        themeName: theme.name,
        source: theme.source
      };

      // Upsert the setting - check if exists first
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .eq('setting_key', 'presentation_template')
        .single();

      let error;
      if (existing?.id) {
        // Update existing
        const result = await supabase
          .from('user_settings')
          .update({
            setting_value: JSON.parse(JSON.stringify(preference)),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('user_settings')
          .insert([{
            user_id: user.id,
            setting_key: 'presentation_template',
            setting_value: JSON.parse(JSON.stringify(preference))
          }]);
        error = result.error;
      }

      if (error) throw error;

      setSelectedTheme(preference);
      toast.success(`Template set to "${theme.name}"`);
    } catch (error) {
      console.error('Error saving preference:', error);
      toast.error('Failed to save template preference');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchThemes();
    fetchUserPreference();
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Presentation className="h-5 w-5" />
              Presentation Templates
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your default PowerPoint template for AI-generated presentations
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchThemes}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Selection */}
            {selectedTheme && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium">
                  Current default: <span className="text-primary">{selectedTheme.themeName}</span>
                </p>
              </div>
            )}

            {/* Theme Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {themes.map((theme) => {
                const isSelected = selectedTheme?.themeId === theme.id;
                const Icon = getStyleIcon(theme.style);

                return (
                  <div
                    key={theme.id}
                    onClick={() => !saving && savePreference(theme)}
                    className={cn(
                      "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    )}

                    {/* Theme header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div 
                        className="flex items-center justify-center h-10 w-10 rounded-lg"
                        style={{ backgroundColor: theme.primaryColor }}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{theme.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {theme.description}
                        </p>
                      </div>
                    </div>

                    {/* Colour preview */}
                    <div className="flex items-center gap-2 mb-3">
                      <div 
                        className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: theme.primaryColor }}
                        title="Primary"
                      />
                      <div 
                        className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: theme.secondaryColor }}
                        title="Secondary"
                      />
                      <div 
                        className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: theme.accentColor }}
                        title="Accent"
                      />
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs", getStyleBadgeClass(theme.style))}
                      >
                        {theme.style}
                      </Badge>
                      {theme.source === 'gamma' && (
                        <Badge variant="outline" className="text-xs">
                          Gamma
                        </Badge>
                      )}
                      {theme.source === 'local' && theme.id.startsWith('nhs') && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                          NHS
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info footer */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Your selected template will be used as the default style for all AI-generated PowerPoint presentations.
                NHS-themed templates follow NHS branding guidelines with appropriate colour schemes.
              </p>
              {themes.some(t => t.source === 'gamma') && (
                <a 
                  href="https://gamma.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  Manage themes in Gamma
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
