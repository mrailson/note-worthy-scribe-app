import { useState, useMemo } from "react";

const mono = "'JetBrains Mono', monospace";
const sans = "'Plus Jakarta Sans', sans-serif";

interface Practice {
  id: string;
  name: string;
  short: string;
  list: number;
  annualAppts: number;
  weeklyAppts: number;
  winterWk: number;
  nonWinterWk: number;
  isHub: boolean;
  x: number;
  y: number;
}

const practices: Practice[] = [
  { id: "K83007", name: "Harborough Field Surgery", short: "Harborough Field", list: 13991, annualAppts: 11604, weeklyAppts: 222, winterWk: 253, nonWinterWk: 213, isHub: true, x: 58, y: 68 },
  { id: "K83023", name: "Oundle Medical Practice", short: "Oundle", list: 10600, annualAppts: 8792, weeklyAppts: 169, winterWk: 193, nonWinterWk: 161, isHub: false, x: 72, y: 6 },
  { id: "K83024", name: "Rushden Medical Centre", short: "Rushden MC", list: 9143, annualAppts: 7583, weeklyAppts: 146, winterWk: 166, nonWinterWk: 139, isHub: false, x: 52, y: 73 },
  { id: "K83028", name: "Spinney Brook Medical Centre", short: "Spinney Brook", list: 11537, annualAppts: 9569, weeklyAppts: 184, winterWk: 210, nonWinterWk: 175, isHub: false, x: 38, y: 56 },
  { id: "K83030", name: "The Cottons Medical Centre", short: "The Cottons", list: 9372, annualAppts: 7773, weeklyAppts: 149, winterWk: 171, nonWinterWk: 142, isHub: true, x: 55, y: 40 },
  { id: "K83044", name: "Parklands Medical Centre", short: "Parklands", list: 13612, annualAppts: 11290, weeklyAppts: 217, winterWk: 248, nonWinterWk: 207, isHub: false, x: 48, y: 78 },
  { id: "K83065", name: "Nene Valley Surgery", short: "Nene Valley", list: 6921, annualAppts: 5740, weeklyAppts: 110, winterWk: 126, nonWinterWk: 105, isHub: false, x: 60, y: 28 },
  { id: "K83069", name: "Marshalls Road Surgery", short: "Marshalls Rd", list: 3156, annualAppts: 2618, weeklyAppts: 50, winterWk: 57, nonWinterWk: 48, isHub: false, x: 52, y: 43 },
  { id: "K83080", name: "Higham Ferrers Surgery", short: "Higham Ferrers", list: 5569, annualAppts: 4619, weeklyAppts: 89, winterWk: 101, nonWinterWk: 85, isHub: false, x: 50, y: 62 },
  { id: "K83616", name: "The Meadows Surgery", short: "The Meadows", list: 6340, annualAppts: 5258, weeklyAppts: 101, winterWk: 115, nonWinterWk: 96, isHub: true, x: 25, y: 60 },
];

const driveTimes = [
  [ 0, 24, 3, 8, 10,  4, 15, 11,  4, 14],
  [24,  0, 26, 20, 14, 27, 10, 13, 22, 28],
  [ 3, 26,  0,  7, 12,  2, 17, 13,  3, 12],
  [ 8, 20,  7,  0,  8, 10, 13,  9,  5,  6],
  [10, 14, 12,  8,  0, 13,  8,  2,  9, 16],
  [ 4, 27,  2, 10, 13,  0, 18, 14,  5, 11],
  [15, 10, 17, 13,  8, 18,  0,  7, 14, 20],
  [11, 13, 13,  9,  2, 14,  7,  0, 10, 17],
  [ 4, 22,  3,  5,  9,  5, 14, 10,  0, 11],
  [14, 28, 12,  6, 16, 11, 20, 17, 11,  0],
];

/** Miles from each spoke to its assigned hub */
const hubMiles: Record<string, number> = {
  "K83007": 0, "K83044": 1.1, "K83024": 1.1, "K83080": 2.4,
  "K83030": 0, "K83028": 5.2, "K83069": 0.4,
  "K83616": 0, "K83023": 8, "K83065": 0,
};

/** Bus service from spoke to hub */
const hubBus: Record<string, string> = {
  "K83044": "25", "K83024": "X46", "K83080": "94",
  "K83028": "X47", "K83069": "X47",
  "K83023": "94/DTRS", "K83065": "16",
};

