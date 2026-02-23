// @ts-nocheck
import { useState, useEffect } from "react";

const practices = [
  { id: 0, name: "The Parks MC", short: "THE PARKS", lat: 52.2080, lng: -0.8870, type: "hub", patients: 22827, postcode: "NN4 5DW", area: "Grange Park", pct: "25.5%", system: "SystmOne", monthly: 50086, budget75: 450776, nonWinterWk: 347.0, winterWk: 415.5, annual: 18933, branches: [
    { name: "Roade", lat: 52.1588, lng: -0.8941 },
    { name: "Hanslope", lat: 52.1150, lng: -0.8310 },
    { name: "Blisworth", lat: 52.1748, lng: -0.9379 },
  ]},
  { id: 1, name: "Brackley MC", short: "BRACKLEY MC", lat: 52.0380, lng: -1.1580, type: "hub", patients: 16212, postcode: "NN13 6QZ", area: "Brackley", pct: "18.1%", system: "SystmOne", monthly: 35572, budget75: 320146, nonWinterWk: 246.4, winterWk: 295.1, annual: 13446, branches: [] },
  { id: 2, name: "Brook Health Centre", short: "BROOK HC", lat: 52.1290, lng: -0.9880, type: "spoke", patients: 9069, postcode: "NN12 6HD", area: "Towcester", pct: "10.1%", system: "SystmOne", monthly: 19899, budget75: 179090, nonWinterWk: 137.8, winterWk: 165.1, annual: 7522, branches: [
    { name: "Silverstone", lat: 52.0918, lng: -1.0260 },
  ]},
  { id: 3, name: "Towcester MC", short: "TOWCESTER MC", lat: 52.1330, lng: -0.9940, type: "spoke", patients: 11748, postcode: "NN12 6HH", area: "Towcester", pct: "13.1%", system: "EMIS", monthly: 25777, budget75: 231994, nonWinterWk: 178.6, winterWk: 213.8, annual: 9744, branches: [
    { name: "Paulerspury", lat: 52.0980, lng: -1.0050 },
  ]},
  { id: 4, name: "Denton Village Surgery", short: "DENTON VS", lat: 52.2700, lng: -0.8540, type: "spoke", patients: 6329, postcode: "NN7 1HT", area: "Denton", pct: "7.1%", system: "SystmOne", monthly: 13887, budget75: 124982, nonWinterWk: 96.2, winterWk: 115.2, annual: 5249, branches: [] },
  { id: 5, name: "Bugbrooke Surgery", short: "BUGBROOKE", lat: 52.2109, lng: -1.0051, type: "spoke", patients: 10788, postcode: "NN7 3QN", area: "Bugbrooke", pct: "12.0%", system: "SystmOne", monthly: 23671, budget75: 213036, nonWinterWk: 164.0, winterWk: 196.3, annual: 8948, branches: [] },
  { id: 6, name: "Springfield Surgery", short: "SPRINGFIELD", lat: 52.0260, lng: -1.1280, type: "spoke", patients: 12611, postcode: "NN13 6AN", area: "Brackley", pct: "14.1%", system: "EMIS", monthly: 27671, budget75: 249036, nonWinterWk: 191.7, winterWk: 229.5, annual: 10460, branches: [] },
];

// Practice-to-practice drive times [Parks, Brackley, Brook, Towcester, Denton, Bugbrooke, Springfield]
const driveTimes = [
  [0,28,18,18,17,18,30],[28,0,16,16,39,25,2],[18,16,0,1,29,16,18],
  [18,16,1,0,29,16,18],[17,39,29,29,0,29,41],[18,25,16,16,29,0,27],[30,2,18,18,41,27,0],
];

// Branch drive times to each of the 7 practices
// Key: "practiceIdx-branchIdx" → [time to Parks, Brackley, Brook, Towcester, Denton, Bugbrooke, Springfield]
const branchDriveTimes = {
  "0-0": [8, 22, 12, 12, 15, 12, 24],   // Roade
  "0-1": [22, 42, 32, 32, 28, 30, 44],   // Hanslope
  "0-2": [10, 20, 10, 10, 18, 6, 22],    // Blisworth
  "2-0": [22, 10, 8, 8, 34, 18, 12],     // Silverstone
  "3-0": [20, 12, 5, 5, 32, 16, 14],     // Paulerspury
};

const sortedForTable = [...practices].sort((a, b) => b.patients - a.patients);
const totals = {
  patients: practices.reduce((s, p) => s + p.patients, 0),
  monthly: practices.reduce((s, p) => s + p.monthly, 0),
  budget75: practices.reduce((s, p) => s + p.budget75, 0),
  nonWinterWk: practices.reduce((s, p) => s + p.nonWinterWk, 0),
  winterWk: practices.reduce((s, p) => s + p.winterWk, 0),
  annual: practices.reduce((s, p) => s + p.annual, 0),
};

const fmt = (n) => "£" + n.toLocaleString();
function getDriveColor(mins) {
  if (mins <= 15) return "#00ff88";
  if (mins <= 25) return "#ff9500";
  return "#ff3344";
}

function projectPoint(lat, lng, width, height, padding) {
  const minLat = 51.98, maxLat = 52.32, minLng = -1.22, maxLng = -0.78;
  return {
    x: padding + ((lng - minLng) / (maxLng - minLng)) * (width - padding * 2),
    y: padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2),
  };
}

