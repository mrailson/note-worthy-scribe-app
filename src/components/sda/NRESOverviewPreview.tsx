// @ts-nocheck
import { useState, useEffect, useRef } from "react";

function useCounter(target: number, dur = 1800, active = true) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) { setV(0); return; }
    let s: number | null = null;
    const go = (ts: number) => { if (!s) s = ts; const p = Math.min((ts - s) / dur, 1); setV(Math.floor(p * p * target)); if (p < 1) requestAnimationFrame(go); };
    requestAnimationFrame(go);
  }, [target, active, dur]);
  return v;
}

function useFadeIn(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, vis];
}

function Stagger({ children, visible, inc = 100 }: { children: React.ReactNode[]; visible: boolean; inc?: number }) {
  return <>{children.map((c, i) => <div key={i} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: `all 0.55s cubic-bezier(0.16,1,0.3,1) ${i * inc}ms` }}>{c}</div>)}</>;
}

function Donut({ pct, size = 130, stroke = 13, color, label, sub }: { pct: number; size?: number; stroke?: number; color: string; label?: string; sub?: string }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const [ap, setAp] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAp(pct), 120); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ - (ap / 100) * circ} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
        {label && <div style={{ fontWeight: 800, fontSize: 24, color: "#1F2937" }}>{label}</div>}
        {sub && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function HBar({ value, max, color, label, sub, delay = 0 }: { value: number; max: number; color: string; label: string; sub: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW((value / max) * 100), 200 + delay); return () => clearTimeout(t); }, [value, max, delay]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#1F2937", fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{sub}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "#E5E7EB", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 5, background: color, width: `${w}%`, transition: `width 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }} />
      </div>
    </div>
  );
}

const gold = "#F5C518", goldDk = "#D4A800", goldLt = "#FDF8E1", goldBd = "#F0DC82";
const bgC = "#F8F9FA", wh = "#FFFFFF", bd = "#E2E5E9", bdLt = "#F1F3F5";
const tx = "#1F2937", txS = "#6B7280", txL = "#9CA3AF", nv = "#1E293B";
const bl = "#2563EB", blBg = "#EFF6FF", blBd = "#BFDBFE";
const tl = "#0D9488", tlBg = "#F0FDFA";
const gn = "#10B981", gnBg = "#ECFDF5";
const rd = "#EF4444", rdBg = "#FEF2F2";
const am = "#F59E0B", amBg = "#FFFBEB";
const pu = "#7C3AED", puBg = "#F5F3FF";
const ind = "#4F46E5", indBg = "#EEF2FF";

const practices = [
  { n: "The Parks MC", list: 22827, pct: 25.5, type: "HUB", sys: "SystmOne", wk: 347, act: 341, st: "on-track", c: gn, alloc: 601247, rb: 450935, nSDA: 312400, bb: 98500, ev: "full", pB: 486 },
  { n: "Brackley MC", list: 16212, pct: 18.1, type: "HUB", sys: "SystmOne", wk: 246, act: 238, st: "on-track", c: gn, alloc: 426942, rb: 320207, nSDA: 225600, bb: 62300, ev: "full", pB: 298 },
  { n: "Springfield Surgery", list: 12611, pct: 14.1, type: "SPOKE", sys: "EMIS", wk: 192, act: 185, st: "at-risk", c: am, alloc: 331948, rb: 248961, nSDA: 178200, bb: 44010, ev: "full", pB: 245 },
  { n: "Towcester MC", list: 11748, pct: 13.1, type: "SPOKE", sys: "EMIS", wk: 179, act: 172, st: "on-track", c: gn, alloc: 309227, rb: 231920, nSDA: 156800, bb: 48500, ev: "partial", pB: 228 },
  { n: "Bugbrooke Surgery", list: 10788, pct: 12.0, type: "SPOKE", sys: "SystmOne", wk: 164, act: 158, st: "on-track", c: gn, alloc: 283946, rb: 212960, nSDA: 142300, bb: 45200, ev: "full", pB: 212 },
  { n: "Brook Health Centre", list: 9069, pct: 10.1, type: "SPOKE", sys: "SystmOne", wk: 138, act: 132, st: "on-track", c: gn, alloc: 238687, rb: 179015, nSDA: 118400, bb: 32100, ev: "partial", pB: 198 },
  { n: "Denton Village Surgery", list: 6329, pct: 7.1, type: "SPOKE", sys: "SystmOne", wk: 96, act: 72, st: "below", c: rd, alloc: 166643, rb: 124982, nSDA: 113854, bb: 0, ev: "pending", pB: 175 },
];

const cats = [
  { n: "Long-Term Conditions", code: "SDA-LTC-REVIEW", ico: "🫀", ap: 682, pt: 456, pct: 37.0, c: ind },
  { n: "Mental Health & Wellbeing", code: "SDA-MH-WELLBEING", ico: "🧠", ap: 441, pt: 312, pct: 23.9, c: pu },
  { n: "Frailty / Complex Elderly", code: "SDA-FRAILTY-COMPLEX", ico: "👴", ap: 389, pt: 245, pct: 21.1, c: tl },
  { n: "Cancer / Palliative Care", code: "SDA-CANCER-PALL", ico: "🎗️", ap: 330, pt: 191, pct: 17.9, c: bl },
];