/** Travel from each practice to Corby Urgent Care Centre */
const cuccTravel: Record<string, { miles: number; carMin: number; publicTransport: string; bus: string }> = {
  "K83007": { miles: 21.3, carMin: 34, publicTransport: "2h 8m", bus: "X46/EMR/X4/1" },
  "K83028": { miles: 17.8, carMin: 30, publicTransport: "1h 28m", bus: "48/EMR/X4" },
  "K83030": { miles: 23, carMin: 33, publicTransport: "1h 43m", bus: "16/X4/1" },
  "K83044": { miles: 22.3, carMin: 38, publicTransport: "1h 55m", bus: "46/X4" },
  "K83065": { miles: 19.4, carMin: 29, publicTransport: "1h 23m", bus: "X16/X4/DTRS" },
  "K83069": { miles: 23.4, carMin: 33, publicTransport: "2h 5m", bus: "16/X4/1" },
  "K83080": { miles: 19.6, carMin: 11, publicTransport: "2h 12m", bus: "50/X4" },
  "K83616": { miles: 19.3, carMin: 29, publicTransport: "1h 23m", bus: "X16/DTRS/X4" },
  "K83023": { miles: 12.9, carMin: 26, publicTransport: "0h 56m", bus: "X4" },
  "K83024": { miles: 21.9, carMin: 37, publicTransport: "1h 30m", bus: "X47/X4" },
};

const hubAssignments: Record<string, string> = {
  "K83007": "K83007", "K83024": "K83007", "K83044": "K83007", "K83080": "K83007",
  "K83028": "K83030", "K83030": "K83030", "K83069": "K83030",
  "K83616": "K83616", "K83023": "K83616", "K83065": "K83616",
};

const hubColors: Record<string, { main: string; dark: string; light: string; glow: string; accent: string; mid: string }> = {
  "K83007": { main: "#005EB8", dark: "#003A75", light: "#E8F1FA", glow: "rgba(0,94,184,0.15)", accent: "#0072CE", mid: "#4A90D9" },
  "K83030": { main: "#00875A", dark: "#005C3E", light: "#E6F5EE", glow: "rgba(0,135,90,0.15)", accent: "#00A86B", mid: "#3AAF7F" },
  "K83616": { main: "#D4531E", dark: "#A13D12", light: "#FDF0EB", glow: "rgba(212,83,30,0.15)", accent: "#E8662A", mid: "#E07A4A" },
};

const hubIncomes: Record<string, number> = { "K83007": 1114154, "K83030": 633631, "K83616": 628260 };

function getDriveColor(mins: number) {
  if (mins <= 5) return { color: "#00875A", bg: "#E6F5EE" };
  if (mins <= 10) return { color: "#3A9A6E", bg: "#EDF7F2" };
  if (mins <= 15) return { color: "#C68A00", bg: "#FFF8E6" };
  if (mins <= 20) return { color: "#D4531E", bg: "#FDF0EB" };
  return { color: "#CC3333", bg: "#FCECEC" };
}

