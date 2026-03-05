import { Loader2, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';

export function EvidenceConfigTab() {
  const { config, loading, updateMandatory } = useNRESEvidenceConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4 pt-2">
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Evidence Requirements</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Configure which evidence documents are mandatory for claim submission. SDA evidence applies to all routes; LTC evidence applies to Buy-Back claims only.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium">Evidence Type</th>
              <th className="text-left px-3 py-2.5 font-medium">Description</th>
              <th className="text-center px-3 py-2.5 font-medium">Applies To</th>
              <th className="text-center px-3 py-2.5 font-medium">Mandatory</th>
            </tr>
          </thead>
          <tbody>
            {config.map(cfg => (
              <tr key={cfg.id} className="border-t">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-medium">{cfg.label}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{cfg.description || '—'}</td>
                <td className="px-3 py-2.5 text-center">
                  <Badge variant="outline" className="text-[10px]">
                    {cfg.applies_to === 'all' ? 'All Routes' : 'Buy-Back Only'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Switch
                    checked={cfg.is_mandatory}
                    onCheckedChange={(checked) => updateMandatory(cfg.id, checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Changes are saved immediately. When mandatory, the practice must upload the document before submitting their claim.
      </p>
    </div>
  );
}