/* ─── TABLE VIEW ─── */
function TableView() {
  const mono = "'JetBrains Mono', monospace";
  const thStyle = { padding: "8px 10px", textAlign: "left", fontSize: "9px", letterSpacing: "1.5px", color: "#90b8cc", fontFamily: mono, borderBottom: "1px solid rgba(0,240,255,0.15)", whiteSpace: "nowrap" };
  const thRight = { ...thStyle, textAlign: "right" };
  const tdStyle = { padding: "7px 10px", fontSize: "11px", color: "#d0e8f0", fontFamily: mono, borderBottom: "1px solid rgba(0,240,255,0.06)", whiteSpace: "nowrap" };
  const tdRight = { ...tdStyle, textAlign: "right" };
  const tdNum = { ...tdRight, fontVariantNumeric: "tabular-nums" };
  const badge = (type, system) => ({
    padding: "2px 8px", borderRadius: "4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1px",
    background: type === "hub" ? "rgba(0,240,255,0.15)" : system ? (system === "EMIS" ? "rgba(255,107,53,0.1)" : "rgba(138,176,192,0.08)") : "rgba(0,224,138,0.08)",
    color: type === "hub" ? "#00f0ff" : system ? (system === "EMIS" ? "#ff8855" : "#8ab8d0") : "#00e08a",
    border: `1px solid ${type === "hub" ? "rgba(0,240,255,0.3)" : system ? (system === "EMIS" ? "rgba(255,107,53,0.2)" : "rgba(138,176,192,0.15)") : "rgba(0,224,138,0.15)"}`,
  });

  return (
    <div style={{ width: "100%", overflowX: "auto", padding: "0 4px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingLeft: "4px" }}>
          <div style={{ width: "3px", height: "18px", background: "#00f0ff", borderRadius: "2px" }} />
          <span style={{ color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: mono, letterSpacing: "1px" }}>PRACTICE LIST SIZES</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,26,46,0.5)", borderRadius: "8px", overflow: "hidden" }}>
          <thead><tr style={{ background: "rgba(0,240,255,0.04)" }}>
            <th style={thStyle}>PRACTICE</th><th style={thRight}>LIST SIZE</th><th style={{ ...thStyle, textAlign: "center" }}>HUB / SPOKE</th><th style={{ ...thStyle, textAlign: "center" }}>CLINICAL SYSTEM</th><th style={thRight}>% OF TOTAL</th>
          </tr></thead>
          <tbody>{sortedForTable.map((p, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,240,255,0.02)" }}>
              <td style={{ ...tdStyle, fontWeight: "600", color: "#fff" }}>{p.name}</td>
              <td style={tdNum}>{p.patients.toLocaleString()}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}><span style={badge(p.type)}>{p.type.toUpperCase()}</span></td>
              <td style={{ ...tdStyle, textAlign: "center" }}><span style={badge(null, p.system)}>{p.system}</span></td>
              <td style={tdNum}>{p.pct}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{ background: "rgba(0,240,255,0.08)" }}>
            <td style={{ ...tdStyle, fontWeight: "800", color: "#00f0ff", fontSize: "12px" }}>TOTAL</td>
            <td style={{ ...tdNum, fontWeight: "800", color: "#00f0ff", fontSize: "12px" }}>{totals.patients.toLocaleString()}</td>
            <td style={tdStyle}></td><td style={tdStyle}></td>
            <td style={{ ...tdNum, fontWeight: "700", color: "#00f0ff" }}>100.0%</td>
          </tr></tfoot>
        </table>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingLeft: "4px" }}>
          <div style={{ width: "3px", height: "18px", background: "#ffd700", borderRadius: "2px" }} />
          <span style={{ color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: mono, letterSpacing: "1px" }}>APPOINTMENT REQUIREMENTS & FINANCIAL ALLOCATION</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,26,46,0.5)", borderRadius: "8px", overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "rgba(0,240,255,0.04)" }}>
              <th style={{ ...thStyle, background: "rgba(10,26,46,0.8)" }} rowSpan={2}>PRACTICE</th><th style={{ ...thRight, background: "rgba(10,26,46,0.8)" }} rowSpan={2}>MONTHLY (£)</th><th style={{ ...thRight, background: "rgba(10,26,46,0.8)" }} rowSpan={2}>BUDGET 75% (£)</th>
              <th style={{ ...thStyle, textAlign: "center", background: "rgba(0,224,138,0.06)", borderBottom: "1px solid rgba(0,224,138,0.15)" }} colSpan={3}><span style={{ color: "#00e08a" }}>● NON-WINTER · 15.2/1,000 · 39 WKS</span></th>
              <th style={{ ...thStyle, textAlign: "center", background: "rgba(255,107,53,0.06)", borderBottom: "1px solid rgba(255,107,53,0.15)" }} colSpan={3}><span style={{ color: "#ff8855" }}>❄ WINTER · 18.2/1,000 · 13 WKS</span></th>
              <th style={{ ...thRight, color: "#ffd700", background: "rgba(10,26,46,0.8)" }} rowSpan={2}>SDA REQ</th><th style={{ ...thStyle, textAlign: "center", background: "rgba(10,26,46,0.8)" }} rowSpan={2}>TYPE</th>
            </tr>
            <tr style={{ background: "rgba(0,240,255,0.03)" }}>
              <th style={{ ...thRight, color: "#80ccaa", fontSize: "8px" }}>WKLY</th><th style={{ ...thRight, color: "#80ccaa", fontSize: "8px" }}>F2F</th><th style={{ ...thRight, color: "#80ccaa", fontSize: "8px" }}>REM</th>
              <th style={{ ...thRight, color: "#cc9080", fontSize: "8px" }}>WKLY</th><th style={{ ...thRight, color: "#cc9080", fontSize: "8px" }}>F2F</th><th style={{ ...thRight, color: "#cc9080", fontSize: "8px" }}>REM</th>
            </tr>
          </thead>
          <tbody>{sortedForTable.map((p, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,240,255,0.02)" }}>
              <td style={{ ...tdStyle, fontWeight: "600", color: "#fff" }}>{p.name}</td>
              <td style={tdNum}>{fmt(p.monthly)}</td><td style={tdNum}>{fmt(p.budget75)}</td>
              <td style={{ ...tdNum, color: "#00e08a", fontWeight: "700" }}>{p.nonWinterWk.toFixed(1)}</td>
              <td style={{ ...tdNum, color: "#8abba0" }}>{(p.nonWinterWk / 2).toFixed(1)}</td><td style={{ ...tdNum, color: "#8abba0" }}>{(p.nonWinterWk / 2).toFixed(1)}</td>
              <td style={{ ...tdNum, color: "#ff8855", fontWeight: "700" }}>{p.winterWk.toFixed(1)}</td>
              <td style={{ ...tdNum, color: "#bb8878" }}>{(p.winterWk / 2).toFixed(1)}</td><td style={{ ...tdNum, color: "#bb8878" }}>{(p.winterWk / 2).toFixed(1)}</td>
              <td style={{ ...tdNum, color: "#ffd700", fontWeight: "700" }}>{p.annual.toLocaleString()}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}><span style={badge(p.type)}>{p.type.toUpperCase()}</span></td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{ background: "rgba(0,240,255,0.08)" }}>
            <td style={{ ...tdStyle, fontWeight: "800", color: "#00f0ff", fontSize: "11px" }}>NEIGHBOURHOOD TOTAL</td>
            <td style={{ ...tdNum, fontWeight: "800", color: "#00f0ff" }}>{fmt(totals.monthly)}</td><td style={{ ...tdNum, fontWeight: "800", color: "#00f0ff" }}>{fmt(totals.budget75)}</td>
            <td style={{ ...tdNum, fontWeight: "800", color: "#00e08a" }}>{totals.nonWinterWk.toFixed(1)}</td>
            <td style={{ ...tdNum, fontWeight: "700", color: "#8abba0" }}>{(totals.nonWinterWk / 2).toFixed(1)}</td><td style={{ ...tdNum, fontWeight: "700", color: "#8abba0" }}>{(totals.nonWinterWk / 2).toFixed(1)}</td>
            <td style={{ ...tdNum, fontWeight: "800", color: "#ff8855" }}>{totals.winterWk.toFixed(1)}</td>
            <td style={{ ...tdNum, fontWeight: "700", color: "#bb8878" }}>{(totals.winterWk / 2).toFixed(1)}</td><td style={{ ...tdNum, fontWeight: "700", color: "#bb8878" }}>{(totals.winterWk / 2).toFixed(1)}</td>
            <td style={{ ...tdNum, fontWeight: "800", color: "#ffd700", fontSize: "12px" }}>{totals.annual.toLocaleString()}</td>
            <td style={tdStyle}></td>
          </tr></tfoot>
        </table>
        <div style={{ color: "#7a9aaa", fontSize: "8px", fontFamily: mono, marginTop: "10px", paddingLeft: "4px" }}>ⓘ Based on Jan 2026 list sizes. Wkly Min = weekly minimum appointment requirement. F2F and Remote each at 50% of total.</div>
      </div>

      {/* Section 3: Resource Overview */}
      <div style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingLeft: "4px" }}>
          <div style={{ width: "3px", height: "18px", background: "#aa88ee", borderRadius: "2px" }} />
          <span style={{ color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: mono, letterSpacing: "1px" }}>RESOURCE OVERVIEW — 50/50 GP & ACP MODEL</span>
        </div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
          <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "8px", fontWeight: "600", fontFamily: mono, letterSpacing: "1px", background: "rgba(0,240,255,0.1)", color: "#00f0ff", border: "1px solid rgba(0,240,255,0.2)" }}>GP: £11,000/session + 29.38% on-costs = £14,232/session</span>
          <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "8px", fontWeight: "600", fontFamily: mono, letterSpacing: "1px", background: "rgba(170,136,238,0.1)", color: "#aa88ee", border: "1px solid rgba(170,136,238,0.2)" }}>ACP: £60,000 salary + 29.38% on-costs = £77,628/yr</span>
          <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "8px", fontWeight: "600", fontFamily: mono, letterSpacing: "1px", background: "rgba(255,215,0,0.1)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.2)" }}>Based on 75% budget allocation · 50/50 split</span>
        </div>
        {(() => {
          const gpSessionCost = 11000 * 1.2938;
          const acpAnnualCost = 60000 * 1.2938;
          const resourceData = sortedForTable.map(p => {
            const gpBudget = p.budget75 / 2;
            const acpBudget = p.budget75 / 2;
            const gpSessions = gpBudget / gpSessionCost;
            const acpFte = acpBudget / acpAnnualCost;
            return { ...p, gpBudget, acpBudget, gpSessions, acpFte };
          });
          const totalBudget75 = resourceData.reduce((s, r) => s + r.budget75, 0);
          const totalGpBudget = totalBudget75 / 2;
          const totalAcpBudget = totalBudget75 / 2;
          const totalGpSessions = totalGpBudget / gpSessionCost;
          const totalAcpFte = totalAcpBudget / acpAnnualCost;

          return (
            <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(10,26,46,0.5)", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "rgba(0,240,255,0.04)" }}>
                  <th style={thStyle}>PRACTICE</th>
                  <th style={thRight}>BUDGET 75% (£)</th>
                  <th style={{ ...thStyle, textAlign: "center", background: "rgba(0,240,255,0.06)", borderBottom: "1px solid rgba(0,240,255,0.15)" }} colSpan={2}><span style={{ color: "#00f0ff" }}>GP (50%)</span></th>
                  <th style={{ ...thStyle, textAlign: "center", background: "rgba(170,136,238,0.06)", borderBottom: "1px solid rgba(170,136,238,0.15)" }} colSpan={2}><span style={{ color: "#aa88ee" }}>ACP (50%)</span></th>
                  <th style={{ ...thRight, color: "#ffd700" }}>TOTAL COST</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>TYPE</th>
                </tr>
                <tr style={{ background: "rgba(0,240,255,0.03)" }}>
                  <th style={{ ...thStyle, borderBottom: "1px solid rgba(0,240,255,0.1)" }}></th>
                  <th style={{ ...thRight, borderBottom: "1px solid rgba(0,240,255,0.1)" }}></th>
                  <th style={{ ...thRight, color: "#80d0e0", fontSize: "8px", borderBottom: "1px solid rgba(0,240,255,0.1)" }}>BUDGET</th>
                  <th style={{ ...thRight, color: "#80d0e0", fontSize: "8px", borderBottom: "1px solid rgba(0,240,255,0.1)" }}>SESSIONS</th>
                  <th style={{ ...thRight, color: "#9a80cc", fontSize: "8px", borderBottom: "1px solid rgba(170,136,238,0.1)" }}>BUDGET</th>
                  <th style={{ ...thRight, color: "#9a80cc", fontSize: "8px", borderBottom: "1px solid rgba(170,136,238,0.1)" }}>FTE</th>
                  <th style={{ ...thRight, borderBottom: "1px solid rgba(0,240,255,0.1)" }}></th>
                  <th style={{ ...thStyle, borderBottom: "1px solid rgba(0,240,255,0.1)" }}></th>
                </tr>
              </thead>
              <tbody>
                {resourceData.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,240,255,0.02)" }}>
                    <td style={{ ...tdStyle, fontWeight: "600", color: "#fff" }}>{r.name}</td>
                    <td style={tdNum}>{fmt(r.budget75)}</td>
                    <td style={{ ...tdNum, color: "#80d0e0" }}>{fmt(Math.round(r.gpBudget))}</td>
                    <td style={{ ...tdNum, color: "#00f0ff", fontWeight: "700" }}>{r.gpSessions.toFixed(1)}</td>
                    <td style={{ ...tdNum, color: "#9a80cc" }}>{fmt(Math.round(r.acpBudget))}</td>
                    <td style={{ ...tdNum, color: "#aa88ee", fontWeight: "700" }}>{r.acpFte.toFixed(2)}</td>
                    <td style={{ ...tdNum, color: "#ffd700", fontWeight: "700" }}>{fmt(Math.round(r.gpSessions * gpSessionCost + r.acpFte * acpAnnualCost))}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: "4px", fontSize: "8px", fontWeight: "700", letterSpacing: "1px",
                        background: r.type === "hub" ? "rgba(0,240,255,0.15)" : "rgba(0,224,138,0.08)",
                        color: r.type === "hub" ? "#00f0ff" : "#00e08a",
                        border: `1px solid ${r.type === "hub" ? "rgba(0,240,255,0.3)" : "rgba(0,224,138,0.15)"}`,
                      }}>{r.type.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "rgba(0,240,255,0.08)" }}>
                  <td style={{ ...tdStyle, fontWeight: "800", color: "#00f0ff", fontSize: "11px" }}>NEIGHBOURHOOD TOTAL</td>
                  <td style={{ ...tdNum, fontWeight: "800", color: "#00f0ff" }}>{fmt(totalBudget75)}</td>
                  <td style={{ ...tdNum, fontWeight: "800", color: "#80d0e0" }}>{fmt(Math.round(totalGpBudget))}</td>
                  <td style={{ ...tdNum, fontWeight: "800", color: "#00f0ff" }}>{totalGpSessions.toFixed(1)}</td>
                  <td style={{ ...tdNum, fontWeight: "800", color: "#9a80cc" }}>{fmt(Math.round(totalAcpBudget))}</td>
                  <td style={{ ...tdNum, fontWeight: "800", color: "#aa88ee" }}>{totalAcpFte.toFixed(2)}</td>
                  <td style={{ ...tdNum, fontWeight: "800", color: "#ffd700", fontSize: "12px" }}>{fmt(Math.round(totalGpSessions * gpSessionCost + totalAcpFte * acpAnnualCost))}</td>
                  <td style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          );
        })()}
        <div style={{ color: "#7a9aaa", fontSize: "8px", fontFamily: mono, marginTop: "10px", paddingLeft: "4px" }}>ⓘ GP session cost: £11,000 + 29.38% employer on-costs = £14,231.80/session. ACP salary: £60,000 + 29.38% employer on-costs = £77,628/yr FTE. Budget split 50% GP sessions, 50% ACP salaried. Sessions are annual.</div>
      </div>
    </div>
  );
}

