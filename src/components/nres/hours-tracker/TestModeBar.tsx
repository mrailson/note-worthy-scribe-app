import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

export type TestRole = 'admin' | 'practice' | 'mgmt_lead' | 'pml_director' | 'pml_finance';

export interface TestModeState {
  enabled: boolean;
  role: TestRole;
  selectedPractice?: string;
}

const ROLE_OPTIONS: { value: TestRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Full Admin', description: 'See everything — current default behaviour' },
  { value: 'practice', label: 'Practice User', description: 'Create, upload evidence, submit claims for one practice' },
  { value: 'mgmt_lead', label: 'Management Lead', description: 'Verify submitted claims across all practices' },
  { value: 'pml_director', label: 'PML Finance Director', description: 'Approve, query or reject verified claims' },
  { value: 'pml_finance', label: 'PML Finance (View Only)', description: 'View approved/paid claims, mark as paid' },
];

interface TestModeBarProps {
  state: TestModeState;
  onChange: (state: TestModeState) => void;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
}

export function TestModeBar({ state, onChange, practiceKeys, practiceNames }: TestModeBarProps) {
  const [open, setOpen] = useState(false);

  const activeRole = ROLE_OPTIONS.find(r => r.value === state.role);
  const isOverriding = state.enabled && state.role !== 'admin';

  return (
    <div className="relative">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className={cn(
          "rounded-lg border overflow-hidden transition-colors",
          isOverriding
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
            : "border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-700"
        )}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors text-left">
              <div className="flex items-center gap-2 text-xs">
                <span>🧪</span>
                <span className="font-medium">Test Mode</span>
                {isOverriding && (
                  <Badge className="bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 text-[10px] px-1.5 py-0">
                    Viewing as: {activeRole?.label}
                    {state.role === 'practice' && state.selectedPractice && ` (${practiceNames[state.selectedPractice] || state.selectedPractice})`}
                  </Badge>
                )}
              </div>
              <div className="text-slate-400">
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 border-t border-amber-200 dark:border-amber-800 space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Simulate different user perspectives. This is UI-only — no data or permissions are actually changed.
              </p>

              {/* Role pills */}
              <div className="flex flex-wrap gap-1.5">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onChange({
                      enabled: true,
                      role: opt.value,
                      selectedPractice: opt.value === 'practice' ? (state.selectedPractice || practiceKeys[0]) : undefined,
                    })}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                      state.role === opt.value
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-amber-400"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Description */}
              {activeRole && (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">
                  {activeRole.description}
                </p>
              )}

              {/* Practice selector for Practice User role */}
              {state.role === 'practice' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Practice:</span>
                  <Select
                    value={state.selectedPractice || ''}
                    onValueChange={v => onChange({ ...state, selectedPractice: v })}
                  >
                    <SelectTrigger className="h-7 text-xs w-[200px]">
                      <SelectValue placeholder="Select practice" />
                    </SelectTrigger>
                    <SelectContent>
                      {practiceKeys.map(k => (
                        <SelectItem key={k} value={k}>{practiceNames[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reset button */}
              {isOverriding && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => onChange({ enabled: true, role: 'admin' })}
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Admin
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
