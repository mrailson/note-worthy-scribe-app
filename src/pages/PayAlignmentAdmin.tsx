import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Trash2, FileText, BarChart3, AlertTriangle, Plus, Copy, Check, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';

import { NRES_PRACTICES, NRES_PRACTICE_KEYS } from '@/data/nresPractices';

const PRACTICES = NRES_PRACTICE_KEYS
  .filter(k => k !== 'bt_pcn')
  .map(k => NRES_PRACTICES[k]);

const ROLES = [
  { id: 'anp',       name: 'Advanced Nurse Practitioner',     short: 'ANP',  band: 'Band 8a', ceiling: 60411 },
  { id: 'acp',       name: 'Advanced Clinical Practitioner',  short: 'ACP',  band: 'Band 8a', ceiling: 60411 },
  { id: 'pharm',     name: 'Clinical Pharmacist',             short: 'CP',   band: 'Band 7',  ceiling: 55173 },
  { id: 'paramedic', name: 'Paramedic',                       short: 'Para', band: 'Band 7',  ceiling: 53473 },
];

const POSITIONS = [
  { value: 'na',    label: 'Not employed' },
  { value: 'below', label: 'Below ceiling' },
  { value: 'at',    label: 'At ceiling' },
  { value: 'above', label: 'Above ceiling' },
];

const POS_COLOR: Record<string, string> = {
  na:    'bg-stone-200 text-stone-700',
  below: 'bg-amber-100 text-amber-900',
  at:    'bg-emerald-100 text-emerald-900',
  above: 'bg-sky-100 text-sky-900',
};

const RISK_COLOR: Record<string, string> = {
  low:    'bg-emerald-50 border-emerald-200 text-emerald-900',
  medium: 'bg-amber-50 border-amber-200 text-amber-900',
  high:   'bg-rose-50 border-rose-200 text-rose-900',
};

const fmt = (n: number) => '£' + n.toLocaleString('en-GB');

interface Survey {
  id: string;
  token: string;
  name: string;
  created_at: string;
  closed_at: string | null;
  is_active: boolean;
}

interface Submission {
  id: string;
  submitted_at: string;
  practice: string | null;
  is_anonymous: boolean;
  responses: Record<string, string>;
  comments: Record<string, string> | null;
  risk_flag: string | null;
}

function generateToken() {
  // short, friendly, URL-safe
  const a = Math.random().toString(36).slice(2, 6);
  const b = Math.random().toString(36).slice(2, 6);
  return `${a}-${b}`;
}