const msList = [
  { ph: "Alpha", dt: "Late March 2026", desc: "Dashboard, Weekly Rota, basic Buy-Back. Service go-live April uses Excel", st: "building", pct: 65 },
  { ph: "Beta", dt: "May 2026", desc: "Monthly Rota, Capacity Planning, Practice Detail, permission overrides", st: "planned", pct: 0 },
  { ph: "Go-Live", dt: "July 2026", desc: "Full system live — replaces Excel. Email automation, compliance, audit trail", st: "planned", pct: 0 },
  { ph: "Refinement", dt: "Aug–Sep 2026", desc: "UAT feedback, polish, training, documentation", st: "planned", pct: 0 },
];

const bbSteps = [
  { s: 1, t: "Application", d: "Practice submits form: staff, role, sessions, rate. Auto-calculates costs inc. 29.38% on-costs", i: "📝" },
  { s: 2, t: "Evidence Upload", d: "6 documents required: contract, salary, on-costs, JD, new hire spec, reinvestment budget. Submit blocked until complete", i: "📎" },
  { s: 3, t: "Board Review", d: "Dr Mark Gray (sole approver): equity check, fairness, evidence verification", i: "🔒" },
  { s: 4, t: "Decision", d: "Approve or reject with mandatory reason. Immutable audit trail visible to board and ICB", i: "✅" },
  { s: 5, t: "Reinvestment", d: "New proactive care hire. Part B continuity slots (30 min) tracked via EMIS/SystmOne CSV", i: "🔄" },
  { s: 6, t: "Part B Evidence", d: "Auto-generates ICB reports from clinical data: LTC, Mental Health, Frailty, Cancer", i: "📊" },
];

const fmt = (n: number) => n.toLocaleString("en-GB");
const fK = (n: number) => n >= 1e6 ? `£${(n/1e6).toFixed(2)}M` : n >= 1000 ? `£${(n/1000).toFixed(0)}K` : `£${n}`;

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) { return <div style={{ background: wh, border: `1px solid ${bd}`, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...style }}>{children}</div>; }
function Bdg({ text, bg, color, style }: { text: string; bg: string; color: string; style?: React.CSSProperties }) { return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: bg, color, ...style }}>{text}</span>; }

/* ══════════════════════════════════════════ */
/* TAB COMPONENTS (hooks safe at top level)  */
/* ══════════════════════════════════════════ */

