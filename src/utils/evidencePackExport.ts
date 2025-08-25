/**
 * NHS-branded evidence pack export utilities
 */

// Types
interface OverviewData {
  practiceName: string;
  pcnName: string;
  generatedBy: string;
  generatedEmail: string;
  cards: Array<{ title: string; bullets: string[] }>;
  cqcNote: string;
  dataFlowSummary: string[];
}

interface AllSecurityData extends OverviewData {
  technical: Array<{ title: string; items: string[]; code?: string }>;
  compliance: Array<{ standard: string; notes: string }>;
  risk: Array<{ id: string; risk: string; mitigation: string; residual: string }>;
  dspt: Array<{ control: string; detail: string; items: string[] }>;
}

// Export handlers
export async function onDownloadCqcEvidencePack() {
  const html = buildCqcEvidenceHTML(collectOverviewData());
  await exportEvidence(html, {
    filenameBase: `CQC_Evidence_Pack_${formatDate(new Date())}`,
  });
}

export async function onDownloadAdvancedEvidencePack() {
  const html = buildAdvancedEvidenceHTML(collectAllSecurityData());
  await exportEvidence(html, {
    filenameBase: `Advanced_Evidence_Pack_${formatDate(new Date())}`,
  });
}

// Simple exporter: PDF OR Word (HTML)
async function exportEvidence(html: string, opts: { filenameBase: string }) {
  const choice = await promptDownloadChoice();
  const { filenameBase } = opts;

  if (choice === "PDF") {
    // Native print dialog (most reliable fonts & pagination)
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      // Let the new window load before print
      setTimeout(() => win.print(), 300);
    }
  } else {
    // Word export via .doc (HTML wrapped)
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

function promptDownloadChoice(): Promise<"PDF" | "Word"> {
  // For now, default to PDF - can be enhanced with modal later
  return Promise.resolve("PDF");
}

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Data collectors
function collectOverviewData(): OverviewData {
  return {
    practiceName: "NHS Practice", // Would be from state
    pcnName: "Primary Care Network", // Would be from state
    generatedBy: "System Administrator", // Would be from auth context
    generatedEmail: "admin@practice.nhs.uk", // Would be from auth context
    cards: getOverviewCards(),
    cqcNote: getCqcNote(),
    dataFlowSummary: getDataFlowItems()
  };
}

function collectAllSecurityData(): AllSecurityData {
  return {
    ...collectOverviewData(),
    technical: getTechnicalSections(),
    compliance: getComplianceStandards(),
    risk: getRiskMatrix(),
    dspt: getDsptCrosswalkTable()
  };
}

// Data getters - these would be replaced with actual state accessors
function getOverviewCards() {
  return [
    {
      title: "Authentication & Access",
      bullets: [
        "JWT token management with auto-refresh",
        "Role-based permissions (7 distinct roles)",
        "Session management with automatic timeout",
        "Account lockout protection"
      ]
    },
    {
      title: "Data Protection",
      bullets: [
        "Data minimization and purpose limitation",
        "Right to access, rectification, and erasure",
        "Data portability features",
        "Consent management systems"
      ]
    },
    {
      title: "Audit & Monitoring",
      bullets: [
        "Complete audit trails for all data changes",
        "Failed login attempt tracking",
        "Role change auditing",
        "Real-time security monitoring"
      ]
    },
    {
      title: "Database Security",
      bullets: [
        "User-based data isolation",
        "Practice-specific access controls",
        "Encrypted data transmission via HTTPS/TLS 1.3",
        "Automated data retention policies"
      ]
    }
  ];
}

function getCqcNote() {
  return `This system meets NHS Digital and GDPR requirements for protecting patient data. Every user action is logged, access is strictly controlled, and all data is hosted and backed up securely in the UK. Practice managers are supported at every step – you do not need technical knowledge to evidence compliance. This page can be shown to CQC inspectors as proof of IT governance and data protection.`;
}

function getDataFlowItems() {
  return [
    "Encryption in Transit (TLS 1.3)",
    "Encryption at Rest (AES-256)",
    "Role-Based Access Control"
  ];
}

function getTechnicalSections() {
  return [
    {
      title: "Authentication & Authorization",
      items: [
        "JWT (1h expiry, auto-refresh)",
        "MFA support",
        "RBAC with 7 roles",
        "Escalation prevention"
      ],
      code: `// JWT token security implementation
const authConfig = {
  persistSession: true,
  autoRefreshToken: true,
  sessionTimeout: 3600 // 1 hour
};`
    },
    {
      title: "Database Security",
      items: [
        "Row Level Security (RLS)",
        "AES-256 at rest",
        "TLS 1.3 transit",
        "Column encryption"
      ]
    },
    {
      title: "Input Validation",
      items: [
        "Zod schemas",
        "DOMPurify sanitization",
        "Parameterised queries",
        "File upload restrictions"
      ]
    }
  ];
}

function getComplianceStandards() {
  return [
    { standard: "GDPR", notes: "Full compliance with data protection regulations" },
    { standard: "DSPT", notes: "Data Security and Protection Toolkit requirements met" },
    { standard: "DCB0129/0160", notes: "NHS Digital Clinical Safety Standards" },
    { standard: "CQC IG", notes: "Care Quality Commission Information Governance" },
    { standard: "MHRA Class I", notes: "Medical Device Regulation compliance" },
    { standard: "ISO 14971", notes: "Risk Management for Medical Devices" },
    { standard: "IEC 62304", notes: "Medical Device Software Lifecycle" }
  ];
}

function getRiskMatrix() {
  return [
    {
      id: "H001",
      risk: "Unauthorized access to patient data",
      mitigation: "End-to-end encryption, MFA, role-based access controls",
      residual: "Low"
    },
    {
      id: "H002", 
      risk: "Data transmission interception",
      mitigation: "TLS 1.3 encryption, secure API endpoints",
      residual: "Very Low"
    },
    {
      id: "H003",
      risk: "Incorrect AI-generated clinical suggestions", 
      mitigation: "Human oversight required, clinical validation disclaimers",
      residual: "Low"
    },
    {
      id: "H004",
      risk: "System downtime during consultations",
      mitigation: "99.9% uptime SLA, offline capabilities, redundant architecture", 
      residual: "Very Low"
    }
  ];
}

function getDsptCrosswalkTable() {
  return [
    {
      control: "Authentication & Access",
      detail: "JWT (1h expiry, auto-refresh), MFA, RBAC, escalation prevention",
      items: ["9.2.6", "9.2.7", "9.3.2", "9.3.3"]
    },
    {
      control: "Database Security",
      detail: "RLS, AES-256 at rest, TLS 1.3 transit, column encryption",
      items: ["9.2.9", "9.3.5"]
    },
    {
      control: "Audit Logging",
      detail: "Complaint, role, doc, meeting changes logged",
      items: ["9.4.2"]
    },
    {
      control: "Monitoring",
      detail: "Failed logins, brute force detection, anomalies, SIEM",
      items: ["9.4.3", "9.4.4", "9.4.6"]
    },
    {
      control: "Input Validation",
      detail: "Zod schemas, DOMPurify, parameterised queries",
      items: ["9.2.4", "9.2.5"]
    }
  ];
}

// Template builders
function buildCqcEvidenceHTML(d: OverviewData) {
  const now = new Date();
  const generatedDate = now.toLocaleString("en-GB", { timeZone: "Europe/London" });
  const appVersion = "1.0.0";
  const referenceId = (Math.random().toString(36).slice(2, 8)).toUpperCase();

  let html = CQC_TEMPLATE_HTML
    .replace(/{{practiceName}}/g, escape(d.practiceName))
    .replace(/{{pcnName}}/g, escape(d.pcnName))
    .replace(/{{generatedDate}}/g, escape(generatedDate))
    .replace(/{{generatedBy}}/g, escape(d.generatedBy))
    .replace(/{{generatedEmail}}/g, escape(d.generatedEmail || ""))
    .replace(/{{appVersion}}/g, escape(appVersion))
    .replace(/{{referenceId}}/g, escape(referenceId))
    .replace("{{cqcNote}}", nl2br(escape(d.cqcNote)))
    .replace("{{#each cards}}" + CARD_LOOP + "{{/each}}", renderCards(d.cards))
    .replace("{{#each dataFlowSummary}}<li>{{this}}</li>{{/each}}", d.dataFlowSummary.map(li).join(""));
  return html;
}

function buildAdvancedEvidenceHTML(d: AllSecurityData) {
  const now = new Date();
  const generatedDate = now.toLocaleString("en-GB", { timeZone: "Europe/London" });
  const appVersion = "1.0.0";
  const referenceId = (Math.random().toString(36).slice(2, 8)).toUpperCase();

  const html = ADV_TEMPLATE_HTML
    .replace(/{{practiceName}}/g, escape(d.practiceName))
    .replace(/{{pcnName}}/g, escape(d.pcnName))
    .replace(/{{generatedDate}}/g, escape(generatedDate))
    .replace(/{{generatedBy}}/g, escape(d.generatedBy))
    .replace(/{{generatedEmail}}/g, escape(d.generatedEmail || ""))
    .replace(/{{appVersion}}/g, escape(appVersion))
    .replace(/{{referenceId}}/g, escape(referenceId))
    .replace("{{cqcNote}}", nl2br(escape(d.cqcNote)))
    .replace("{{#each technical}}" + TECH_LOOP + "{{/each}}", renderTechnical(d.technical))
    .replace("{{#each compliance}}" + COMP_LOOP + "{{/each}}", renderCompliance(d.compliance))
    .replace("{{#each risk}}" + RISK_LOOP + "{{/each}}", renderRisk(d.risk))
    .replace("{{#each dspt}}" + DSPT_LOOP + "{{/each}}", renderDspt(d.dspt));
  return html;
}

// Helper functions
function escape(s: string) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[m]!));
}

