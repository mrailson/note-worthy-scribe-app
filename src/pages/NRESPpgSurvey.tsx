import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Rating = "better" | "same" | "worse" | null;
type Followup = "couldnt-get-through" | "no-appointment" | "wait-too-long" | "other" | null;

const PRACTICES: Array<{ id: string; name: string; sub?: string }> = [
  { id: "brackley", name: "Brackley Medical Centre" },
  { id: "brook", name: "Brook Health Centre" },
  { id: "bugbrooke", name: "Bugbrooke Medical Centre" },
  { id: "denton", name: "Denton Village Surgery" },
  { id: "springfield", name: "Springfield Surgery" },
  { id: "parks", name: "The Parks Medical Practice", sub: "Including Grange Park, Blisworth, Roade and Hanslope" },
  { id: "towcester", name: "Towcester Medical Centre" },
  { id: "unsure", name: "I'm not sure / prefer not to say" },
];

const FOLLOWUPS: Array<{ id: Exclude<Followup, null>; label: string }> = [
  { id: "couldnt-get-through", label: "I couldn't get through on the phone" },
  { id: "no-appointment", label: "No appointment was offered" },
  { id: "wait-too-long", label: "I had to wait too long" },
  { id: "other", label: "Something else" },
];

const RATING_LABEL: Record<Exclude<Rating, null>, string> = {
  better: "Better",
  same: "The same",
  worse: "Worse",
};