function OverviewTab() {
  const [ld, setLd] = useState(false);
  const [hp, setHp] = useState<number | null>(null);
  useEffect(() => { setLd(true); }, []);
  const cP = useCounter(89584, 2000, ld);
  const cA = useCounter(74302, 2000, ld);
  const cV = useCounter(236, 1600, ld);
  const cW = useCounter(1362, 1400, ld);
  const totAct = practices.reduce((s, p) => s + p.act, 0);
  const comp = ((totAct / 1362) * 100).toFixed(1);

  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 18 }}>
      {[{ l: "Total Patients", v: fmt(cP), c: nv, s: "Across 7 practices" }, { l: "Annual Appointments", v: fmt(cA), c: bl, s: "Contractual target" }, { l: "Contract Value", v: `£${(cV/100).toFixed(2)}M`, c: "#92400E", s: "12-month LES" }, { l: "Weekly Target", v: fmt(cW), c: tl, s: "Non-winter (15.2/1,000)" }, { l: "This Week", v: fmt(totAct), c: parseFloat(comp) >= 95 ? gn : am, s: `${comp}% of target` }].map((m, i) =>
        <Card key={i} style={{ padding: 16, borderTop: `3px solid ${m.c}`, opacity: ld ? 1 : 0, transform: ld ? "translateY(0)" : "translateY(18px)", transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 90}ms` }}>
          <div style={{ fontSize: 10, color: txS, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>{m.l}</div>
          <div style={{ fontSize: 27, fontWeight: 800, color: m.c, fontVariantNumeric: "tabular-nums" }}>{m.v}</div>
          <div style={{ fontSize: 10, color: txL, marginTop: 3 }}>{m.s}</div>
        </Card>
      )}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
      <Card style={{ padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Neighbourhood Compliance</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 36, alignItems: "center" }}>
          <Donut pct={parseFloat(comp)} color={gn} label={`${comp}%`} sub="of target" />
          <div style={{ textAlign: "left" }}>
            {[{ l: "F2F Appointments", v: "623", c: tl }, { l: "Remote Appointments", v: "675", c: pu }, { l: "Remote Ratio", v: "52.0% ✓", c: gn }].map((x, i) =>
              <div key={i} style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: txS }}>{x.l}</div><div style={{ fontSize: 20, fontWeight: 700, color: x.c }}>{x.v}</div></div>
            )}
          </div>
        </div>
      </Card>
      <Card style={{ padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>NRES Scheme Structure</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ t: "Part A — Reactive SDA", d: "15 min same-day access slots", c: bl, b: blBg }, { t: "Part B — Continuity", d: "30 min proactive care: LTC, MH, Frailty, Cancer", c: ind, b: indBg }, { t: "New SDA Provision", d: "New staff/sessions funded by contract", c: tl, b: tlBg }, { t: "Buy-Back Provision", d: "Existing staff bought back → reinvest in proactive care", c: pu, b: puBg }].map((x, i) =>
            <div key={i} style={{ background: x.b, borderRadius: 8, padding: 12, border: `1px solid ${x.c}20` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: x.c, marginBottom: 3 }}>{x.t}</div>
              <div style={{ fontSize: 11, color: txS, lineHeight: 1.4 }}>{x.d}</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 10, padding: "7px 12px", background: goldLt, borderRadius: 6, fontSize: 11, color: "#92400E", border: `1px solid ${goldBd}` }}>🔓 Open Book Accounting — full financial transparency to NRES board and ICB</div>
      </Card>
    </div>
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Practice Quick Status</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {practices.map((p, i) => <div key={i} onMouseEnter={() => setHp(i)} onMouseLeave={() => setHp(null)} style={{ background: hp === i ? (p.c === gn ? gnBg : p.c === am ? amBg : rdBg) : "#F9FAFB", borderRadius: 10, padding: 12, textAlign: "center", cursor: "pointer", border: `1.5px solid ${hp === i ? p.c : bd}`, transition: "all 0.2s", transform: hp === i ? "translateY(-3px)" : "none", boxShadow: hp === i ? `0 4px 12px ${p.c}18` : "none" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: txS, marginBottom: 5 }}>{p.n.split(" ")[0]}</div>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: p.c, margin: "0 auto 5px", boxShadow: `0 0 6px ${p.c}44` }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: p.c }}>{p.act}</div>
          <div style={{ fontSize: 10, color: txL }}>/ {p.wk} target</div>
          <Bdg text={p.st === "on-track" ? "On Track" : p.st === "at-risk" ? "At Risk" : "Below"} bg={p.c + "15"} color={p.c} />
        </div>)}
      </div>
    </Card>
  </div>;
}

function PracticesTab() {
  const [ref, vis] = useFadeIn();
  return <div ref={ref}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Practice Allocations</div>
    <div style={{ fontSize: 13, color: txS, marginBottom: 14 }}>7 practices • 89,584 patients • Weighted by list size</div>
    <Card style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 0.6fr 0.8fr 1fr 1fr 1fr", gap: 8, padding: "10px 16px", background: "#F9FAFB", borderBottom: `1px solid ${bd}`, fontSize: 10, color: txS, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>
        <span>Practice</span><span>List Size</span><span>Type</span><span>System</span><span>Target/Wk</span><span>Allocation</span><span>Recruit (75%)</span><span>Status</span>
      </div>
      <Stagger visible={vis} inc={70}>{practices.map((p, i) =>
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 0.6fr 0.8fr 1fr 1fr 1fr", gap: 8, padding: "11px 16px", background: i % 2 ? "#FAFBFC" : wh, borderBottom: `1px solid ${bdLt}`, fontSize: 13, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{p.n}</span>
          <span>{fmt(p.list)} <span style={{ color: txL, fontSize: 11 }}>({p.pct}%)</span></span>
          <Bdg text={p.type} bg={p.type === "HUB" ? goldLt : indBg} color={p.type === "HUB" ? "#92400E" : ind} />
          <span style={{ fontSize: 11, color: txS }}>{p.sys}</span>
          <span style={{ fontWeight: 700 }}>{p.wk}</span>
          <span style={{ color: bl }}>{fK(p.alloc)}</span>
          <span style={{ color: tl }}>{fK(p.rb)}</span>
          <Bdg text={p.st === "on-track" ? "● On Track" : p.st === "at-risk" ? "● At Risk" : "● Below"} bg={p.c + "14"} color={p.c} />
        </div>
      )}</Stagger>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 0.6fr 0.8fr 1fr 1fr 1fr", gap: 8, padding: "11px 16px", background: blBg, fontSize: 13, fontWeight: 700, color: bl, borderTop: `2px solid ${blBd}` }}>
        <span>NEIGHBOURHOOD TOTAL</span><span>89,584</span><span></span><span></span><span>1,362</span><span>£2.36M</span><span>£1.77M</span><span></span>
      </div>
    </Card>
  </div>;
}

function RotaTab() {
  const [ref, vis] = useFadeIn();
  return <div ref={ref}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Rota & Capacity Management</div>
    <div style={{ fontSize: 13, color: txS, marginBottom: 14 }}>Weekly session planning across 7 practices</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Session Structure</div>
        {[{ l: "Standard Session", d: "4h 10m", a: "12 appointments × 15 min", c: bl, b: blBg }, { l: "Part B Session", d: "4h 10m", a: "8 appointments × 30 min", c: ind, b: indBg }, { l: "Mixed Session", d: "4h 10m", a: "6×15 min + 4×30 min", c: tl, b: tlBg }].map((s, i) =>
          <div key={i} style={{ background: s.b, borderRadius: 8, padding: 13, marginBottom: 10, borderLeft: `4px solid ${s.c}`, opacity: vis ? 1 : 0, transform: vis ? "translateX(0)" : "translateX(-18px)", transition: `all 0.5s ease ${200 + i * 140}ms` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700, fontSize: 13, color: s.c }}>{s.l}</span><span style={{ fontSize: 11, color: txS }}>{s.d}</span></div>
            <div style={{ fontSize: 12, color: txS, marginTop: 3 }}>{s.a}</div>
          </div>
        )}
        <div style={{ background: goldLt, borderRadius: 8, padding: 11, fontSize: 11, color: "#92400E", border: `1px solid ${goldBd}` }}><strong>BMA Standard:</strong> GP session = 4 hrs 10 min. Configurable by staff type: GP, ACP, ANP, Paramedic, Pharmacist.</div>
      </Card>
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Capacity Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[{ l: "On-Site Rooms", v: "1,188", s: "appts/week capacity", c: tl, b: tlBg }, { l: "Remote Minimum", v: "174", s: "non-winter shortfall", c: pu, b: puBg }].map((m, i) =>
            <div key={i} style={{ background: m.b, borderRadius: 8, padding: 12, textAlign: "center", border: `1px solid ${m.c}20` }}>
              <div style={{ fontSize: 10, color: txS, textTransform: "uppercase", letterSpacing: 0.6 }}>{m.l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: m.c }}>{m.v}</div>
              <div style={{ fontSize: 10, color: txL }}>{m.s}</div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: txS, marginBottom: 6 }}>On-Site Capacity by Practice</div>
        {([["The Parks",348],["Brackley",240],["Towcester",204],["Springfield",120],["Bugbrooke",120],["Brook HC",120],["Denton",36]] as [string, number][]).map(([n,r],i) => <HBar key={i} value={r} max={400} color={tl} label={n} sub={`${r}/wk`} delay={i*80} />)}
      </Card>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {[{ ic: "☀", l: "Non-Winter", c: gn, b: gnBg, w: "39 weeks • 15.2 per 1,000", tg: "1,362", rm: "174", md: "180" }, { ic: "❄", l: "Winter", c: bl, b: blBg, w: "13 weeks • 18.2 per 1,000", tg: "1,631", rm: "443", md: "444" }].map((p, i) =>
        <Card key={i} style={{ padding: 18, borderTop: `3px solid ${p.c}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><Bdg text={`${p.ic} ${p.l}`} bg={p.b} color={p.c} style={{ fontSize: 12, padding: "4px 14px" }} /><span style={{ fontSize: 12, color: txS, lineHeight: "26px" }}>{p.w}</span></div>
          <div style={{ fontSize: 12, color: txS, lineHeight: 1.8 }}>Weekly target: <strong style={{ color: tx }}>{p.tg} appointments</strong><br/>On-site: 1,188 → Remote minimum: {p.rm} • Modelled: {p.md}</div>
        </Card>
      )}
    </div>
  </div>;
}