function SpokeRow({ practice, hubId, isLast }: { practice: Practice; hubId: string; isLast: boolean }) {
  const hubIdx = practices.findIndex(p => p.id === hubId);
  const practiceIdx = practices.findIndex(p => p.id === practice.id);
  const mins = driveTimes[hubIdx][practiceIdx];
  const driveCol = getDriveColor(mins);
  const isHubSelf = practice.id === hubId;
  const hc = hubColors[hubId];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(170px, 1.4fr) 80px 85px 85px 85px 85px 80px",
      gap: 8, padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid #f0f2f5",
      alignItems: "center", background: isHubSelf ? hc.light : "white", transition: "background 0.15s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isHubSelf ? (
          <span style={{ color: "white", fontSize: 7, fontWeight: 700, letterSpacing: 1, fontFamily: mono, background: hc.main, padding: "2px 8px", borderRadius: 4 }}>HUB</span>
        ) : (
          <span style={{ color: "#8a9aaa", fontSize: 7, fontWeight: 600, letterSpacing: 1, fontFamily: mono, background: "#f0f2f5", padding: "2px 6px", borderRadius: 4 }}>SPOKE</span>
        )}
        <div>
          <div style={{ color: "#1a2a3a", fontSize: 11, fontWeight: isHubSelf ? 700 : 600, fontFamily: sans }}>{practice.short}</div>
          <div style={{ color: "#aabbcc", fontSize: 8, fontFamily: mono }}>{practice.id}</div>
          {practice.id === "K83028" && (
            <div style={{ color: "#8a9aaa", fontSize: 7, fontFamily: sans, fontStyle: "italic", marginTop: 1 }}>Incl. Woodford Surgery (branch)</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#1a2a3a", fontSize: 13, fontWeight: 700, fontFamily: mono }}>{practice.list.toLocaleString()}</div>
        <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1 }}>PATIENTS</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: hc.main, fontSize: 13, fontWeight: 700, fontFamily: mono }}>{practice.weeklyAppts}</div>
        <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1 }}>WEEKLY</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#6a7a8a", fontSize: 12, fontWeight: 600, fontFamily: mono }}>{practice.annualAppts.toLocaleString()}</div>
        <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1 }}>ANNUAL</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#00875A", fontSize: 13, fontWeight: 700, fontFamily: mono }}>{practice.nonWinterWk}</div>
        <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1 }}>NON-WIN</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#D4531E", fontSize: 13, fontWeight: 700, fontFamily: mono }}>{practice.winterWk}</div>
        <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1 }}>WINTER</div>
      </div>
      <div style={{ textAlign: "center" }}>
        {isHubSelf ? (
          <div style={{ color: hc.main, fontSize: 9, fontFamily: mono, fontWeight: 700 }}>📍 Base</div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: driveCol.bg, padding: "4px 10px", borderRadius: 6, border: `1px solid ${driveCol.color}25` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: driveCol.color }} />
            <span style={{ color: driveCol.color, fontSize: 11, fontWeight: 700, fontFamily: mono }}>{mins}m</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HubPanel({ hubId, isExpanded, onToggle }: { hubId: string; isExpanded: boolean; onToggle: () => void }) {
  const hub = practices.find(p => p.id === hubId)!;
  const hc = hubColors[hubId];
  const members = practices.filter(p => hubAssignments[p.id] === hubId);
  const totalList = members.reduce((s, m) => s + m.list, 0);
  const totalWeekly = members.reduce((s, m) => s + m.weeklyAppts, 0);
  const totalAnnual = members.reduce((s, m) => s + m.annualAppts, 0);
  const totalNonWinter = members.reduce((s, m) => s + m.nonWinterWk, 0);
  const totalWinter = members.reduce((s, m) => s + m.winterWk, 0);
  const income = hubIncomes[hubId];

  const sorted = [...members].sort((a, b) => {
    if (a.id === hubId) return -1;
    if (b.id === hubId) return 1;
    return b.list - a.list;
  });

  return (
    <div style={{
      background: "white", border: `1px solid ${isExpanded ? hc.main + "60" : "#e8ecf0"}`,
      borderRadius: 12, overflow: "hidden",
      boxShadow: isExpanded ? `0 4px 20px ${hc.glow}` : "0 1px 4px rgba(0,40,80,0.04)",
      transition: "all 0.25s ease", marginBottom: 14,
    }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", cursor: "pointer",
        borderBottom: isExpanded ? `2px solid ${hc.main}20` : "none",
        borderLeft: `5px solid ${hc.main}`, background: isExpanded ? hc.light : "white",
        transition: "background 0.2s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: hc.main, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${hc.glow}` }}>
            <span style={{ color: "white", fontSize: 14, fontWeight: 800, fontFamily: mono }}>H</span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#1a2a3a", fontSize: 16, fontWeight: 800, fontFamily: sans }}>{hub.short}</span>
              <span style={{ color: hc.main, fontSize: 8, fontWeight: 700, letterSpacing: 2, fontFamily: mono }}>HUB</span>
            </div>
            <div style={{ color: "#8a9aaa", fontSize: 9, fontFamily: mono, marginTop: 2 }}>{members.length} practices · {hub.id}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[
            { label: "PATIENTS", value: totalList.toLocaleString(), color: hc.main },
            { label: "WEEKLY", value: String(totalWeekly), color: "#00875A" },
            { label: "INCOME", value: `£${(income / 1000).toFixed(0)}K`, color: "#C68A00" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", minWidth: 70 }}>
              <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1.5, fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 16, fontWeight: 800, fontFamily: mono }}>{s.value}</div>
            </div>
          ))}
          <div style={{ color: "#aabbcc", fontSize: 18, transition: "transform 0.2s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", marginLeft: 8 }}>▾</div>
        </div>
      </div>

      {isExpanded && (
        <div>
          <div style={{
            display: "grid", gridTemplateColumns: "minmax(170px, 1.4fr) 80px 85px 85px 85px 85px 80px",
            gap: 8, padding: "8px 16px", borderBottom: "1px solid #e8ecf0", background: "#f8f9fb",
          }}>
            {["Practice", "List Size", "Weekly", "Annual", "Non-Winter", "Winter", "Drive"].map((h, i) => (
              <div key={i} style={{ color: "#8a9aaa", fontSize: 7, fontFamily: mono, fontWeight: 700, letterSpacing: 1.5, textAlign: i === 0 ? "left" : i === 1 ? "right" : "center" }}>{h}</div>
            ))}
          </div>
          {sorted.map((p, i) => (
            <SpokeRow key={p.id} practice={p} hubId={hubId} isLast={i === sorted.length - 1} />
          ))}
          <div style={{
            display: "grid", gridTemplateColumns: "minmax(170px, 1.4fr) 80px 85px 85px 85px 85px 80px",
            gap: 8, padding: "10px 16px", background: hc.light, borderTop: `2px solid ${hc.main}20`,
          }}>
            <div style={{ color: hc.dark, fontSize: 10, fontWeight: 700, fontFamily: sans, display: "flex", alignItems: "center" }}>Hub Total</div>
            <div style={{ textAlign: "right", color: hc.dark, fontSize: 13, fontWeight: 800, fontFamily: mono }}>{totalList.toLocaleString()}</div>
            <div style={{ textAlign: "center", color: hc.dark, fontSize: 13, fontWeight: 800, fontFamily: mono }}>{totalWeekly}</div>
            <div style={{ textAlign: "center", color: hc.dark, fontSize: 12, fontWeight: 700, fontFamily: mono }}>{totalAnnual.toLocaleString()}</div>
            <div style={{ textAlign: "center", color: "#00875A", fontSize: 13, fontWeight: 800, fontFamily: mono }}>{totalNonWinter}</div>
            <div style={{ textAlign: "center", color: "#D4531E", fontSize: 13, fontWeight: 800, fontFamily: mono }}>{totalWinter}</div>
            <div style={{ textAlign: "center", color: "#8a9aaa", fontSize: 8, fontFamily: mono }}>—</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapView({ selected, setSelected }: { selected: number | null; setSelected: (v: number | null) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [driveScope, setDriveScope] = useState<"hub" | "all">("hub");
  const W = 700, H = 700;
  const pad = 80;
  const toX = (pct: number) => pad + (pct / 100) * (W - pad * 2);
  const toY = (pct: number) => pad + (pct / 100) * (H - pad * 2);

  const handleMarkerClick = (i: number) => {
    const p = practices[i];
    if (selected === i) {
      if (p.isHub && driveScope === "hub") {
        setDriveScope("all");
      } else {
        setSelected(null);
        setDriveScope("hub");
      }
    } else {
      setSelected(i);
      setDriveScope(p.isHub ? "hub" : "all");
    }
  };

  const visibleTargets = useMemo(() => {
    if (selected === null) return [];
    const selPractice = practices[selected];
    if (selPractice.isHub && driveScope === "hub") {
      return practices.map((_, i) => i).filter(i => i !== selected && hubAssignments[practices[i].id] === selPractice.id);
    }
    return practices.map((_, i) => i).filter(i => i !== selected);
  }, [selected, driveScope]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs><filter id="dropShadow"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.12)" /></filter></defs>
        {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1={0} y1={H * i / 8} x2={W} y2={H * i / 8} stroke="rgba(0,94,184,0.04)" strokeWidth="0.5" />)}
        {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={W * i / 8} y1={0} x2={W * i / 8} y2={H} stroke="rgba(0,94,184,0.03)" strokeWidth="0.5" />)}
        {practices.filter(p => p.isHub).map((p) => {
          const hc = hubColors[p.id];
          return <circle key={`zone${p.id}`} cx={toX(p.x)} cy={toY(p.y)} r={50} fill={hc.glow} stroke={hc.main} strokeWidth="0.8" strokeDasharray="6 4" opacity={0.5} />;
        })}
        {practices.map((p, i) => {
          const hubId = hubAssignments[p.id];
          if (hubId === p.id) return null;
          const hub = practices.find(h => h.id === hubId)!;
          return <line key={`conn${i}`} x1={toX(p.x)} y1={toY(p.y)} x2={toX(hub.x)} y2={toY(hub.y)} stroke={hubColors[hubId].main} strokeWidth="0.8" strokeDasharray="4 4" opacity={0.15} />;
        })}
        {selected !== null && visibleTargets.map((i) => {
          const p = practices[i];
          const mins = driveTimes[selected][i];
          const { color } = getDriveColor(mins);
          const from = practices[selected];
          const midX = (toX(from.x) + toX(p.x)) / 2;
          const midY = (toY(from.y) + toY(p.y)) / 2;
          return (
            <g key={`drive${i}`}>
              <line x1={toX(from.x)} y1={toY(from.y)} x2={toX(p.x)} y2={toY(p.y)} stroke={color} strokeWidth="2.5" opacity={0.35} />
              <line x1={toX(from.x)} y1={toY(from.y)} x2={toX(p.x)} y2={toY(p.y)} stroke={color} strokeWidth="1.2" opacity={0.8} />
              <rect x={midX - 16} y={midY - 10} width={32} height={20} rx={6} fill="white" stroke={color} strokeWidth="1.2" filter="url(#dropShadow)" />
              <text x={midX} y={midY + 4} textAnchor="middle" fill={color} fontSize="10" fontFamily={mono} fontWeight="700">{mins}m</text>
            </g>
          );
        })}
        <text x={toX(25)} y={toY(52)} textAnchor="middle" fill="rgba(0,40,80,0.1)" fontSize="9" fontFamily={sans} fontWeight="700" letterSpacing="4">WELLINGBOROUGH</text>
        <text x={toX(50)} y={toY(85)} textAnchor="middle" fill="rgba(0,40,80,0.1)" fontSize="9" fontFamily={sans} fontWeight="700" letterSpacing="4">RUSHDEN</text>
        <text x={toX(53)} y={toY(48)} textAnchor="middle" fill="rgba(0,40,80,0.1)" fontSize="8" fontFamily={sans} fontWeight="700" letterSpacing="3">RAUNDS</text>
        <text x={toX(60)} y={toY(22)} textAnchor="middle" fill="rgba(0,40,80,0.1)" fontSize="8" fontFamily={sans} fontWeight="700" letterSpacing="3">THRAPSTON</text>
        <text x={toX(72)} y={toY(1)} textAnchor="middle" fill="rgba(0,40,80,0.1)" fontSize="8" fontFamily={sans} fontWeight="700" letterSpacing="3">OUNDLE</text>
        {practices.map((p, i) => {
          const isSelected = selected === i;
          const isHovered = hovered === i;
          const hubId = hubAssignments[p.id];
          const hc = hubColors[hubId];
          const markerColor = p.isHub ? hc.main : hc.accent;
          const r = p.isHub ? 11 : 7;
          const isInScope = selected === null || visibleTargets.includes(i) || i === selected;
          const dimmed = selected !== null && !isInScope;
          return (
            <g key={`marker${i}`} style={{ cursor: "pointer", opacity: dimmed ? 0.25 : 1, transition: "opacity 0.2s ease" }} onClick={() => handleMarkerClick(i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {p.isHub && <circle cx={toX(p.x)} cy={toY(p.y)} r={18} fill="none" stroke={markerColor} strokeWidth="1.2" opacity={0.25} style={{ animation: "pulse 2.5s ease-in-out infinite" }} />}
              {isSelected && <circle cx={toX(p.x)} cy={toY(p.y)} r={r + 7} fill="none" stroke={markerColor} strokeWidth="2" opacity={0.5} />}
              <circle cx={toX(p.x)} cy={toY(p.y) + 1} r={r} fill="rgba(0,0,0,0.06)" />
              {p.isHub ? (
                <g><circle cx={toX(p.x)} cy={toY(p.y)} r={r} fill={isSelected || isHovered ? markerColor : "white"} stroke={markerColor} strokeWidth="2.5" /><text x={toX(p.x)} y={toY(p.y) + 4} textAnchor="middle" fill={isSelected || isHovered ? "white" : markerColor} fontSize="9" fontFamily={mono} fontWeight="800">H</text></g>
              ) : (
                <circle cx={toX(p.x)} cy={toY(p.y)} r={r} fill={isSelected || isHovered ? markerColor : "white"} stroke={markerColor} strokeWidth="2" />
              )}
              <text x={toX(p.x)} y={toY(p.y) - (p.isHub ? 18 : 13)} textAnchor="middle" fill={isSelected || isHovered ? hc.dark : "rgba(0,40,80,0.5)"} fontSize={p.isHub ? "10" : "9"} fontFamily={sans} fontWeight={p.isHub ? "700" : "600"}>{p.short}</text>
              {p.isHub && <text x={toX(p.x)} y={toY(p.y) + 24} textAnchor="middle" fill={markerColor} fontSize="10" fontFamily={mono} fontWeight="800" letterSpacing="2">HUB</text>}
            </g>
          );
        })}
      </svg>

      {selected !== null && (
        <div style={{ position: "absolute", top: 10, left: 10, background: "white", border: "1px solid rgba(0,40,80,0.1)", borderRadius: 12, padding: "14px 16px", width: 220, zIndex: 20, boxShadow: "0 8px 32px rgba(0,40,80,0.1)" }}>
          <div style={{ color: "#005EB8", fontSize: 8, letterSpacing: 2, fontFamily: mono, marginBottom: 3, fontWeight: 600 }}>DRIVE TIMES FROM</div>
          <div style={{ color: "#1a2a3a", fontSize: 12, fontWeight: 700, fontFamily: sans, marginBottom: 4 }}>{practices[selected].short}</div>
          {practices[selected].isHub && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #E8F1FA" }}>
              <div style={{ display: "flex", gap: 2, background: "#f0f2f5", borderRadius: 5, padding: 2, flex: 1 }}>
                <button onClick={(e) => { e.stopPropagation(); setDriveScope("hub"); }} style={{ flex: 1, background: driveScope === "hub" ? "white" : "transparent", border: driveScope === "hub" ? "1px solid #dde2e8" : "1px solid transparent", color: driveScope === "hub" ? "#005EB8" : "#8a9aaa", padding: "4px 8px", fontSize: 7, fontFamily: mono, fontWeight: 700, borderRadius: 4, cursor: "pointer", letterSpacing: 1 }}>HUB ONLY</button>
                <button onClick={(e) => { e.stopPropagation(); setDriveScope("all"); }} style={{ flex: 1, background: driveScope === "all" ? "white" : "transparent", border: driveScope === "all" ? "1px solid #dde2e8" : "1px solid transparent", color: driveScope === "all" ? "#005EB8" : "#8a9aaa", padding: "4px 8px", fontSize: 7, fontFamily: mono, fontWeight: 700, borderRadius: 4, cursor: "pointer", letterSpacing: 1 }}>ALL ENN</button>
              </div>
            </div>
          )}
          {!practices[selected].isHub && (
            <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #E8F1FA" }} />
          )}
          {visibleTargets
            .map(i => ({ practice: practices[i], mins: driveTimes[selected][i], idx: i }))
            .sort((a, b) => a.mins - b.mins)
            .map((r, i) => {
              const { color, bg } = getDriveColor(r.mins);
              const isHubMember = hubAssignments[r.practice.id] === practices[selected!].id;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < visibleTargets.length - 1 ? "1px solid #f0f2f5" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
                    <span style={{ color: isHubMember || !practices[selected!].isHub ? "#3a4a5a" : "#8a9aaa", fontSize: 9, fontFamily: sans, fontWeight: isHubMember ? 600 : 400 }}>{r.practice.short}</span>
                    {r.practice.isHub && <span style={{ color: "white", fontSize: 5, fontWeight: 700, fontFamily: mono, background: hubColors[r.practice.id].main, padding: "1px 3px", borderRadius: 2 }}>HUB</span>}
                  </div>
                  <span style={{ color, fontSize: 10, fontWeight: 700, fontFamily: mono, background: bg, padding: "2px 6px", borderRadius: 4 }}>{r.mins}m</span>
                </div>
              );
            })}
          <div style={{ marginTop: 8, color: "#aabbcc", fontSize: 7, fontFamily: mono, textAlign: "center", letterSpacing: 1 }}>
            {practices[selected].isHub ? (driveScope === "hub" ? "Click hub again for all ENN" : "Click hub again to close") : "Click practice again to close"}
          </div>
        </div>
      )}

      {selected === null && (
        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", color: "#8a9aaa", fontSize: 8, fontFamily: mono, fontWeight: 600, letterSpacing: 2, background: "white", padding: "6px 16px", borderRadius: 6, border: "1px solid #e8ecf0" }}>
          CLICK A HUB FOR ITS PRACTICES · CLICK AGAIN FOR ALL ENN
        </div>
      )}
    </div>
  );
}

