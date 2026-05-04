import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS } from '@/data/nresPractices';

const PRACTICES = NRES_PRACTICE_KEYS
  .filter(k => k !== 'bt_pcn')
  .map(k => NRES_PRACTICES[k]);

const ROLES = [
  { id: 'anp',       name: 'Advanced Nurse Practitioner',     band: 'Band 8a', ceiling: 60411 },
  { id: 'acp',       name: 'Advanced Clinical Practitioner',  band: 'Band 8a', ceiling: 60411 },
  { id: 'pharm',     name: 'Clinical Pharmacist',             band: 'Band 7',  ceiling: 55173 },
  { id: 'paramedic', name: 'Paramedic',                       band: 'Band 7',  ceiling: 53473 },
];

const POSITIONS = [
  { value: 'na',    label: 'Not employed',  desc: "We don't employ this role"            },
  { value: 'below', label: 'Below ceiling', desc: 'Practice top-of-pay sits below it'    },
  { value: 'at',    label: 'At ceiling',    desc: 'Practice top-of-pay matches it'       },
  { value: 'above', label: 'Above ceiling', desc: 'Practice top-of-pay sits above it'    },
];

const fmt = (n: number) => '£' + n.toLocaleString('en-GB');

type ResponsesMap = Record<string, string>;
type CommentsMap = Record<string, string>;

