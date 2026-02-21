import { useState, useEffect } from "react";

const practices = [
  { name: "The Parks Medical Practice", short: "THE PARKS", lat: 52.2080, lng: -0.8870, type: "hub", patients: "22,827", postcode: "NN4 5DW", area: "Grange Park", pct: "25.5%", system: "SystmOne", monthly: "£50,886", budget75: "£458,776", nonWinterWk: 347.0, winterWk: 415.5, annual: "18,933",
    branches: [
      { name: "Roade", lat: 52.2250, lng: -0.9200 },
      { name: "Hanslope", lat: 52.2950, lng: -0.8350 },
      { name: "Blisworth", lat: 52.2150, lng: -0.9380 },
    ]},
  { name: "Brackley Medical Centre", short: "BRACKLEY MC", lat: 52.0380, lng: -1.1580, type: "hub", patients: "16,212", postcode: "NN13 6QZ", area: "Brackley", pct: "18.1%", system: "SystmOne", monthly: "£35,572", budget75: "£320,146", nonWinterWk: 246.4, winterWk: 295.1, annual: "13,446", branches: [] },
  { name: "Brook Health Centre", short: "BROOK HC", lat: 52.1290, lng: -0.9880, type: "spoke", patients: "9,069", postcode: "NN12 6HD", area: "Towcester", pct: "10.1%", system: "SystmOne", monthly: "£19,899", budget75: "£179,090", nonWinterWk: 137.8, winterWk: 165.1, annual: "7,522",
    branches: [
      { name: "Silverstone", lat: 52.0880, lng: -1.0280 },
    ]},
  { name: "Towcester Medical Centre", short: "TOWCESTER MC", lat: 52.1330, lng: -0.9940, type: "spoke", patients: "11,748", postcode: "NN12 6HH", area: "Towcester", pct: "13.1%", system: "EMIS", monthly: "£25,777", budget75: "£231,994", nonWinterWk: 178.6, winterWk: 213.8, annual: "9,744",
    branches: [
      { name: "Paulerspury", lat: 52.1050, lng: -1.0200 },
    ]},
  { name: "Denton Village Surgery", short: "DENTON VS", lat: 52.2700, lng: -0.8540, type: "spoke", patients: "6,329", postcode: "NN7 1HT", area: "Denton", pct: "7.1%", system: "SystmOne", monthly: "£13,887", budget75: "£124,982", nonWinterWk: 96.2, winterWk: 115.2, annual: "5,249", branches: [] },
  { name: "Bugbrooke Medical Practice", short: "BUGBROOKE", lat: 52.2280, lng: -1.0280, type: "spoke", patients: "10,788", postcode: "NN7 3QN", area: "Bugbrooke", pct: "12.0%", system: "SystmOne", monthly: "£23,671", budget75: "£213,036", nonWinterWk: 164.0, winterWk: 196.3, annual: "8,948", branches: [] },
  { name: "Springfield Surgery", short: "SPRINGFIELD", lat: 52.0260, lng: -1.1280, type: "spoke", patients: "12,611", postcode: "NN13 6AN", area: "Brackley", pct: "14.1%", system: "EMIS", monthly: "£27,671", budget75: "£249,036", nonWinterWk: 191.7, winterWk: 229.5, annual: "10,460", branches: [] },
];

const driveTimes = [
  [0,  28, 18, 18, 17, 18, 30],
  [28,  0, 16, 16, 39, 25,  2],
  [18, 16,  0,  2, 29, 16, 18],
  [18, 16,  2,  0, 29, 16, 18],
  [17, 39, 29, 29,  0, 29, 41],
  [18, 25, 16, 16, 29,  0, 27],
  [30,  2, 18, 18, 41, 27,  0],
];

function getDriveColor(mins) {
  if (mins <= 15) return { color: "#00ff88" };
  if (mins <= 25) return { color: "#ff9500" };
  return { color: "#ff3344" };
}

function projectPoint(lat, lng, width, height, padding) {
  const minLat = 51.98, maxLat = 52.32;
  const minLng = -1.22, maxLng = -0.78;
  const x = padding + ((lng - minLng) / (maxLng - minLng)) * (width - padding * 2);
  const y = padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2);
  return { x, y };
}