function BuyBackTab() {
  const [ref, vis] = useFadeIn();
  const [bb, setBb] = useState(0);
  return <div ref={ref}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Buy-Back Scheme</div>
    <div style={{ fontSize: 13, color: txS, marginBottom: 14 }}>Open book — existing staff bought back, funds reinvested in proactive care</div>
    <Card style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Buy-Back Process Flow</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {bbSteps.map((s, i) => <div key={i} onMouseEnter={() => setBb(i)} style={{ background: bb === i ? blBg : "#F9FAFB", border: `1.5px solid ${bb === i ? bl : bd}`, borderRadius: 10, padding: 13, cursor: "pointer", transition: "all 0.2s", transform: bb === i ? "translateY(-3px)" : "none", boxShadow: bb === i ? "0 4px 12px rgba(37,99,235,0.1)" : "none", opacity: vis ? 1 : 0, transitionDelay: `${i*70}ms` }}>
          <div style={{ fontSize: 24, marginBottom: 5 }}>{s.i}</div>
          <div style={{ fontSize: 10, color: txL }}>Step {s.s}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: bb === i ? bl : tx, marginBottom: 5 }}>{s.t}</div>
          <div style={{ fontSize: 10, color: txS, lineHeight: 1.4 }}>{s.d}</div>
        </div>)}
      </div>
    </Card>
    <Card style={{ overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 16px 4px" }}><span style={{ fontSize: 15, fontWeight: 700 }}>Practice Budget & Drawdown</span><span style={{ fontSize: 12, color: txS, marginLeft: 12 }}>Open book — visible to NRES board and ICB</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 0.8fr 1.2fr", gap: 6, padding: "8px 16px", fontSize: 10, color: txS, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, background: "#F9FAFB", borderTop: `1px solid ${bd}`, borderBottom: `1px solid ${bd}` }}>
        <span>Practice</span><span>Recruit Budget</span><span>New SDA</span><span>Buy-Back</span><span>Remaining</span><span>Evidence</span><span>Usage</span>
      </div>
      <Stagger visible={vis} inc={60}>{practices.map((p, i) => { const rem = p.rb - p.nSDA - p.bb; const u = ((p.nSDA + p.bb) / p.rb * 100).toFixed(1); return (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 0.8fr 1.2fr", gap: 6, padding: "10px 16px", background: i % 2 ? "#FAFBFC" : wh, borderBottom: `1px solid ${bdLt}`, fontSize: 12, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{p.n}</span>
          <span style={{ color: tl }}>{fK(p.rb)}</span>
          <span style={{ color: bl }}>{fK(p.nSDA)}</span>
          <span style={{ color: pu }}>{p.bb > 0 ? fK(p.bb) : "—"}</span>
          <span style={{ color: rem > 25000 ? gn : am, fontWeight: 600 }}>{fK(rem)}</span>
          <Bdg text={p.ev === "full" ? "✓ Full" : p.ev === "partial" ? "◐ Partial" : "○ Pending"} bg={p.ev === "full" ? gnBg : p.ev === "partial" ? amBg : rdBg} color={p.ev === "full" ? gn : p.ev === "partial" ? am : rd} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#E5E7EB", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, background: parseFloat(u) > 95 ? rd : parseFloat(u) > 85 ? am : gn, width: `${u}%`, transition: "width 1s ease" }} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: txS, minWidth: 34 }}>{u}%</span>
          </div>
        </div>); })}</Stagger>
    </Card>
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Required Evidence per Buy-Back Claim</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[{ t: "At Submission", items: ["Staff contract / employment letter", "Salary confirmation or payslip", "On-costs breakdown", "Job description (SDA role)", "New hire job specification", "Reinvestment budget breakdown"], c: bl, b: blBg }, { t: "Within 3 Months", items: ["New hire signed contract", "Salary evidence for new role", "On-costs for new hire"], c: am, b: amBg }, { t: "Ongoing (Quarterly)", items: ["SDA delivery confirmation", "Part B clinical data (CSV import)", "Reinvestment spend report"], c: gn, b: gnBg }].map((g, gi) =>
          <div key={gi} style={{ background: g.b, borderRadius: 10, padding: 14, border: `1px solid ${g.c}20` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: g.c, marginBottom: 8 }}>{g.t}</div>
            {g.items.map((it, ii) => <div key={ii} style={{ fontSize: 11, color: txS, padding: "4px 0", borderBottom: ii < g.items.length - 1 ? `1px solid ${g.c}12` : "none" }}><span style={{ color: g.c, marginRight: 6 }}>○</span>{it}</div>)}
          </div>
        )}
      </div>
    </Card>
  </div>;
}

