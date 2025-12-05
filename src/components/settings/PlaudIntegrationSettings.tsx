import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Copy, Check, ExternalLink, Mic } from 'lucide-react';

interface PlaudIntegration {
  id: string;
  user_id: string;
  enabled: boolean;
  webhook_secret: string | null;
  auto_generate_notes: boolean;
  default_meeting_type: string;
  created_at: string;
  updated_at: string;
}

export function PlaudIntegrationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<PlaudIntegration | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [autoGenerateNotes, setAutoGenerateNotes] = useState(true);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/plaud-webhook`;

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('plaud_integrations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setIntegration(data as PlaudIntegration);
        setEnabled(data.enabled);
        setWebhookSecret(data.webhook_secret || '');
        setAutoGenerateNotes(data.auto_generate_notes);
      }
    } catch (error) {
      console.error('Failed to load Plaud integration:', error);
      toast.error('Failed to load Plaud settings');
    } finally {
      setLoading(false);
    }
  };

  const saveIntegration = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const integrationData = {
        user_id: user.id,
        enabled,
        webhook_secret: webhookSecret || null,
        auto_generate_notes: autoGenerateNotes,
        default_meeting_type: 'imported',
      };

      if (integration) {
        const { error } = await supabase
          .from('plaud_integrations')
          .update(integrationData)
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('plaud_integrations')
          .insert(integrationData)
          .select()
          .single();
        if (error) throw error;
        setIntegration(data as PlaudIntegration);
      }

      toast.success('Plaud integration settings saved');
    } catch (error) {
      console.error('Failed to save Plaud integration:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Webhook URL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Plaud Integration</CardTitle>
          {enabled && <Badge variant="secondary" className="ml-auto">Active</Badge>}
        </div>
        <CardDescription>
          Connect your Plaud device to automatically import transcripts into Meeting Manager
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="plaud-enabled">Enable Plaud Integration</Label>
            <p className="text-sm text-muted-foreground">
              Receive transcripts from your Plaud device automatically
            </p>
          </div>
          <Switch
            id="plaud-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <>
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Add this URL in your Plaud Developer Portal webhook settings
              </p>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyWebhookUrl}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Webhook Secret (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Enter your webhook signing secret from Plaud for secure verification
              </p>
              <Input
                id="webhook-secret"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Enter webhook secret from Plaud"
              />
            </div>

            {/* Auto Generate Notes */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-notes">Auto-generate Meeting Notes</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically generate meeting notes when a transcript arrives
                </p>
              </div>
              <Switch
                id="auto-notes"
                checked={autoGenerateNotes}
                onCheckedChange={setAutoGenerateNotes}
              />
            </div>

            {/* Help Link */}
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-sm mb-2">Setup Instructions</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to the Plaud Developer Portal</li>
                <li>Create a new webhook endpoint</li>
                <li>Paste the webhook URL above</li>
                <li>Copy the webhook signing secret and paste it above</li>
                <li>Enable the "transcription.completed" event</li>
              </ol>
              <Button
                variant="link"
                size="sm"
                className="mt-2 p-0 h-auto"
                asChild
              >
                <a
                  href="https://www.plaud.ai/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  Open Plaud Developer Portal
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </>
        )}

        {/* Save Button */}
        <Button
          onClick={saveIntegration}
          disabled={saving}
          className="w-full"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Plaud Settings
        </Button>
      </CardContent>
    </Card>
  );
}