function SvgDefs() {
  return (
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feFlood floodColor="#00ff88" floodOpacity="0.3" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feFlood floodColor="#ff9500" floodOpacity="0.3" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feFlood floodColor="#ff3344" floodOpacity="0.3" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowBranch" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function GridLines({ width, height }) {
  const lines = [];
  for (let x = 0; x < width; x += 40) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#1a4560" strokeWidth="0.5" opacity="0.4" />);
  for (let y = 0; y < height; y += 40) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#1a4560" strokeWidth="0.5" opacity="0.4" />);
  return <g>{lines}</g>;
}

function PulseRing({ cx, cy, color, delay = 0, maxR = 30 }) {
  return (
    <circle cx={cx} cy={cy} r="6" fill="none" stroke={color} strokeWidth="1">
      <animate attributeName="r" from="6" to={maxR} dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" from="0.6" to="0" dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  );
}

function BranchSites({ practices: allPractices, positions, width, height, padding, hoveredBranch, setHoveredBranch }) {
  return (
    <g>
      {allPractices.map((practice, pi) => {
        if (!practice.branches || practice.branches.length === 0) return null;
        const parentPos = positions[pi];
        const parentColor = practice.type === "hub" ? "#00f0ff" : "#00e08a";
        const branchColor = "#8866cc";

        return practice.branches.map((branch, bi) => {
          const bPos = projectPoint(branch.lat, branch.lng, width, height, padding);
          const key = `${pi}-${bi}`;
          const isHovered = hoveredBranch === key;

          return (
            <g key={key}
              onMouseEnter={() => setHoveredBranch(key)}
              onMouseLeave={() => setHoveredBranch(null)}>
              {/* Connection to parent */}
              <line x1={parentPos.x} y1={parentPos.y} x2={bPos.x} y2={bPos.y}
                stroke={branchColor} strokeWidth="1" opacity="0.2" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="2s" repeatCount="indefinite" />
              </line>

              {/* Branch marker - diamond shape */}
              <g transform={`translate(${bPos.x}, ${bPos.y}) rotate(45)`} style={{ cursor: "default" }}>
                <rect x="-4.5" y="-4.5" width="9" height="9" fill={branchColor} opacity="0.15" filter="url(#glowBranch)" rx="1" />
                <rect x="-3" y="-3" width="6" height="6" fill={branchColor} opacity={isHovered ? "0.9" : "0.6"} filter="url(#glowBranch)" rx="1" />
                <rect x="-1.2" y="-1.2" width="2.4" height="2.4" fill="#fff" opacity="0.8" rx="0.5" />
              </g>

              {/* Small pulse */}
              <circle cx={bPos.x} cy={bPos.y} r="3" fill="none" stroke={branchColor} strokeWidth="0.5">
                <animate attributeName="r" from="3" to="12" dur="3s" begin={`${pi * 0.3 + bi * 0.5}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="3s" begin={`${pi * 0.3 + bi * 0.5}s`} repeatCount="indefinite" />
              </circle>

              {/* Label */}
              <g transform={`translate(${bPos.x + 10}, ${bPos.y - 4})`} opacity={isHovered ? 1 : 0.7}>
                <rect x="-2" y="-9" width={isHovered ? 130 : branch.name.length * 6.5 + 10} height={isHovered ? 28 : 16}
                  rx="2" fill="#0a1a2e" stroke={branchColor} strokeWidth="0.5" opacity={isHovered ? 0.95 : 0.6} />
                <text x="4" y="2" fill={branchColor} fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="600" letterSpacing="0.5">
                  {branch.name.toUpperCase()}
                </text>
                {isHovered && (
                  <text x="4" y="14" fill="#6a5a8a" fontSize="7" fontFamily="'JetBrains Mono', monospace">
                    BRANCH OF {practice.short}
                  </text>
                )}
              </g>
            </g>
          );
        });
      })}
    </g>
  );
}

function DriveTimeLines({ selectedIdx, positions }) {
  if (selectedIdx === null) return null;
  const from = positions[selectedIdx];
  return (
    <g>
      {practices.map((p, i) => {
        if (i === selectedIdx) return null;
        const to = positions[i];
        const mins = driveTimes[selectedIdx][i];
        const { color } = getDriveColor(mins);
        const w = mins <= 15 ? 3 : mins <= 25 ? 2.5 : 2;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2 - 18;
        const filterName = mins <= 15 ? "url(#glowGreen)" : mins <= 25 ? "url(#glowOrange)" : "url(#glowRed)";
        return (
          <g key={`dt-${i}`}>
            <path d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`} stroke={color} strokeWidth={w + 4} fill="none" opacity="0.12" filter={filterName} />
            <path d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`} stroke={color} strokeWidth={w} fill="none" opacity="0.7" strokeDasharray="8 4">
              <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1.5s" repeatCount="indefinite" />
            </path>
            <g transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2 - 8})`}>
              <rect x="-24" y="-11" width="48" height="22" rx="4" fill="#0a1a2e" stroke={color} strokeWidth="1" opacity="0.95" />
              <text x="0" y="5" textAnchor="middle" fill={color} fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">{mins}m</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function SDAPanel({ practice, visible }) {
  if (!visible) return null;
  const maxAnnual = 18933;
  const annualNum = parseInt(practice.annual.replace(/,/g, ""));
  const barPct = (annualNum / maxAnnual) * 100;

  return (
    <div style={{
      position: "absolute", bottom: "12px", left: "12px", right: "12px",
      background: "rgba(10,26,46,0.95)", border: "1px solid rgba(0,240,255,0.2)",
      borderRadius: "8px", padding: "12px 16px", zIndex: 20,
      backdropFilter: "blur(12px)", boxShadow: "0 0 30px rgba(0,240,255,0.05)",
      display: "flex", gap: "16px", alignItems: "stretch",
    }}>
      <div style={{ minWidth: "140px", borderRight: "1px solid rgba(0,240,255,0.2)", paddingRight: "16px" }}>
        <div style={{ color: "#00f0ff", fontSize: "8px", letterSpacing: "2px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>SDA ALLOCATION</div>
        <div style={{ color: "#fff", fontSize: "13px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "6px" }}>{practice.short}</div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
          <span style={{ padding: "1px 6px", borderRadius: "3px", fontSize: "7px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "1px", background: practice.type === "hub" ? "rgba(0,240,255,0.15)" : "rgba(0,224,138,0.1)", color: practice.type === "hub" ? "#00f0ff" : "#00e08a", border: `1px solid ${practice.type === "hub" ? "rgba(0,240,255,0.3)" : "rgba(0,224,138,0.2)"}` }}>{practice.type === "hub" ? "HUB" : "SPOKE"}</span>
          <span style={{ padding: "1px 6px", borderRadius: "3px", fontSize: "7px", fontWeight: "600", fontFamily: "'JetBrains Mono', monospace", background: practice.system === "EMIS" ? "rgba(255,107,53,0.12)" : "rgba(138,176,192,0.1)", color: practice.system === "EMIS" ? "#ff6b35" : "#6ba3be", border: `1px solid ${practice.system === "EMIS" ? "rgba(255,107,53,0.25)" : "rgba(138,176,192,0.2)"}` }}>{practice.system}</span>
          {practice.branches && practice.branches.length > 0 && (
            <span style={{ padding: "1px 6px", borderRadius: "3px", fontSize: "7px", fontWeight: "600", fontFamily: "'JetBrains Mono', monospace", background: "rgba(136,102,204,0.12)", color: "#aa88ee", border: "1px solid rgba(136,102,204,0.25)" }}>{practice.branches.length} BRANCH{practice.branches.length > 1 ? "ES" : ""}</span>
          )}
        </div>
        <div style={{ color: "#b0d0e0", fontSize: "8px", fontFamily: "'JetBrains Mono', monospace" }}>{practice.patients} patients · {practice.pct}</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div>
            <div style={{ color: "#90b8cc", fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace" }}>MONTHLY</div>
            <div style={{ color: "#00e08a", fontSize: "14px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>{practice.monthly}</div>
          </div>
          <div>
            <div style={{ color: "#90b8cc", fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace" }}>BUDGET 75%</div>
            <div style={{ color: "#00f0ff", fontSize: "14px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>{practice.budget75}</div>
          </div>
          <div>
            <div style={{ color: "#90b8cc", fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace" }}>ANNUAL TARGET</div>
            <div style={{ color: "#ffd700", fontSize: "14px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>{practice.annual}</div>
          </div>
        </div>
        <div style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barPct}%`, borderRadius: "3px", background: `linear-gradient(90deg, #00f0ff, ${practice.type === "hub" ? "#00e08a" : "#0088cc"})`, boxShadow: "0 0 8px rgba(0,240,255,0.3)", transition: "width 0.8s ease" }} />
        </div>
      </div>

      <div style={{ minWidth: "200px", borderLeft: "1px solid rgba(0,240,255,0.2)", paddingLeft: "16px" }}>
        <div style={{ display: "flex", gap: "16px" }}>
          <div>
            <div style={{ color: "#80ccaa", fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "3px" }}>● NON-WINTER /WK</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
              <span style={{ color: "#00e08a", fontSize: "16px", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>{practice.nonWinterWk}</span>
              <span style={{ color: "#8abba0", fontSize: "7px", fontFamily: "'JetBrains Mono', monospace" }}>F2F {(practice.nonWinterWk / 2).toFixed(1)} · REM {(practice.nonWinterWk / 2).toFixed(1)}</span>
            </div>
          </div>
          <div>
            <div style={{ color: "#cc9080", fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "3px" }}>❄ WINTER /WK</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
              <span style={{ color: "#ff6b35", fontSize: "16px", fontWeight: "800", fontFamily: "'JetBrains Mono', monospace" }}>{practice.winterWk}</span>
              <span style={{ color: "#bb8878", fontSize: "7px", fontFamily: "'JetBrains Mono', monospace" }}>F2F {(practice.winterWk / 2).toFixed(1)} · REM {(practice.winterWk / 2).toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div style={{ color: "#7a9aaa", fontSize: "7px", fontFamily: "'JetBrains Mono', monospace", marginTop: "6px" }}>39 WKS NON-WINTER · 13 WKS WINTER · 15.2/18.2 PER 1K</div>
      </div>
    </div>
  );
}

function DriveTimeSidebar({ selectedIdx }) {
  if (selectedIdx === null) return null;
  const selected = practices[selectedIdx];
  const routes = practices
    .map((p, i) => ({ practice: p, mins: driveTimes[selectedIdx][i], idx: i }))
    .filter(r => r.idx !== selectedIdx)
    .sort((a, b) => a.mins - b.mins);

  return (
    <div style={{
      position: "absolute", top: "12px", right: "12px",
      background: "rgba(10,26,46,0.95)", border: "1px solid rgba(0,240,255,0.25)",
      borderRadius: "8px", padding: "14px 16px", width: "210px", zIndex: 20,
      backdropFilter: "blur(12px)", boxShadow: "0 0 30px rgba(0,240,255,0.05)",
    }}>
      <div style={{ color: "#00f0ff", fontSize: "9px", letterSpacing: "2px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>DRIVE TIMES FROM</div>
      <div style={{ color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "12px", borderBottom: "1px solid rgba(0,240,255,0.15)", paddingBottom: "8px" }}>{selected.short}</div>
      {routes.map((r, i) => {
        const { color } = getDriveColor(r.mins);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < routes.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ color: "#8ab0c0", fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>{r.practice.short}</span>
            </div>
            <span style={{ color, fontSize: "10px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>{r.mins}m</span>
          </div>
        );
      })}
      <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(0,240,255,0.1)", display: "flex", flexDirection: "column", gap: "5px" }}>
        {[{ color: "#00ff88", label: "≤ 15 MIN — OPTIMAL" }, { color: "#ff9500", label: "16–25 MIN — ACCEPTABLE" }, { color: "#ff3344", label: "> 25 MIN — AVOID" }].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "16px", height: "2px", background: l.color, boxShadow: `0 0 4px ${l.color}`, borderRadius: "1px" }} />
            <span style={{ color: "#4a6a7a", fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NRESGlassMap() {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sdaPractice, setSdaPractice] = useState(null);
  const [hoveredBranch, setHoveredBranch] = useState(null);
  const [time, setTime] = useState(new Date());
  const width = 860;
  const height = 660;
  const padding = 80;

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const positions = practices.map(p => projectPoint(p.lat, p.lng, width, height, padding));
  const hubConnections = [[0, 2], [0, 4], [0, 5], [1, 6], [1, 3]];
  const hubToHub = [[0, 1]];

  const labelOffsets = [
    { dx: 20, dy: -50 },
    { dx: -170, dy: 28 },
    { dx: 25, dy: 22 },
    { dx: -175, dy: -32 },
    { dx: 20, dy: -58 },
    { dx: -178, dy: -52 },
    { dx: 25, dy: 28 },
  ];

  const handlePinClick = (e, i) => {
    e.stopPropagation();
    if (selected === i) { setSelected(null); setSdaPractice(i); }
    else if (sdaPractice === i) { setSdaPractice(null); }
    else { setSelected(i); setSdaPractice(null); }
  };

  const totalBranches = practices.reduce((sum, p) => sum + (p.branches ? p.branches.length : 0), 0);

  return (
    <div style={{
      width: "100%", minHeight: "100%",
      background: "radial-gradient(ellipse at 30% 20%, #1a2d4a 0%, #132238 40%, #0e1a2e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      overflow: "hidden", position: "relative",
    }}>
      <div style={{ position: "absolute", top: "-20%", left: "10%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(0,240,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "15%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(0,224,138,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px", width: "100%" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: selected !== null ? "#00ff88" : "#00f0ff", boxShadow: `0 0 12px ${selected !== null ? "#00ff88" : "#00f0ff"}`, animation: "pulse 2s ease-in-out infinite" }} />
        <div>
          <div style={{ color: "#00f0ff", fontSize: "13px", fontWeight: "700", letterSpacing: "4px" }}>NRES NEIGHBOURHOOD</div>
          <div style={{ color: "#4a8a9a", fontSize: "9px", letterSpacing: "2px", marginTop: "2px" }}>
            {selected !== null ? `DRIVE TIME ANALYSIS · ${practices[selected].short}`
              : sdaPractice !== null ? `SDA ALLOCATION · ${practices[sdaPractice].short}`
              : `RURAL EAST & SOUTH · NORTHAMPTONSHIRE · ${time.toLocaleTimeString("en-GB")} UTC`}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "baseline", justifyContent: "flex-end" }}>
            <div>
              <div style={{ color: "#5a8a9a", fontSize: "7px", letterSpacing: "1px" }}>PATIENTS</div>
              <div style={{ color: "#00e08a", fontSize: "12px", fontWeight: "700" }}>89,584</div>
            </div>
            <div>
              <div style={{ color: "#5a8a9a", fontSize: "7px", letterSpacing: "1px" }}>ANNUAL APPTS</div>
              <div style={{ color: "#ffd700", fontSize: "12px", fontWeight: "700" }}>74,381</div>
            </div>
            <div>
              <div style={{ color: "#5a8a9a", fontSize: "7px", letterSpacing: "1px" }}>ANNUAL VALUE</div>
              <div style={{ color: "#00f0ff", fontSize: "12px", fontWeight: "700" }}>£2.36M</div>
            </div>
          </div>
          <div style={{ color: "#4a7a6a", fontSize: "7px", letterSpacing: "1px", marginTop: "2px" }}>
            GO LIVE 1ST APRIL 2026 · JAN 26 LIST · 7 PRACTICES · {totalBranches} BRANCHES · 2 HUBS · 5 SPOKES
          </div>
        </div>
      </div>

      {/* Glass Map */}
      <div style={{
        position: "relative", width: "100%", borderRadius: "12px",
        border: `1px solid rgba(${selected !== null ? "0,255,136" : sdaPractice !== null ? "255,215,0" : "0,240,255"},0.2)`,
        background: "linear-gradient(135deg, rgba(18,42,68,0.85) 0%, rgba(12,30,52,0.9) 100%)",
        boxShadow: "0 0 60px rgba(0,240,255,0.08), inset 0 0 60px rgba(0,240,255,0.03), 0 20px 60px rgba(0,0,0,0.3)",
        backdropFilter: "blur(20px)", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none", zIndex: 10, borderRadius: "12px 12px 0 0" }} />
        <div style={{ position: "absolute", top: "10%", left: "-20%", width: "60%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", transform: "rotate(-15deg)", pointerEvents: "none", zIndex: 10 }} />

        <DriveTimeSidebar selectedIdx={selected} />
        <SDAPanel practice={sdaPractice !== null ? practices[sdaPractice] : null} visible={sdaPractice !== null && selected === null} />

        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}
          onClick={() => { setSelected(null); setSdaPractice(null); }}>
          <SvgDefs />
          <GridLines width={width} height={height} />
          {/* Default network lines */}
          {selected === null && (
            <g>
              {hubToHub.map(([a, b], i) => {
                const pa = positions[a]; const pb = positions[b];
                return (<line key={`hh${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#00f0ff" strokeWidth="1.5" opacity="0.15" strokeDasharray="8 4"><animate attributeName="stroke-dashoffset" from="0" to="-24" dur="3s" repeatCount="indefinite" /></line>);
              })}
              {hubConnections.map(([a, b], i) => {
                const pa = positions[a]; const pb = positions[b];
                const mx = (pa.x + pb.x) / 2; const my = (pa.y + pb.y) / 2 - 20;
                return (<path key={`c${i}`} d={`M ${pa.x} ${pa.y} Q ${mx} ${my} ${pb.x} ${pb.y}`} stroke="#00f0ff" strokeWidth="1" fill="none" opacity="0.25" strokeDasharray="6 3"><animate attributeName="stroke-dashoffset" from="0" to="-18" dur="2.5s" repeatCount="indefinite" /></path>);
              })}
            </g>
          )}

          <DriveTimeLines selectedIdx={selected} positions={positions} />

          {/* Branch sites */}
          <BranchSites practices={practices} positions={positions}
            width={width} height={height} padding={padding}
            hoveredBranch={hoveredBranch} setHoveredBranch={setHoveredBranch} />

          {/* Coordinates */}
          {[52.05, 52.10, 52.15, 52.20, 52.25, 52.30].map(lat => {
            const p = projectPoint(lat, -1.22, width, height, padding);
            return <text key={`lat${lat}`} x={12} y={p.y + 3} fill="#2a5a7a" fontSize="7" fontFamily="'JetBrains Mono', monospace">{lat.toFixed(2)}°N</text>;
          })}
          {[-1.15, -1.05, -0.95, -0.85].map(lng => {
            const p = projectPoint(52.32, lng, width, height, padding);
            return <text key={`lng${lng}`} x={p.x - 15} y={height - 10} fill="#2a5a7a" fontSize="7" fontFamily="'JetBrains Mono', monospace">{Math.abs(lng).toFixed(2)}°W</text>;
          })}

          <text x={width / 2} y={height - 25} textAnchor="middle" fill="#1a3a55" fontSize="28" fontFamily="'JetBrains Mono', monospace" fontWeight="800" letterSpacing="12" opacity="0.35">NORTHANTS</text>

          {/* Practice markers */}
          {practices.map((p, i) => {
            const pos = positions[i];
            const isHub = p.type === "hub";
            const isSelected = selected === i;
            const isSda = sdaPractice === i && selected === null;
            const isTarget = selected !== null && selected !== i;
            const baseColor = isHub ? "#00f0ff" : "#00e08a";
            const markerColor = isSelected ? "#ffffff" : isSda ? "#ffd700" : isTarget ? getDriveColor(driveTimes[selected][i]).color : baseColor;
            const off = labelOffsets[i];

            return (
              <g key={i} style={{ cursor: "pointer" }}
                onClick={(e) => handlePinClick(e, i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}>

                <line x1={pos.x} y1={pos.y} x2={pos.x + off.dx * 0.3} y2={pos.y + off.dy * 0.3} stroke={markerColor} strokeWidth="0.5" opacity="0.4" />

                <PulseRing cx={pos.x} cy={pos.y} color={markerColor} delay={i * 0.4} maxR={isSelected || isSda ? 40 : isHub ? 35 : 22} />
                {(isHub || isSelected || isSda) && <PulseRing cx={pos.x} cy={pos.y} color={markerColor} delay={i * 0.4 + 1.5} maxR={isSelected || isSda ? 40 : 35} />}

                <circle cx={pos.x} cy={pos.y} r={isSelected || isSda ? 9 : isHub ? 7 : 5} fill={markerColor} opacity="0.2" filter="url(#glowStrong)" />
                <circle cx={pos.x} cy={pos.y} r={isSelected || isSda ? 7 : isHub ? 5 : 3.5} fill={markerColor} opacity="0.9" filter="url(#glow)" />
                <circle cx={pos.x} cy={pos.y} r={isSelected || isSda ? 3 : isHub ? 2.5 : 1.8} fill="#fff" opacity="0.9" />

                {(isSelected || isSda) && (
                  <circle cx={pos.x} cy={pos.y} r="14" fill="none" stroke={markerColor} strokeWidth="1.5" opacity="0.5" strokeDasharray="4 3">
                    <animate attributeName="stroke-dashoffset" from="0" to="14" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                <g transform={`translate(${pos.x + off.dx}, ${pos.y + off.dy})`} opacity={hovered === i || isSelected || isSda ? 1 : 0.85}>
                  <rect x="-2" y="-14" width={hovered === i ? 190 : 155} height={hovered === i ? 92 : 22}
                    rx="2" fill="#0a1a2e" stroke={markerColor} strokeWidth={isSelected || isSda ? "1" : "0.5"} opacity={hovered === i ? 0.95 : 0.7} />
                  <text x="6" y="0" fill={markerColor} fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700" letterSpacing="1">{p.short}</text>
                  {isHub && <text x={p.short.length * 7.2 + 14} y="0" fill="#ff6b35" fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="600">HUB</text>}
                  {isTarget && (
                    <text x={p.short.length * 7.2 + (isHub ? 32 : 14)} y="0" fill={getDriveColor(driveTimes[selected][i]).color} fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="700">{driveTimes[selected][i]}m</text>
                  )}
                  {hovered === i && (
                    <>
                      <text x="6" y="16" fill="#6ba3be" fontSize="8" fontFamily="'JetBrains Mono', monospace">{p.area} · {p.postcode} · {p.system}</text>
                      <text x="6" y="30" fill="#4a8a6a" fontSize="8" fontFamily="'JetBrains Mono', monospace">PATIENTS: {p.patients} ({p.pct})</text>
                      <text x="6" y="44" fill="#ffd700" fontSize="8" fontFamily="'JetBrains Mono', monospace">SDA: {p.annual}/yr · {p.nonWinterWk}/wk</text>
                      {p.branches && p.branches.length > 0 && (
                        <text x="6" y="58" fill="#8866cc" fontSize="8" fontFamily="'JetBrains Mono', monospace">
                          BRANCHES: {p.branches.map(b => b.name).join(", ")}
                        </text>
                      )}
                      <text x="6" y={p.branches && p.branches.length > 0 ? 72 : 58} fill="#5a7a8a" fontSize="7" fontFamily="'JetBrains Mono', monospace">
                        {isSelected ? "● DRIVE TIMES · CLICK AGAIN FOR SDA"
                          : isSda ? "● SDA VIEW · CLICK AGAIN TO DISMISS"
                          : "CLICK: DRIVE TIMES · 2ND CLICK: SDA"}
                      </text>
                    </>
                  )}
                </g>
              </g>
            );
          })}
        </svg>

        {/* Corner decorations */}
        {["top-left", "top-right", "bottom-left", "bottom-right"].map(pos => {
          const isTop = pos.includes("top"); const isLeft = pos.includes("left");
          return (<div key={pos} style={{ position: "absolute", [isTop ? "top" : "bottom"]: "8px", [isLeft ? "left" : "right"]: "8px", width: "20px", height: "20px", borderTop: isTop ? "1px solid rgba(0,240,255,0.4)" : "none", borderBottom: !isTop ? "1px solid rgba(0,240,255,0.4)" : "none", borderLeft: isLeft ? "1px solid rgba(0,240,255,0.4)" : "none", borderRight: !isLeft ? "1px solid rgba(0,240,255,0.4)" : "none", pointerEvents: "none" }} />);
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "14px", marginTop: "10px", flexWrap: "wrap", width: "100%", justifyContent: "center" }}>
        {[
          { color: "#00f0ff", label: "HUB", shape: "circle" },
          { color: "#00e08a", label: "SPOKE", shape: "circle" },
          { color: "#8866cc", label: "BRANCH", shape: "diamond" },
          { color: "#00ff88", label: "≤15m" },
          { color: "#ff9500", label: "16-25m" },
          { color: "#ff3344", label: ">25m" },
          { color: "#ffd700", label: "SDA VIEW" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {item.shape === "diamond" ? (
              <div style={{ width: "7px", height: "7px", background: item.color, boxShadow: `0 0 6px ${item.color}`, transform: "rotate(45deg)" }} />
            ) : (
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
            )}
            <span style={{ color: "#4a7a9a", fontSize: "7px", letterSpacing: "1.5px", fontFamily: "'JetBrains Mono', monospace" }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ color: "#2a4a6a", fontSize: "7px", letterSpacing: "2px", marginTop: "6px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>
        PCN SERVICES LTD · NRES PROGRAMME · 1ST CLICK: DRIVE TIMES · 2ND CLICK: SDA ALLOCATION · BG: DISMISS
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