export const ENNNeighbourhoodMap = () => {
  const [view, setView] = useState("hubs");
  const [selected, setSelected] = useState<number | null>(null);
  const [expandedHubs, setExpandedHubs] = useState<Record<string, boolean>>({ "K83007": true, "K83030": false, "K83616": false });

  const totalPatients = practices.reduce((s, p) => s + p.list, 0);
  const totalWeekly = practices.reduce((s, p) => s + p.weeklyAppts, 0);

  const toggleHub = (id: string) => setExpandedHubs(prev => ({ ...prev, [id]: !prev[id] }));

  const hubOrder = ["K83007", "K83030", "K83616"];

  return (
    <div style={{ background: "linear-gradient(145deg, #f6f8fb 0%, #eef2f7 50%, #f0f4f9 100%)", minHeight: "100%", padding: 24, fontFamily: sans, color: "#1a2a3a", position: "relative", overflow: "auto" }}>
      <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, background: "radial-gradient(circle, rgba(0,94,184,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, position: "relative", zIndex: 10 }}>
        <div>
          <div style={{ color: "#005EB8", fontSize: 9, letterSpacing: 3, marginBottom: 6, fontFamily: mono, fontWeight: 600, opacity: 0.7 }}>NOTEWELL AI · NEIGHBOURHOOD ACCESS SERVICE</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a2a3a", letterSpacing: -0.5 }}>East Northants Neighbourhood</div>
          <div style={{ color: "#8a9aaa", fontSize: 10, letterSpacing: 1, marginTop: 4, fontFamily: mono }}>ENN · 3SIXTY CARE PARTNERSHIP · 10 PRACTICES · 3 HUBS</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "PATIENTS", value: totalPatients.toLocaleString(), color: "#005EB8" },
            { label: "WEEKLY APPTS", value: totalWeekly.toLocaleString(), color: "#00875A" },
            { label: "ANNUAL BUDGET", value: "£2.38M", color: "#C68A00" },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: "center", padding: "10px 20px", background: "white", border: `1px solid ${stat.color}20`, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,40,80,0.04)" }}>
              <div style={{ color: "#8a9aaa", fontSize: 7, letterSpacing: 2, marginBottom: 5, fontFamily: mono, fontWeight: 600 }}>{stat.label}</div>
              <div style={{ color: stat.color, fontSize: 22, fontWeight: 800, fontFamily: mono }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, position: "relative", zIndex: 10 }}>
        {[{ id: "hubs", label: "HUB VIEW" }, { id: "map", label: "MAP & DRIVE TIMES" }].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id); setSelected(null); }} style={{ background: view === tab.id ? "#005EB8" : "white", border: `1px solid ${view === tab.id ? "#005EB8" : "#dde2e8"}`, color: view === tab.id ? "white" : "#6a7a8a", padding: "9px 22px", fontSize: 9, letterSpacing: 2, fontFamily: mono, fontWeight: 700, borderRadius: 6, cursor: "pointer", boxShadow: view === tab.id ? "0 2px 8px rgba(0,94,184,0.2)" : "none" }}>
            {tab.label}
          </button>
        ))}
        {view === "hubs" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button onClick={() => setExpandedHubs({ "K83007": true, "K83030": true, "K83616": true })} style={{ background: "white", border: "1px solid #dde2e8", color: "#6a7a8a", padding: "8px 14px", fontSize: 9, fontFamily: mono, fontWeight: 600, borderRadius: 6, cursor: "pointer", letterSpacing: 1 }}>
              Expand All
            </button>
            <button onClick={() => setExpandedHubs({ "K83007": false, "K83030": false, "K83616": false })} style={{ background: "white", border: "1px solid #dde2e8", color: "#6a7a8a", padding: "8px 14px", fontSize: 9, fontFamily: mono, fontWeight: 600, borderRadius: 6, cursor: "pointer", letterSpacing: 1 }}>
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10 }}>
        {view === "hubs" && (
          <div>
            {hubOrder.map(hubId => (
              <HubPanel key={hubId} hubId={hubId} isExpanded={expandedHubs[hubId]} onToggle={() => toggleHub(hubId)} />
            ))}
            <div style={{ background: "white", border: "1px solid #e8ecf0", borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,40,80,0.04)" }}>
              <div style={{ color: "#8a9aaa", fontSize: 8, fontFamily: mono, fontWeight: 600, letterSpacing: 1.5 }}>DRIVE TIME KEY</div>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { color: "#00875A", bg: "#E6F5EE", label: "≤ 10 min" },
                  { color: "#C68A00", bg: "#FFF8E6", label: "11-15 min" },
                  { color: "#D4531E", bg: "#FDF0EB", label: "16-20 min" },
                  { color: "#CC3333", bg: "#FCECEC", label: "20+ min" },
                ].map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: l.bg, padding: "4px 12px", borderRadius: 6, border: `1px solid ${l.color}20` }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                    <span style={{ color: l.color, fontSize: 9, fontFamily: mono, fontWeight: 600 }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ color: "#8a9aaa", fontSize: 8, fontFamily: mono }}>Total: £{(2376045).toLocaleString()}</div>
            </div>
          </div>
        )}

        {view === "map" && (
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: "1 1 62%", background: "white", border: "1px solid #e8ecf0", borderRadius: 12, height: 560, position: "relative", overflow: "hidden", boxShadow: "0 2px 16px rgba(0,40,80,0.04)" }}>
              <MapView selected={selected} setSelected={setSelected} />
            </div>
            <div style={{ flex: "1 1 38%", display: "flex", flexDirection: "column", gap: 10 }}>
              {practices.filter(p => p.isHub).map(hub => {
                const hc = hubColors[hub.id];
                const members = practices.filter(p => hubAssignments[p.id] === hub.id);
                const totalList = members.reduce((s, m) => s + m.list, 0);
                const totalWeeklyHub = members.reduce((s, m) => s + m.weeklyAppts, 0);
                return (
                  <div key={hub.id} onClick={() => { const idx = practices.findIndex(p => p.id === hub.id); setSelected(selected === idx ? null : idx); }} style={{ background: "white", border: `1px solid ${selected !== null && hubAssignments[practices[selected].id] === hub.id ? hc.main : hc.main + "30"}`, borderRadius: 10, padding: "12px 14px", borderLeft: `4px solid ${hc.main}`, cursor: "pointer", boxShadow: selected !== null && hubAssignments[practices[selected].id] === hub.id ? `0 2px 12px ${hc.glow}` : "0 1px 4px rgba(0,40,80,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: hc.main }} />
                      <span style={{ color: hc.dark, fontSize: 11, fontWeight: 800, fontFamily: sans }}>{hub.short} Hub</span>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div><div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1.5 }}>PATIENTS</div><div style={{ color: "#1a2a3a", fontSize: 16, fontWeight: 800, fontFamily: mono }}>{totalList.toLocaleString()}</div></div>
                      <div><div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1.5 }}>WEEKLY</div><div style={{ color: "#1a2a3a", fontSize: 16, fontWeight: 800, fontFamily: mono }}>{totalWeeklyHub}</div></div>
                      <div><div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1.5 }}>PRACTICES</div><div style={{ color: "#1a2a3a", fontSize: 16, fontWeight: 800, fontFamily: mono }}>{members.length}</div></div>
                    </div>
                  </div>
                );
              })}
              <div style={{ background: "white", border: "1px solid #e8ecf0", borderRadius: 10, padding: "12px 14px", marginTop: "auto" }}>
                <div style={{ color: "#8a9aaa", fontSize: 7, fontFamily: mono, letterSpacing: 2, fontWeight: 600, marginBottom: 8 }}>ENN TOTALS</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ label: "Practices", value: "10", color: "#005EB8" }, { label: "Hubs", value: "3", color: "#005EB8" }, { label: "Annual", value: "74,846", color: "#C68A00" }, { label: "Winter", value: "821", color: "#D4531E" }].map((s, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center", padding: "6px 4px", background: "#f8f9fb", borderRadius: 6 }}>
                      <div style={{ color: "#aabbcc", fontSize: 6, fontFamily: mono, letterSpacing: 1 }}>{s.label}</div>
                      <div style={{ color: s.color, fontSize: 12, fontWeight: 800, fontFamily: mono }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ color: "#c0c8d0", fontSize: 8, letterSpacing: 2, marginTop: 24, textAlign: "center", fontFamily: mono, fontWeight: 600 }}>
        PCN SERVICES LTD · ENN PROGRAMME · APPOINTMENT PLANNING MODEL · 2026
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
};
