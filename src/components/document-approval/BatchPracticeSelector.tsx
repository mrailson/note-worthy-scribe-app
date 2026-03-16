import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, ChevronDown, ChevronUp, Loader2, Search, Plus, Trash2, UserPlus,
} from 'lucide-react';
import { useNotewellDirectory, NotewellUser } from '@/hooks/useNotewellDirectory';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS, type NRESPracticeKey } from '@/data/nresPractices';

const TITLE_OPTIONS = ['', 'Dr', 'Mr', 'Mrs', 'Ms', 'Miss', 'Prof', 'Rev'];

export interface BatchSignatoryRow {
  id: string;
  signatory_title: string;
  name: string;
  email: string;
  role: string;
  organisation: string;
  organisation_type: string;
}

export interface PracticeSelection {
  practiceKey: string;       // unique key (nres key or practice group name)
  practiceName: string;      // display name
  organisationType: string;
  signatories: BatchSignatoryRow[];
}

interface BatchPracticeSelectorProps {
  selections: PracticeSelection[];
  onChange: (selections: PracticeSelection[]) => void;
}

let _batchId = 0;
function batchLocalId() { return `bsig-${++_batchId}-${Date.now()}`; }

export function BatchPracticeSelector({ selections, onChange }: BatchPracticeSelectorProps) {
  const { practiceGroups, loading: directoryLoading, loaded: directoryLoaded, fetchDirectory } = useNotewellDirectory();
  const [expandedPractices, setExpandedPractices] = useState<Set<string>>(new Set());
  const [practiceSearch, setPracticeSearch] = useState('');

  useEffect(() => {
    if (!directoryLoaded) fetchDirectory();
  }, [directoryLoaded, fetchDirectory]);

  // Build combined practice list: NRES practices + directory practices (deduped)
  const availablePractices = useMemo(() => {
    const practices: { key: string; name: string; orgType: string; users: NotewellUser[] }[] = [];

    // NRES practices
    for (const key of NRES_PRACTICE_KEYS) {
      const name = NRES_PRACTICES[key];
      const matchingGroup = practiceGroups.find(g =>
        g.practice_name.toLowerCase().includes(name.toLowerCase().split(' ')[0].toLowerCase())
      );
      practices.push({
        key,
        name,
        orgType: 'Practice',
        users: matchingGroup?.users || [],
      });
    }

    // Add non-NRES directory practices
    for (const group of practiceGroups) {
      const alreadyAdded = practices.some(p =>
        group.practice_name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0].toLowerCase())
      );
      if (!alreadyAdded) {
        practices.push({
          key: `dir-${group.practice_name}`,
          name: group.practice_name,
          orgType: group.organisation_type,
          users: group.users,
        });
      }
    }

    return practices;
  }, [practiceGroups]);

  const filteredPractices = useMemo(() => {
    if (!practiceSearch.trim()) return availablePractices;
    const q = practiceSearch.toLowerCase();
    return availablePractices.filter(p => p.name.toLowerCase().includes(q));
  }, [availablePractices, practiceSearch]);

  const selectedKeys = new Set(selections.map(s => s.practiceKey));

  const togglePractice = (practice: typeof availablePractices[0]) => {
    if (selectedKeys.has(practice.key)) {
      onChange(selections.filter(s => s.practiceKey !== practice.key));
    } else {
      onChange([...selections, {
        practiceKey: practice.key,
        practiceName: practice.name,
        organisationType: practice.orgType,
        signatories: [{ id: batchLocalId(), signatory_title: '', name: '', email: '', role: '', organisation: practice.name, organisation_type: practice.orgType }],
      }]);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedPractices(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const updateSignatory = (practiceKey: string, sigId: string, field: keyof BatchSignatoryRow, value: string) => {
    onChange(selections.map(s => {
      if (s.practiceKey !== practiceKey) return s;
      return { ...s, signatories: s.signatories.map(sig => sig.id === sigId ? { ...sig, [field]: value } : sig) };
    }));
  };

  const addSignatoryRow = (practiceKey: string, practice: PracticeSelection) => {
    onChange(selections.map(s => {
      if (s.practiceKey !== practiceKey) return s;
      return { ...s, signatories: [...s.signatories, { id: batchLocalId(), signatory_title: '', name: '', email: '', role: '', organisation: practice.practiceName, organisation_type: practice.organisationType }] };
    }));
  };

  const removeSignatoryRow = (practiceKey: string, sigId: string) => {
    onChange(selections.map(s => {
      if (s.practiceKey !== practiceKey) return s;
      return { ...s, signatories: s.signatories.filter(sig => sig.id !== sigId) };
    }));
  };

  const addDirectoryUser = (practiceKey: string, user: NotewellUser, practice: PracticeSelection) => {
    const alreadyAdded = practice.signatories.some(s => s.email.toLowerCase() === user.email.toLowerCase());
    if (alreadyAdded) return;

    onChange(selections.map(s => {
      if (s.practiceKey !== practiceKey) return s;
      const newSig: BatchSignatoryRow = {
        id: batchLocalId(),
        signatory_title: user.title || '',
        name: user.full_name,
        email: user.email,
        role: user.practice_role || user.role || '',
        organisation: user.practice_name,
        organisation_type: user.organisation_type === 'Management' ? 'Other' : user.organisation_type || '',
      };
      // Replace empty first row or append
      const cleaned = s.signatories.filter(sig => sig.name.trim() || sig.email.trim());
      return { ...s, signatories: [...cleaned, newSig] };
    }));
  };

  const totalSignatories = selections.reduce((acc, s) => acc + s.signatories.filter(sig => sig.name.trim() && sig.email.trim()).length, 0);

  return (
    <div className="space-y-4">
      {/* Practice picker */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Select Practices
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selections.length} practice{selections.length !== 1 ? 's' : ''} selected · {totalSignatories} signator{totalSignatories !== 1 ? 'ies' : 'y'} total
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search practices…"
            value={practiceSearch}
            onChange={e => setPracticeSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {directoryLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading directory…</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {filteredPractices.map(practice => {
              const isSelected = selectedKeys.has(practice.key);
              const orgLabel = practice.orgType === 'Practice' ? 'NRES' : practice.orgType === 'Management' ? 'PML' : practice.orgType;
              return (
                <div
                  key={practice.key}
                  onClick={() => togglePractice(practice)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <Checkbox checked={isSelected} />
                  <span className="text-sm font-medium text-foreground flex-1">{practice.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{orgLabel}</Badge>
                  {practice.users.length > 0 && (
                    <span className="text-xs text-muted-foreground">{practice.users.length} staff</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Per-practice signatory sections */}
      {selections.map(selection => {
        const isExpanded = expandedPractices.has(selection.practiceKey);
        const practice = availablePractices.find(p => p.key === selection.practiceKey);
        const validCount = selection.signatories.filter(s => s.name.trim() && s.email.trim()).length;

        return (
          <Card key={selection.practiceKey} className="overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpand(selection.practiceKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="font-semibold text-foreground">{selection.practiceName}</span>
                <Badge variant={validCount > 0 ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                  {validCount} signator{validCount !== 1 ? 'ies' : 'y'}
                </Badge>
              </div>
            </button>

            {isExpanded && (
              <div className="p-4 space-y-3">
                {/* Quick add from directory users */}
                {practice && practice.users.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Quick add from directory:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {practice.users.map(u => {
                        const alreadyAdded = selection.signatories.some(s => s.email.toLowerCase() === u.email.toLowerCase());
                        return (
                          <Button
                            key={u.user_id}
                            variant={alreadyAdded ? 'secondary' : 'outline'}
                            size="sm"
                            className="text-xs h-7 gap-1"
                            disabled={alreadyAdded}
                            onClick={() => addDirectoryUser(selection.practiceKey, u, selection)}
                          >
                            <UserPlus className="h-3 w-3" />
                            {u.full_name}
                            {alreadyAdded && ' ✓'}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Signatory rows */}
                <div className="space-y-2">
                  {selection.signatories.map(sig => (
                    <div key={sig.id} className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr_1fr_32px] gap-2 p-2 bg-muted/30 rounded-lg items-center">
                      <Select value={sig.signatory_title} onValueChange={v => updateSignatory(selection.practiceKey, sig.id, 'signatory_title', v)}>
                        <SelectTrigger className="text-sm h-8"><SelectValue placeholder="Title" /></SelectTrigger>
                        <SelectContent>
                          {TITLE_OPTIONS.map(t => (
                            <SelectItem key={t || '__none'} value={t || ' '}>{t || '—'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input value={sig.name} onChange={e => updateSignatory(selection.practiceKey, sig.id, 'name', e.target.value)} placeholder="Full name *" className="text-sm h-8" />
                      <Input type="email" value={sig.email} onChange={e => updateSignatory(selection.practiceKey, sig.id, 'email', e.target.value)} placeholder="Email *" className="text-sm h-8" />
                      <Input value={sig.role} onChange={e => updateSignatory(selection.practiceKey, sig.id, 'role', e.target.value)} placeholder="Role" className="text-sm h-8" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSignatoryRow(selection.practiceKey, sig.id)} disabled={selection.signatories.length <= 1}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={() => addSignatoryRow(selection.practiceKey, selection)} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add Signatory
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