export default function PayAlignmentSurvey() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<'loading' | 'invalid' | 'form' | 'thanks'>('loading');
  const [identifyMode, setIdMode] = useState<'' | 'identify' | 'anonymous'>('');
  const [practice, setPractice] = useState('');
  const [responses, setResponses] = useState<ResponsesMap>({});
  const [comments, setComments] = useState<CommentsMap>({});
  const [riskFlag, setRiskFlag] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validate survey token
  useEffect(() => {
    if (!token) { setView('invalid'); return; }
    (async () => {
      const { data } = await supabase
        .from('nres_pay_alignment_surveys')
        .select('id, is_active, closed_at')
        .eq('token', token)
        .maybeSingle();
      if (!data || !data.is_active || data.closed_at) {
        setView('invalid');
      } else {
        setView('form');
      }
    })();
  }, [token]);

  const allRolesAnswered = ROLES.every(r => responses[r.id]);
  const idComplete = identifyMode === 'anonymous' || (identifyMode === 'identify' && practice);
  const canSubmit = idComplete && allRolesAnswered;

  const submit = async () => {
    if (!canSubmit || !token) return;
    setLoading(true);
    setErrorMsg(null);
    const isAnon = identifyMode === 'anonymous';
    try {
      const { data, error } = await supabase.functions.invoke('submit-pay-alignment', {
        body: {
          token,
          practice: isAnon ? null : practice,
          isAnonymous: isAnon,
          responses,
          comments,
          riskFlag,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setView('thanks');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not submit your response. Please try again.');
    }
    setLoading(false);
  };

  const reset = () => {
    setIdMode(''); setPractice(''); setResponses({}); setComments({}); setRiskFlag('');
    setErrorMsg(null);
    setView('form');
  };

  const Header = () => (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-stone-900 text-stone-50 flex items-center justify-center">
          <FileText size={18} />
        </div>
        <div>
          <p className="font-serif text-lg leading-tight text-stone-900">NRES SDA Workforce Alignment</p>
          <p className="text-xs text-stone-500">Northamptonshire Rural East &amp; South · NMoC SDA Pilot</p>
        </div>
      </div>
    </header>
  );

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 font-sans flex items-center justify-center">
        <p className="text-stone-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (view === 'invalid') {
    return (
      <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className="font-serif text-2xl text-stone-900 mb-3">This survey is no longer active</h1>
          <p className="text-stone-600 max-w-md mx-auto">
            The link you used has been closed or is invalid. Please contact the Programme Lead if you believe this is in error.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'thanks') {
    return (
      <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-6">
            <Check size={28} strokeWidth={2.5}/>
          </div>
          <h1 className="font-serif text-3xl text-stone-900 mb-3">Response received</h1>
          <p className="text-stone-600 max-w-md mx-auto leading-relaxed">
            Thank you. Your data sits with the Programme Lead and Operations Manager only.
            The PM group and Programme Board will see aggregated counts across all practices — never your practice's individual figures.
          </p>
          <button
            onClick={reset}
            className="mt-8 px-5 py-2.5 rounded-md bg-stone-900 text-stone-50 text-sm hover:bg-stone-700"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">Practice manager survey</p>
          <h1 className="font-serif text-3xl text-stone-900 leading-tight mb-3">
            Pay alignment check for SDA-eligible roles
          </h1>
          <p className="text-stone-600 leading-relaxed">
            We're checking how Same Day Access reclaim ceilings sit against your practice's actual pay scales — to surface any workforce parity risks before claims go live. We are <span className="italic">not</span> asking for salary figures.
          </p>
        </div>

        <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 mb-8 flex gap-4">
          <ShieldCheck size={22} className="text-emerald-700 shrink-0 mt-0.5"/>
          <div className="text-sm text-emerald-950 leading-relaxed">
            <p className="font-medium mb-1.5">Your data, your control</p>
            <ul className="space-y-1 text-emerald-900">
              <li>· You choose whether to identify your practice or submit fully anonymously.</li>
              <li>· If identified, only Malcolm Railson and Amanda Taylor see your individual response.</li>
              <li>· The PM group and Programme Board see aggregated counts only ("4 of 7 practices…").</li>
              <li>· No salary figures are requested or stored.</li>
              <li>· Takes 2 minutes. Four roles, one position per role.</li>
            </ul>
          </div>
        </div>

        <section className="mb-8">
          <label className="block text-sm font-medium text-stone-900 mb-3">How would you like to submit?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setIdMode('identify')}
              className={`text-left px-4 py-3 rounded-md border transition ${
                identifyMode === 'identify'
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400'
              }`}
            >
              <p className="font-medium text-sm leading-tight">Identify my practice</p>
              <p className={`text-xs mt-1 leading-snug ${identifyMode === 'identify' ? 'text-stone-300' : 'text-stone-500'}`}>
                Only Malcolm Railson (Digital & Estates Lead) and Amanda Taylor (Managerial Lead) see which practice responded. Helps us follow up if anything needs clarifying.
              </p>
            </button>
            <button
              onClick={() => { setIdMode('anonymous'); setPractice(''); }}
              className={`text-left px-4 py-3 rounded-md border transition ${
                identifyMode === 'anonymous'
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400'
              }`}
            >
              <p className="font-medium text-sm leading-tight">Submit fully anonymously</p>
              <p className={`text-xs mt-1 leading-snug ${identifyMode === 'anonymous' ? 'text-stone-300' : 'text-stone-500'}`}>
                No practice name attached. Even Malcolm Railson (Digital & Estates Lead) and Amanda Taylor (Managerial Lead) won't know which practice responded.
              </p>
            </button>
          </div>

          {identifyMode === 'identify' && (
            <select
              value={practice}
              onChange={e => setPractice(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-md border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
            >
              <option value="">Select your practice…</option>
              {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-xl text-stone-900 mb-1">For each role, where does your top-of-pay sit?</h2>
          <p className="text-sm text-stone-600 mb-5">Relative to the Same Day Access reclaimable ceiling shown alongside.</p>

          <div className="space-y-4">
            {ROLES.map(role => (
              <div key={role.id} className="bg-white border border-stone-200 rounded-lg p-5">
                <div className="flex items-baseline justify-between mb-3 gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{role.name}</p>
                    <p className="text-xs text-stone-500">{role.band}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">SDA ceiling</p>
                    <p className="font-mono text-sm text-stone-900">{fmt(role.ceiling)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {POSITIONS.map(pos => {
                    const selected = responses[role.id] === pos.value;
                    return (
                      <button
                        key={pos.value}
                        onClick={() => setResponses({ ...responses, [role.id]: pos.value })}
                        className={`text-left px-3 py-2.5 rounded-md border text-sm transition ${
                          selected
                            ? 'border-stone-900 bg-stone-900 text-stone-50'
                            : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-400'
                        }`}
                      >
                        <p className="font-medium text-[13px] leading-tight">{pos.label}</p>
                        <p className={`text-[11px] mt-0.5 leading-tight ${selected ? 'text-stone-300' : 'text-stone-500'}`}>{pos.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {responses[role.id] && responses[role.id] !== 'na' && (
                  <input
                    type="text"
                    placeholder="Optional note (e.g. recruitment context, expected churn)"
                    value={comments[role.id] || ''}
                    onChange={e => setComments({ ...comments, [role.id]: e.target.value })}
                    className="mt-3 w-full px-3 py-2 rounded-md border border-stone-200 bg-stone-50 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-transparent"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <label className="block text-sm font-medium text-stone-900 mb-2">
            Any workforce parity or retention concerns? <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={riskFlag}
            onChange={e => setRiskFlag(e.target.value)}
            rows={3}
            placeholder="e.g. our nurses already ask why ARRS roles pay more; we'd struggle to backfill if SDA pulled staff…"
            className="w-full px-3.5 py-2.5 rounded-md border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
        </section>

        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-md border border-rose-200 bg-rose-50 text-sm text-rose-900">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-stone-200">
          <p className="text-xs text-stone-500">
            {canSubmit
              ? (identifyMode === 'anonymous' ? 'Ready to submit anonymously.' : 'Ready to submit.')
              : !identifyMode
                ? 'Choose identify or anonymous to begin.'
                : !idComplete
                  ? 'Select your practice to continue.'
                  : 'Pick a position for each role to enable submission.'}
          </p>
          <button
            disabled={!canSubmit || loading}
            onClick={submit}
            className={`px-5 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${
              canSubmit && !loading
                ? 'bg-stone-900 text-stone-50 hover:bg-stone-700'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Submitting…' : <>Submit response <ArrowRight size={16}/></>}
          </button>
        </div>

        <footer className="mt-12 text-center text-xs text-stone-400">
          Notewell · Built for NRES SDA Programme Board
        </footer>
      </main>
    </div>
  );
}