const STYLES = `
.ppg-root :where(*) { box-sizing: border-box; margin: 0; padding: 0; }
.ppg-root {
  --navy:#1A3A5C;--navy-deep:#0F2540;--navy-soft:#2C547A;
  --teal:#2A9D8F;--teal-pale:#E6F4F1;--teal-dark:#1F7A6F;
  --coral:#E76F51;--coral-pale:#FBEAE3;--ink:#1E293B;--muted:#64748B;
  --pale:#F1F5F9;--line:#CBD5E1;--bg:#F8FAFC;--white:#FFFFFF;
  --shadow:0 1px 2px rgba(15,37,64,.05),0 4px 16px rgba(15,37,64,.07);
  --shadow-lg:0 4px 12px rgba(15,37,64,.08),0 16px 40px rgba(15,37,64,.10);
  --radius:14px;--radius-sm:10px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;
  color:var(--ink);background:var(--bg);line-height:1.5;min-height:100vh;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.ppg-root button { font-family:inherit;cursor:pointer;border:none;background:none;color:inherit; }
.ppg-root .topbar { background:var(--white);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10; }
.ppg-root .topbar-inner { max-width:720px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
.ppg-root .brand { display:flex;align-items:center;gap:10px;font-weight:700;color:var(--navy);font-size:14px;letter-spacing:0.3px; }
.ppg-root .brand-dot { width:10px;height:10px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 3px var(--teal-pale); }
.ppg-root .brand small { color:var(--muted);font-weight:500;font-size:12px;letter-spacing:0;margin-left:6px; }
.ppg-root .info-link { color:var(--teal-dark);font-weight:600;font-size:13px;background:var(--teal-pale);padding:6px 12px;border-radius:100px;transition:background .15s;white-space:nowrap; }
.ppg-root .info-link:hover { background:#D5EDE8; }
.ppg-root .wrap { max-width:720px;margin:0 auto;padding:28px 20px 60px; }
.ppg-root .progress { display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px;min-height:12px; }
.ppg-root .pdot { width:8px;height:8px;border-radius:50%;background:var(--line);transition:background .25s,transform .25s; }
.ppg-root .pdot.active { background:var(--teal);transform:scale(1.4); }
.ppg-root .pdot.done { background:var(--teal);opacity:0.5; }
.ppg-root .screen { background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);padding:32px 28px;animation:ppgfadein .35s ease; }
@keyframes ppgfadein { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
.ppg-root .eyebrow { color:var(--teal);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px; }
.ppg-root h1 { color:var(--navy);font-size:28px;line-height:1.2;letter-spacing:-0.4px;font-weight:700;margin-bottom:12px; }
.ppg-root h2 { color:var(--navy);font-size:22px;line-height:1.25;font-weight:700;margin-bottom:6px; }
.ppg-root .lede { color:var(--muted);font-size:16px;line-height:1.55;margin-bottom:24px; }
.ppg-root .nres-panel { background:var(--teal-pale);border-radius:var(--radius-sm);padding:18px 20px;margin-bottom:24px;border-left:4px solid var(--teal); }
.ppg-root .nres-panel-title { color:var(--teal-dark);font-weight:700;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px; }
.ppg-root .nres-panel-body { color:var(--ink);font-size:14.5px;line-height:1.55; }
.ppg-root .nres-panel-body strong { color:var(--navy); }
.ppg-root .btn-primary { display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--teal);color:var(--white);font-weight:700;font-size:16px;padding:16px 28px;border-radius:100px;width:100%;transition:background .15s,transform .05s;-webkit-tap-highlight-color:transparent; }
.ppg-root .btn-primary:hover:not(:disabled) { background:var(--teal-dark); }
.ppg-root .btn-primary:active { transform:scale(0.99); }
.ppg-root .btn-primary:disabled { background:var(--line);color:var(--muted);cursor:not-allowed; }
.ppg-root .btn-primary .arrow { font-size:18px;transition:transform .15s; }
.ppg-root .btn-primary:hover:not(:disabled) .arrow { transform:translateX(3px); }
.ppg-root .btn-secondary { color:var(--muted);font-weight:600;font-size:14px;padding:12px 16px;background:none; }
.ppg-root .btn-secondary:hover { color:var(--navy); }
.ppg-root .btn-row { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px; }
.ppg-root .btn-row .btn-primary { width:auto;flex:1; }
.ppg-root .practice-list { display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:8px; }
.ppg-root .practice-card { display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--white);border:2px solid var(--line);border-radius:var(--radius-sm);text-align:left;width:100%;transition:border-color .15s,background .15s;-webkit-tap-highlight-color:transparent; }
.ppg-root .practice-card:hover { border-color:var(--teal); }
.ppg-root .practice-card.selected { border-color:var(--teal);background:var(--teal-pale); }
.ppg-root .practice-radio { width:22px;height:22px;border-radius:50%;border:2px solid var(--line);flex-shrink:0;position:relative;transition:border-color .15s; }
.ppg-root .practice-card.selected .practice-radio { border-color:var(--teal); }
.ppg-root .practice-card.selected .practice-radio::after { content:'';position:absolute;inset:4px;border-radius:50%;background:var(--teal); }
.ppg-root .practice-name { font-weight:600;font-size:15.5px;color:var(--navy);line-height:1.3;display:block; }
.ppg-root .practice-sub { font-weight:500;font-size:13px;color:var(--muted);line-height:1.4;margin-top:3px;display:block; }
.ppg-root .practice-text { flex:1; }
.ppg-root .rating-options { display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:8px; }
.ppg-root .rating-card { display:flex;align-items:center;gap:16px;padding:20px 22px;background:var(--white);border:2px solid var(--line);border-radius:var(--radius-sm);text-align:left;width:100%;transition:border-color .15s,background .15s;-webkit-tap-highlight-color:transparent; }
.ppg-root .rating-card .face { font-size:32px;line-height:1;flex-shrink:0; }
.ppg-root .rating-card .label { font-size:18px;font-weight:700;color:var(--navy); }
.ppg-root .rating-card .sublabel { font-size:13px;color:var(--muted);font-weight:500;margin-top:2px; }
.ppg-root .rating-card[data-value="better"]:hover, .ppg-root .rating-card[data-value="better"].selected { border-color:var(--teal);background:var(--teal-pale); }
.ppg-root .rating-card[data-value="better"].selected .label { color:var(--teal-dark); }
.ppg-root .rating-card[data-value="same"]:hover, .ppg-root .rating-card[data-value="same"].selected { border-color:var(--navy);background:#EEF2F7; }
.ppg-root .rating-card[data-value="worse"]:hover, .ppg-root .rating-card[data-value="worse"].selected { border-color:var(--coral);background:var(--coral-pale); }
.ppg-root .rating-card[data-value="worse"].selected .label { color:var(--coral); }
.ppg-root .followup-options { display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:8px; }
.ppg-root .followup-card { display:flex;align-items:center;gap:14px;padding:16px 18px;background:var(--white);border:2px solid var(--line);border-radius:var(--radius-sm);text-align:left;width:100%;transition:border-color .15s,background .15s;-webkit-tap-highlight-color:transparent;font-size:15.5px;color:var(--ink);font-weight:500; }
.ppg-root .followup-card:hover { border-color:var(--coral); }
.ppg-root .followup-card.selected { border-color:var(--coral);background:var(--coral-pale);font-weight:600;color:var(--navy); }
.ppg-root .followup-check { width:22px;height:22px;border-radius:6px;border:2px solid var(--line);flex-shrink:0;position:relative;transition:border-color .15s,background .15s; }
.ppg-root .followup-card.selected .followup-check { border-color:var(--coral);background:var(--coral); }
.ppg-root .followup-card.selected .followup-check::after { content:'';position:absolute;left:5px;top:1px;width:7px;height:12px;border:solid var(--white);border-width:0 2.5px 2.5px 0;transform:rotate(45deg); }
.ppg-root .comment-area { width:100%;min-height:110px;padding:14px 16px;border:2px solid var(--line);border-radius:var(--radius-sm);font-family:inherit;font-size:15.5px;line-height:1.5;color:var(--ink);resize:vertical;background:var(--white);transition:border-color .15s; }
.ppg-root .comment-area:focus { outline:none;border-color:var(--teal); }
.ppg-root .comment-area::placeholder { color:var(--muted);opacity:0.7; }
.ppg-root .field-hint { font-size:13px;color:var(--muted);margin-top:8px;text-align:right; }
.ppg-root .submit-error { margin-top:12px;color:var(--coral);font-size:14px;text-align:center;font-weight:600; }
.ppg-root .confirm { text-align:center;padding:16px 0 8px; }
.ppg-root .confirm-tick { width:86px;height:86px;margin:0 auto 22px;border-radius:50%;background:var(--teal-pale);display:flex;align-items:center;justify-content:center;animation:ppgpop .5s ease; }
.ppg-root .confirm-tick svg { width:44px;height:44px;color:var(--teal); }
@keyframes ppgpop { 0%{transform:scale(0.6);opacity:0;} 60%{transform:scale(1.08);} 100%{transform:scale(1);opacity:1;} }
.ppg-root .confirm h1 { margin-bottom:14px; }
.ppg-root .confirm-body { color:var(--muted);font-size:16px;line-height:1.6;margin-bottom:28px;max-width:460px;margin-left:auto;margin-right:auto; }
.ppg-root .confirm-summary { text-align:left;background:var(--pale);border-radius:var(--radius-sm);padding:18px 22px;margin:0 0 24px;font-size:14.5px; }
.ppg-root .confirm-summary dt { color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px; }
.ppg-root .confirm-summary dd { color:var(--navy);font-weight:600;margin-bottom:12px;line-height:1.4; }
.ppg-root .confirm-summary dd:last-child { margin-bottom:0; }
.ppg-root .modal-overlay { display:none;position:fixed;inset:0;background:rgba(15,37,64,0.55);z-index:100;align-items:center;justify-content:center;padding:20px;animation:ppgfadein .2s ease; }
.ppg-root .modal-overlay.open { display:flex; }
.ppg-root .modal { background:var(--white);border-radius:var(--radius);max-width:540px;width:100%;max-height:90vh;overflow-y:auto;padding:28px 28px 24px;box-shadow:var(--shadow-lg); }
.ppg-root .modal h2 { color:var(--navy);font-size:22px;margin-bottom:4px; }
.ppg-root .modal-eyebrow { color:var(--teal);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px; }
.ppg-root .modal-body { color:var(--ink);font-size:15px;line-height:1.6;margin-top:14px; }
.ppg-root .modal-body p { margin-bottom:12px; }
.ppg-root .modal-body p:last-child { margin-bottom:0; }
.ppg-root .modal-body strong { color:var(--navy); }
.ppg-root .modal-stats { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 6px; }
.ppg-root .stat { background:var(--teal-pale);border-radius:10px;padding:14px 16px; }
.ppg-root .stat-num { color:var(--teal-dark);font-size:22px;font-weight:800;line-height:1;margin-bottom:4px; }
.ppg-root .stat-label { color:var(--ink);font-size:12.5px;line-height:1.3; }
.ppg-root .modal-close { margin-top:22px;background:var(--navy);color:var(--white);font-weight:700;padding:12px 22px;border-radius:100px;width:100%;font-size:15px;transition:background .15s; }
.ppg-root .modal-close:hover { background:var(--navy-deep); }
.ppg-root .page-footer { text-align:center;color:var(--muted);font-size:12.5px;margin-top:24px;line-height:1.6; }
.ppg-root .page-footer .badge { display:inline-block;background:var(--teal-pale);color:var(--teal-dark);font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:100px;margin-bottom:8px; }
.ppg-root .spinner { width:18px;height:18px;border:2.5px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:ppgspin 0.8s linear infinite; }
@keyframes ppgspin { to { transform:rotate(360deg); } }
@media (max-width:480px) {
  .ppg-root .wrap { padding:20px 14px 50px; }
  .ppg-root .screen { padding:26px 22px;border-radius:12px; }
  .ppg-root h1 { font-size:24px; }
  .ppg-root .lede { font-size:15px; }
  .ppg-root .topbar-inner { padding:12px 14px; }
  .ppg-root .brand small { display:none; }
  .ppg-root .info-link { padding:6px 10px;font-size:12.5px; }
  .ppg-root .modal { padding:24px 22px 22px;border-radius:14px; }
}
`;