export default function PayAlignmentAdmin() {
  const { profile, loading: profileLoading } = useUserProfile();
  const { toast } = useToast();
  const [authorised, setAuthorised] = useState<boolean | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<'aggregate' | 'raw'>('aggregate');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Auth check via has_role RPC (system_admin)
  useEffect(() => {
    if (profileLoading) return;
    if (!profile?.user_id) { setAuthorised(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: profile.user_id,
        _role: 'system_admin',
      });
      setAuthorised(!error && data === true);
    })();
  }, [profile, profileLoading]);

  const loadSurveys = useCallback(async () => {
    const { data } = await supabase
      .from('nres_pay_alignment_surveys')
      .select('*')
      .order('created_at', { ascending: false });
    const list = (data || []) as Survey[];
    setSurveys(list);
    setActiveSurvey(prev => prev ? list.find(s => s.id === prev.id) || list[0] || null : list[0] || null);
  }, []);

  const loadSubmissions = useCallback(async (surveyId: string) => {
    const { data } = await supabase
      .from('nres_pay_alignment_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });
    setSubmissions((data || []) as Submission[]);
  }, []);

  useEffect(() => { if (authorised) loadSurveys(); }, [authorised, loadSurveys]);
  useEffect(() => { if (activeSurvey) loadSubmissions(activeSurvey.id); }, [activeSurvey, loadSubmissions]);

  const createSurvey = async () => {
    if (!newName.trim()) { toast({ title: 'Survey name required', variant: 'destructive' }); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from('nres_pay_alignment_surveys')
      .insert({
        name: newName.trim(),
        token: generateToken(),
        created_by: profile?.user_id,
        is_active: true,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast({ title: 'Could not create survey', description: error.message, variant: 'destructive' });
      return;
    }
    setNewName('');
    await loadSurveys();
    setActiveSurvey(data as Survey);
    toast({ title: 'Survey created', description: 'Public link generated below.' });
  };

  const toggleSurvey = async (s: Survey) => {
    const closing = s.is_active;
    const { error } = await supabase
      .from('nres_pay_alignment_surveys')
      .update({
        is_active: !closing,
        closed_at: closing ? new Date().toISOString() : null,
      })
      .eq('id', s.id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    await loadSurveys();
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm('Delete this response? This cannot be undone.')) return;
    await supabase.from('nres_pay_alignment_responses').delete().eq('id', id);
    if (activeSurvey) await loadSubmissions(activeSurvey.id);
  };

  const publicUrl = (token: string) =>
    `${window.location.origin}/survey/pay-alignment/${token}`;

  const copyUrl = async (token: string) => {
    await navigator.clipboard.writeText(publicUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  if (authorised === null) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500 text-sm">Checking access…</div>;
  }
  if (authorised === false) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock size={32} className="mx-auto text-stone-400 mb-4" />
          <h1 className="font-serif text-xl text-stone-900 mb-2">Access denied</h1>
          <p className="text-sm text-stone-600 mb-4">You need the system administrator role to view this page.</p>
          <Link to="/" className="text-sm text-stone-900 underline">Back to home</Link>
        </div>
      </div>
    );
  }

  // Aggregated calc
  const aggregate = ROLES.map(role => {
    const positions = submissions.map(s => s.responses?.[role.id]).filter(Boolean);
    const counts = {
      na:    positions.filter(p => p === 'na').length,
      below: positions.filter(p => p === 'below').length,
      at:    positions.filter(p => p === 'at').length,
      above: positions.filter(p => p === 'above').length,
    };
    const employing = counts.below + counts.at + counts.above;
    let risk = 'low', riskLabel = 'Low risk';
    if (employing > 0) {
      const belowShare = counts.below / employing;
      if (belowShare >= 0.5) { risk = 'high'; riskLabel = 'High parity risk'; }
      else if (belowShare > 0) { risk = 'medium'; riskLabel = 'Moderate risk'; }
    }
    return { role, counts, employing, risk, riskLabel };
  });

  const totalSubs = submissions.length;
  const anonCount = submissions.filter(s => s.is_anonymous).length;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500">Programme Lead view</p>
            <h1 className="font-serif text-2xl text-stone-900">NRES Pay Alignment Admin</h1>
          </div>
          <Link to="/admin" className="text-xs text-stone-500 hover:text-stone-900">← Back to admin</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Create new survey */}
        <section className="bg-white border border-stone-200 rounded-lg p-5">
          <h2 className="font-medium text-stone-900 mb-3 flex items-center gap-2">
            <Plus size={16} /> Create a new survey run
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. May 2026 NRES PM Group"
              className="flex-1 px-3 py-2 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
            <button
              onClick={createSurvey}
              disabled={creating}
              className="px-4 py-2 rounded-md bg-stone-900 text-stone-50 text-sm hover:bg-stone-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </section>

        {/* Survey list */}
        <section className="bg-white border border-stone-200 rounded-lg p-5">
          <h2 className="font-medium text-stone-900 mb-3">Surveys</h2>
          {surveys.length === 0 && (
            <p className="text-sm text-stone-500">No surveys yet — create one above.</p>
          )}
          <div className="space-y-2">
            {surveys.map(s => (
              <div
                key={s.id}
                className={`border rounded-md p-3 ${activeSurvey?.id === s.id ? 'border-stone-900 bg-stone-50' : 'border-stone-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setActiveSurvey(s)}
                    className="text-left flex-1"
                  >
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Created {new Date(s.created_at).toLocaleDateString('en-GB')}
                      {' · '}
                      {s.is_active
                        ? <span className="text-emerald-700">Active</span>
                        : <span className="text-stone-500">Closed {s.closed_at ? new Date(s.closed_at).toLocaleDateString('en-GB') : ''}</span>}
                    </p>
                  </button>
                  <button
                    onClick={() => toggleSurvey(s)}
                    className="text-xs text-stone-500 hover:text-stone-900"
                  >
                    {s.is_active ? 'Close' : 'Reopen'}
                  </button>
                </div>
                {s.is_active && (
                  <div className="mt-3 flex items-center gap-2 bg-white border border-stone-200 rounded p-2">
                    <code className="text-xs text-stone-700 flex-1 truncate">{publicUrl(s.token)}</code>
                    <button
                      onClick={() => copyUrl(s.token)}
                      className="text-xs px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 flex items-center gap-1"
                    >
                      {copied === s.token ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Responses for active survey */}
        {activeSurvey && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h2 className="font-serif text-xl text-stone-900">Responses · {activeSurvey.name}</h2>
                <p className="text-sm text-stone-600">
                  {totalSubs} {totalSubs === 1 ? 'response' : 'responses'} of {PRACTICES.length} practices
                  {anonCount > 0 && <span className="text-stone-500"> · {anonCount} anonymous</span>}
                </p>
              </div>
            </div>

            <div className="flex gap-1 border-b border-stone-200 mb-6">
              {[
                { id: 'aggregate' as const, label: 'Aggregated', icon: BarChart3 },
                { id: 'raw' as const,       label: 'Raw responses', icon: FileText },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2 text-sm flex items-center gap-1.5 border-b-2 -mb-px ${
                      tab === t.id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    <Icon size={14}/> {t.label}
                  </button>
                );
              })}
            </div>

            {totalSubs === 0 && (
              <div className="bg-white border border-stone-200 rounded-lg p-10 text-center">
                <p className="text-stone-500 text-sm">No responses yet. Share the survey link with practice managers.</p>
              </div>
            )}

            {totalSubs > 0 && tab === 'aggregate' && (
              <div className="space-y-4">
                {aggregate.map(({ role, counts, employing, risk, riskLabel }) => (
                  <div key={role.id} className="bg-white border border-stone-200 rounded-lg p-5">
                    <div className="flex items-baseline justify-between mb-3 gap-3">
                      <div>
                        <p className="font-medium text-stone-900">{role.name}</p>
                        <p className="text-xs text-stone-500">{role.band} · SDA ceiling {fmt(role.ceiling)}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${RISK_COLOR[risk]}`}>
                        {riskLabel}
                      </span>
                    </div>

                    <StackedBar counts={counts} total={totalSubs}/>

                    <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
                      {POSITIONS.map(pos => (
                        <div key={pos.value} className="text-center">
                          <p className={`inline-block px-2 py-0.5 rounded ${POS_COLOR[pos.value]} text-[11px] mb-1`}>{pos.label}</p>
                          <p className="font-mono text-sm text-stone-900">{counts[pos.value as keyof typeof counts]}</p>
                        </div>
                      ))}
                    </div>

                    {employing > 0 && (
                      <p className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-600 leading-relaxed">
                        <span className="font-medium text-stone-900">{employing}</span> of {totalSubs} responding practices employ this role.
                        {counts.below > 0 && <> <span className="text-amber-800 font-medium">{counts.below}</span> pay below the SDA ceiling — those substantive staff may be incentivised toward SDA work.</>}
                        {counts.below === 0 && employing > 0 && <> No reported parity risk: all employing practices pay at or above the ceiling.</>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {totalSubs > 0 && tab === 'raw' && (
              <div className="space-y-3">
                {submissions.map(s => (
                  <div key={s.id} className="bg-white border border-stone-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {s.is_anonymous ? (
                          <>
                            <Lock size={14} className="text-stone-400"/>
                            <p className="font-medium text-stone-500 text-sm italic">Anonymous response</p>
                          </>
                        ) : (
                          <p className="font-medium text-stone-900 text-sm">{s.practice}</p>
                        )}
                        <p className="text-xs text-stone-500">· {new Date(s.submitted_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                      </div>
                      <button
                        onClick={() => deleteSubmission(s.id)}
                        className="text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      {ROLES.map(r => {
                        const v = s.responses?.[r.id];
                        const pos = POSITIONS.find(p => p.value === v);
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-stone-50 rounded">
                            <span className="text-stone-700 truncate">{r.short}</span>
                            <span className={`px-1.5 py-0.5 rounded ${POS_COLOR[v || ''] || 'bg-stone-200 text-stone-600'} text-[10px]`}>
                              {pos?.label || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {s.risk_flag && (
                      <div className="mt-2 pt-2 border-t border-stone-100 flex gap-2">
                        <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5"/>
                        <p className="text-xs text-stone-700 italic">"{s.risk_flag}"</p>
                      </div>
                    )}
                    {Object.entries(s.comments || {}).filter(([, c]) => c).map(([rid, c]) => {
                      const r = ROLES.find(rr => rr.id === rid);
                      return (
                        <p key={rid} className="text-xs text-stone-600 mt-1">
                          <span className="font-medium">{r?.short}:</span> {c}
                        </p>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function StackedBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (total === 0) return null;
  const segs = [
    { key: 'na',    color: 'bg-stone-300'   },
    { key: 'below', color: 'bg-amber-400'   },
    { key: 'at',    color: 'bg-emerald-500' },
    { key: 'above', color: 'bg-sky-500'     },
  ];
  return (
    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-stone-100">
      {segs.map(s => {
        const w = (counts[s.key] / total) * 100;
        if (w === 0) return null;
        return <div key={s.key} className={s.color} style={{ width: `${w}%` }}/>;
      })}
    </div>
  );
}
