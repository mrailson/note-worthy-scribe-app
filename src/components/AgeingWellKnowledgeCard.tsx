import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Palette — tuned to match the existing AgeWell modal (navy header + cream body)
// Tweak here if your theme tokens differ.
// ---------------------------------------------------------------------------
const NAVY = "#103a4a";        // header + headings
const NAVY_SOFT = "#1b4d60";    // hover / secondary navy
const CREAM = "#f5efe3";        // modal body background
const CREAM_CARD = "#ede4d2";   // surface cards inside the cream body
const AMBER = "#d4a14a";        // REFERENCE badge + accent
const INK = "#1f2937";          // body text on cream
const MUTED = "#6b6458";        // secondary text on cream
const CORAL = "#c2593a";        // target-cohort highlight in charts
const NEUTRAL = "#b4ac9b";      // non-target in charts
const PURPLE = "#5c55a7";       // phasing: core funding
const TEAL = "#2e8f6e";         // phasing: EoL nursing
const GOLD = "#c48a1e";         // phasing: OPMH worker

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const frailtyData = [
  { band: "Fit (eFI 0–0.12)", count: 78000, target: false },
  { band: "Mild (0.13–0.24)", count: 32500, target: false },
  { band: "Moderate (0.25–0.36)", count: 13000, target: true },
  { band: "Severe (0.37+)", count: 6500, target: true },
];

const phasingData = [
  { quarter: "Q1 Apr–Jun", core: 17, eol: 0, opmh: 0 },
  { quarter: "Q2 Jul–Sep", core: 17, eol: 1.5, opmh: 0 },
  { quarter: "Q3 Oct–Dec", core: 17, eol: 4.4, opmh: 5.4 },
  { quarter: "Q4 Jan–Mar", core: 17, eol: 4.4, opmh: 5.4 },
];

const cohortCriteria = [
  "Moderate / severe frailty (eFI)",
  "Frequent unplanned primary-care contact",
  "Frequent unplanned acute activity",
  "Open to community nursing (several weeks)",
  "Polypharmacy (10+ medications)",
  "Complex LTCs affecting independence / carer",
  "Complex hospital discharge",
];

const deliveryRows = [
  { req: "Clinical frailty sessions", perPcn: "2/week × 40 wks (1 GP + 1 GP/B7)", total: "1,360 sessions" },
  { req: "Project Lead", perPcn: "1.0 WTE Band 5", total: "17.0 WTE" },
  { req: "Weekly MDT", perPcn: "Multi-agency membership", total: "~850 MDTs/yr" },
  { req: "Extended patient-present reviews", perPcn: "120/yr, ~45 min each", total: "2,040+ reviews" },
  { req: "Group frailty events", perPcn: "6/yr, ≥12 attendees, from Q3", total: "102+ events · 1,224+ seats" },
];

const investmentRows = [
  { stream: "Clinical champion + project lead", alloc: "£91,412.50 per PCN · £1.55M total", live: "1 Apr 2026" },
  { stream: "Specialist EoL nursing", alloc: "0.4 WTE × 6 large + 0.2 × 10 smaller = 4.4 WTE", live: "1 Sep 2026" },
  { stream: "Older-person MH support worker", alloc: "0.6 WTE × 9 neighbourhoods = 5.4 WTE", live: "1 Oct 2026" },
  { stream: "Group session non-staff costs", alloc: "~£260 per session", live: "Q3 onwards" },
];

const partners = [
  { name: "Northamptonshire Healthcare NHS FT", role: "Community services, frailty, CCT" },
  { name: "North & West Northants Councils", role: "Adult Social Care (by geography)" },
  { name: "Northamptonshire Carers", role: "Carer identification & support" },
  { name: "Age UK Northamptonshire", role: "Wellbeing, befriending, advice" },
  { name: "Alzheimer's Society", role: "Dementia support navigation" },
  { name: "Northants Black Communities Together", role: "Health inequalities, reach & equity" },
];

const kpis = [
  { n: 1, group: "Mod/severe frail", measure: "eFI + Rockwood score recorded", source: "Local MDT" },
  { n: 2, group: "10+ medications", measure: "Medication review completed", source: "Local MDT" },
  { n: 3, group: "Complex LTC cohort", measure: "Count of extended reviews", source: "Local MDT" },
  { n: 4, group: "High-intensity users", measure: "Reduction in GP contacts (qtly from Q2)", source: "Local list" },
];