/* ─── SVG DEFS ─── */
function SvgDefs() {
  return (
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feFlood floodColor="#00ff88" floodOpacity="0.3" result="color" /><feComposite in="color" in2="blur" operator="in" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feFlood floodColor="#ff9500" floodOpacity="0.3" result="color" /><feComposite in="color" in2="blur" operator="in" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feFlood floodColor="#ff3344" floodOpacity="0.3" result="color" /><feComposite in="color" in2="blur" operator="in" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowBranch" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="blur" /><feFlood floodColor="#aa66ff" floodOpacity="0.3" result="color" /><feComposite in="color" in2="blur" operator="in" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
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
  return (<circle cx={cx} cy={cy} r="6" fill="none" stroke={color} strokeWidth="1"><animate attributeName="r" from="6" to={maxR} dur="3s" begin={`${delay}s`} repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="3s" begin={`${delay}s`} repeatCount="indefinite" /></circle>);
}

/* ─── DRIVE TIME LINES (practice or branch source) ─── */
function DriveLines({ fromPos, times, positions }) {
  return (
    <g>{practices.map((p, i) => {
      const mins = times[i];
      if (mins === 0) return null;
      const to = positions[i];
      const color = getDriveColor(mins);
      const w = mins <= 15 ? 3 : mins <= 25 ? 2.5 : 2;
      const mx = (fromPos.x + to.x) / 2, my = (fromPos.y + to.y) / 2 - 18;
      const filterName = mins <= 15 ? "url(#glowGreen)" : mins <= 25 ? "url(#glowOrange)" : "url(#glowRed)";
      return (
        <g key={`dl-${i}`}>
          <path d={`M ${fromPos.x} ${fromPos.y} Q ${mx} ${my} ${to.x} ${to.y}`} stroke={color} strokeWidth={w + 4} fill="none" opacity="0.12" filter={filterName} />
          <path d={`M ${fromPos.x} ${fromPos.y} Q ${mx} ${my} ${to.x} ${to.y}`} stroke={color} strokeWidth={w} fill="none" opacity="0.7" strokeDasharray="8 4"><animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1.5s" repeatCount="indefinite" /></path>
          <g transform={`translate(${(fromPos.x + to.x) / 2}, ${(fromPos.y + to.y) / 2 - 8})`}>
            <rect x="-24" y="-11" width="48" height="22" rx="4" fill="#0a1a2e" stroke={color} strokeWidth="1" opacity="0.95" />
            <text x="0" y="5" textAnchor="middle" fill={color} fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">{mins}m</text>
          </g>
        </g>
      );
    })}</g>
  );
}

/* ─── DRIVE TIME SIDEBAR ─── */
function DriveTimeSidebar({ title, subtitle, times, isBranch, onViewSDA, positionLeft = false }) {
  if (!times) return null;
  const routes = practices.map((p, i) => ({ practice: p, mins: times[i], idx: i })).filter(r => r.mins > 0).sort((a, b) => a.mins - b.mins);
  const accentColor = isBranch ? "#aa88ee" : "#00f0ff";
  return (
    <div style={{ position: "absolute", top: "12px", ...(positionLeft ? { left: "12px" } : { right: "12px" }), background: "rgba(10,26,46,0.95)", border: `1px solid ${isBranch ? "rgba(136,102,204,0.3)" : "rgba(0,240,255,0.25)"}`, borderRadius: "8px", padding: "14px 16px", width: "220px", zIndex: 20, backdropFilter: "blur(12px)", boxShadow: `0 0 30px ${isBranch ? "rgba(136,102,204,0.1)" : "rgba(0,240,255,0.05)"}` }} onClick={(e) => e.stopPropagation()}>
      <div style={{ color: accentColor, fontSize: "9px", letterSpacing: "2px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>DRIVE TIMES FROM</div>
      <div style={{ color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace", marginBottom: "2px" }}>{title}</div>
      {subtitle && <div style={{ color: isBranch ? "#8866cc" : "#5a8a9a", fontSize: "8px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "10px", paddingBottom: "8px", borderBottom: `1px solid ${isBranch ? "rgba(136,102,204,0.2)" : "rgba(0,240,255,0.15)"}` }}>{subtitle}</div>}
      {!subtitle && <div style={{ marginBottom: "10px", paddingBottom: "0", borderBottom: `1px solid ${isBranch ? "rgba(136,102,204,0.2)" : "rgba(0,240,255,0.15)"}` }} />}
      {routes.map((r, i) => {
        const color = getDriveColor(r.mins);
        return (<div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: i < routes.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} /><span style={{ color: "#8ab0c0", fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>{r.practice.short}</span>{r.practice.type === "hub" && <span style={{ fontSize: "7px", fontWeight: "700", letterSpacing: "0.5px", padding: "1px 4px", borderRadius: "3px", background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>HUB</span>}</div><span style={{ color, fontSize: "10px", fontWeight: "700", fontFamily: "'JetBrains Mono', monospace" }}>{r.mins}m</span></div>);
      })}
      <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: `1px solid ${isBranch ? "rgba(136,102,204,0.15)" : "rgba(0,240,255,0.1)"}`, display: "flex", flexDirection: "column", gap: "5px" }}>
        {[{ color: "#00ff88", label: "≤ 15 MIN — OPTIMAL" }, { color: "#ff9500", label: "16–25 MIN — ACCEPTABLE" }, { color: "#ff3344", label: "> 25 MIN — AVOID" }].map(l => (<div key={l.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "16px", height: "2px", background: l.color, boxShadow: `0 0 4px ${l.color}`, borderRadius: "1px" }} /><span style={{ color: "#ffffff", fontWeight: 700, fontSize: "7px", letterSpacing: "1px", fontFamily: "'JetBrains Mono', monospace" }}>{l.label}</span></div>))}
      </div>
      {/* View SDA button */}
      {onViewSDA && (
        <div
          onClick={onViewSDA}
          style={{
            marginTop: "10px", paddingTop: "10px",
            borderTop: `1px solid ${isBranch ? "rgba(136,102,204,0.15)" : "rgba(0,240,255,0.1)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            cursor: "pointer", padding: "8px 12px", borderRadius: "6px",
            background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,215,0,0.15)"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,215,0,0.08)"; e.currentTarget.style.borderColor = "rgba(255,215,0,0.2)"; }}
        >
          <span style={{ color: "#ffd700", fontSize: "8px", fontWeight: "700", letterSpacing: "1.5px", fontFamily: "'JetBrains Mono', monospace" }}>VIEW SDA ALLOCATION</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </div>
      )}
    </div>
  );
}

/* ─── SDA PANEL ─── */
function SDAPanel({ practice, visible, acpPct, setAcpPct }) {
  if (!visible) return null;
  const barPct = (practice.annual / 18933) * 100;
  const gpSessionCost = 11000 * 1.2938;
  const acpAnnualCost = 60000 * 1.2938;
  const gpPct = 100 - acpPct;
  const gpBudget = practice.budget75 * (gpPct / 100);
  const acpBudget = practice.budget75 * (acpPct / 100);
  const gpSessions = gpBudget / gpSessionCost;
  const acpFte = acpBudget / acpAnnualCost;
  const mono = "'JetBrains Mono', monospace";
  const stops = [0, 25, 50];
  return (
    <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px", background: "rgba(10,26,46,0.95)", border: "1px solid rgba(0,240,255,0.2)", borderRadius: "8px", padding: "12px 16px", zIndex: 20, backdropFilter: "blur(12px)", display: "flex", gap: "16px", alignItems: "stretch" }}>
      <div style={{ minWidth: "140px", borderRight: "1px solid rgba(0,240,255,0.2)", paddingRight: "16px" }}>
        <div style={{ color: "#00f0ff", fontSize: "8px", letterSpacing: "2px", fontFamily: mono, marginBottom: "4px" }}>SDA ALLOCATION</div>
        <div style={{ color: "#fff", fontSize: "13px", fontWeight: "700", fontFamily: mono, marginBottom: "6px" }}>{practice.short}</div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
          <span style={{ padding: "1px 6px", borderRadius: "3px", fontSize: "7px", fontWeight: "700", fontFamily: mono, letterSpacing: "1px", background: practice.type === "hub" ? "rgba(0,240,255,0.15)" : "rgba(0,224,138,0.1)", color: practice.type === "hub" ? "#00f0ff" : "#00e08a", border: `1px solid ${practice.type === "hub" ? "rgba(0,240,255,0.3)" : "rgba(0,224,138,0.2)"}` }}>{practice.type === "hub" ? "HUB" : "SPOKE"}</span>
          <span style={{ padding: "1px 6px", borderRadius: "3px", fontSize: "7px", fontWeight: "600", fontFamily: mono, background: practice.system === "EMIS" ? "rgba(255,107,53,0.12)" : "rgba(138,176,192,0.1)", color: practice.system === "EMIS" ? "#ff6b35" : "#6ba3be", border: `1px solid ${practice.system === "EMIS" ? "rgba(255,107,53,0.25)" : "rgba(138,176,192,0.2)"}` }}>{practice.system}</span>
        </div>
        <div style={{ color: "#b0d0e0", fontSize: "8px", fontFamily: mono }}>{practice.patients.toLocaleString()} patients · {practice.pct}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div><div style={{ color: "#90b8cc", fontSize: "7px", letterSpacing: "1px", fontFamily: mono }}>MONTHLY</div><div style={{ color: "#00e08a", fontSize: "14px", fontWeight: "700", fontFamily: mono }}>{fmt(practice.monthly)}</div></div>
          <div><div style={{ color: "#90b8cc", fontSize: "7px", letterSpacing: "1px", fontFamily: mono }}>BUDGET 75%</div><div style={{ color: "#00f0ff", fontSize: "14px", fontWeight: "700", fontFamily: mono }}>{fmt(practice.budget75)}</div></div>
          <div><div style={{ color: "#90b8cc", fontSize: "7px", letterSpacing: "1px", fontFamily: mono }}>ANNUAL SDA REQ</div><div style={{ color: "#ffd700", fontSize: "14px", fontWeight: "700", fontFamily: mono }}>{practice.annual.toLocaleString()}</div></div>
        </div>
        <div style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barPct}%`, borderRadius: "3px", background: `linear-gradient(90deg, #00f0ff, ${practice.type === "hub" ? "#00e08a" : "#0088cc"})`, boxShadow: "0 0 8px rgba(0,240,255,0.3)", transition: "width 0.8s ease" }} />
        </div>
      </div>
      <div style={{ minWidth: "130px", borderLeft: "1px solid rgba(0,240,255,0.2)", paddingLeft: "16px" }}>
        <div style={{ display: "flex", gap: "16px" }}>
          <div><div style={{ color: "#80ccaa", fontSize: "7px", letterSpacing: "1px", fontFamily: mono, marginBottom: "3px" }}>● NON-WINTER /WK</div><div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}><span style={{ color: "#00e08a", fontSize: "16px", fontWeight: "800", fontFamily: mono }}>{practice.nonWinterWk}</span><span style={{ color: "#8abba0", fontSize: "7px", fontFamily: mono }}>F2F {(practice.nonWinterWk / 2).toFixed(1)} · REM {(practice.nonWinterWk / 2).toFixed(1)}</span></div></div>
          <div><div style={{ color: "#cc9080", fontSize: "7px", letterSpacing: "1px", fontFamily: mono, marginBottom: "3px" }}>❄ WINTER /WK</div><div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}><span style={{ color: "#ff6b35", fontSize: "16px", fontWeight: "800", fontFamily: mono }}>{practice.winterWk}</span><span style={{ color: "#bb8878", fontSize: "7px", fontFamily: mono }}>F2F {(practice.winterWk / 2).toFixed(1)} · REM {(practice.winterWk / 2).toFixed(1)}</span></div></div>
        </div>
        <div style={{ color: "#7a9aaa", fontSize: "7px", fontFamily: mono, marginTop: "6px" }}>39 WKS NON-WINTER · 13 WKS WINTER · 15.2/18.2 PER 1K</div>
      </div>
      {/* Resource section with slider */}
      <div style={{ minWidth: "185px", borderLeft: "1px solid rgba(170,136,238,0.3)", paddingLeft: "16px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ color: "#ffffff", fontSize: "7px", letterSpacing: "1.5px", fontFamily: mono }}>RESOURCE MIX</span>
          <span style={{ color: "#90b8cc", fontSize: "8px", fontFamily: mono, fontWeight: "700" }}>GP {gpPct}% <span style={{ color: "#5a7a8a" }}>·</span> ACP {acpPct}%</span>
        </div>
        {/* Slider track */}
        <div style={{ position: "relative", height: "20px", marginBottom: "4px" }}>
          <div style={{ position: "absolute", top: "8px", left: "0", right: "0", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${gpPct}%`, background: "linear-gradient(90deg, #00f0ff, #00e08a)", borderRadius: "2px", transition: "width 0.3s ease", boxShadow: "0 0 8px rgba(0,240,255,0.3)" }} />
          </div>
          {/* Clickable stop buttons */}
          {stops.map((stop) => {
            const gp = 100 - stop;
            const xPct = gp;
            const isActive = acpPct === stop;
            return (
              <div key={stop} onClick={() => setAcpPct(stop)} style={{ position: "absolute", left: `${xPct}%`, top: "2px", transform: "translateX(-50%)", cursor: "pointer", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: isActive ? "14px" : "10px", height: isActive ? "14px" : "10px", borderRadius: "50%", background: isActive ? "#00f0ff" : "rgba(30,60,90,0.9)", border: `2px solid ${isActive ? "#00f0ff" : "rgba(0,240,255,0.4)"}`, boxShadow: isActive ? "0 0 10px rgba(0,240,255,0.5)" : "none", transition: "all 0.3s ease" }} />
              </div>
            );
          })}
        </div>
        {/* Stop labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", position: "relative", height: "10px" }}>
          {stops.map((stop) => {
            const gp = 100 - stop;
            const xPct = gp;
            const isActive = acpPct === stop;
            return (
              <div key={stop} onClick={() => setAcpPct(stop)} style={{ position: "absolute", left: `${xPct}%`, transform: "translateX(-50%)", cursor: "pointer" }}>
                <span style={{ color: isActive ? "#00f0ff" : "#5a7a8a", fontSize: "7px", fontFamily: mono, fontWeight: isActive ? "700" : "400", transition: "all 0.3s ease" }}>{gp}/{stop}</span>
              </div>
            );
          })}
        </div>
        {/* Results */}
        <div style={{ display: "flex", gap: "14px", paddingTop: "4px", borderTop: "1px solid rgba(0,240,255,0.1)" }}>
          <div>
            <div style={{ color: "#c0e0f0", fontSize: "7px", letterSpacing: "1px", fontFamily: mono, marginBottom: "2px" }}>GP SESSIONS</div>
            <span style={{ color: "#00f0ff", fontSize: "16px", fontWeight: "800", fontFamily: mono, transition: "all 0.3s ease" }}>{gpSessions.toFixed(1)}</span>
            <div style={{ color: "#5a8a9a", fontSize: "7px", fontFamily: mono }}>{fmt(Math.round(gpBudget))}</div>
          </div>
          <div style={{ opacity: acpPct === 0 ? 0.3 : 1, transition: "opacity 0.3s ease" }}>
            <div style={{ color: "#e0d0ff", fontSize: "7px", letterSpacing: "1px", fontFamily: mono, marginBottom: "2px" }}>ACP WTE</div>
            <span style={{ color: "#eeddff", fontSize: "16px", fontWeight: "800", fontFamily: mono, transition: "all 0.3s ease" }}>{acpFte.toFixed(2)}</span>
            <div style={{ color: "#5a8a9a", fontSize: "7px", fontFamily: mono }}>{acpPct === 0 ? "—" : fmt(Math.round(acpBudget))}</div>
          </div>
        </div>
        {/* Assumptions */}
        <div style={{ marginTop: "6px", paddingTop: "5px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ color: "#90a8b8", fontSize: "7px", fontFamily: mono, lineHeight: "1.6" }}>
            <span style={{ color: "#00f0ff" }}>GP</span> £11,000/sess + 29.38% = <span style={{ color: "#c0e0f0" }}>£14,232</span>/sess
          </div>
          <div style={{ color: "#90a8b8", fontSize: "7px", fontFamily: mono, lineHeight: "1.6" }}>
            <span style={{ color: "#eeddff" }}>ACP</span> £60,000/yr + 29.38% = <span style={{ color: "#c0e0f0" }}>£77,628</span>/yr
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAP VIEW ─── */
function MapView() {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);       // practice drive time
  const [sdaPractice, setSdaPractice] = useState(null);  // practice SDA
  const [acpPct, setAcpPct] = useState(50); // ACP % of budget (GP gets remainder)
  const [selectedBranch, setSelectedBranch] = useState(null); // "pi-bi" key
  const [hoveredBranch, setHoveredBranch] = useState(null);
  const width = 860, height = 660, padding = 80;
  const positions = practices.map(p => projectPoint(p.lat, p.lng, width, height, padding));
  const hubConnections = [[0, 2], [0, 4], [0, 5], [1, 6], [1, 3]];
  const hubToHub = [[0, 1]];
  const labelOffsets = [{ dx: 20, dy: -50 }, { dx: -170, dy: 28 }, { dx: 25, dy: 22 }, { dx: -175, dy: -32 }, { dx: 20, dy: -58 }, { dx: -178, dy: -52 }, { dx: 25, dy: 28 }];
  const showingDriveLines = selected !== null || selectedBranch !== null;

  const clearAll = () => { setSelected(null); setSdaPractice(null); setSelectedBranch(null); };

  const handlePinClick = (e, i) => {
    e.stopPropagation();
    setSelectedBranch(null);
    if (selected === i) { setSelected(null); setSdaPractice(i); }
    else if (sdaPractice === i) { setSdaPractice(null); }
    else { setSelected(i); setSdaPractice(null); }
  };

  const handleBranchClick = (e, key) => {
    e.stopPropagation();
    setSelected(null); setSdaPractice(null);
    setSelectedBranch(selectedBranch === key ? null : key);
  };

  // Determine what drive times/sidebar to show
  let driveFromPos = null, activeTimes = null, sidebarTitle = null, sidebarSubtitle = null, isBranchSidebar = false;

  if (selected !== null) {
    driveFromPos = positions[selected];
    activeTimes = driveTimes[selected];
    sidebarTitle = practices[selected].short;
  } else if (selectedBranch) {
    const bt = branchDriveTimes[selectedBranch];
    if (bt) {
      const [pi, bi] = selectedBranch.split("-").map(Number);
      const branch = practices[pi].branches[bi];
      driveFromPos = projectPoint(branch.lat, branch.lng, width, height, padding);
      activeTimes = bt;
      sidebarTitle = branch.name.toUpperCase();
      sidebarSubtitle = `BRANCH OF ${practices[pi].short}`;
      isBranchSidebar = true;
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: "12px", border: `1px solid rgba(${selected !== null ? "0,255,136" : selectedBranch ? "136,102,204" : sdaPractice !== null ? "255,215,0" : "0,240,255"},0.2)`, background: "linear-gradient(135deg, rgba(18,42,68,0.85) 0%, rgba(12,30,52,0.9) 100%)", boxShadow: "0 0 60px rgba(0,240,255,0.08), inset 0 0 60px rgba(0,240,255,0.03), 0 20px 60px rgba(0,0,0,0.3)", backdropFilter: "blur(20px)", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none", zIndex: 10, borderRadius: "12px 12px 0 0" }} />
      <div style={{ position: "absolute", top: "10%", left: "-20%", width: "60%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", transform: "rotate(-15deg)", pointerEvents: "none", zIndex: 10 }} />

      <DriveTimeSidebar title={sidebarTitle} subtitle={sidebarSubtitle} times={activeTimes} isBranch={isBranchSidebar} positionLeft={selected === 0 || selected === 4} onViewSDA={selected !== null ? () => { setSdaPractice(selected); setSelected(null); setSelectedBranch(null); } : null} />
      <SDAPanel practice={sdaPractice !== null ? practices[sdaPractice] : null} visible={sdaPractice !== null && selected === null && !selectedBranch} acpPct={acpPct} setAcpPct={setAcpPct} />

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }} onClick={clearAll}>
        <SvgDefs /><GridLines width={width} height={height} />

        {/* Default network lines */}
        {!showingDriveLines && (<g>
          {hubToHub.map(([a, b], i) => { const pa = positions[a], pb = positions[b]; return (<line key={`hh${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#00f0ff" strokeWidth="1.5" opacity="0.15" strokeDasharray="8 4"><animate attributeName="stroke-dashoffset" from="0" to="-24" dur="3s" repeatCount="indefinite" /></line>); })}
          {hubConnections.map(([a, b], i) => { const pa = positions[a], pb = positions[b], mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2 - 20; return (<path key={`c${i}`} d={`M ${pa.x} ${pa.y} Q ${mx} ${my} ${pb.x} ${pb.y}`} stroke="#00f0ff" strokeWidth="1" fill="none" opacity="0.25" strokeDasharray="6 3"><animate attributeName="stroke-dashoffset" from="0" to="-18" dur="2.5s" repeatCount="indefinite" /></path>); })}
        </g>)}

        {/* Drive time lines */}
        {driveFromPos && activeTimes && <DriveLines fromPos={driveFromPos} times={activeTimes} positions={positions} />}

        {/* Branch sites */}
        {practices.map((practice, pi) => {
          if (!practice.branches || !practice.branches.length) return null;
          const parentPos = positions[pi];
          const branchColor = "#8866cc";
          return practice.branches.map((branch, bi) => {
            const bPos = projectPoint(branch.lat, branch.lng, width, height, padding);
            const key = `${pi}-${bi}`;
            const isHov = hoveredBranch === key;
            const isSel = selectedBranch === key;
            const markerCol = isSel ? "#ddbbff" : branchColor;

            return (
              <g key={key}>
                {/* Connection to parent */}
                {!showingDriveLines && <line x1={parentPos.x} y1={parentPos.y} x2={bPos.x} y2={bPos.y} stroke={branchColor} strokeWidth="1" opacity="0.2" strokeDasharray="3 3"><animate attributeName="stroke-dashoffset" from="0" to="-12" dur="2s" repeatCount="indefinite" /></line>}

                {/* Clickable area + marker */}
                <g style={{ cursor: "pointer" }}
                  onClick={(e) => handleBranchClick(e, key)}
                  onMouseEnter={() => setHoveredBranch(key)}
                  onMouseLeave={() => setHoveredBranch(null)}>

                  {/* Invisible hit area */}
                  <circle cx={bPos.x} cy={bPos.y} r="14" fill="transparent" />

                  {/* Selection ring */}
                  {isSel && (<>
                    <circle cx={bPos.x} cy={bPos.y} r="14" fill="none" stroke="#ddbbff" strokeWidth="1.5" opacity="0.5" strokeDasharray="4 3"><animate attributeName="stroke-dashoffset" from="0" to="14" dur="2s" repeatCount="indefinite" /></circle>
                    <PulseRing cx={bPos.x} cy={bPos.y} color="#ddbbff" delay={0} maxR={35} />
                    <PulseRing cx={bPos.x} cy={bPos.y} color="#ddbbff" delay={1.5} maxR={35} />
                  </>)}

                  {/* Diamond marker */}
                  <g transform={`translate(${bPos.x}, ${bPos.y}) rotate(45)`}>
                    <rect x="-5.5" y="-5.5" width="11" height="11" fill={markerCol} opacity="0.15" filter="url(#glowBranch)" rx="1" />
                    <rect x="-3.5" y="-3.5" width="7" height="7" fill={markerCol} opacity={isHov || isSel ? "0.95" : "0.6"} filter={isSel ? "url(#glowPurple)" : "url(#glowBranch)"} rx="1" />
                    <rect x="-1.5" y="-1.5" width="3" height="3" fill="#fff" opacity="0.9" rx="0.5" />
                  </g>

                  {/* Pulse */}
                  {!isSel && <circle cx={bPos.x} cy={bPos.y} r="3" fill="none" stroke={branchColor} strokeWidth="0.5"><animate attributeName="r" from="3" to="12" dur="3s" begin={`${pi * 0.3 + bi * 0.5}s`} repeatCount="indefinite" /><animate attributeName="opacity" from="0.4" to="0" dur="3s" begin={`${pi * 0.3 + bi * 0.5}s`} repeatCount="indefinite" /></circle>}

                  {/* Label */}
                  <g transform={`translate(${bPos.x + 12}, ${bPos.y - 4})`} opacity={isHov || isSel ? 1 : 0.7}>
                    <rect x="-2" y="-9" width={isHov || isSel ? 140 : branch.name.length * 6.5 + 10} height={isHov || isSel ? 38 : 16} rx="2" fill="#0a1a2e" stroke={markerCol} strokeWidth={isSel ? "1" : "0.5"} opacity={isHov || isSel ? 0.95 : 0.6} />
                    <text x="4" y="2" fill={markerCol} fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="600" letterSpacing="0.5">{branch.name.toUpperCase()}</text>
                    {(isHov || isSel) && <>
                      <text x="4" y="14" fill="#7a6a9a" fontSize="7" fontFamily="'JetBrains Mono', monospace">BRANCH OF {practice.short}</text>
                      <text x="4" y="24" fill="#5a7a8a" fontSize="7" fontFamily="'JetBrains Mono', monospace">{isSel ? "● SHOWING DRIVE TIMES" : "CLICK FOR DRIVE TIMES"}</text>
                    </>}
                  </g>
                </g>
              </g>
            );
          });
        })}

        {/* Coordinates */}
        {[52.05, 52.10, 52.15, 52.20, 52.25, 52.30].map(lat => { const p = projectPoint(lat, -1.22, width, height, padding); return <text key={`lat${lat}`} x={12} y={p.y + 3} fill="#2a5a7a" fontSize="7" fontFamily="'JetBrains Mono', monospace">{lat.toFixed(2)}°N</text>; })}
        {[-1.15, -1.05, -0.95, -0.85].map(lng => { const p = projectPoint(52.32, lng, width, height, padding); return <text key={`lng${lng}`} x={p.x - 15} y={height - 10} fill="#2a5a7a" fontSize="7" fontFamily="'JetBrains Mono', monospace">{Math.abs(lng).toFixed(2)}°W</text>; })}
        <text x={width / 2} y={height - 25} textAnchor="middle" fill="#1a3a55" fontSize="28" fontFamily="'JetBrains Mono', monospace" fontWeight="800" letterSpacing="12" opacity="0.35">NORTHANTS</text>

        {/* Practice markers */}
        {practices.map((p, i) => {
          const pos = positions[i], isHub = p.type === "hub", isSelected = selected === i, isSda = sdaPractice === i && selected === null && !selectedBranch;
          const isTarget = (selected !== null && selected !== i) || selectedBranch !== null;
          const baseColor = isHub ? "#00f0ff" : "#00e08a";
          let markerColor = baseColor;
          if (isSelected) markerColor = "#ffffff";
          else if (isSda) markerColor = "#ffd700";
          else if (selected !== null && selected !== i) markerColor = getDriveColor(driveTimes[selected][i]);
          else if (selectedBranch && branchDriveTimes[selectedBranch]) markerColor = getDriveColor(branchDriveTimes[selectedBranch][i]);
          const off = labelOffsets[i];

          return (
            <g key={i} style={{ cursor: "pointer" }} onClick={(e) => handlePinClick(e, i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <line x1={pos.x} y1={pos.y} x2={pos.x + off.dx * 0.3} y2={pos.y + off.dy * 0.3} stroke={markerColor} strokeWidth="0.5" opacity="0.4" />
              <PulseRing cx={pos.x} cy={pos.y} color={markerColor} delay={i * 0.4} maxR={isSelected || isSda ? 40 : isHub ? 35 : 22} />
              {(isHub || isSelected || isSda) && <PulseRing cx={pos.x} cy={pos.y} color={markerColor} delay={i * 0.4 + 1.5} maxR={isSelected || isSda ? 40 : 35} />}
              <circle cx={pos.x} cy={pos.y} r={isSelected || isSda ? 9 : isHub ? 7 : 5} fill={markerColor} opacity="0.2" filter="url(#glowStrong)" />
              <circle cx={pos.x} cy={pos.y} r={isSelected || isSda ? 7 : isHub ? 5 : 3.5} fill={markerColor} opacity="0.9" filter="url(#glow)" />
              <circle cx={pos.x} cy={pos.y} r={isSelected || isSda ? 3 : isHub ? 2.5 : 1.8} fill="#fff" opacity="0.9" />
              {(isSelected || isSda) && (<circle cx={pos.x} cy={pos.y} r="14" fill="none" stroke={markerColor} strokeWidth="1.5" opacity="0.5" strokeDasharray="4 3"><animate attributeName="stroke-dashoffset" from="0" to="14" dur="2s" repeatCount="indefinite" /></circle>)}
              <g transform={`translate(${pos.x + off.dx}, ${pos.y + off.dy})`} opacity={hovered === i || isSelected || isSda ? 1 : 0.85}>
                <rect x="-2" y="-14" width={hovered === i ? 190 : 155} height={hovered === i ? 92 : 22} rx="2" fill="#0a1a2e" stroke={markerColor} strokeWidth={isSelected || isSda ? "1" : "0.5"} opacity={hovered === i ? 0.95 : 0.7} />
                <text x="6" y="0" fill={markerColor} fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700" letterSpacing="1">{p.short}</text>
                {isHub && <text x={p.short.length * 7.2 + 14} y="1" fill="#ff6b35" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="800" letterSpacing="1">HUB</text>}
                {isTarget && activeTimes && <text x={p.short.length * 7.2 + (isHub ? 46 : 14)} y="0" fill={getDriveColor(activeTimes[i])} fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="700">{activeTimes[i]}m</text>}
                {hovered === i && (<>
                  <text x="6" y="16" fill="#6ba3be" fontSize="8" fontFamily="'JetBrains Mono', monospace">{p.area} · {p.postcode} · {p.system}</text>
                  <text x="6" y="30" fill="#4a8a6a" fontSize="8" fontFamily="'JetBrains Mono', monospace">PATIENTS: {p.patients.toLocaleString()} ({p.pct})</text>
                  <text x="6" y="44" fill="#ffd700" fontSize="8" fontFamily="'JetBrains Mono', monospace">SDA: {p.annual.toLocaleString()}/yr · {p.nonWinterWk}/wk</text>
                  {p.branches && p.branches.length > 0 && <text x="6" y="58" fill="#8866cc" fontSize="8" fontFamily="'JetBrains Mono', monospace">BRANCHES: {p.branches.map(b => b.name).join(", ")}</text>}
                  <text x="6" y={p.branches && p.branches.length > 0 ? 72 : 58} fill="#5a7a8a" fontSize="7" fontFamily="'JetBrains Mono', monospace">{isSelected ? "● DRIVE TIMES · CLICK AGAIN FOR SDA" : isSda ? "● SDA VIEW · CLICK AGAIN TO DISMISS" : "CLICK: DRIVE TIMES · 2ND CLICK: SDA"}</text>
                </>)}
              </g>
            </g>
          );
        })}
      </svg>
      {["top-left", "top-right", "bottom-left", "bottom-right"].map(pos => { const isTop = pos.includes("top"), isLeft = pos.includes("left"); return (<div key={pos} style={{ position: "absolute", [isTop ? "top" : "bottom"]: "8px", [isLeft ? "left" : "right"]: "8px", width: "20px", height: "20px", borderTop: isTop ? "1px solid rgba(0,240,255,0.4)" : "none", borderBottom: !isTop ? "1px solid rgba(0,240,255,0.4)" : "none", borderLeft: isLeft ? "1px solid rgba(0,240,255,0.4)" : "none", borderRight: !isLeft ? "1px solid rgba(0,240,255,0.4)" : "none", pointerEvents: "none" }} />); })}
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function NRESGlassMap() {
  const [activeTab, setActiveTab] = useState("map");
  const [time, setTime] = useState(new Date());
  const mono = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  const totalBranches = practices.reduce((s, p) => s + (p.branches ? p.branches.length : 0), 0);

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "radial-gradient(ellipse at 30% 20%, #1a2d4a 0%, #132238 40%, #0e1a2e 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "20px", fontFamily: mono, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: "-20%", left: "10%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(0,240,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "15%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(0,224,138,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px", width: "100%", maxWidth: "860px" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00f0ff", boxShadow: "0 0 12px #00f0ff", animation: "pulse 2s ease-in-out infinite" }} />
        <div>
          <div style={{ color: "#00f0ff", fontSize: "13px", fontWeight: "700", letterSpacing: "4px" }}>NRES NEIGHBOURHOOD</div>
          <div style={{ color: "#4a8a9a", fontSize: "9px", letterSpacing: "2px", marginTop: "2px" }}>NORTHAMPTONSHIRE RURAL EAST & SOUTH</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "baseline", justifyContent: "flex-end" }}>
            <div><div style={{ color: "#5a8a9a", fontSize: "7px", letterSpacing: "1px" }}>PATIENTS</div><div style={{ color: "#00e08a", fontSize: "12px", fontWeight: "700" }}>89,584</div></div>
            <div><div style={{ color: "#5a8a9a", fontSize: "7px", letterSpacing: "1px" }}>ANNUAL SDA REQ</div><div style={{ color: "#ffd700", fontSize: "12px", fontWeight: "700" }}>74,301</div></div>
            <div><div style={{ color: "#5a8a9a", fontSize: "7px", letterSpacing: "1px" }}>ANNUAL VALUE</div><div style={{ color: "#00f0ff", fontSize: "12px", fontWeight: "700" }}>£2.36M</div></div>
          </div>
          <div style={{ color: "#ffffff", fontSize: "7px", fontWeight: "700", letterSpacing: "1px", marginTop: "2px" }}>GO LIVE 1ST APRIL 2026 · JAN 26 LIST · 7 PRACTICES · {totalBranches} BRANCHES · 2 HUBS · 5 SPOKES</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "0", width: "100%", maxWidth: "860px" }}>
        {[{ id: "map", label: "◉ VISUAL MAP" }, { id: "table", label: "☰ DATA TABLE" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "10px 16px", border: "none", cursor: "pointer",
            fontFamily: mono, fontSize: "10px", fontWeight: "700", letterSpacing: "2px",
            background: activeTab === tab.id ? "linear-gradient(180deg, rgba(0,240,255,0.12) 0%, rgba(10,26,46,0.9) 100%)" : "rgba(10,26,46,0.4)",
            color: activeTab === tab.id ? "#00f0ff" : "#4a7a8a",
            borderTop: activeTab === tab.id ? "2px solid #00f0ff" : "2px solid transparent",
            borderLeft: "1px solid rgba(0,240,255,0.1)", borderRight: "1px solid rgba(0,240,255,0.1)",
            borderBottom: activeTab === tab.id ? "none" : "1px solid rgba(0,240,255,0.15)",
            borderRadius: "8px 8px 0 0", transition: "all 0.3s ease",
            boxShadow: activeTab === tab.id ? "0 -4px 20px rgba(0,240,255,0.1)" : "none",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ width: "100%", maxWidth: "860px" }}>
        {activeTab === "map" ? <MapView /> : (
          <div style={{ background: "linear-gradient(135deg, rgba(18,42,68,0.85) 0%, rgba(12,30,52,0.9) 100%)", border: "1px solid rgba(0,240,255,0.2)", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "20px", boxShadow: "0 0 60px rgba(0,240,255,0.08), inset 0 0 60px rgba(0,240,255,0.03), 0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "8px", fontWeight: "600", fontFamily: mono, letterSpacing: "1px", background: "rgba(0,224,138,0.1)", color: "#00e08a", border: "1px solid rgba(0,224,138,0.2)" }}>● Non-Winter: 15.2 per 1,000 list · 39 weeks</span>
              <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "8px", fontWeight: "600", fontFamily: mono, letterSpacing: "1px", background: "rgba(255,136,85,0.1)", color: "#ff8855", border: "1px solid rgba(255,136,85,0.2)" }}>❄ Winter: 18.2 per 1,000 list · 13 weeks</span>
            </div>
            <TableView />
          </div>
        )}
      </div>

      {/* Legend (map only) */}
      {activeTab === "map" && (
        <div style={{ display: "flex", gap: "14px", marginTop: "10px", flexWrap: "wrap", width: "100%", maxWidth: "860px", justifyContent: "center" }}>
          {[{ color: "#00f0ff", label: "HUB", shape: "circle" }, { color: "#00e08a", label: "SPOKE", shape: "circle" }, { color: "#8866cc", label: "BRANCH (CLICK)", shape: "diamond" }, { color: "#00ff88", label: "≤15m" }, { color: "#ff9500", label: "16-25m" }, { color: "#ff3344", label: ">25m" }, { color: "#ffd700", label: "SDA VIEW" }].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {item.shape === "diamond" ? <div style={{ width: "7px", height: "7px", background: item.color, boxShadow: `0 0 6px ${item.color}`, transform: "rotate(45deg)" }} /> : <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: item.color, boxShadow: `0 0 6px ${item.color}` }} />}
              <span style={{ color: "#ffffff", fontSize: "7px", fontWeight: "700", letterSpacing: "1.5px", fontFamily: mono }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ color: "#ffffff", fontSize: "7px", fontWeight: "700", letterSpacing: "2px", marginTop: "8px", textAlign: "center", fontFamily: mono }}>NRES PROGRAMME · APPOINTMENT PLANNING MODEL · GO LIVE APRIL 2026</div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}table{border-spacing:0;}`}</style>
    </div>
  );
}