function PartBTab() {
  const [ref, vis] = useFadeIn();
  return <div ref={ref}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Part B — Continuity of Care Evidence</div>
    <div style={{ fontSize: 13, color: txS, marginBottom: 14 }}>30 min proactive care slots — auto-generated from EMIS & SystmOne CSV imports • Slot types agreed with Wellingborough</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
      {[{ l: "Part B Appointments", v: "1,842", c: ind, s: "30 min continuity slots" }, { l: "Part A Appointments", v: "5,448", c: bl, s: "15 min same-day reactive" }, { l: "Part B % of Total", v: "25.3%", c: gn, s: "Target ≥20% ✓" }, { l: "Unique Patients (B)", v: "1,204", c: nv, s: "Continuity contacts" }].map((m, i) =>
        <Card key={i} style={{ padding: 16, borderTop: `3px solid ${m.c}`, opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(14px)", transition: `all 0.5s ease ${i * 90}ms` }}>
          <div style={{ fontSize: 10, color: txS, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{m.l}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: m.c }}>{m.v}</div>
          <div style={{ fontSize: 10, color: txL, marginTop: 2 }}>{m.s}</div>
        </Card>
      )}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>National Tracked Categories</div>
        {cats.map((c, i) => <div key={i} style={{ background: "#F9FAFB", borderRadius: 10, padding: 13, marginBottom: 10, borderLeft: `4px solid ${c.c}`, opacity: vis ? 1 : 0, transform: vis ? "translateX(0)" : "translateX(-14px)", transition: `all 0.5s ease ${250 + i * 110}ms` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <div><span style={{ fontSize: 16, marginRight: 8 }}>{c.ico}</span><span style={{ fontWeight: 700, fontSize: 13 }}>{c.n}</span></div>
            <span style={{ fontSize: 20, fontWeight: 800, color: c.c }}>{c.ap}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: txS, marginBottom: 5 }}>
            <span>Slot: <span style={{ color: c.c, fontWeight: 600 }}>{c.code}</span></span>
            <span>{c.pt} patients • {c.pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "#E5E7EB", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, background: c.c, width: vis ? `${c.pct * 2.7}%` : "0%", transition: `width 1.2s ease ${350 + i * 110}ms` }} /></div>
        </div>)}
      </Card>
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Part B by Practice</div>
        {practices.map((p, i) => { const tP = p.act * 4.3; const bP = ((p.pB / (tP || 1)) * 100).toFixed(1); return <div key={i} style={{ marginBottom: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{p.n.split(" ").slice(0,2).join(" ")}</span><span style={{ color: ind, fontWeight: 700 }}>{p.pB} <span style={{ color: txL, fontWeight: 400, fontSize: 10 }}>Part B</span></span></div>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#E5E7EB" }}>
            <div style={{ height: "100%", background: "#93C5FD", width: vis ? `${100 - parseFloat(bP)}%` : "0%", transition: `width 1s ease ${i * 70}ms` }} />
            <div style={{ height: "100%", background: ind, width: vis ? `${bP}%` : "0%", transition: `width 1s ease ${i * 70 + 180}ms` }} />
          </div>
          <div style={{ fontSize: 10, color: txL, marginTop: 2, textAlign: "right" }}>Part B: {bP}%</div>
        </div>; })}
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10, color: txS }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#93C5FD", marginRight: 4, verticalAlign: "middle" }} />Part A (15 min)</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: ind, marginRight: 4, verticalAlign: "middle" }} />Part B (30 min)</span>
        </div>
      </Card>
    </div>
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Clinical System Data Import & Standardised Slot Types</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
        {[{ l: "EMIS Web", p: "Springfield, Towcester", c: tl, b: tlBg, st: ["Appointments → Slot Type contains 'SDA-'", "CSV: Date, Slot Type, Duration, Clinician, Status", "Weekly upload (Monday by practice admin)"] }, { l: "SystmOne", p: "Parks, Brackley, Bugbrooke, Brook, Denton", c: pu, b: puBg, st: ["SDA Slot Type Activity → filter SDA- prefix", "Excel: Date, Slot Type, Duration, Clinician, Attended", "Weekly upload (Monday by practice admin)"] }].map((s, i) =>
          <div key={i} style={{ background: s.b, borderRadius: 10, padding: 14, border: `1px solid ${s.c}20` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.c, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 10, color: txS, marginBottom: 6 }}>{s.p}</div>
            {s.st.map((x, j) => <div key={j} style={{ fontSize: 11, color: txS, lineHeight: 1.6 }}>{x}</div>)}
          </div>
        )}
      </div>
      <div style={{ background: goldLt, borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#92400E", border: `1px solid ${goldBd}` }}>🔗 All SDA- slot types standardised with Wellingborough neighbourhood for consistent ICB reporting</div>
    </Card>
  </div>;
}

function TimelineTab() {
  const [ref, vis] = useFadeIn();
  const [xlTab, setXlTab] = useState(0);
  const cols = [gold, bl, gn, pu];

  const xlTabs = [
    { group: "Core", color: bl, tabs: [
      { name: "Assumptions", desc: "Contract parameters, rates, on-costs %, winter/non-winter weeks. Yellow cells = adjustable inputs that drive all calculations.", icon: "⚙️" },
      { name: "Practice Allocations", desc: "List sizes, % share, annual allocation, monthly instalment, recruit budget (75%), weekly targets (non-winter & winter), F2F/remote split.", icon: "📊" },
      { name: "Room Capacity", desc: "Clinical rooms by practice × day × session (AM/PM). On-site maximum = 1,188 appts/week. Drives remote shortfall calculation.", icon: "🏥" },
    ]},
    { group: "Rota", color: tl, tabs: [
      { name: "Weekly Rota", desc: "Session-by-session tracker: day, practice, staff name, type (GP/ACP/ANP/Para), provision (New SDA/Buy-Back), appointments, delivery mode, cost.", icon: "📅" },
      { name: "Monthly Rota", desc: "Calendar overview by practice. Weekly totals, session counts, staff breakdown. Filters by practice or neighbourhood-wide.", icon: "🗓️" },
      { name: "Workforce", desc: "Full SDA staff directory: role, home practice, contract type, sessions/week, cost/session, on-costs, sites worked, available days.", icon: "👥" },
    ]},
    { group: "Finance", color: gn, tabs: [
      { name: "Buy-Back Tracker", desc: "All applications: staff, role, sessions, rate, on-costs, same-day %, claim value, status, approver (Dr Gray sole sign-off), reinvestment plan.", icon: "🔄" },
      { name: "Cash Flow", desc: "Monthly instalments, cumulative paid, New SDA spend, buy-back drawn, total claimed, remaining claimable, % drawn down. Open book.", icon: "💰" },
    ]},
    { group: "Compliance", color: am, tabs: [
      { name: "Compliance Tracker", desc: "Weekly actuals vs targets per practice. RAG status auto-calculated. 52-week tracking grid. Flags practices below 80% threshold.", icon: "✅" },
      { name: "DNA Tracking", desc: "Weekly DNAs per practice. DNA rate calculated against total offered. Threshold alerts when rate exceeds 5%.", icon: "🚫" },
      { name: "Absence Tracker", desc: "Staff absence log: date, type (AL/sickness), sessions lost, cover arranged, cover by whom. Feeds capacity gap reporting.", icon: "📋" },
    ]},
    { group: "Practice", color: pu, tabs: [
      { name: "7× Practice Dashboards", desc: "Individual sheets for Parks, Brackley, Springfield, Towcester, Bugbrooke, Brook, Denton. Profile, targets, staff roster, weekly tracking, financials.", icon: "🏠" },
      { name: "Practice Contacts", desc: "Email contacts per practice for automated report distribution. Primary contacts, weekly/monthly report flags, alert preferences.", icon: "📧" },
      { name: "Audit Log", desc: "Immutable change log: date, who, role, what changed, previous value, new value, on behalf of. Governance & ICB transparency.", icon: "📝" },
    ]},
  ];

  return <div ref={ref}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Delivery Timeline</div>
    <div style={{ fontSize: 13, color: txS, marginBottom: 22 }}>Service launches April 2026 with Excel workbook • Notewell system replaces Excel from July 2026</div>

    {/* Timeline nodes */}
    <div style={{ position: "relative", padding: "0 40px", marginBottom: 28 }}>
      <div style={{ position: "absolute", top: 32, left: 40, right: 40, height: 4, background: "#E5E7EB", borderRadius: 2 }}><div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${gold}, ${bl})`, width: vis ? "25%" : "0%", transition: "width 2s cubic-bezier(0.16,1,0.3,1)" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, position: "relative" }}>
        {msList.map((m, i) => <div key={i} style={{ textAlign: "center", opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(18px)", transition: `all 0.7s ease ${400 + i * 180}ms` }}>
          <div style={{ width: 58, height: 58, borderRadius: 29, margin: "0 auto 10px", background: m.st === "building" ? cols[i] : wh, border: `3px solid ${cols[i]}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: m.st === "building" ? `0 0 18px ${cols[i]}30` : "0 2px 6px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: m.st === "building" ? nv : cols[i] }}>{m.ph.charAt(0)}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: cols[i] }}>{m.ph}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{m.dt}</div>
          <div style={{ fontSize: 11, color: txS, marginTop: 5, lineHeight: 1.4, maxWidth: 200, margin: "5px auto 0" }}>{m.desc}</div>
          {m.pct > 0 && <div style={{ marginTop: 7 }}><div style={{ height: 6, borderRadius: 3, background: "#E5E7EB", overflow: "hidden", margin: "0 20px" }}><div style={{ height: "100%", borderRadius: 3, background: cols[i], width: vis ? `${m.pct}%` : "0%", transition: "width 1.5s ease 700ms" }} /></div><div style={{ fontSize: 10, color: cols[i], marginTop: 3, fontWeight: 700 }}>{m.pct}% complete</div></div>}
        </div>)}
      </div>
    </div>

    {/* Excel Go-Live Tool */}
    <Card style={{ padding: 0, marginBottom: 16, overflow: "hidden", border: `2px solid ${gn}` }}>
      <div style={{ background: `linear-gradient(135deg, ${gnBg}, #D1FAE5)`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#217346", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(33,115,70,0.3)" }}>
            <span style={{ color: wh, fontWeight: 800, fontSize: 16 }}>XL</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: nv }}>NRES_SDA_Rota_Management_V3.1.xlsx</div>
            <div style={{ fontSize: 12, color: txS }}>Go-Live Operations Tool — April 2026 service launch</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Bdg text="20 TABS" bg={wh} color="#217346" style={{ fontSize: 12, padding: "5px 14px", border: "1px solid #217346" }} />
          <Bdg text="FORMULA-DRIVEN" bg={wh} color="#217346" style={{ fontSize: 12, padding: "5px 14px", border: "1px solid #217346" }} />
          <Bdg text="READY" bg="#217346" color={wh} style={{ fontSize: 12, padding: "5px 14px" }} />
        </div>
      </div>

      <div style={{ padding: "12px 20px 6px", fontSize: 12, color: txS, background: wh }}>
        The Managerial Lead will manage this workbook centrally, populating it directly where possible and working with practices to gather any data they can't source themselves. The aim is to minimise the burden on practices while maintaining accurate, real-time operational oversight. As the Notewell AI system progresses (Alpha → Beta → Go-Live), each Excel tab is progressively replaced by a live dashboard.
      </div>

      {/* Tab group selector */}
      <div style={{ display: "flex", gap: 0, padding: "0 20px", background: wh, borderBottom: `1px solid ${bd}` }}>
        {xlTabs.map((g, i) => <button key={i} onClick={() => setXlTab(i)} style={{ padding: "9px 16px", fontSize: 12, fontWeight: xlTab === i ? 700 : 500, border: "none", cursor: "pointer", background: "transparent", color: xlTab === i ? g.color : txL, borderBottom: xlTab === i ? `3px solid ${g.color}` : "3px solid transparent", transition: "all 0.2s" }}>{g.group} ({g.tabs.length})</button>)}
      </div>

      {/* Tab cards */}
      <div style={{ padding: 16, background: "#FAFBFC" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${xlTabs[xlTab].tabs.length}, 1fr)`, gap: 12 }}>
          {xlTabs[xlTab].tabs.map((t, i) => (
            <div key={i} style={{ background: wh, borderRadius: 8, padding: 14, border: `1px solid ${bd}`, borderTop: `3px solid ${xlTabs[xlTab].color}`, transition: "all 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: nv, marginBottom: 6 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: txS, lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transition note */}
      <div style={{ padding: "10px 20px", background: goldLt, borderTop: `1px solid ${goldBd}`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14 }}>🔄</span>
        <div style={{ fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>
          <strong>Excel → Notewell Transition:</strong> Each Excel tab maps to a Notewell screen. As the Alpha (March), Beta (May), and Go-Live (July) releases ship, practice managers switch from the Excel tab to the equivalent live dashboard. Excel remains the audit baseline and fallback.
        </div>
      </div>
    </Card>

    {/* Key Dates + Build Effort */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Key Dates</div>
        {[{ d: "Late March 2026", e: "Alpha — Dashboard, Weekly Rota, Buy-Back", c: gold, bold: false }, { d: "April 2026", e: "NRES service launches — Excel V3.1 as go-live tool", c: am, bold: true }, { d: "May 2026", e: "Beta — Monthly Rota, Capacity, Practice Detail", c: bl, bold: false }, { d: "July 2026", e: "Full Go-Live — Notewell replaces Excel entirely", c: gn, bold: false }, { d: "Aug–Sep 2026", e: "Refinement — UAT, training, documentation", c: pu, bold: false }].map((x, i) =>
          <div key={i} style={{ display: "flex", gap: 10, padding: x.bold ? "9px 10px" : "9px 0", borderBottom: i < 4 ? `1px solid ${bdLt}` : "none", opacity: vis ? 1 : 0, transition: `opacity 0.5s ease ${200 + i * 90}ms`, background: x.bold ? amBg : "transparent", margin: x.bold ? "0 -10px" : "0", borderRadius: x.bold ? 6 : 0 }}>
            <div style={{ width: 4, borderRadius: 2, background: x.c, flexShrink: 0 }} />
            <div><div style={{ fontSize: 12, fontWeight: 700, color: x.c }}>{x.d}</div><div style={{ fontSize: 12, color: x.bold ? nv : txS, fontWeight: x.bold ? 600 : 400 }}>{x.e}</div></div>
          </div>
        )}
      </Card>
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Build Effort Estimate</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 18 }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 34, fontWeight: 800, color: nv }}>197</div><div style={{ fontSize: 10, color: txL, textTransform: "uppercase" }}>Min Hours</div></div>
          <div style={{ fontSize: 22, color: bd, alignSelf: "center" }}>—</div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 34, fontWeight: 800, color: nv }}>295</div><div style={{ fontSize: 10, color: txL, textTransform: "uppercase" }}>Max Hours</div></div>
        </div>
        {[{ p: "Core UI & Data Model", h: "50–70", w: 28, c: bl }, { p: "Rota & Buy-Back Logic", h: "45–65", w: 25, c: tl }, { p: "Business Logic", h: "35–50", w: 18, c: gn }, { p: "Reporting & Exports", h: "30–45", w: 15, c: am }, { p: "Auth & Permissions", h: "20–30", w: 10, c: pu }, { p: "Polish & Deployment", h: "17–35", w: 8, c: gold }].map((x, i) =>
          <div key={i} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span style={{ fontWeight: 500 }}>{x.p}</span><span style={{ color: txS }}>{x.h} hrs</span></div>
            <div style={{ height: 8, borderRadius: 4, background: "#E5E7EB", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, background: x.c, width: vis ? `${x.w * 3.3}%` : "0%", transition: `width 1s ease ${i * 90}ms` }} /></div>
          </div>
        )}
      </Card>
    </div>
  </div>;
}

/* ══════════════════════════════════════════ */
/* MAIN APP                                  */
/* ══════════════════════════════════════════ */

const TABS = ["Overview", "Practices", "Rota & Capacity", "Buy-Back", "Part B Evidence", "Timeline"];

export default function NRESOverview() {
  const [tab, setTab] = useState(0);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", background: bgC, minHeight: "100vh", color: tx }}>
      <div style={{ background: `linear-gradient(135deg, #F7D44C 0%, ${gold} 40%, ${goldDk} 100%)`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${goldDk}`, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: nv }}>Notewell AI</span>
          <span style={{ fontSize: 14, color: nv }}>✦</span>
          <div style={{ width: 1, height: 22, background: goldDk, margin: "0 6px" }} />
          <span style={{ fontSize: 13, color: "#44403C", fontWeight: 600 }}>NRES SDA Rota Management — Executive Overview</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["7 Practices", "89,584 Patients", "£2.36M"].map((t, i) => <span key={i} style={{ fontSize: 10, color: nv, background: "rgba(255,255,255,0.5)", padding: "3px 10px", borderRadius: 5, fontWeight: 700 }}>{t}</span>)}
        </div>
      </div>

      <div style={{ display: "flex", padding: "0 24px", background: wh, borderBottom: `1px solid ${bd}` }}>
        {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} style={{ padding: "11px 18px", fontSize: 13, fontWeight: tab === i ? 700 : 500, border: "none", cursor: "pointer", background: "transparent", color: tab === i ? bl : txS, borderBottom: tab === i ? `3px solid ${bl}` : "3px solid transparent", transition: "all 0.2s" }}>{t}</button>)}
      </div>

      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        {tab === 0 && <OverviewTab />}
        {tab === 1 && <PracticesTab />}
        {tab === 2 && <RotaTab />}
        {tab === 3 && <BuyBackTab />}
        {tab === 4 && <PartBTab />}
        {tab === 5 && <TimelineTab />}
      </div>

      <div style={{ padding: "12px 24px", borderTop: `1px solid ${bd}`, background: wh, textAlign: "center", fontSize: 11, color: txS }}>NRES Neighbourhood SDA Rota Management System — Technical Specification v2.3 — February 2026</div>
    </div>
  );
}
