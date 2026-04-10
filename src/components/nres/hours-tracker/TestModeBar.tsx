import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { FlaskConical, RotateCcw, ChevronDown, Building2 } from 'lucide-react';

export type TestRole = 'admin' | 'practice' | 'mgmt_lead' | 'pml_director' | 'pml_finance';

export interface TestModeState {
  enabled: boolean;
  role: TestRole;
  selectedPractice?: string;
}

const ROLE_OPTIONS: { value: TestRole; label: string; icon: string }[] = [
  { value: 'admin', label: 'Admin', icon: '👑' },
  { value: 'practice', label: 'Practice', icon: '🏥' },
  { value: 'mgmt_lead', label: 'Mgmt Lead', icon: '📋' },
  { value: 'pml_director', label: 'PML Director', icon: '✅' },
  { value: 'pml_finance', label: 'PML Finance', icon: '💰' },
];

interface TestModeBarProps {
  state: TestModeState;
  onChange: (state: TestModeState) => void;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
}

export function TestModeBar({ state, onChange, practiceKeys, practiceNames }: TestModeBarProps) {
  const isOverriding = state.enabled && state.role !== 'admin';
  const activeRole = ROLE_OPTIONS.find(r => r.value === state.role);
  const [showPractice, setShowPractice] = useState(state.role === 'practice');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowPractice(state.role === 'practice');
  }, [state.role]);

  const handleToggle = (enabled: boolean) => {
    onChange({ ...state, enabled, role: enabled ? state.role : 'admin' });
  };

  const handleRoleChange = (role: TestRole) => {
    onChange({
      enabled: true,
      role,
      selectedPractice: role === 'practice' ? (state.selectedPractice || practiceKeys[0]) : undefined,
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-300 overflow-hidden",
        isOverriding
          ? "border-amber-300/80 bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-700/60 shadow-sm shadow-amber-200/30"
          : "border-border/60 bg-muted/30"
      )}
    >
      {/* Compact top bar */}
      <div className="flex items-center gap-2.5 px-3 py-1.5">
        <FlaskConical className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
          isOverriding ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )} />

        <span className={cn(
          "text-[11px] font-semibold tracking-wide uppercase shrink-0 transition-colors duration-200",
          isOverriding ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
        )}>
          Test
        </span>

        <Switch
          checked={state.enabled}
          onCheckedChange={handleToggle}
          className="scale-75 origin-left shrink-0"
        />

        {/* Inline role selector — segmented control style */}
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-md bg-background/80 border border-border/50 p-0.5 transition-all duration-300",
            !state.enabled && "opacity-40 pointer-events-none"
          )}
        >
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleRoleChange(opt.value)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-200 whitespace-nowrap",
                state.role === opt.value
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              title={opt.label}
            >
              <span className="mr-0.5">{opt.icon}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Active role badge — shows when overriding */}
        {isOverriding && (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/50 text-[10px] px-1.5 py-0 animate-fade-in">
            {activeRole?.icon} {activeRole?.label}
            {state.role === 'practice' && state.selectedPractice && (
              <span className="ml-1 opacity-70">· {practiceNames[state.selectedPractice]?.split(' ')[0] || state.selectedPractice}</span>
            )}
          </Badge>
        )}

        {/* Reset */}
        {isOverriding && (
          <button
            onClick={() => onChange({ enabled: true, role: 'admin' })}
            className="ml-auto text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-300 transition-colors"
            title="Reset to Admin"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Practice selector — slides open when Practice role selected */}
      <div
        ref={contentRef}
        className={cn(
          "grid transition-all duration-300 ease-out",
          showPractice && state.enabled
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 px-3 pb-2 pt-0.5">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <Select
              value={state.selectedPractice || ''}
              onValueChange={v => onChange({ ...state, selectedPractice: v })}
            >
              <SelectTrigger className="h-7 text-xs flex-1 max-w-[280px]">
                <SelectValue placeholder="Select practice…" />
              </SelectTrigger>
              <SelectContent>
                {practiceKeys.map(k => (
                  <SelectItem key={k} value={k} className="text-xs">{practiceNames[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
