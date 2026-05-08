import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AGEWELL_PRACTICES, AGEWELL_AREAS } from "@/data/agewellPractices";

type YN = "yes" | "no";
type YNU = "yes" | "no" | "unsure";
type YNUNA = "yes" | "no" | "unsure" | "not_applicable";
type Agree = "agree" | "neutral" | "disagree";
type Completed = "with_support_worker" | "on_my_own";

const STORAGE_KEY = "agewell-feedback-draft-v1";
const FONT_KEY = "agewell-font-scale";
const CONTRAST_KEY = "agewell-high-contrast";

const STYLES = `
.aw-root :where(*) { box-sizing: border-box; margin: 0; padding: 0; }
.aw-root {
  --teal:#4DB6A6;--teal-dark:#2F8C7E;--teal-pale:#E6F4F1;
  --navy:#1A3A5C;--ink:#1E293B;--muted:#64748B;
  --bg:#F4FAFB;--white:#FFFFFF;--line:#CBD5E1;--coral:#E76F51;
  --shadow:0 1px 2px rgba(15,37,64,.05),0 4px 16px rgba(15,37,64,.07);
  --radius:14px;--radius-sm:10px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;
  color:var(--ink);background:var(--bg);line-height:1.5;
  height:100vh;height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  font-size:17px;
}
@media (min-width:768px){ .aw-root{font-size:16px;} }
.aw-root.font-115 { font-size:19.5px; }
.aw-root.font-130 { font-size:22px; }
.aw-root.high-contrast { --bg:#FFFFFF;--white:#FFFFFF;--ink:#000;--muted:#222;--line:#000;--teal:#006B5F;--teal-dark:#003B33;--teal-pale:#E6F4F1;--navy:#000; }
.aw-root button { font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;font-size:inherit; }
.aw-root .topbar { background:var(--white);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10; }
.aw-root .topbar-inner { max-width:760px;margin:0 auto;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap; }
.aw-root .brand { display:flex;align-items:center;gap:10px;font-weight:700;color:var(--navy);font-size:0.85em;letter-spacing:0.3px; }
.aw-root .brand-dot { width:12px;height:12px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px var(--teal-pale); }
.aw-root .a11y { display:flex;align-items:center;gap:6px; }
.aw-root .a11y button { padding:6px 10px;border-radius:8px;background:var(--teal-pale);color:var(--teal-dark);font-weight:700;font-size:0.8em;min-width:38px;min-height:38px; }
.aw-root .a11y button.active { background:var(--teal);color:#fff; }
.aw-root .wrap { max-width:760px;margin:0 auto;padding:24px 18px 60px; }
.aw-root .header-band { background:linear-gradient(135deg,var(--teal),var(--teal-dark));color:#fff;padding:24px 22px;border-radius:var(--radius);margin-bottom:18px; }
.aw-root .header-band h1 { font-size:1.5em;font-weight:800;letter-spacing:-0.3px;margin-bottom:6px;line-height:1.2; }
.aw-root .header-band p { color:#E6F4F1;font-size:0.95em;line-height:1.55; }
.aw-root .intro { background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:22px;margin-bottom:14px; }
.aw-root .intro p { color:var(--ink);font-size:1em;line-height:1.6;margin-bottom:10px; }
.aw-root .intro .a11y-note { color:var(--muted);font-size:0.85em;line-height:1.5; }
.aw-root .progress-text { color:var(--teal-dark);font-weight:700;font-size:0.85em;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;text-align:center; }
.aw-root .progress-bar { background:var(--line);border-radius:100px;height:6px;overflow:hidden;margin-bottom:18px; }
.aw-root .progress-bar > div { background:var(--teal);height:100%;transition:width .35s; }
.aw-root .qcard { background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:22px 20px;margin-bottom:14px;animation:awin .3s ease; }
@keyframes awin { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
.aw-root .qnum { color:var(--teal-dark);font-size:0.75em;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px; }
.aw-root .qtext { color:var(--navy);font-weight:700;font-size:1.05em;line-height:1.35;margin-bottom:14px; }
.aw-root .qtext em { font-style:italic;font-weight:600;color:var(--ink); }
.aw-root .qtext .req { color:var(--coral);margin-left:3px; }
.aw-root .options { display:grid;grid-template-columns:1fr;gap:8px; }
.aw-root .opt { display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--white);border:2px solid var(--line);border-radius:var(--radius-sm);text-align:left;width:100%;min-height:48px;transition:border-color .15s,background .15s;font-size:0.95em;color:var(--ink);font-weight:500; }
.aw-root .opt:hover { border-color:var(--teal); }
.aw-root .opt.selected { border-color:var(--teal);background:var(--teal-pale);font-weight:600;color:var(--navy); }
.aw-root .opt-radio { width:22px;height:22px;border-radius:50%;border:2px solid var(--line);flex-shrink:0;position:relative; }
.aw-root .opt.selected .opt-radio { border-color:var(--teal); }
.aw-root .opt.selected .opt-radio::after { content:'';position:absolute;inset:4px;border-radius:50%;background:var(--teal); }
.aw-root .stars { display:flex;gap:6px;flex-wrap:wrap; }
.aw-root .star { display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:2px solid var(--line);background:var(--white);border-radius:var(--radius-sm);min-width:60px;min-height:64px;transition:all .15s; }
.aw-root .star:hover { border-color:var(--teal); }
.aw-root .star.selected { border-color:var(--teal);background:var(--teal-pale); }
.aw-root .star-glyph { font-size:1.3em;line-height:1; }
.aw-root .star-num { font-size:0.75em;font-weight:700;color:var(--muted); }
.aw-root .star.selected .star-num { color:var(--teal-dark); }
.aw-root .star-scale { display:flex;justify-content:space-between;color:var(--muted);font-size:0.78em;margin-top:8px; }
.aw-root .textarea-wrap textarea { width:100%;min-height:96px;padding:12px 14px;border:2px solid var(--line);border-radius:var(--radius-sm);font-family:inherit;font-size:0.95em;line-height:1.5;color:var(--ink);resize:vertical;background:var(--white);transition:border-color .15s; }
.aw-root .textarea-wrap textarea:focus { outline:none;border-color:var(--teal); }
.aw-root .char-count { font-size:0.8em;color:var(--muted);text-align:right;margin-top:6px; }
.aw-root .combo { position:relative; }
.aw-root .combo input { width:100%;padding:13px 14px;border:2px solid var(--line);border-radius:var(--radius-sm);font-family:inherit;font-size:0.95em;background:var(--white);color:var(--ink); }
.aw-root .combo input:focus { outline:none;border-color:var(--teal); }
.aw-root .combo-results { position:absolute;left:0;right:0;top:calc(100% + 4px);background:var(--white);border:2px solid var(--teal);border-radius:var(--radius-sm);max-height:280px;overflow-y:auto;z-index:50;box-shadow:var(--shadow); }
.aw-root .combo-area { padding:6px 14px;color:var(--teal-dark);font-style:italic;font-weight:700;font-size:0.78em;text-transform:uppercase;letter-spacing:1px;background:var(--teal-pale); }
.aw-root .combo-item { display:block;width:100%;text-align:left;padding:10px 14px;border-top:1px solid var(--line);font-size:0.95em;color:var(--ink); }
.aw-root .combo-item:hover, .aw-root .combo-item.active { background:var(--teal-pale);color:var(--navy);font-weight:600; }
.aw-root .combo-item.freeform { font-style:italic;color:var(--muted); }
.aw-root .selected-pill { display:inline-flex;align-items:center;gap:8px;background:var(--teal-pale);color:var(--teal-dark);padding:6px 12px;border-radius:100px;font-size:0.85em;font-weight:600;margin-top:8px; }
.aw-root .selected-pill button { color:var(--teal-dark);font-size:1em; }
.aw-root .submit-area { background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-top:6px; }
.aw-root .btn-submit { display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:var(--teal);color:#fff;font-weight:800;font-size:1.05em;padding:16px 22px;border-radius:100px;transition:all .15s;-webkit-tap-highlight-color:transparent;min-height:54px; }
.aw-root .btn-submit:hover:not(:disabled) { background:var(--teal-dark); }
.aw-root .btn-submit:disabled { background:var(--line);color:var(--muted);cursor:not-allowed; }
.aw-root .err { color:var(--coral);font-size:0.88em;margin-top:10px;text-align:center;font-weight:600; }
.aw-root .missing-list { color:var(--muted);font-size:0.85em;margin-top:8px;text-align:center; }
.aw-root .spinner { width:18px;height:18px;border:2.5px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:awspin .8s linear infinite; }
@keyframes awspin { to{transform:rotate(360deg);} }
.aw-root .thanks { text-align:center;background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:36px 22px; }
.aw-root .thanks-tick { width:80px;height:80px;margin:0 auto 18px;border-radius:50%;background:var(--teal-pale);display:flex;align-items:center;justify-content:center;animation:awpop .5s ease; }
.aw-root .thanks-tick svg { width:42px;height:42px;color:var(--teal); }
@keyframes awpop { 0%{transform:scale(0.5);opacity:0;} 60%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
.aw-root .thanks h2 { color:var(--navy);font-size:1.4em;margin-bottom:12px; }
.aw-root .thanks p { color:var(--muted);line-height:1.55;max-width:460px;margin:0 auto 20px; }
.aw-root .thanks a { color:var(--teal-dark);font-weight:700;text-decoration:underline; }
.aw-root .footer-note { text-align:center;color:var(--muted);font-size:0.78em;margin-top:18px;line-height:1.6; }
.aw-root .honeypot { position:absolute;left:-9999px;width:1px;height:1px;opacity:0; }
@media (max-width:480px){
  .aw-root .wrap { padding:18px 14px 44px; }
  .aw-root .header-band { padding:20px 18px; }
  .aw-root .header-band h1 { font-size:1.35em; }
  .aw-root .qcard { padding:18px 16px; }
  .aw-root .star { min-width:52px; }
}
`;