const contacts = [
  { role: "Ageing Well Programme Lead", detail: "NHS Northamptonshire ICB" },
  { role: "Lead PCN Clinical Director", detail: "MOU signatory, Party A" },
  { role: "GP Provider Forum chair", detail: "Central programme coordination" },
  { role: "Data submissions", detail: "Agewell.centre.nhft.nhs.uk" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface AgeingWellKnowledgeCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgeingWellKnowledgeCard({ open, onOpenChange }: AgeingWellKnowledgeCardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 gap-0"
        style={{ backgroundColor: CREAM }}
      >
        {/* Navy header ------------------------------------------------------- */}
        <div className="px-8 pt-8 pb-6 sticky top-0 z-10" style={{ backgroundColor: NAVY }}>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-[11px] font-medium tracking-[0.15em]" style={{ color: AMBER }}>
              REFERENCE
            </span>
            <span className="text-[11px]" style={{ color: "rgba(245,239,227,0.6)" }}>
              v3.0 · aligned to 26/27 MOU · April 2026
            </span>
          </div>
          <DialogTitle
            className="text-3xl font-normal italic m-0"
            style={{ color: CREAM, fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Ageing Well — Northamptonshire
          </DialogTitle>
        </div>

        {/* Body -------------------------------------------------------------- */}
        <div className="px-8 py-8 space-y-8" style={{ color: INK }}>
          {/* Hero metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard label="Participating PCNs" value="17" sub="6 large + 10 smaller" />
            <MetricCard label="Neighbourhoods" value="9" sub="platform for INTs" />
            <MetricCard label="Core 26/27 funding" value="£1.55M" sub="£91,412.50 per PCN" />
            <MetricCard label="Extended reviews/yr" value="2,040+" sub="min 120 per PCN" />
          </div>

          {/* Programme overview */}
          <Section title="Programme overview">
            <p className="leading-relaxed">
              Ageing Well is Northamptonshire's multi-agency{" "}
              <span className="font-medium">Proactive Care</span> programme for frail older adults.
              Each PCN funds a Clinical Frailty Lead and a Band 5 Project Lead who convene a weekly
              MDT drawn from health, adult social care and the voluntary sector. The programme is
              the agreed platform for Integrated Neighbourhood Teams,{" "}
              <span className="font-medium">Pillar One</span> of the Northamptonshire Urgent &
              Emergency Care Strategy, and a foundation for the ICB Neighbourhood Model and Frailty
              Strategy.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
              <InfoTile label="STRATEGIC FIT" text="Pillar One · Northants UEC Strategy" />
              <InfoTile label="POLICY FRAME" text="INT model · DHSC & NHSE guidance" />
              <InfoTile label="FUNDING ENVELOPE" text="ICB Operating Plan · BCF (W/N)" />
            </div>
          </Section>

          {/* Population we serve */}
          <Section title="Population we serve">
            <p className="text-sm mb-3" style={{ color: MUTED }}>
              Target cohort is moderate / severe frailty by eFI, prioritised using seven MOU-defined
              criteria (see below). Majority aged 65+, with discretion to include under-65s who
              would benefit.
            </p>
            <div className="flex flex-wrap gap-4 mb-2 text-xs" style={{ color: MUTED }}>
              <LegendSwatch color={NEUTRAL} label="Wider 65+ population" />
              <LegendSwatch color={CORAL} label="Ageing Well target cohort" />
            </div>
            <div className="w-full h-52">
              <ResponsiveContainer>
                <BarChart
                  data={frailtyData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                >
                  <CartesianGrid horizontal={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${v / 1000}k`}
                    tick={{ fill: MUTED, fontSize: 11 }}
                    axisLine={{ stroke: "rgba(0,0,0,0.15)" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="band"
                    tick={{ fill: INK, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: NAVY, border: "none", borderRadius: 6, fontSize: 12 }}
                    itemStyle={{ color: CREAM }}
                    labelStyle={{ color: CREAM }}
                    formatter={(v: number) => [`${v.toLocaleString()} people`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 4, 4]}>
                    {frailtyData.map((d, i) => (
                      <Cell key={i} fill={d.target ? CORAL : NEUTRAL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Patient cohort criteria */}
          <Section title="Patient cohort — seven MOU criteria">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-sm">
              {cohortCriteria.map((c, i) => (
                <div
                  key={i}
                  className="flex gap-2 px-3 py-2 rounded-md"
                  style={{ backgroundColor: CREAM_CARD }}
                >
                  <span style={{ color: MUTED, fontWeight: 500, minWidth: 14 }}>{i + 1}</span>
                  <span>{c}</span>
                </div>
              ))}
              <div
                className="flex gap-2 px-3 py-2 rounded-md text-sm italic"
                style={{ border: `0.5px dashed ${MUTED}`, color: MUTED }}
              >
                Care home & housebound residents included
              </div>
            </div>
          </Section>

          {/* Delivery requirements */}
          <Section title="What each PCN delivers — MOU minimums">
            <DataTable
              columns={[
                { key: "req", label: "Requirement", width: "38%" },
                { key: "perPcn", label: "Per PCN", width: "34%" },
                { key: "total", label: "Across 17 PCNs", width: "28%", align: "right" },
              ]}
              rows={deliveryRows}
            />
          </Section>

          {/* Investment phasing */}
          <Section title="2026/27 investment — phased through the year">
            <div className="flex flex-wrap gap-4 mb-2 text-xs" style={{ color: MUTED }}>
              <LegendSwatch color={PURPLE} label="Core PCN funding (Apr)" />
              <LegendSwatch color={TEAL} label="EoL nursing uplift (Sep)" />
              <LegendSwatch color={GOLD} label="OPMH support worker (Oct)" />
            </div>
            <div className="w-full h-56 mb-3">
              <ResponsiveContainer>
                <BarChart
                  data={phasingData}
                  margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fill: INK, fontSize: 11 }}
                    axisLine={{ stroke: "rgba(0,0,0,0.15)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: MUTED, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: "PCNs funded + new WTE coming online",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: MUTED, fontSize: 10 },
                      offset: 10,
                    }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: NAVY, border: "none", borderRadius: 6, fontSize: 12 }}
                    itemStyle={{ color: CREAM }}
                    labelStyle={{ color: CREAM }}
                  />
                  <Bar dataKey="core" stackId="a" fill={PURPLE} name="Core (PCNs funded)" />
                  <Bar dataKey="eol" stackId="a" fill={TEAL} name="EoL nursing WTE" />
                  <Bar dataKey="opmh" stackId="a" fill={GOLD} name="OPMH support WTE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTable
              columns={[
                { key: "stream", label: "Stream", width: "40%" },
                { key: "alloc", label: "Allocation", width: "35%" },
                { key: "live", label: "Live from", width: "25%", align: "right" },
              ]}
              rows={investmentRows}
            />
          </Section>

          {/* Partners */}
          <Section title="Partner organisations (ICB service agreements)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {partners.map((p, i) => (
                <div
                  key={i}
                  className="rounded-md px-3 py-2.5"
                  style={{ border: `0.5px solid rgba(0,0,0,0.1)` }}
                >
                  <div className="text-[13px] font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: MUTED }}>
                    {p.role}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* KPIs */}
          <Section title="Reporting — four MOU KPIs (monthly)">
            <DataTable
              columns={[
                { key: "n", label: "#", width: "8%" },
                { key: "group", label: "Patient group", width: "32%" },
                { key: "measure", label: "Measure", width: "38%" },
                { key: "source", label: "Source", width: "22%" },
              ]}
              rows={kpis}
            />
            <p className="text-xs mt-2" style={{ color: MUTED }}>
              Submitted monthly via MS Form to{" "}
              <span className="font-mono">Agewell.centre.nhft.nhs.uk</span>. Payment release
              contingent on submissions.
            </p>
          </Section>

          {/* Governance */}
          <Section title="Governance">
            <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed">
              <li>
                MOU signed between <span className="font-medium">Lead PCN Clinical Director</span>{" "}
                (Party A) and <span className="font-medium">NHS Northamptonshire ICB</span> (Party B)
              </li>
              <li>
                Central coordination via the newly established{" "}
                <span className="font-medium">Northamptonshire GP Provider Forum</span>
              </li>
              <li>
                Operational: <span className="font-medium">Ageing Well Leads Forum</span> (GP +
                Frailty leads across all PCNs)
              </li>
              <li>Four quarterly payments of £22,853.13 per PCN, subject to activity evidence</li>
              <li>
                Aligned to BCF plans (North + West), ICB 5-year plan, Primary Care Strategy (in
                development)
              </li>
            </ul>
          </Section>

          {/* Contacts */}
          <Section title="Key contacts">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {contacts.map((c, i) => (
                <div
                  key={i}
                  className="rounded-md px-3 py-2.5"
                  style={{ border: `0.5px solid rgba(0,0,0,0.1)` }}
                >
                  <div className="text-[13px] font-medium">{c.role}</div>
                  <div className="text-xs" style={{ color: MUTED }}>
                    {c.detail}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <p className="text-[11px] pt-2" style={{ color: MUTED }}>
            Frailty distribution uses Northants 65+ population (~130k) and typical eFI banding; swap
            for live ICB figures when available. All other figures taken from the MOU 2026/27 issued
            to PCNs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-xl font-normal italic mb-3"
        style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md p-3" style={{ backgroundColor: CREAM_CARD }}>
      <div className="text-xs mb-1" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="text-2xl font-medium" style={{ color: NAVY }}>
        {value}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>
        {sub}
      </div>
    </div>
  );
}

function InfoTile({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md px-3 py-2.5" style={{ border: `0.5px solid rgba(0,0,0,0.1)` }}>
      <div className="text-[10px] tracking-wider mb-0.5" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="text-xs leading-snug">{text}</div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

interface Col {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right";
}

function DataTable({ columns, rows }: { columns: Col[]; rows: Record<string, React.ReactNode>[] }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `0.5px solid rgba(0,0,0,0.1)` }}
    >
      <table className="w-full text-[13px]" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ backgroundColor: CREAM_CARD }}>
            {columns.map((c, i) => (
              <th
                key={i}
                className="px-3 py-2 font-medium"
                style={{ color: MUTED, textAlign: c.align ?? "left" }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td
                  key={j}
                  className="px-3 py-2"
                  style={{
                    borderTop: `0.5px solid rgba(0,0,0,0.08)`,
                    textAlign: c.align ?? "left",
                    color: j === 0 ? INK : MUTED,
                  }}
                >
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