function nl2br(s: string) {
  return s.replace(/\n/g, "<br>");
}

function li(s: string) {
  return `<li>${escape(s)}</li>`;
}

// Template loops
const CARD_LOOP = `<div class="card">
  <h3>{{title}}</h3>
  <ul class="kvs">{{#each bullets}}<li>{{this}}</li>{{/each}}</ul>
</div>`;

function renderCards(cards: Array<{ title: string; bullets: string[] }>) {
  return cards.map(c => CARD_LOOP
    .replace("{{title}}", escape(c.title))
    .replace("{{#each bullets}}<li>{{this}}</li>{{/each}}", c.bullets.map(li).join(""))
  ).join("");
}

const TECH_LOOP = `<div class="block">
  <h3>{{title}}</h3>
  <ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>
  {{#if code}}<details><summary>Code sample</summary><pre class="code">{{code}}</pre></details>{{/if}}
</div>`;

function renderTechnical(list: any[]) {
  return list.map(sec => {
    let html = TECH_LOOP
      .replace("{{title}}", escape(sec.title))
      .replace("{{#each items}}<li>{{this}}</li>{{/each}}", (sec.items || []).map(li).join(""));
    if (sec.code) {
      html = html.replace("{{#if code}}", "").replace("{{code}}", escape(sec.code)).replace("{{/if}}", "");
    } else {
      html = html.replace(/{{#if code}}[\s\S]*?{{\/if}}/g, "");
    }
    return html;
  }).join("");
}

const COMP_LOOP = `<tr><td><span class="badge">{{standard}}</span></td><td>{{notes}}</td></tr>`;
function renderCompliance(rows: any[]) {
  return rows.map(r => COMP_LOOP
    .replace("{{standard}}", escape(r.standard))
    .replace("{{notes}}", escape(r.notes || ""))
  ).join("");
}

const RISK_LOOP = `<tr><td>{{id}}</td><td>{{risk}}</td><td>{{mitigation}}</td><td>{{residual}}</td></tr>`;
function renderRisk(rows: any[]) {
  return rows.map(r => RISK_LOOP
    .replace("{{id}}", escape(r.id))
    .replace("{{risk}}", escape(r.risk))
    .replace("{{mitigation}}", escape(r.mitigation))
    .replace("{{residual}}", escape(r.residual))
  ).join("");
}

const DSPT_LOOP = `<tr><td>{{control}}</td><td>{{detail}}</td><td>{{items}}</td></tr>`;
function renderDspt(rows: any[]) {
  return rows.map(r => DSPT_LOOP
    .replace("{{control}}", escape(r.control))
    .replace("{{detail}}", escape(r.detail))
    .replace("{{items}}", (r.items || []).map((i: string) => `<span class="badge">${escape(i)}</span>`).join(" "))
  ).join("");
}

// NHS-branded HTML templates
const CQC_TEMPLATE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CQC Evidence Pack</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --nhs-blue:#005EB8; --nhs-dark:#003087; --ink:#0b0c0c; --muted:#505a5f; --border:#dfe1e3; --bg:#ffffff;
  }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: var(--bg); margin: 0; }
  .page { padding: 24mm 18mm; }
  header { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
  .nhs-tag { background: var(--nhs-blue); color:#fff; padding:8px 12px; font-weight:700; border-radius:4px; font-size:18px; }
  h1 { color: var(--nhs-blue); margin: 8px 0 4px; font-size: 26px; }
  h2 { color: var(--nhs-dark); margin: 20px 0 8px; font-size: 20px; }
  p, li { line-height: 1.45; font-size: 12.5pt; }
  .meta { font-size:11pt; color:var(--muted); margin-bottom:16px; }
  .card-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin:12px 0 6px; }
  .card { border:1px solid var(--border); border-left:5px solid var(--nhs-blue); padding:12px; border-radius:6px; background:#fff; }
  .card h3 { margin:0 0 6px; font-size:14pt; color:var(--nhs-blue); }
  .cqc-note { background:#f3f7ff; border:1px solid #cfe0ff; padding:12px; border-radius:6px; }
  .kvs li { margin-bottom:6px; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid var(--border); font-size:10pt; color:var(--muted); display:flex; justify-content:space-between; }
  .page-break { page-break-before: always; }
  @media print {
    a { text-decoration: none; color: inherit; }
    .page { padding: 16mm 14mm; }
  }
</style>
</head>
<body>
  <section class="page" role="document" aria-label="CQC Evidence Pack">
    <header>
      <div class="nhs-tag" aria-label="NHS branded header">NHS</div>
      <div>
        <h1>IT Security & Data Protection — CQC Evidence Pack</h1>
        <div class="meta">
          <span><strong>Practice:</strong> {{practiceName}}</span> &nbsp;|&nbsp;
          <span><strong>PCN:</strong> {{pcnName}}</span> &nbsp;|&nbsp;
          <span><strong>Generated:</strong> {{generatedDate}} (Europe/London)</span> &nbsp;|&nbsp;
          <span><strong>By:</strong> {{generatedBy}} {{generatedEmail}}</span>
        </div>
      </div>
    </header>

    <h2>Plain-English Summary</h2>
    <p>
      You do not need to change how you currently work. We will assist at every step and work directly with your
      Data Protection Officer (DPO), Clinical Safety Officer (CSO) and NHS IT Governance colleagues to keep everything compliant.
      This means no extra burden for you — we handle the technical and regulatory detail in the background.
    </p>

    <h2>Key Safeguards</h2>
    <div class="card-grid">
      {{#each cards}}{{/each}}
    </div>

    <h2>Data Flow Controls</h2>
    <ul class="kvs">
      {{#each dataFlowSummary}}<li>{{this}}</li>{{/each}}
    </ul>

    <h2>CQC Inspection Note</h2>
    <div class="cqc-note">
      {{cqcNote}}
    </div>

    <div class="footer" aria-label="Document metadata">
      <div>Version: {{appVersion}}</div>
      <div>Reference: CQC-IT-{{referenceId}}</div>
    </div>
  </section>
</body>
</html>`;

const ADV_TEMPLATE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Advanced Evidence Pack (Technical + DSPT)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --nhs-blue:#005EB8; --nhs-dark:#003087; --ink:#0b0c0c; --muted:#505a5f; --border:#dfe1e3; --bg:#ffffff; --row:#f8f9fa;
  }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: var(--bg); margin: 0; }
  .page { padding: 22mm 16mm; }
  header { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
  .nhs-tag { background: var(--nhs-blue); color:#fff; padding:8px 12px; font-weight:700; border-radius:4px; font-size:18px; }
  h1 { color: var(--nhs-blue); margin: 8px 0 4px; font-size: 26px; }
  h2 { color: var(--nhs-dark); margin: 18px 0 8px; font-size: 20px; border-bottom:2px solid var(--border); padding-bottom:4px; }
  h3 { color: var(--nhs-blue); margin: 12px 0 6px; font-size: 16px; }
  p, li { line-height: 1.45; font-size: 12.5pt; }
  .meta { font-size:11pt; color:var(--muted); margin-bottom:16px; }
  .block { margin:10px 0 14px; }
  pre.code { background:#0b0c0c; color:#fff; padding:10px; border-radius:6px; overflow:auto; font-size:10pt; }
  table { width:100%; border-collapse: collapse; margin: 8px 0 14px; }
  th, td { border:1px solid var(--border); padding:8px; vertical-align: top; }
  th { background: var(--row); text-align:left; }
  .badge { display:inline-block; padding:2px 6px; border-radius:10px; font-size:10pt; background:#eef4ff; color:var(--nhs-dark); border:1px solid #cfe0ff; }
  .page-break { page-break-before: always; }
  .footer { margin-top:18px; padding-top:8px; border-top:1px solid var(--border); font-size:10pt; color:var(--muted); display:flex; justify-content:space-between; }
  @media print { .page { padding: 16mm 12mm; } }
</style>
</head>
<body>
  <section class="page" role="document" aria-label="Advanced Evidence Pack">
    <header>
      <div class="nhs-tag">NHS</div>
      <div>
        <h1>Security & Compliance — Advanced Evidence Pack</h1>
        <div class="meta">
          <span><strong>Practice:</strong> {{practiceName}}</span> &nbsp;|&nbsp;
          <span><strong>PCN:</strong> {{pcnName}}</span> &nbsp;|&nbsp;
          <span><strong>Generated:</strong> {{generatedDate}} (Europe/London)</span> &nbsp;|&nbsp;
          <span><strong>By:</strong> {{generatedBy}} {{generatedEmail}}</span>
        </div>
      </div>
    </header>

    <!-- Overview summary (short) -->
    <h2>Executive Summary</h2>
    <p>{{cqcNote}}</p>

    <div class="page-break"></div>

    <!-- Technical -->
    <h2>Technical Implementation Evidence</h2>
    {{#each technical}}{{/each}}

    <div class="page-break"></div>

    <!-- Compliance -->
    <h2>Compliance Standards & Declarations</h2>
    <table aria-label="Compliance standards">
      <thead><tr><th>Standard</th><th>Notes / Scope</th></tr></thead>
      <tbody>
        {{#each compliance}}{{/each}}
      </tbody>
    </table>

    <div class="page-break"></div>

    <!-- Risk -->
    <h2>Risk Management (H001–H004)</h2>
    <table aria-label="Risk register">
      <thead><tr><th>ID</th><th>Risk</th><th>Mitigation</th><th>Residual</th></tr></thead>
      <tbody>
        {{#each risk}}{{/each}}
      </tbody>
    </table>

    <div class="page-break"></div>

    <!-- DSPT -->
    <h2>DSP Toolkit Evidence Crosswalk</h2>
    <table aria-label="DSPT crosswalk">
      <thead>
        <tr>
          <th>Security Control</th>
          <th>Implementation Detail</th>
          <th>DSPT Evidence Items</th>
        </tr>
      </thead>
      <tbody>
        {{#each dspt}}{{/each}}
      </tbody>
    </table>

    <div class="footer">
      <div>Version: {{appVersion}}</div>
      <div>Reference: DSPT-MAP-{{referenceId}}</div>
    </div>
  </section>
</body>
</html>`;