export default function NRESPpgSurvey() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [practice, setPractice] = useState<{ id: string; label: string } | null>(null);
  const [rating, setRating] = useState<Rating>(null);
  const [followup, setFollowup] = useState<{ id: Exclude<Followup, null>; label: string } | null>(null);
  const [comment, setComment] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Page metadata + noindex
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "How was your same-day appointment? — NRES Patient Feedback";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.title = prevTitle;
      meta.remove();
    };
  }, []);

  // Smooth-scroll on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Esc closes modal
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const dots = useMemo(() => {
    if (step === 1 || step === 6) return null;
    const showFollowup = rating === "worse";
    const stepsList = showFollowup ? [2, 3, 4, 5] : [2, 3, 5];
    return stepsList.map((s) => {
      const isActive = s === step;
      const isDone = stepsList.indexOf(s) < stepsList.indexOf(step);
      return <div key={s} className={`pdot${isActive ? " active" : isDone ? " done" : ""}`} />;
    });
  }, [step, rating]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError(null);

    // Honeypot — silent thank-you, no submission
    if (honeypot.trim().length > 0) {
      setStep(6);
      return;
    }
    if (!practice || !rating) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-ppg-response", {
        body: {
          practice_id: practice.id,
          practice_label: practice.label,
          rating,
          followup_reason: rating === "worse" ? followup?.id ?? null : null,
          followup_label: rating === "worse" ? followup?.label ?? null : null,
          comment: comment.trim() ? comment.trim() : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          honeypot: "",
        },
      });
      if (error || !(data && (data as any).success)) {
        throw new Error((error as any)?.message || "Submission failed");
      }
      setStep(6);
    } catch (e) {
      setSubmitError("Something went wrong — please try again. If it keeps happening, please tell reception.");
    } finally {
      setSubmitting(false);
    }
  };

  const summaryComment = comment.trim().length > 140
    ? comment.trim().slice(0, 140) + "…"
    : comment.trim();

  return (
    <div className="ppg-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-dot" />
            NRES <small>Patient Feedback</small>
          </div>
          <button className="info-link" onClick={() => setModalOpen(true)}>What is NRES?</button>
        </div>
      </header>

      <main className="wrap">
        <div className="progress" aria-hidden="true">{dots}</div>

        {/* Honeypot */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />

        {step === 1 && (
          <section className="screen" aria-labelledby="welcome-title">
            <div className="eyebrow">SAME DAY ACCESS PILOT</div>
            <h1 id="welcome-title">How was your same-day appointment?</h1>
            <p className="lede">
              We'd love 30 seconds of your feedback. Your answers are completely
              anonymous — we don't ask for your name or any personal details.
            </p>
            <div className="nres-panel">
              <div className="nres-panel-title">First time hearing about NRES?</div>
              <div className="nres-panel-body">
                NRES stands for <strong>Northamptonshire Rural East &amp; South</strong> —
                a partnership of seven local GP practices working together to give patients
                easier same-day access and better long-term care.
              </div>
            </div>
            <button className="btn-primary" onClick={() => setStep(2)}>
              Start the survey <span className="arrow">→</span>
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="screen" aria-labelledby="practice-title">
            <div className="eyebrow">QUESTION 1 OF 2</div>
            <h2 id="practice-title">Which practice are you registered with?</h2>
            <p className="lede">This helps us understand feedback across the seven practices.</p>
            <div className="practice-list" role="radiogroup" aria-labelledby="practice-title">
              {PRACTICES.map((p) => {
                const selected = practice?.id === p.id;
                return (
                  <button
                    key={p.id}
                    className={`practice-card${selected ? " selected" : ""}`}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPractice({ id: p.id, label: p.name })}
                  >
                    <span className="practice-radio" />
                    <span className="practice-text">
                      <span className="practice-name">{p.name}</span>
                      {p.sub && <span className="practice-sub">{p.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="btn-row">
              <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-primary" disabled={!practice} onClick={() => setStep(3)}>
                Continue <span className="arrow">→</span>
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="screen" aria-labelledby="rating-title">
            <div className="eyebrow">QUESTION 2 OF 2</div>
            <h2 id="rating-title">Compared to before, how was your experience getting a same-day appointment?</h2>
            <p className="lede">Choose the answer that fits best.</p>
            <div className="rating-options" role="radiogroup" aria-labelledby="rating-title">
              {([
                { v: "better", face: "🙂", label: "Better", sub: "An improvement on before" },
                { v: "same", face: "😐", label: "The same", sub: "No real difference" },
                { v: "worse", face: "🙁", label: "Worse", sub: "Not as good as before" },
              ] as const).map((r) => {
                const selected = rating === r.v;
                return (
                  <button
                    key={r.v}
                    className={`rating-card${selected ? " selected" : ""}`}
                    data-value={r.v}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRating(r.v)}
                  >
                    <span className="face">{r.face}</span>
                    <span>
                      <span className="label">{r.label}</span>
                      <span className="sublabel" style={{ display: "block" }}>{r.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="btn-row">
              <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button
                className="btn-primary"
                disabled={!rating}
                onClick={() => setStep(rating === "worse" ? 4 : 5)}
              >
                Continue <span className="arrow">→</span>
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="screen" aria-labelledby="followup-title">
            <div className="eyebrow">FOLLOW-UP</div>
            <h2 id="followup-title">What was the main issue?</h2>
            <p className="lede">We're sorry your experience was worse. Please tell us what went wrong so we can fix it.</p>
            <div className="followup-options" role="radiogroup" aria-labelledby="followup-title">
              {FOLLOWUPS.map((f) => {
                const selected = followup?.id === f.id;
                return (
                  <button
                    key={f.id}
                    className={`followup-card${selected ? " selected" : ""}`}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFollowup({ id: f.id, label: f.label })}
                  >
                    <span className="followup-check" />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="btn-row">
              <button className="btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-primary" disabled={!followup} onClick={() => setStep(5)}>
                Continue <span className="arrow">→</span>
              </button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="screen" aria-labelledby="comment-title">
            <div className="eyebrow">ALMOST DONE</div>
            <h2 id="comment-title">Anything you'd like to add?</h2>
            <p className="lede">Optional — only if you'd like to share more. You can leave this blank.</p>
            <textarea
              className="comment-area"
              maxLength={400}
              placeholder="Type your comment here…"
              aria-label="Optional comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="field-hint"><span>{comment.length}</span> / 400</div>
            <div className="btn-row">
              <button
                className="btn-secondary"
                onClick={() => setStep(rating === "worse" ? 4 : 3)}
                disabled={submitting}
              >
                ← Back
              </button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? (
                  <>
                    <span className="spinner" /> Submitting…
                  </>
                ) : (
                  <>
                    Submit feedback <span className="arrow">→</span>
                  </>
                )}
              </button>
            </div>
            {submitError && <div className="submit-error">{submitError}</div>}
          </section>
        )}

        {step === 6 && (
          <section className="screen" aria-labelledby="thanks-title">
            <div className="confirm">
              <div className="confirm-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 12.5 9.5 18 20 6.5" />
                </svg>
              </div>
              <h1 id="thanks-title">Thank you</h1>
              <p className="confirm-body">
                Your feedback has been recorded anonymously. It goes straight to the
                NRES Programme Board and helps shape the same-day service for everyone.
              </p>
              <dl className="confirm-summary">
                {practice && (<><dt>Practice</dt><dd>{practice.label}</dd></>)}
                {rating && (<><dt>Your rating</dt><dd>{RATING_LABEL[rating]}</dd></>)}
                {followup && rating === "worse" && (<><dt>Main issue</dt><dd>{followup.label}</dd></>)}
                {summaryComment && (<><dt>Your comment</dt><dd style={{ fontWeight: 500 }}>{summaryComment}</dd></>)}
              </dl>
              <button
                className="btn-primary"
                style={{ background: "var(--navy)" }}
                onClick={() => setModalOpen(true)}
              >
                Learn more about NRES
              </button>
            </div>
          </section>
        )}

        <footer className="page-footer">
          <div className="badge">Anonymous</div><br />
          No names, phone numbers or NHS numbers are collected.<br />
          Northamptonshire Rural East &amp; South · Neighbourhood Pilot 2026
        </footer>
      </main>

      <div
        className={`modal-overlay${modalOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
      >
        <div className="modal">
          <div className="modal-eyebrow">ABOUT THE PILOT</div>
          <h2 id="modal-title">What is NRES?</h2>
          <div className="modal-body">
            <p>
              <strong>Northamptonshire Rural East &amp; South (NRES)</strong> is a
              partnership of seven local GP practices that have joined forces to
              deliver care a little differently.
            </p>
            <p>
              Instead of working alone, the practices share staff, appointments and
              expertise across the area. The aim is simple: <strong>get patients seen
              sooner</strong> when they need it, and <strong>support people with
              long-term conditions better</strong> over time.
            </p>
            <div className="modal-stats">
              <div className="stat">
                <div className="stat-num">7</div>
                <div className="stat-label">GP practices working together</div>
              </div>
              <div className="stat">
                <div className="stat-num">~89,500</div>
                <div className="stat-label">Patients in the area</div>
              </div>
            </div>
            <p style={{ marginTop: 14 }}>
              The pilot started on <strong>1 April 2026</strong> and runs across two parts:
            </p>
            <p>
              <strong>Part A — Same Day Access:</strong> if you need to be seen today,
              we'll find you an appointment, even if it's at a neighbouring practice.
            </p>
            <p>
              <strong>Part B — Complex Care:</strong> patients living with long-term
              conditions get continuity of care from a named clinician who knows them.
            </p>
            <p>
              Your feedback helps us measure how we're doing and where to improve.
            </p>
          </div>
          <button className="modal-close" onClick={() => setModalOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
