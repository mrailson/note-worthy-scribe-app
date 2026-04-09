import { useState } from 'react';
import { type RoleConfig, type GroundRule } from '@/hooks/useNRESBuyBackRateSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const RULE_TYPE_CONFIG = {
  must_have: { label: 'Must Have', icon: CheckCircle2, colour: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
  must_not: { label: 'Must Not', icon: XCircle, colour: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30' },
  condition: { label: 'Condition', icon: AlertTriangle, colour: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  information: { label: 'Information', icon: Info, colour: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
} as const;

type RuleType = keyof typeof RULE_TYPE_CONFIG;

export function getDefaultGroundRules(roleKey: string): GroundRule[] {
  return [
    { id: `${roleKey}-auto-001`, type: 'must_have', text: 'Must have current professional registration relevant to the role', requires_acknowledgement: true },
    { id: `${roleKey}-auto-002`, type: 'must_have', text: 'Must have appropriate indemnity cover in place', requires_acknowledgement: true },
    { id: `${roleKey}-auto-003`, type: 'must_not', text: 'Must not exceed the maximum reclaimable rate as set in programme settings', requires_acknowledgement: false },
    { id: `${roleKey}-auto-004`, type: 'must_not', text: 'Must not undertake LTC (Part B) activity during funded SDA (Part A) hours', requires_acknowledgement: true },
    { id: `${roleKey}-auto-005`, type: 'condition', text: 'Buy-back staff must have matching Part B (LTC) delivery evidenced before payment is released', requires_acknowledgement: true },
    { id: `${roleKey}-auto-006`, type: 'information', text: 'Claims must be submitted within 30 calendar days of the end of the claim month', requires_acknowledgement: false },
  ];
}

interface GroundRulesEditorProps {
  role: RoleConfig;
  onRulesChange: (rules: GroundRule[]) => void;
}

export function GroundRulesEditor({ role, onRulesChange }: GroundRulesEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rules = role.ground_rules || [];
  const [newType, setNewType] = useState<RuleType>('must_have');
  const [newText, setNewText] = useState('');
  const [newAck, setNewAck] = useState(true);

  const groupedRules = {
    must_have: rules.filter(r => r.type === 'must_have'),
    must_not: rules.filter(r => r.type === 'must_not'),
    condition: rules.filter(r => r.type === 'condition'),
    information: rules.filter(r => r.type === 'information'),
  };

  const handleDelete = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const handleToggleAck = (ruleId: string, checked: boolean) => {
    onRulesChange(rules.map(r => r.id === ruleId ? { ...r, requires_acknowledgement: checked } : r));
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    const id = `${role.key}-${Date.now()}`;
    onRulesChange([...rules, { id, type: newType, text: newText.trim(), requires_acknowledgement: newAck }]);
    setNewText('');
    setNewAck(true);
  };

  const ackCount = rules.filter(r => r.requires_acknowledgement).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-primary hover:underline py-1">
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Ground Rules ({rules.length})
          {ackCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">{ackCount} require acknowledgement</Badge>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-4 border rounded-lg p-3 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-[10px] text-muted-foreground">
            Ground rules for <strong>{role.label}</strong>. Rules marked with ☑ require practice acknowledgement before claim submission.
          </p>

          {(Object.keys(groupedRules) as RuleType[]).map(type => {
            const group = groupedRules[type];
            if (group.length === 0) return null;
            const config = RULE_TYPE_CONFIG[type];
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${config.colour}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{config.label}</span>
                </div>
                <div className="space-y-1">
                  {group.map(rule => (
                    <div key={rule.id} className={`flex items-start gap-2 rounded px-2 py-1.5 ${config.bg}`}>
                      <span className="flex-1 text-xs">{rule.text}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Checkbox
                          checked={rule.requires_acknowledgement}
                          onCheckedChange={(checked) => handleToggleAck(rule.id, !!checked)}
                          className="mt-0.5"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No ground rules configured for this role.</p>
          )}

          {/* Add new rule */}
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center gap-2">
              <Select value={newType} onValueChange={v => setNewType(v as RuleType)}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="must_have">Must Have</SelectItem>
                  <SelectItem value="must_not">Must Not</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="information">Information</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="flex-1 h-7 text-xs"
                placeholder="Rule text..."
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <div className="flex items-center gap-1 shrink-0">
                <Checkbox checked={newAck} onCheckedChange={c => setNewAck(!!c)} />
                <span className="text-[10px] text-muted-foreground">Ack</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAdd} disabled={!newText.trim()}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