const PRACTICES_BY_AREA = AGEWELL_AREAS.map((area) => ({
  area,
  items: AGEWELL_PRACTICES
    .filter((p) => p.area === area)
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB")),
}));

const QUESTIONS_TOTAL = 13;

interface FormState {
  practiceId: string | null;
  practiceLabel: string | null;
  practiceFreeform: string;
  branchSite: string;
  q2_supportRating: number | null;
  q3_equipment: YNU | null;
  q4_signposted: YN | null;
  q5_onlineMeeting: YNUNA | null;
  q6_medicineReview: YNUNA | null;
  q7_listened: Agree | null;
  q8_independent: Agree | null;
  q9_difference: string;
  q10_overall: number | null;
  q11_recommend: YNU | null;
  q12_suggestions: string;
  q13_completed: Completed | null;
}

const EMPTY_STATE: FormState = {
  practiceId: null, practiceLabel: null, practiceFreeform: "", branchSite: "",
  q2_supportRating: null, q3_equipment: null, q4_signposted: null,
  q5_onlineMeeting: null, q6_medicineReview: null,
  q7_listened: null, q8_independent: null,
  q9_difference: "", q10_overall: null, q11_recommend: null,
  q12_suggestions: "", q13_completed: null,
};

function StarRating({ value, onChange, idLabel }: { value: number | null; onChange: (n: number) => void; idLabel: string }) {
  const labels = ["1 of 5 — Poor", "2 of 5", "3 of 5", "4 of 5", "5 of 5 — Excellent"];
  return (
    <div>
      <div className="stars" role="radiogroup" aria-label={idLabel}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star${value === n ? " selected" : ""}`}
            role="radio"
            aria-checked={value === n}
            aria-label={labels[n - 1]}
            onClick={() => onChange(n)}
          >
            <span className="star-glyph" aria-hidden="true">{value !== null && n <= value ? "★" : "☆"}</span>
            <span className="star-num">{n}</span>
          </button>
        ))}
      </div>
      <div className="star-scale"><span>1 = Poor</span><span>5 = Excellent</span></div>
    </div>
  );
}

function Radios<T extends string>({
  options, value, onChange, name,
}: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; name: string }) {
  return (
    <div className="options" role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const sel = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            className={`opt${sel ? " selected" : ""}`}
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(o.value)}
          >
            <span className="opt-radio" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PracticeCombobox({
  state, setState,
}: { state: FormState; setState: (s: FormState | ((prev: FormState) => FormState)) => void }) {
  const [query, setQuery] = useState(state.practiceLabel ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PRACTICES_BY_AREA;
    return PRACTICES_BY_AREA.map((g) => ({
      area: g.area,
      items: g.items.filter((p) => p.name.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const showFreeformInput = state.practiceId === "__freeform";

  return (
    <div className="combo" ref={ref}>
      <input
        type="text"
        value={query}
        placeholder="Type to search…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setState((s) => ({ ...s, practiceId: null, practiceLabel: null }));
        }}
        aria-label="Choose your registered GP surgery"
      />
      {open && (
        <div className="combo-results" role="listbox">
          {filtered.map((g) => (
            <div key={g.area}>
              <div className="combo-area">{g.area}</div>
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`combo-item${state.practiceId === p.id ? " active" : ""}`}
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      practiceId: p.id,
                      practiceLabel: p.name,
                      practiceFreeform: "",
                    }));
                    setQuery(p.name);
                    setOpen(false);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            className="combo-item freeform"
            onClick={() => {
              setState((s) => ({ ...s, practiceId: "__freeform", practiceLabel: null }));
              setOpen(false);
            }}
          >
            My practice isn't listed — I'll type it in
          </button>
        </div>
      )}
      {state.practiceLabel && state.practiceId !== "__freeform" && (
        <div className="selected-pill">
          ✓ {state.practiceLabel}
          <button
            type="button"
            aria-label="Clear practice"
            onClick={() => { setState((s) => ({ ...s, practiceId: null, practiceLabel: null })); setQuery(""); }}
          >×</button>
        </div>
      )}
      {showFreeformInput && (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={state.practiceFreeform}
            placeholder="Type your practice name…"
            onChange={(e) => setState((s) => ({ ...s, practiceFreeform: e.target.value }))}
            aria-label="Type your practice name"
            maxLength={150}
          />
        </div>
      )}
    </div>
  );
}

export default function AgewellFeedback() {
  const [state, setStateRaw] = useState<FormState>(EMPTY_STATE);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [fontScale, setFontScale] = useState<100 | 115 | 130>(100);
  const [highContrast, setHighContrast] = useState(false);

  const setState: typeof setStateRaw = (v) => {
    setStateRaw(v as any);
    setMissingFields([]);
    setError(null);
  };

  // Persist draft
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setStateRaw(JSON.parse(raw));
    } catch (_) { /* ignore */ }
    try {
      const fs = localStorage.getItem(FONT_KEY);
      if (fs === "115" || fs === "130" || fs === "100") setFontScale(parseInt(fs, 10) as any);
      const hc = localStorage.getItem(CONTRAST_KEY);
      if (hc === "1") setHighContrast(true);
    } catch (_) { /* ignore */ }
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
  }, [state]);

  useEffect(() => {
    try { localStorage.setItem(FONT_KEY, String(fontScale)); } catch (_) { /* ignore */ }
  }, [fontScale]);

  useEffect(() => {
    try { localStorage.setItem(CONTRAST_KEY, highContrast ? "1" : "0"); } catch (_) { /* ignore */ }
  }, [highContrast]);

  // Page metadata + noindex
  useEffect(() => {
    const prev = document.title;
    document.title = "Ageing Well Patient Feedback";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.title = prev; meta.remove(); };
  }, []);

  // Progress count: how many of the 13 are answered
  const progress = useMemo(() => {
    let n = 0;
    if (state.practiceLabel || state.practiceFreeform.trim()) n++;
    if (state.q2_supportRating) n++;
    if (state.q3_equipment) n++;
    if (state.q4_signposted) n++;
    if (state.q5_onlineMeeting) n++;
    if (state.q6_medicineReview) n++;
    if (state.q7_listened) n++;
    if (state.q8_independent) n++;
    if (state.q9_difference.trim()) n++;
    if (state.q10_overall) n++;
    if (state.q11_recommend) n++;
    if (state.q12_suggestions.trim()) n++; // optional but counted for progress display
    if (state.q13_completed) n++;
    return n;
  }, [state]);

  const validate = (): string[] => {
    const missing: string[] = [];
    if (!state.practiceLabel && !state.practiceFreeform.trim()) missing.push("Q1 Practice");
    if (!state.q2_supportRating) missing.push("Q2 Support worker rating");
    if (!state.q3_equipment) missing.push("Q3 Equipment");
    if (!state.q4_signposted) missing.push("Q4 Signposted");
    if (!state.q5_onlineMeeting) missing.push("Q5 Online meeting");
    if (!state.q6_medicineReview) missing.push("Q6 Medicine review");
    if (!state.q7_listened) missing.push("Q7 Listened to concerns");
    if (!state.q8_independent) missing.push("Q8 More independent");
    if (!state.q9_difference.trim()) missing.push("Q9 Most significant difference");
    if (!state.q10_overall) missing.push("Q10 Overall rating");
    if (!state.q11_recommend) missing.push("Q11 Would recommend");
    if (!state.q13_completed) missing.push("Q13 Completed with support");
    return missing;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (honeypot.trim().length > 0) { setSubmitted(true); return; }

    const missing = validate();
    if (missing.length > 0) {
      setMissingFields(missing);
      setError("Please answer all required questions before submitting.");
      // Scroll to first missing
      setTimeout(() => {
        const el = document.querySelector(".aw-root .qcard.has-error");
        if (el) (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-agewell-feedback", {
        body: {
          practice_canonical: state.practiceLabel ?? null,
          practice_label_freeform: !state.practiceLabel ? state.practiceFreeform.trim() || null : null,
          branch_site: state.branchSite.trim() || null,
          support_worker_rating: state.q2_supportRating,
          equipment_provided: state.q3_equipment,
          signposted: state.q4_signposted,
          online_meeting_concerns_discussed: state.q5_onlineMeeting,
          medicine_review_beneficial: state.q6_medicineReview,
          listened_to_concerns: state.q7_listened,
          more_independent: state.q8_independent,
          most_significant_difference: state.q9_difference.trim(),
          overall_rating: state.q10_overall,
          would_recommend: state.q11_recommend,
          suggestions_concerns: state.q12_suggestions.trim() || null,
          completed_with_support: state.q13_completed,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          honeypot: "",
        },
      });
      if (error || !(data as any)?.success) throw new Error((error as any)?.message || "Submission failed");
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_e) {
      setError("Something went wrong. Please try again. If it keeps happening, please tell the Ageing Well team.");
    } finally {
      setSubmitting(false);
    }
  };

  const rootClass = `aw-root${fontScale === 115 ? " font-115" : fontScale === 130 ? " font-130" : ""}${highContrast ? " high-contrast" : ""}`;

  return (
    <div className={rootClass}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-dot" aria-hidden="true" />
            Ageing Well — Patient Feedback
          </div>
          <div className="a11y" role="group" aria-label="Accessibility options">
            <button
              type="button"
              className={fontScale === 100 ? "active" : ""}
              onClick={() => setFontScale(100)}
              aria-pressed={fontScale === 100}
              aria-label="Standard text size"
              title="Standard"
            >A</button>
            <button
              type="button"
              className={fontScale === 115 ? "active" : ""}
              onClick={() => setFontScale(115)}
              aria-pressed={fontScale === 115}
              aria-label="Larger text size"
              title="Larger"
            >A+</button>
            <button
              type="button"
              className={fontScale === 130 ? "active" : ""}
              onClick={() => setFontScale(130)}
              aria-pressed={fontScale === 130}
              aria-label="Largest text size"
              title="Largest"
            >A++</button>
            <button
              type="button"
              className={highContrast ? "active" : ""}
              onClick={() => setHighContrast((v) => !v)}
              aria-pressed={highContrast}
              aria-label="High contrast mode"
              title="High contrast"
            >◐</button>
          </div>
        </div>
      </header>

      <main className="wrap">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          className="honeypot"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />

        {submitted ? (
          <div className="thanks" aria-live="polite">
            <div className="thanks-tick" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 12.5 9.5 18 20 6.5" />
              </svg>
            </div>
            <h2>Thank you — your feedback has been received</h2>
            <p>Your responses are anonymous and will go straight to the Ageing Well team. They use this to improve the service for everyone.</p>
            <p><a href="https://gpnotewell.co.uk">Return to gpnotewell.co.uk</a></p>
          </div>
        ) : (
          <>
            <div className="header-band">
              <h1>Ageing Well Team Northamptonshire — Patient Feedback</h1>
              <p>Anonymous · Takes about 3 minutes · Your input shapes the service</p>
            </div>

            <div className="intro">
              <p>
                Thank you for allowing the Ageing Well Team to provide support for you.
                We are dedicated to meeting the needs of all our patients, and we value your input.
                Your feedback is important to us, and we would greatly appreciate any suggestions on how we can improve our services.
                If needed, your family, friends, or caregivers can assist you in completing the form.
                Please know that your feedback will be kept anonymous.
              </p>
              <p className="a11y-note">
                When you submit this form, it will not automatically collect your details like name and email address unless you provide it yourself.
              </p>
            </div>

            <div className="progress-text">Question {Math.min(progress + (progress < QUESTIONS_TOTAL ? 1 : 0), QUESTIONS_TOTAL)} of {QUESTIONS_TOTAL}</div>
            <div className="progress-bar"><div style={{ width: `${(progress / QUESTIONS_TOTAL) * 100}%` }} /></div>

            {/* Q1 */}
            <div className={`qcard${missingFields.includes("Q1 Practice") ? " has-error" : ""}`}>
              <div className="qnum">Question 1 of 13</div>
              <div className="qtext">What is the name of your Registered GP Surgery?<span className="req">*</span></div>
              <PracticeCombobox state={state} setState={setState} />
            </div>

            {/* Q2 */}
            <div className={`qcard${missingFields.includes("Q2 Support worker rating") ? " has-error" : ""}`}>
              <div className="qnum">Question 2 of 13</div>
              <div className="qtext">How would you rate the service provided by the Ageing Well support worker?<span className="req">*</span></div>
              <StarRating value={state.q2_supportRating} onChange={(n) => setState((s) => ({ ...s, q2_supportRating: n }))} idLabel="Support worker rating" />
            </div>

            {/* Q3 */}
            <div className={`qcard${missingFields.includes("Q3 Equipment") ? " has-error" : ""}`}>
              <div className="qnum">Question 3 of 13</div>
              <div className="qtext">Did your Ageing Well support worker assist you to get any specialist equipment? For example, a lifeline button or mobility aids?<span className="req">*</span></div>
              <Radios<YNU>
                options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Unsure" }]}
                value={state.q3_equipment}
                onChange={(v) => setState((s) => ({ ...s, q3_equipment: v }))}
                name="Equipment provided"
              />
            </div>

            {/* Q4 */}
            <div className={`qcard${missingFields.includes("Q4 Signposted") ? " has-error" : ""}`}>
              <div className="qnum">Question 4 of 13</div>
              <div className="qtext">Were you signposted to any other services? For example: Age UK, social prescriber, Get up and go classes, community groups?<span className="req">*</span></div>
              <Radios<YN>
                options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                value={state.q4_signposted}
                onChange={(v) => setState((s) => ({ ...s, q4_signposted: v }))}
                name="Signposted"
              />
            </div>

            {/* Q5 */}
            <div className={`qcard${missingFields.includes("Q5 Online meeting") ? " has-error" : ""}`}>
              <div className="qnum">Question 5 of 13</div>
              <div className="qtext">If you had a meeting online with a Doctor or any other health professional, did you have the opportunity to discuss all of your needs and concerns?<span className="req">*</span></div>
              <Radios<YNUNA>
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unsure", label: "Unsure" },
                  { value: "not_applicable", label: "Not applicable" },
                ]}
                value={state.q5_onlineMeeting}
                onChange={(v) => setState((s) => ({ ...s, q5_onlineMeeting: v }))}
                name="Online meeting"
              />
            </div>

            {/* Q6 */}
            <div className={`qcard${missingFields.includes("Q6 Medicine review") ? " has-error" : ""}`}>
              <div className="qnum">Question 6 of 13</div>
              <div className="qtext">If you had a medicine review during the meeting, did you find it beneficial?<span className="req">*</span></div>
              <Radios<YNUNA>
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unsure", label: "Unsure" },
                  { value: "not_applicable", label: "Not applicable" },
                ]}
                value={state.q6_medicineReview}
                onChange={(v) => setState((s) => ({ ...s, q6_medicineReview: v }))}
                name="Medicine review"
              />
            </div>

            {/* Q7 */}
            <div className={`qcard${missingFields.includes("Q7 Listened to concerns") ? " has-error" : ""}`}>
              <div className="qnum">Question 7 of 13</div>
              <div className="qtext">
                Please specify to what extent you agree with the following statement:<br />
                <em>I feel confident that the Ageing Well workers listened to my concerns and needs.</em>
                <span className="req">*</span>
              </div>
              <Radios<Agree>
                options={[
                  { value: "agree", label: "Agree" },
                  { value: "neutral", label: "Neutral or Don't know" },
                  { value: "disagree", label: "Disagree" },
                ]}
                value={state.q7_listened}
                onChange={(v) => setState((s) => ({ ...s, q7_listened: v }))}
                name="Listened to concerns"
              />
            </div>

            {/* Q8 */}
            <div className={`qcard${missingFields.includes("Q8 More independent") ? " has-error" : ""}`}>
              <div className="qnum">Question 8 of 13</div>
              <div className="qtext">
                Please specify to what extent you agree with the following statement:<br />
                <em>I feel more independent and confident in my own home.</em>
                <span className="req">*</span>
              </div>
              <Radios<Agree>
                options={[
                  { value: "agree", label: "Agree" },
                  { value: "neutral", label: "Neutral or Don't know" },
                  { value: "disagree", label: "Disagree" },
                ]}
                value={state.q8_independent}
                onChange={(v) => setState((s) => ({ ...s, q8_independent: v }))}
                name="More independent"
              />
            </div>

            {/* Q9 */}
            <div className={`qcard${missingFields.includes("Q9 Most significant difference") ? " has-error" : ""}`}>
              <div className="qnum">Question 9 of 13</div>
              <div className="qtext">What has been the most significant difference the Ageing Well Team has made for you?<span className="req">*</span></div>
              <div className="textarea-wrap">
                <textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Please tell us in your own words…"
                  value={state.q9_difference}
                  onChange={(e) => setState((s) => ({ ...s, q9_difference: e.target.value }))}
                  aria-label="Most significant difference"
                />
                <div className="char-count">{state.q9_difference.length} / 1000</div>
              </div>
            </div>

            {/* Q10 */}
            <div className={`qcard${missingFields.includes("Q10 Overall rating") ? " has-error" : ""}`}>
              <div className="qnum">Question 10 of 13</div>
              <div className="qtext">How would you rate the Ageing Well Service?<span className="req">*</span></div>
              <StarRating value={state.q10_overall} onChange={(n) => setState((s) => ({ ...s, q10_overall: n }))} idLabel="Overall rating" />
            </div>

            {/* Q11 */}
            <div className={`qcard${missingFields.includes("Q11 Would recommend") ? " has-error" : ""}`}>
              <div className="qnum">Question 11 of 13</div>
              <div className="qtext">Would you recommend this service to anyone else?<span className="req">*</span></div>
              <Radios<YNU>
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unsure", label: "Unsure" },
                ]}
                value={state.q11_recommend}
                onChange={(v) => setState((s) => ({ ...s, q11_recommend: v }))}
                name="Would recommend"
              />
            </div>

            {/* Q12 */}
            <div className="qcard">
              <div className="qnum">Question 12 of 13</div>
              <div className="qtext">Do you have any suggestions on how we could improve our service, or would you like to share any concerns or negative experiences?</div>
              <div className="textarea-wrap">
                <textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Optional — leave blank if none."
                  value={state.q12_suggestions}
                  onChange={(e) => setState((s) => ({ ...s, q12_suggestions: e.target.value }))}
                  aria-label="Suggestions or concerns"
                />
                <div className="char-count">{state.q12_suggestions.length} / 1000</div>
              </div>
            </div>

            {/* Q13 */}
            <div className={`qcard${missingFields.includes("Q13 Completed with support") ? " has-error" : ""}`}>
              <div className="qnum">Question 13 of 13</div>
              <div className="qtext">Did you receive any support when completing this feedback form?<span className="req">*</span></div>
              <Radios<Completed>
                options={[
                  { value: "with_support_worker", label: "Yes – I completed it with the support from an Ageing Well Support Worker" },
                  { value: "on_my_own", label: "No – I completed it on my own" },
                ]}
                value={state.q13_completed}
                onChange={(v) => setState((s) => ({ ...s, q13_completed: v }))}
                name="Completed with support"
              />
            </div>

            <div className="submit-area">
              <button
                type="button"
                className="btn-submit"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (<><span className="spinner" /> Submitting…</>) : "Submit feedback"}
              </button>
              {error && <div className="err">{error}</div>}
              {missingFields.length > 0 && (
                <div className="missing-list">Missing: {missingFields.join(", ")}</div>
              )}
            </div>

            <div className="footer-note">
              Anonymous submission. No names, NHS numbers or contact details are collected.<br />
              Ageing Well Team Northamptonshire · gpnotewell.co.uk/agewell/feedback
            </div>
          </>
        )}
      </main>
    </div>
  );
}
