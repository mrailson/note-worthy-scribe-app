import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Pencil, X, Plus, GripVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNRESEvidenceConfig, type AppliesToValue } from '@/hooks/useNRESEvidenceConfig';
import { cn } from '@/lib/utils';

const APPLIES_TO_ORDER: AppliesToValue[] = ['all', 'buyback', 'new_sda', 'management', 'gp_locum'];

const appliesToLabel = (v: AppliesToValue) => {
  switch (v) {
    case 'all': return 'All routes';
    case 'buyback': return 'Buy-back only';
    case 'new_sda': return 'New SDA only';
    case 'management': return 'Management only';
    case 'gp_locum': return 'GP Locum only';
  }
};

const appliesToClasses = (v: AppliesToValue) => {
  switch (v) {
    case 'all': return 'bg-[#E6F1FB] text-[#0C447C] hover:bg-[#d0e5f7]';
    case 'buyback': return 'bg-[#FAEEDA] text-[#633806] hover:bg-[#f5e0c5]';
    case 'new_sda': return 'bg-[#EAF3DE] text-[#3B6D11] hover:bg-[#ddecc8]';
    case 'management': return 'bg-[#EDE9FE] text-[#5B21B6] hover:bg-[#ddd6fe]';
    case 'gp_locum': return 'bg-[#FCE7F3] text-[#9D174D] hover:bg-[#fbcfe8]';
  }
};

function cycleAppliesTo(current: AppliesToValue): AppliesToValue {
  const idx = APPLIES_TO_ORDER.indexOf(current);
  return APPLIES_TO_ORDER[(idx + 1) % APPLIES_TO_ORDER.length];
}

export function EvidenceConfigTab() {
  const { config, loading, updateMandatory, updateAppliesTo, updateRow, addRow, deleteRow } = useNRESEvidenceConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', description: '', applies_to: 'all' as AppliesToValue });
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input when editing opens
  useEffect(() => {
    if (editingId && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openEdit = (id: string) => {
    const row = config.find(c => c.id === id);
    if (!row) return;
    setDeletingId(null);
    setEditingId(id);
    setEditForm({ label: row.label, description: row.description || '', applies_to: row.applies_to });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateRow(editingId, editForm);
    setEditingId(null);
  };

  const openDelete = (id: string) => {
    setEditingId(null);
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await deleteRow(deletingId);
    setDeletingId(null);
  };

  const handleAdd = async () => {
    const newId = await addRow();
    if (newId) {
      setDeletingId(null);
      setEditingId(newId);
      setEditForm({ label: 'New evidence type', description: 'Description of the evidence required', applies_to: 'all' });
    }
  };

  const handleCycleAppliesTo = async (id: string, current: AppliesToValue) => {
    const next = cycleAppliesTo(current);
    await updateAppliesTo(id, next);
  };

  return (
    <div className="space-y-4 pb-4 pt-2">
      <div>
        <h3 className="border-l-[3px] border-primary pl-3 text-sm font-semibold mb-2">Evidence Requirements</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Configure which evidence documents are required for claim submission. All evidence applies to both routes unless restricted. Use the mandatory toggle to control whether the practice must upload the document before submitting their claim.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="w-7 px-1 py-2.5" />
              <th className="text-left px-3 py-2.5 font-medium">Evidence Type</th>
              <th className="text-left px-3 py-2.5 font-medium max-w-[240px]">Description</th>
              <th className="text-center px-3 py-2.5 font-medium w-[100px]">Applies To</th>
              <th className="text-center px-3 py-2.5 font-medium w-[80px]">Mandatory</th>
              <th className="text-right px-3 py-2.5 font-medium w-[60px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {config.map(cfg => (
              <React.Fragment key={cfg.id}>
                <tr className="border-t">
                  {/* Drag handle */}
                  <td className="px-1 py-2.5 text-center">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mx-auto cursor-grab" />
                  </td>
                  {/* Evidence type with mandatory dot */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        cfg.is_mandatory ? "bg-[#1D9E75]" : "bg-muted-foreground/30"
                      )} />
                      <span className="font-medium">{cfg.label}</span>
                    </div>
                  </td>
                  {/* Description */}
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[240px] truncate">
                    {cfg.description || '—'}
                  </td>
                  {/* Applies to pill */}
                  <td className="px-3 py-2.5 text-center">
                    <TooltipProvider>
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleCycleAppliesTo(cfg.id, cfg.applies_to)}
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer",
                              appliesToClasses(cfg.applies_to)
                            )}
                          >
                            {appliesToLabel(cfg.applies_to)}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>Click to cycle</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  {/* Mandatory toggle */}
                  <td className="px-3 py-2.5 text-center">
                    <Switch
                      checked={cfg.is_mandatory}
                      onCheckedChange={(checked) => updateMandatory(cfg.id, checked)}
                      className={cn(
                        cfg.is_mandatory && "data-[state=checked]:bg-[#1D9E75]"
                      )}
                    />
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(cfg.id)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => openDelete(cfg.id)}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Inline edit panel */}
                {editingId === cfg.id && (
                  <tr key={`edit-${cfg.id}`} className="border-t bg-muted/30">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Evidence type name</label>
                            <Input
                              ref={nameInputRef}
                              value={editForm.label}
                              onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Applies to</label>
                            <select
                              value={editForm.applies_to}
                              onChange={e => setEditForm(f => ({ ...f, applies_to: e.target.value as AppliesToValue }))}
                              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                            >
                              <option value="all">All routes</option>
                              <option value="buyback">Buy-back only</option>
                              <option value="new_sda">New SDA only</option>
                              <option value="management">Management only</option>
                              <option value="gp_locum">GP Locum only</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Description</label>
                          <Textarea
                            value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            className="text-xs min-h-[56px]"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEdit} className="h-7 text-xs">
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveEdit} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Inline delete confirmation */}
                {deletingId === cfg.id && (
                  <tr key={`del-${cfg.id}`} className="border-t bg-destructive/5">
                    <td colSpan={6} className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs">
                          Remove "<strong>{cfg.label}</strong>"? This cannot be undone.
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setDeletingId(null)} className="h-7 text-xs">
                            Keep
                          </Button>
                          <Button variant="destructive" size="sm" onClick={confirmDelete} className="h-7 text-xs">
                            Delete
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      <Button variant="outline" size="sm" onClick={handleAdd} className="h-8 text-xs gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        Add evidence type
      </Button>

      <p className="text-[10px] text-muted-foreground">
        Changes are saved immediately. When mandatory, the practice must upload the document before submitting their claim.
      </p>
    </div>
  );
}
