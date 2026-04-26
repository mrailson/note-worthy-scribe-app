import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Image, RefreshCw, SlidersHorizontal, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ASK_AI_IMAGE_STUDIO_TEMPLATES } from '@/components/AskAI/askAIImageStudioTemplates';

interface TemplateUsageRow {
  template_id: string;
  total_generations: number;
  regeneration_count: number;
  regeneration_rate: number | null;
  advanced_opened_count: number;
  advanced_opened_rate: number | null;
  unique_users: number;
  last_generated: string | null;
}

const templateTitle = (templateId: string) =>
  ASK_AI_IMAGE_STUDIO_TEMPLATES.find(template => template.id === templateId)?.title || templateId;

export const AskAIImageStudioUsageReport = () => {
  const [rows, setRows] = useState<TemplateUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)('get_ask_ai_image_studio_usage_report');
        if (error) throw error;
        setRows((data || []) as TemplateUsageRow[]);
      } catch (error) {
        console.error('Failed to load Ask AI Image Studio usage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsage();
  }, []);

  const totals = rows.reduce(
    (acc, row) => ({
      generations: acc.generations + Number(row.total_generations || 0),
      regenerations: acc.regenerations + Number(row.regeneration_count || 0),
      advanced: acc.advanced + Number(row.advanced_opened_count || 0),
      users: Math.max(acc.users, Number(row.unique_users || 0)),
    }),
    { generations: 0, regenerations: 0, advanced: 0, users: 0 }
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, index) => <Skeleton key={index} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <Image className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{totals.generations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Regenerations</span>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{totals.regenerations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Advanced opened</span>
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{totals.advanced}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Template users</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{totals.users}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead className="text-center">Usage</TableHead>
                <TableHead className="text-center">Regeneration rate</TableHead>
                <TableHead className="text-center">Advanced opened</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-right">Last generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No Ask AI Image Studio generations yet</TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.template_id}>
                  <TableCell>
                    <div className="font-medium">{templateTitle(row.template_id)}</div>
                    <div className="text-xs text-muted-foreground">{row.template_id}</div>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{row.total_generations}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{row.regeneration_rate ?? 0}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{row.advanced_opened_rate ?? 0}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">{row.unique_users}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {row.last_generated ? format(new Date(row.last_generated), 'dd MMM yyyy HH:mm') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
