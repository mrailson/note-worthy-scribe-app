// @ts-nocheck
import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   NRES SDA Claims System — Programme Board Presentation
   Notewell · March 2026
   ═══════════════════════════════════════════════════════════════════════ */

// ── Shared Config ───────────────────────────────────────────────────────
const PRACTICES = [
  { key:"parks", name:"The Parks MC" },{ key:"brackley", name:"Brackley MC" },
  { key:"springfield", name:"Springfield Surgery" },{ key:"towcester", name:"Towcester MC" },
  { key:"bugbrooke", name:"Bugbrooke Surgery" },{ key:"brook", name:"Brook Health Centre" },
  { key:"denton", name:"Denton Village Surgery" },
];
const ROLES = [
  { key:"gp",label:"GP",annual:11000,alloc:"sessions" },
  { key:"anp",label:"ANP",annual:55000,alloc:"hours" },
  { key:"acp",label:"ACP",annual:50000,alloc:"hours" },
  { key:"practice_nurse",label:"Practice Nurse",annual:35000,alloc:"hours" },
  { key:"hca",label:"HCA",annual:25000,alloc:"hours" },
  { key:"pharmacist",label:"Pharmacist",annual:45000,alloc:"hours" },
];
const MULT = 1.2938;
const calc = (role,type,val) => { const r=ROLES.find(x=>x.key===role); if(!r||!val)return 0; let a; if(type==="sessions")a=val*r.annual*MULT; else if(type==="hours")a=(val/37.5)*r.annual*MULT; else a=val*r.annual*MULT; return a/12; };
const fm = n => "£"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
const fmK = n => n>=1000?"£"+Math.round(n/1000)+"k":fm(n);

const EV_TYPES = {
  sda_slot:{label:"SDA Slot Type Report",icon:"📊"},sda_rota:{label:"SDA Rota Report",icon:"📅"},
  ltc_slot:{label:"LTC Slot Type Report",icon:"📊"},ltc_rota:{label:"LTC Rota Report",icon:"📅"},
};

const STATUS_CFG = {
  draft:{l:"Draft",c:"#6B7280",bg:"#F3F4F6"},submitted:{l:"Submitted",c:"#2563EB",bg:"#DBEAFE"},
  verified:{l:"Verified",c:"#D97706",bg:"#FEF3C7"},approved:{l:"Approved",c:"#059669",bg:"#D1FAE5"},
  rejected:{l:"Returned",c:"#DC2626",bg:"#FEE2E2"},
};

const PAY_CFG = {
  awaiting:{l:"Awaiting Payment",c:"#D97706",bg:"#FEF3C7",i:"⏳"},
  due:{l:"Payment Due",c:"#2563EB",bg:"#DBEAFE",i:"📅"},
  paid:{l:"Payment Made",c:"#059669",bg:"#D1FAE5",i:"💸"},
  received:{l:"Receipt Confirmed",c:"#7C3AED",bg:"#EDE9FE",i:"✅"},
};

// ── Slide Components ────────────────────────────────────────────────────
const SlideTitle = ({children,sub}) => (
  <div style={{marginBottom:28}}>
    <h2 style={{fontFamily:"'Source Serif 4','Georgia',serif",fontSize:28,fontWeight:800,color:"#0C2D48",margin:0,letterSpacing:-0.5,lineHeight:1.2}}>{children}</h2>
    {sub && <p style={{fontSize:14,color:"#475569",margin:"6px 0 0",fontWeight:400}}>{sub}</p>}
  </div>
);

const Stat = ({label,value,sub,color="#0C2D48",bg="#F1F5F9"}) => (
  <div style={{background:bg,borderRadius:12,padding:"20px 18px",borderLeft:`4px solid ${color}`,flex:1}}>
    <div style={{fontSize:10,color,fontWeight:700,letterSpacing:0.5}}>{label}</div>
    <div style={{fontSize:28,fontWeight:800,color,marginTop:4,lineHeight:1}}>{value}</div>
    {sub && <div style={{fontSize:11,color:"#475569",marginTop:4}}>{sub}</div>}
  </div>
);

const InfoCard = ({icon,title,children,accent="#0C2D48"}) => (
  <div style={{background:"#fff",borderRadius:12,padding:"20px 18px",border:"1px solid #E2E8F0",borderTop:`3px solid ${accent}`}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <span style={{fontSize:22}}>{icon}</span>
      <span style={{fontFamily:"'Source Serif 4','Georgia',serif",fontSize:16,fontWeight:800,color:"#0C2D48"}}>{title}</span>
    </div>
    <div style={{fontSize:13,color:"#475569",lineHeight:1.7}}>{children}</div>
  </div>
);

const Badge = ({children,color="#0C4A6E",bg="#E0F2FE"}) => (
  <span style={{display:"inline-flex",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,color,background:bg}}>{children}</span>
);

const FlowStep = ({n,label,sub,color,active}) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:80}}>
    <div style={{width:active?38:30,height:active?38:30,borderRadius:"50%",background:color,
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:active?15:13,color:"#fff",fontWeight:700,
      boxShadow:active?`0 0 0 4px ${color}33`:"none",transition:"all 0.3s"}}>{n}</div>
    <div style={{fontSize:12,fontWeight:active?700:500,color,marginTop:6,textAlign:"center"}}>{label}</div>
    <div style={{fontSize:10,color:"#94A3B8",textAlign:"center"}}>{sub}</div>
  </div>
);

const FlowLine = ({color}) => <div style={{flex:1,height:3,background:color,borderRadius:2,margin:"0 4px",alignSelf:"center",marginBottom:28}} />;

// ── Navigation Sections ─────────────────────────────────────────────────
const SECTIONS = [
  { id:"cover", label:"Cover", icon:"📋" },
  { id:"challenge", label:"The Challenge", icon:"⚠️" },
  { id:"manual", label:"Option A: Manual", icon:"📝" },
  { id:"solution", label:"Option B: Digital", icon:"💡" },
  { id:"workflow", label:"Claims Workflow", icon:"🔄" },
  { id:"evidence", label:"Evidence Model", icon:"📎" },
  { id:"payments", label:"Payments & Finance", icon:"💰" },
  { id:"compare", label:"Options Comparison", icon:"⚖️" },
  { id:"demo", label:"Live Prototype", icon:"🖥️" },
  { id:"plan", label:"Implementation Plan", icon:"📅" },
  { id:"ask", label:"The Ask", icon:"✅" },
];

// ── Demo Data for Prototype ─────────────────────────────────────────────
const demoStaff = [
  {id:1,name:"Dr Aamer Badshah",role:"gp",cat:"new_sda",aT:"sessions",aV:4,pk:"parks"},
  {id:2,name:"Dr Jane Collins",role:"gp",cat:"buyback",aT:"sessions",aV:3,pk:"parks"},
  {id:3,name:"Sarah Mitchell",role:"anp",cat:"buyback",aT:"hours",aV:15,pk:"parks"},
];

const demoClaims = [
  {id:101,pk:"parks",month:"Apr 2026",status:"draft",staff:3,total:null,
    lines:[
      {name:"Dr Jane Collins",role:"gp",cat:"buyback",aT:"sessions",aV:3,ev:{}},
      {name:"Sarah Mitchell",role:"anp",cat:"buyback",aT:"hours",aV:15,ev:{sda_slot:true,sda_rota:true}},
    ]},
  {id:102,pk:"brackley",month:"Mar 2026",status:"verified",staff:1,total:null},
  {id:103,pk:"towcester",month:"Feb 2026",status:"approved",staff:2,total:null,payStatus:"received"},
];

// ── Phase Data ──────────────────────────────────────────────────────────
const phases = [
  {n:"0",l:"Email & Config Update",dev:0.5,test:0.25,risk:"low",d:"Update Amanda Palin's email system-wide"},
  {n:"1",l:"Practice Details & Bank Storage",dev:2,test:1,risk:"med",d:"Secure storage of practice addresses and bank details for remittances"},
  {n:"2",l:"Staff Roster Redesign",dev:3,test:1.5,risk:"med",d:"Simple table-based roster with live cost calculations"},
  {n:"3",l:"Evidence Upload Redesign",dev:3,test:2,risk:"high",d:"Mandatory/optional evidence model with retrospective LTC uploads"},
  {n:"4",l:"LTC Evidence Tracking",dev:1.5,test:1,risk:"low",d:"Dashboard tracking of outstanding LTC evidence obligations"},
  {n:"5",l:"Workflow Visibility",dev:2.5,test:1,risk:"med",d:"Visual stepper, queue views, enhanced audit trails"},
  {n:"6",l:"Remittance Documents",dev:3,test:1.5,risk:"med",d:"Auto-generated payment remittances on SNO approval"},
  {n:"7",l:"Payment Lifecycle",dev:3.5,test:2,risk:"high",d:"Due dates, payment confirmation, receipt tracking, email notifications"},
  {n:"8",l:"Finance Dashboard & Ledger",dev:3,test:1.5,risk:"med",d:"Cross-practice finance view and practice payment ledger with running balance"},
];
const totalDev = phases.reduce((s,p)=>s+p.dev,0);
const totalTest = phases.reduce((s,p)=>s+p.test,0);
const totalHrs = totalDev+totalTest;

// ═══════════════════════════════════════════════════════════════════════
//  MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════════════
export default function BoardPresentation() {
  const [section, setSection] = useState("cover");
  const [demoView, setDemoView] = useState("dashboard");
  const [demoRole, setDemoRole] = useState("practice");
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [expandedClaim, setExpandedClaim] = useState(null);
  const [showCalc, setShowCalc] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [section]);

  const riskC = {low:"#059669",med:"#D97706",high:"#DC2626"};
  const riskBg = {low:"#D1FAE5",med:"#FEF3C7",high:"#FEE2E2"};

  return (
    <div style={{fontFamily:"'Source Serif 4','Georgia',serif",background:"#F5F3EF",minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ═══ HEADER ═══ */}
      <header style={{background:"linear-gradient(135deg, #1A3A5C 0%, #1E5F7A 50%, #2A7A94 100%)",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#10B981,#059669)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff"}}>N</div>
          <div>
            <div style={{color:"#fff",fontSize:16,fontWeight:800,fontFamily:"'DM Sans',sans-serif",letterSpacing:-0.5}}>Notewell</div>
            <div style={{color:"#7DD3FC",fontSize:9,fontWeight:600,letterSpacing:1,fontFamily:"'DM Sans',sans-serif"}}>NRES PROGRAMME BOARD</div>
          </div>
        </div>
        <div style={{color:"#94A3B8",fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
          SDA Part A Claims System · Digital Enhancement Proposal · March 2026
        </div>
      </header>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* ═══ SIDEBAR NAV ═══ */}
        <nav style={{width:210,background:"#1A3A5C",padding:"16px 0",overflowY:"auto",flexShrink:0}}>
          {SECTIONS.map((s,i) => (
            <button key={s.id} onClick={()=>setSection(s.id)} style={{
              display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 18px",
              border:"none",cursor:"pointer",textAlign:"left",transition:"all 0.15s",
              background:section===s.id?"#143050":"transparent",
              borderLeft:section===s.id?"3px solid #10B981":"3px solid transparent",
              fontFamily:"'DM Sans',sans-serif",
            }}>
              <span style={{fontSize:15}}>{s.icon}</span>
              <div>
                <div style={{fontSize:10,color:"#64748B",fontWeight:600}}>{String(i).padStart(2,"0")}</div>
                <div style={{fontSize:12,fontWeight:section===s.id?700:500,color:section===s.id?"#fff":"#94A3B8"}}>{s.label}</div>
              </div>
            </button>
          ))}
          <div style={{padding:"20px 18px",borderTop:"1px solid #2A5070",marginTop:12}}>
            <div style={{fontSize:10,color:"#475569",fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
              Prepared by<br/><span style={{color:"#94A3B8",fontWeight:600}}>Malcolm Railson</span><br/>
              NRES Neighbourhood Manager
            </div>
          </div>
        </nav>

        {/* ═══ CONTENT ═══ */}
        <main ref={contentRef} style={{flex:1,overflowY:"auto",padding:"32px 40px 60px",fontFamily:"'DM Sans',sans-serif"}}>

          {/* ─── COVER ─── */}
          {section==="cover" && (
            <div style={{display:"flex",flexDirection:"column",justifyContent:"center",minHeight:"70vh"}}>
              <div style={{maxWidth:700}}>
                <div style={{fontSize:11,color:"#D97706",fontWeight:700,letterSpacing:1.5,marginBottom:12}}>NRES PROGRAMME · MARCH 2026</div>
                <h1 style={{fontFamily:"'Source Serif 4','Georgia',serif",fontSize:38,fontWeight:800,color:"#0C2D48",margin:"0 0 16px",lineHeight:1.15,letterSpacing:-0.5}}>
                  SDA Part A Claims System<br/>
                  <span style={{color:"#059669"}}>Digital Enhancement Proposal</span>
                </h1>
                <p style={{fontSize:16,color:"#475569",lineHeight:1.7,margin:"0 0 28px",maxWidth:580}}>
                  A streamlined digital claims, evidence, and payment system for the £2.34M Neighbourhood Access Service contract across 7 NRES member practices and ~89,584 patients.
                </p>
                <div style={{display:"flex",gap:16}}>
                  <Stat label="CONTRACT VALUE" value="£2.34M" sub="2-year NAS pilot" color="#059669" bg="#D1FAE5" />
                  <Stat label="PRACTICES" value="7" sub="NRES neighbourhood" color="#2563EB" bg="#DBEAFE" />
                  <Stat label="PATIENTS" value="~89.6k" sub="registered population" color="#7C3AED" bg="#EDE9FE" />
                </div>
                <div style={{marginTop:28,display:"flex",gap:12,flexWrap:"wrap"}}>
                  {["Principal Medical Ltd (SNO)","Dr Mark Gray (SRO)","Malcolm Railson (Neighbourhood Manager)","Amanda Palin (Operations)"].map((p,i) => (
                    <span key={i} style={{padding:"4px 12px",borderRadius:6,fontSize:11,background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#475569",fontWeight:500}}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── THE CHALLENGE ─── */}
          {section==="challenge" && (
            <div>
              <SlideTitle sub="Why the current system needs upgrading">The Challenge</SlideTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28}}>
                {[
                  {icon:"📋",title:"Staff Management is Fiddly",body:"Practice managers struggle with the current interface for maintaining their SDA staff list. Adding and editing buyback and new SDA staff feels complex — it should be as simple as managing a roster.",accent:"#DC2626"},
                  {icon:"📎",title:"Evidence Upload is Confusing",body:"Practices don't know which evidence documents to upload and where. The distinction between mandatory SDA evidence and Part B LTC evidence is unclear, leading to incomplete submissions and delays.",accent:"#D97706"},
                  {icon:"👁️",title:"Workflow Visibility is Poor",body:"Once a claim is submitted, practices can't easily see where it is in the approval pipeline. Verifiers and the SNO lack clear queue views. Status tracking is fragmented.",accent:"#2563EB"},
                  {icon:"💰",title:"Finance Tracking is Missing",body:"There is no payment lifecycle tracking. Once approved, there's no mechanism to record payment due dates, confirm payments, or generate remittance advices. PML Finance has no dashboard.",accent:"#7C3AED"},
                ].map((c,i) => (
                  <div key={i} style={{background:"#fff",borderRadius:14,padding:22,borderTop:`4px solid ${c.accent}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                    <div style={{fontSize:24,marginBottom:8}}>{c.icon}</div>
                    <div style={{fontFamily:"'Source Serif 4','Georgia',serif",fontSize:16,fontWeight:800,color:"#0C2D48",marginBottom:8}}>{c.title}</div>
                    <div style={{fontSize:13,color:"#475569",lineHeight:1.7}}>{c.body}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"linear-gradient(135deg,#0C2D48,#145374)",borderRadius:14,padding:"24px 28px",color:"#fff"}}>
                <div style={{fontSize:16,fontWeight:800,marginBottom:8}}>The Result</div>
                <div style={{fontSize:14,opacity:0.85,lineHeight:1.7}}>
                  Practices submit incomplete claims. Verification bottlenecks build up. There is no end-to-end audit trail from claim through to payment.
                  PML Finance cannot track what has been approved versus what has been paid. The programme lacks the financial governance transparency expected of a £2.34M public contract.
                </div>
              </div>
            </div>
          )}

          {/* ─── OPTION A: MANUAL PROCESS ─── */}
          {section==="manual" && (
            <div>
              <SlideTitle sub="What the process looks like without system development">Option A: Manual Process</SlideTitle>

              <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:"14px 18px",marginBottom:24,fontSize:13,color:"#92400E",lineHeight:1.6}}>
                If the Programme Board prefers not to invest in system development, the SDA Part A claiming process can be operated manually using existing tools — email, spreadsheets, shared drives, and PDF forms. Below is a full breakdown of what that looks like, who does what, and the time commitment required.
              </div>

              {/* Monthly Process Flow */}
              <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:14}}>Monthly Claims Cycle — Manual Process</div>

              {/* Step by step */}
              <div style={{display:"grid",gap:10,marginBottom:28}}>
                {[
                  {step:"1",who:"Practice Manager",title:"Prepare Staff & Cost Spreadsheet",time:"45–60 mins per practice",
                    detail:"Each practice maintains a spreadsheet of SDA staff (name, role, sessions/hours, start date, buyback or new hire). Practice Manager manually calculates monthly costs using the on-costs formula (base × 1.2938 ÷ 12), checking for pro-rata adjustments. Updates the spreadsheet each month if anything changes.",
                    tools:"Excel/Google Sheets template",risk:"Calculation errors, inconsistent formats across 7 practices, version control issues"},
                  {step:"2",who:"Practice Manager",title:"Export Evidence Reports from Clinical System",time:"20–30 mins per practice",
                    detail:"Log into EMIS or SystmOne. Run SDA Slot Type report and SDA Rota report for each buyback clinician. For buyback claims, also run LTC Slot Type and LTC Rota reports. Export as PDF. Label each file clearly with practice name, clinician, and period. For a practice with 3 buyback staff, that's up to 12 report exports.",
                    tools:"EMIS/SystmOne reporting module",risk:"Wrong date range selected, reports not clearly labelled, missing LTC evidence"},
                  {step:"3",who:"Practice Manager",title:"Complete Part A Claim Form",time:"20–30 mins per practice",
                    detail:"Fill in the Part A claim form (Word/PDF template) with staff details, allocation, calculated amounts, and declaration. Cross-reference against the cost spreadsheet. Attach or reference the evidence files.",
                    tools:"Word/PDF form template",risk:"Transcription errors between spreadsheet and form, declaration not signed"},
                  {step:"4",who:"Practice Manager",title:"Email Claim Pack to NRES Team",time:"10 mins per practice",
                    detail:"Compose email to Malcolm/Amanda with: completed claim form, cost spreadsheet, and all evidence files attached. A buyback claim with 3 staff could have 12+ attachments. Subject line must follow naming convention.",
                    tools:"NHS email",risk:"Attachments missing, wrong files attached, email size limits, lost in inbox"},
                  {step:"5",who:"Malcolm / Amanda",title:"Receive & Log All Practice Claims",time:"30–45 mins",
                    detail:"Receive up to 7 practice emails. Download all attachments. Log each claim in a master tracking spreadsheet (practice, month, staff count, amount, date received, status). Create folders on shared drive for each practice/month. Move evidence files into correct folders.",
                    tools:"Email, master tracking spreadsheet, shared drive",risk:"Missed emails, misfiled evidence, tracking spreadsheet becomes unwieldy"},
                  {step:"6",who:"Malcolm / Amanda",title:"Verify Each Claim — Evidence Check",time:"30–45 mins per practice",
                    detail:"Open each evidence file and verify: correct clinician name, correct period, SDA slot types present, rota shows correct sessions. For buyback: check all 4 evidence types present and that LTC evidence demonstrates additionality. Cross-check claimed amounts against role rates and on-costs formula. Flag any missing or incorrect evidence.",
                    tools:"PDF viewer, calculator/spreadsheet",risk:"Evidence appears valid but covers wrong period, calculation errors not caught, no standardised review checklist"},
                  {step:"7",who:"Malcolm / Amanda",title:"Chase Missing Evidence / Corrections",time:"Variable — 15–60 mins",
                    detail:"Email practices with queries or requests for replacement evidence. Track which practices have responded. Follow up after 3–5 days if not received. Update tracking spreadsheet.",
                    tools:"Email",risk:"Delays compound, chase emails get lost, practice staff turnover means contacts change"},
                  {step:"8",who:"Malcolm / Amanda",title:"Prepare Verification Summary for SNO",time:"20–30 mins",
                    detail:"Compile a summary document for Dr Mark Gray: list of verified claims, total amounts per practice, any concerns or exceptions noted. Attach or link to evidence folders. Email to SNO.",
                    tools:"Word/email, shared drive",risk:"Summary doesn't match individual claim details, SNO cannot easily review evidence"},
                  {step:"9",who:"Dr Mark Gray (SNO)",title:"Review & Approve Claims",time:"20–30 mins",
                    detail:"Review Malcolm/Amanda's summary. Optionally spot-check individual evidence files on the shared drive. Reply by email with approval, or flag concerns requiring follow-up. For rejected claims, email Malcolm with notes to pass back to the practice.",
                    tools:"Email, shared drive",risk:"Approval is just a reply email — no formal digital signature or audit trail. Difficult to prove governance in audit."},
                  {step:"10",who:"Malcolm / Amanda",title:"Notify Practices of Outcome",time:"15–20 mins",
                    detail:"Email each practice with approval confirmation or rejection with notes. Update master tracking spreadsheet with approved status and date.",
                    tools:"Email, tracking spreadsheet",risk:"Practice doesn't receive or read the email, no system of record"},
                  {step:"11",who:"Malcolm / Amanda",title:"Prepare Payment Schedule for PML Finance",time:"30–45 mins",
                    detail:"Compile a payment schedule spreadsheet: practice name, bank details, approved amount, claim reference. Manually type or copy bank details from a separate register. Email to PML Finance (Carolyn) with the schedule and copies of approved claim forms.",
                    tools:"Spreadsheet, email",risk:"Bank detail transcription errors, wrong amount copied, schedule doesn't match approved claims"},
                  {step:"12",who:"PML Finance (Carolyn)",title:"Process Payments via BACS",time:"15–30 mins",
                    detail:"Receive payment schedule. Verify amounts against her own records. Set up BACS payments. Process and confirm back to Malcolm by email.",
                    tools:"Banking system, email",risk:"Manual data entry into banking system, no automated reconciliation"},
                  {step:"13",who:"Malcolm / Amanda",title:"Confirm Payment to Practices",time:"15 mins",
                    detail:"Email each practice confirming payment has been made and expected clearing date. No formal remittance advice document unless manually created.",
                    tools:"Email",risk:"No standardised remittance document, no payment receipt confirmation from practices"},
                  {step:"14",who:"Malcolm / Amanda",title:"Update Master Tracking & Archive",time:"20–30 mins",
                    detail:"Update tracking spreadsheet with payment date. Archive all evidence files, claim forms, and email chains for the month. This is the programme's audit trail.",
                    tools:"Spreadsheet, shared drive, email archive",risk:"Shared drive permissions, file naming inconsistencies, no search capability across months"},
                ].map((s,i) => (
                  <div key={i} style={{background:"#fff",borderRadius:10,padding:"14px 16px",border:"1px solid #E2E8F0",borderLeft:`4px solid ${
                    s.who.includes("Practice")?"#2563EB":s.who.includes("Malcolm")?"#D97706":s.who.includes("Gray")?"#059669":"#7C3AED"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:"#0C2D48",display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:11,color:"#7DD3FC",fontWeight:700,flexShrink:0}}>{s.step}</div>
                        <div>
                          <span style={{fontSize:14,fontWeight:800,color:"#0C2D48"}}>{s.title}</span>
                          <span style={{fontSize:11,color:"#64748B",marginLeft:8}}>({s.who})</span>
                        </div>
                      </div>
                      <span style={{padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:"#FEE2E2",color:"#991B1B",flexShrink:0,whiteSpace:"nowrap"}}>{s.time}</span>
                    </div>
                    <div style={{fontSize:12,color:"#475569",lineHeight:1.6,marginBottom:6}}>{s.detail}</div>
                    <div style={{display:"flex",gap:16,fontSize:11}}>
                      <div><span style={{color:"#64748B",fontWeight:600}}>Tools:</span> <span style={{color:"#475569"}}>{s.tools}</span></div>
                      <div><span style={{color:"#DC2626",fontWeight:600}}>Risk:</span> <span style={{color:"#991B1B"}}>{s.risk}</span></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Time totals */}
              <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:14}}>Monthly Time Burden — All Parties</div>
              <div style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"1px solid #E2E8F0",marginBottom:20}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#0C2D48"}}>
                    {["Role","Tasks","Time per Month","Notes"].map((h,i)=>(
                      <th key={i} style={{padding:"10px 14px",textAlign:"left",color:"#7DD3FC",fontWeight:600,fontSize:11}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[
                      {role:"Practice Managers (×7)",tasks:"Spreadsheet, evidence export, claim form, email submission",time:"1.5–2 hrs each\n10.5–14 hrs total",note:"Repeated monthly. Most PMs will need training on the on-costs formula. Staff turnover means re-training."},
                      {role:"Malcolm Railson / Amanda Palin",tasks:"Receive, log, verify evidence, chase, compile, notify, payment schedule, archive",time:"3–5 hrs",note:"This is per month on top of existing programme management duties. Scales poorly if practices submit late."},
                      {role:"Dr Mark Gray (SNO)",tasks:"Review summary, approve, flag concerns",time:"30–45 mins",note:"Relies on Malcolm's summary being accurate. Limited direct evidence visibility."},
                      {role:"PML Finance (Carolyn)",tasks:"Process BACS payments, confirm",time:"30–45 mins",note:"Manual transcription of bank details and amounts into banking system."},
                    ].map((r,i) => (
                      <tr key={i} style={{borderBottom:"1px solid #F1F5F9",background:i%2?"#FAFAFA":"#fff"}}>
                        <td style={{padding:"10px 14px",fontWeight:700,verticalAlign:"top"}}>{r.role}</td>
                        <td style={{padding:"10px 14px",verticalAlign:"top",color:"#475569"}}>{r.tasks}</td>
                        <td style={{padding:"10px 14px",fontWeight:700,color:"#DC2626",verticalAlign:"top",whiteSpace:"pre-line"}}>{r.time}</td>
                        <td style={{padding:"10px 14px",fontSize:11,color:"#64748B",verticalAlign:"top"}}>{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{borderTop:"2.5px solid #0C2D48",background:"#FEE2E2"}}>
                    <td style={{padding:"12px 14px",fontWeight:800,fontSize:13}}>TOTAL (all parties)</td>
                    <td style={{padding:"12px 14px"}}></td>
                    <td style={{padding:"12px 14px",fontWeight:800,fontSize:14,color:"#991B1B"}}>15–21 hrs/month</td>
                    <td style={{padding:"12px 14px",fontSize:11,color:"#991B1B",fontWeight:600}}>180–252 hrs/year across the programme</td>
                  </tr></tfoot>
                </table>
              </div>

              {/* Governance risks */}
              <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:14}}>Governance & Audit Risks</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {[
                  {icon:"📧",title:"Email as System of Record",body:"The approval trail is email replies. If an email is deleted, misplaced, or a mailbox is archived, the governance record is lost. Not searchable or reportable."},
                  {icon:"📊",title:"Spreadsheet as Single Point of Failure",body:"The master tracking spreadsheet is the only record linking claims to approvals to payments. Formula errors, accidental deletions, or corruption could disrupt the entire programme's financial records."},
                  {icon:"🔒",title:"No Access Control",body:"Evidence files on a shared drive are accessible to anyone with the link. There's no role-based access — any admin can modify or delete claim evidence. No edit history."},
                  {icon:"🔍",title:"Audit Readiness",body:"In an external audit, the team would need to reconstruct the trail from emails, spreadsheets, and shared drive folders across multiple months. This could take days per quarter reviewed."},
                  {icon:"⏱️",title:"No Real-Time Visibility",body:"Practices cannot check claim status without emailing Malcolm. The SNO cannot see what's in the pipeline. PML Finance has no view of what's been approved vs paid."},
                  {icon:"💷",title:"Payment Reconciliation",body:"No formal remittance documents. No mechanism for practices to confirm receipt. No running ledger. Reconciliation requires manually cross-referencing bank statements against the tracking spreadsheet."},
                ].map((c,i) => (
                  <div key={i} style={{background:"#fff",borderRadius:10,padding:"14px 16px",border:"1px solid #FECACA",borderTop:`3px solid #DC2626`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <span style={{fontSize:18}}>{c.icon}</span>
                      <span style={{fontSize:13,fontWeight:800,color:"#991B1B"}}>{c.title}</span>
                    </div>
                    <div style={{fontSize:12,color:"#475569",lineHeight:1.6}}>{c.body}</div>
                  </div>
                ))}
              </div>

              {/* What's needed to set up */}
              <div style={{background:"#fff",borderRadius:12,padding:18,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#0C2D48",marginBottom:10}}>What's Needed to Operate Manually</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12,color:"#475569",lineHeight:1.5}}>
                  {[
                    "Part A claim form template (Word/PDF) — already created",
                    "Cost calculation spreadsheet template — needs distributing to 7 practices with training",
                    "Evidence naming convention document — to be created and communicated",
                    "Master tracking spreadsheet — Malcolm/Amanda to maintain monthly",
                    "Shared drive folder structure — to be set up and permissions managed",
                    "Practice bank details register — to be collected and maintained securely (GDPR)",
                    "Email notification templates — standardised submission, approval, payment emails",
                    "Training sessions for 7 Practice Managers — on-costs formula, evidence extraction, submission process",
                  ].map((t,i) => (
                    <div key={i} style={{display:"flex",gap:6,alignItems:"flex-start",padding:"6px 10px",background:"#F8FAFC",borderRadius:6}}>
                      <span style={{color:"#D97706",flexShrink:0}}>○</span><span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── OPTION B: DIGITAL SOLUTION ─── */}
          {section==="solution" && (
            <div>
              <SlideTitle sub="A seamless end-to-end claims and payment system">Option B: Digital Solution (Notewell)</SlideTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:28}}>
                {[
                  {icon:"📋",title:"Simple Roster",body:"Clean table-based staff management with live cost calculations and one-click route selection.",color:"#059669"},
                  {icon:"📎",title:"Guided Evidence",body:"Clear 4-slot evidence panel per staff member. Mandatory vs 'due in course' clearly labelled. Progress tracking.",color:"#2563EB"},
                  {icon:"🔄",title:"Visual Workflow",body:"Step-by-step pipeline tracker. Dedicated queues for verifiers and SNO. Full audit trail at every stage.",color:"#D97706"},
                  {icon:"💰",title:"Payment Lifecycle",body:"Due dates, payment confirmation, receipt tracking, auto-generated remittance documents, and a full practice ledger.",color:"#7C3AED"},
                ].map((c,i) => (
                  <div key={i} style={{background:"#fff",borderRadius:12,padding:"18px 16px",borderBottom:`3px solid ${c.color}`,textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
                    <div style={{fontSize:14,fontWeight:800,color:"#0C2D48",marginBottom:6}}>{c.title}</div>
                    <div style={{fontSize:12,color:"#64748B",lineHeight:1.6}}>{c.body}</div>
                  </div>
                ))}
              </div>

              <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:14}}>Key Capabilities</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  "Practices maintain their own SDA staff roster — New SDA (Route 1) and Buyback (Route 2)",
                  "Monthly claims auto-populate from the roster with calculated costs including on-costs",
                  "Per-staff evidence upload with clear mandatory/optional distinction per route",
                  "Route 2 Buyback: all 4 evidence documents mandatory before submission",
                  "Route 1 New SDA: SDA evidence mandatory, LTC evidence tracked as 'due in course'",
                  "Two-stage approval: Malcolm/Amanda verify → Dr Gray (SNO) approves",
                  "Auto-generated payment remittance with practice bank details and full breakdown",
                  "PML Finance sets due dates, confirms payment — email remittance advice sent to practice",
                  "Practice or SNO can confirm payment receipt — covers 'finance forgot' scenario",
                  "Full practice ledger with running balance and historical remittance archive",
                ].map((t,i) => (
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 12px",background:"#fff",borderRadius:8,border:"1px solid #E2E8F0"}}>
                    <span style={{color:"#10B981",fontWeight:700,fontSize:14,flexShrink:0}}>✓</span>
                    <span style={{fontSize:12,color:"#475569",lineHeight:1.5}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── CLAIMS WORKFLOW ─── */}
          {section==="workflow" && (
            <div>
              <SlideTitle sub="Two routes, one seamless process">Claims Workflow</SlideTitle>

              <div style={{background:"#fff",borderRadius:14,padding:24,marginBottom:20,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:16}}>Route 2: Buyback of Existing Staff</div>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:0,padding:"8px 0"}}>
                  <FlowStep n="1" label="Draft" sub="Practice builds claim" color="#6B7280" active={false} />
                  <FlowLine color="#6B7280" />
                  <FlowStep n="2" label="Submitted" sub="Evidence complete" color="#2563EB" active={false} />
                  <FlowLine color="#2563EB" />
                  <FlowStep n="3" label="Verified" sub="Malcolm / Amanda" color="#D97706" active={true} />
                  <FlowLine color="#D97706" />
                  <FlowStep n="4" label="Approved" sub="SNO (Dr Gray)" color="#059669" active={false} />
                  <FlowLine color="#059669" />
                  <FlowStep n="5" label="Paid" sub="PML Finance" color="#7C3AED" active={false} />
                </div>
                <div style={{fontSize:12,color:"#64748B",textAlign:"center",marginTop:12,lineHeight:1.6}}>
                  Requires <strong>4 mandatory evidence documents</strong>: SDA Slot Type, SDA Rota, LTC Slot Type, LTC Rota.<br/>
                  Verifiers check evidence completeness. SNO provides final approval. Payment remittance auto-generated.
                </div>
              </div>

              <div style={{background:"#fff",borderRadius:14,padding:24,marginBottom:20,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:16}}>Route 1: New SDA Resource</div>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:0,padding:"8px 0"}}>
                  <FlowStep n="1" label="Draft" sub="Practice builds claim" color="#6B7280" active={false} />
                  <FlowLine color="#6B7280" />
                  <FlowStep n="2" label="Submitted" sub="SDA evidence" color="#2563EB" active={true} />
                  <FlowLine color="#2563EB" />
                  <FlowStep n="3" label="Approved" sub="SNO (Dr Gray)" color="#059669" active={false} />
                  <FlowLine color="#059669" />
                  <FlowStep n="4" label="Paid" sub="PML Finance" color="#7C3AED" active={false} />
                </div>
                <div style={{fontSize:12,color:"#64748B",textAlign:"center",marginTop:12,lineHeight:1.6}}>
                  SDA evidence mandatory for submission. LTC evidence tracked as <strong>"due in course"</strong> — practices can upload later.<br/>
                  No intermediate verification step — submitted directly to SNO for approval.
                </div>
              </div>

              <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:"16px 20px"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#92400E",marginBottom:6}}>The Golden Rule: Additionality</div>
                <div style={{fontSize:13,color:"#78350F",lineHeight:1.7}}>
                  Every claim must demonstrate that funding generates new work that would not otherwise occur.
                  For new hires, the post itself proves additionality. For buybacks, Part B (LTC) evidence must prove
                  that buying back SDA time has freed up capacity for new, unfunded LTC work.
                </div>
              </div>
            </div>
          )}

          {/* ─── EVIDENCE MODEL ─── */}
          {section==="evidence" && (
            <div>
              <SlideTitle sub="Clear mandatory and 'due in course' evidence requirements">Evidence Model</SlideTitle>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
                <div style={{background:"#fff",borderRadius:14,padding:22,border:"2px solid #2563EB"}}>
                  <Badge color="#1D4ED8" bg="#DBEAFE">ROUTE 1 · NEW SDA RESOURCE</Badge>
                  <div style={{marginTop:16,display:"grid",gap:8}}>
                    {[
                      {k:"sda_slot",req:true},{k:"sda_rota",req:true},{k:"ltc_slot",req:false},{k:"ltc_rota",req:false},
                    ].map(e => (
                      <div key={e.k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,
                        border:`1.5px solid ${e.req?"#10B981":"#CBD5E1"}`,background:e.req?"#F0FDF4":"#FAFAFA"}}>
                        <span style={{fontSize:16}}>{EV_TYPES[e.k].icon}</span>
                        <span style={{flex:1,fontSize:12,fontWeight:600}}>{EV_TYPES[e.k].label}</span>
                        {e.req
                          ? <Badge color="#065F46" bg="#D1FAE5">MANDATORY</Badge>
                          : <Badge color="#7C3AED" bg="#EDE9FE">DUE IN COURSE</Badge>}
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12,fontSize:11,color:"#1D4ED8",background:"#EFF6FF",borderRadius:6,padding:"8px 10px",lineHeight:1.5}}>
                    LTC evidence is not required for submission but must be uploaded in due course. The system tracks outstanding LTC evidence and reminds practices until it's provided.
                  </div>
                </div>

                <div style={{background:"#fff",borderRadius:14,padding:22,border:"2px solid #D97706"}}>
                  <Badge color="#92400E" bg="#FEF3C7">ROUTE 2 · BUYBACK</Badge>
                  <div style={{marginTop:16,display:"grid",gap:8}}>
                    {["sda_slot","sda_rota","ltc_slot","ltc_rota"].map(k => (
                      <div key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,
                        border:"1.5px solid #10B981",background:"#F0FDF4"}}>
                        <span style={{fontSize:16}}>{EV_TYPES[k].icon}</span>
                        <span style={{flex:1,fontSize:12,fontWeight:600}}>{EV_TYPES[k].label}</span>
                        <Badge color="#065F46" bg="#D1FAE5">MANDATORY</Badge>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12,fontSize:11,color:"#92400E",background:"#FFFBEB",borderRadius:6,padding:"8px 10px",lineHeight:1.5}}>
                    All 4 evidence documents must be uploaded before submission is allowed. Payment is blocked until both Part A (SDA) and Part B (LTC) evidence is verified.
                  </div>
                </div>
              </div>

              <div style={{background:"#fff",borderRadius:12,padding:18,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#0C2D48",marginBottom:10}}>What Practices Upload</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:12,color:"#475569",lineHeight:1.6}}>
                  <div><strong style={{color:"#0C2D48"}}>SDA Slot Type Report:</strong> Export from EMIS/SystmOne showing appointment types coded as SDA for the clinician during the claim period.</div>
                  <div><strong style={{color:"#0C2D48"}}>SDA Rota Report:</strong> Rota export showing sessions where the clinician is rostered for SDA activity.</div>
                  <div><strong style={{color:"#0C2D48"}}>LTC Slot Type Report:</strong> Report showing new LTC/chronic disease appointment types delivered as the matching Part B output.</div>
                  <div><strong style={{color:"#0C2D48"}}>LTC Rota Report:</strong> Rota showing new LTC sessions added as a result of the SDA buyback arrangement.</div>
                </div>
              </div>
            </div>
          )}

          {/* ─── PAYMENTS & FINANCE ─── */}
          {section==="payments" && (
            <div>
              <SlideTitle sub="End-to-end payment tracking from approval to receipt">Payments & Finance</SlideTitle>

              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:0,marginBottom:28,padding:"16px 0",background:"#fff",borderRadius:14,border:"1px solid #E2E8F0"}}>
                <div style={{padding:"0 20px"}}>
                  <FlowStep n="✅" label="Approved" sub="SNO signs off" color="#059669" active={false} />
                </div>
                <FlowLine color="#059669" />
                <div style={{padding:"0 20px"}}>
                  <FlowStep n="📄" label="Remittance" sub="Auto-generated" color="#0C4A6E" active={true} />
                </div>
                <FlowLine color="#0C4A6E" />
                <div style={{padding:"0 20px"}}>
                  <FlowStep n="📅" label="Due Date" sub="PML Finance sets" color="#2563EB" active={false} />
                </div>
                <FlowLine color="#2563EB" />
                <div style={{padding:"0 20px"}}>
                  <FlowStep n="💸" label="Paid" sub="Finance confirms" color="#D97706" active={false} />
                </div>
                <FlowLine color="#D97706" />
                <div style={{padding:"0 20px"}}>
                  <FlowStep n="✅" label="Received" sub="Practice confirms" color="#7C3AED" active={false} />
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                <InfoCard icon="📄" title="Payment Remittance" accent="#0C4A6E">
                  Auto-generated on SNO approval. Includes practice bank details, itemised staff breakdown with base rate and on-costs, approval audit trail, programme reference, and distribution list. Printable and stored permanently.
                </InfoCard>
                <InfoCard icon="💸" title="Payment Lifecycle" accent="#D97706">
                  PML Finance sets due date, then confirms payment made — triggering an email remittance advice to the practice. Practice or SNO can independently confirm receipt. Full audit trail at every stage.
                </InfoCard>
                <InfoCard icon="📊" title="Practice Ledger" accent="#2563EB">
                  Each practice sees a full payment ledger with chronological claims, running balance, outstanding amounts, and an archive of all remittance advices. Historical record for audit and governance.
                </InfoCard>
                <InfoCard icon="🏦" title="Finance Dashboard" accent="#7C3AED">
                  Cross-practice view for PML Finance showing total approved, paid, and outstanding. Inline payment management — set due dates, confirm payments, view remittances — all from one screen.
                </InfoCard>
              </div>

              <div style={{background:"linear-gradient(135deg,#059669,#047857)",borderRadius:14,padding:"20px 24px",color:"#fff"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,opacity:0.8}}>Complete Financial Governance</div>
                    <div style={{fontSize:22,fontWeight:800,marginTop:4}}>From claim to confirmed receipt — every step tracked and auditable</div>
                  </div>
                  <div style={{textAlign:"right",fontSize:12,opacity:0.7}}>
                    Remittance documents<br/>Email notifications<br/>Running balance ledger
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── OPTIONS COMPARISON ─── */}
          {section==="compare" && (
            <div>
              <SlideTitle sub="Manual process vs digital system — side by side">Options Comparison</SlideTitle>

              {/* Head to head table */}
              <div style={{background:"#fff",borderRadius:14,overflow:"hidden",border:"1px solid #E2E8F0",marginBottom:24}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>
                    <th style={{padding:"14px 16px",textAlign:"left",background:"#F8FAFC",color:"#64748B",fontWeight:600,fontSize:11,width:"28%"}}>Criteria</th>
                    <th style={{padding:"14px 16px",textAlign:"left",background:"#FEE2E2",color:"#991B1B",fontWeight:700,fontSize:12,width:"36%"}}>Option A: Manual Process</th>
                    <th style={{padding:"14px 16px",textAlign:"left",background:"#D1FAE5",color:"#065F46",fontWeight:700,fontSize:12,width:"36%"}}>Option B: Digital (Notewell)</th>
                  </tr></thead>
                  <tbody>
                    {[
                      {area:"Monthly Time — Practices",a:"10.5–14 hrs/month (7 PMs × 1.5–2 hrs each)",b:"2–3.5 hrs/month (7 PMs × 15–30 mins each)",winner:"b"},
                      {area:"Monthly Time — NRES Team",a:"3–5 hrs/month (Malcolm/Amanda)",b:"1–1.5 hrs/month (review & approve queue)",winner:"b"},
                      {area:"Monthly Time — SNO",a:"30–45 mins (email review)",b:"15–20 mins (queue-based approval)",winner:"b"},
                      {area:"Monthly Time — PML Finance",a:"30–45 mins (manual BACS setup)",b:"10–15 mins (confirm payment in system)",winner:"b"},
                      {area:"Total Monthly Time (all parties)",a:"15–21 hours",b:"3.5–6 hours",winner:"b"},
                      {area:"Annual Time Commitment",a:"180–252 hours",b:"42–72 hours",winner:"b"},
                      {area:"Cost Calculation Accuracy",a:"Manual formula in Excel — error-prone. Each PM must understand on-costs. No central validation.",b:"Auto-calculated from centrally managed rates. Calculation breakdown visible and verifiable.",winner:"b"},
                      {area:"Evidence Submission",a:"Email attachments — up to 12+ files per practice. Naming convention reliant. Size limits. Lost in inbox.",b:"Per-staff evidence slots with guided upload. System blocks submission until mandatory evidence is complete.",winner:"b"},
                      {area:"Evidence Verification",a:"Malcolm opens PDFs, manually cross-references. No checklist. Relies on individual diligence.",b:"Evidence status visible per staff line. Progress bars. Clear mandatory vs optional distinction.",winner:"b"},
                      {area:"Approval Audit Trail",a:"Email reply from Dr Gray. Can be deleted or lost. No timestamp guarantee. Difficult to evidence in audit.",b:"Database record with timestamp, user ID. Immutable. Full trail from submission through to payment receipt.",winner:"b"},
                      {area:"Payment Remittance",a:"No standardised document. Manual payment schedule spreadsheet with manual bank detail transcription.",b:"Auto-generated remittance document with practice details, bank info, itemised breakdown, and audit trail.",winner:"b"},
                      {area:"Payment Tracking",a:"Manual spreadsheet entry. No running balance. No receipt confirmation from practices.",b:"Full lifecycle: due date → paid → receipt confirmed. Running ledger. Email remittance advice.",winner:"b"},
                      {area:"Practice Visibility",a:"Practice must email Malcolm to check status. No self-service.",b:"Real-time status visible in portal. Practices see their own claims, evidence, payments, and ledger.",winner:"b"},
                      {area:"LTC Evidence Tracking",a:"Relies on Malcolm remembering which practices owe LTC evidence. No systematic tracking.",b:"System tracks outstanding LTC evidence with per-claim badges and dashboard indicators until uploaded.",winner:"b"},
                      {area:"Scalability",a:"Workload increases linearly with practices and staff. Already at capacity with 7 practices.",b:"Marginal effort per additional practice is minimal. System handles calculation, routing, and tracking.",winner:"b"},
                      {area:"Setup Cost",a:"~2 days to create templates, train PMs, set up shared drive",b:"8–10 days development (one-off)",winner:"a"},
                      {area:"Ongoing Running Cost",a:"Staff time: 180–252 hrs/year at ~£25/hr avg = £4,500–6,300/year",b:"Staff time: 42–72 hrs/year at ~£25/hr avg = £1,050–1,800/year",winner:"b"},
                    ].map((r,i) => (
                      <tr key={i} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"10px 14px",fontWeight:700,color:"#0C2D48",verticalAlign:"top"}}>{r.area}</td>
                        <td style={{padding:"10px 14px",verticalAlign:"top",background:r.winner==="a"?"#F0FDF4":"#FEFCE8",color:"#475569"}}>{r.a}</td>
                        <td style={{padding:"10px 14px",verticalAlign:"top",background:r.winner==="b"?"#F0FDF4":"#FEFCE8",color:"#475569"}}>{r.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Time savings visual */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
                <div style={{background:"#FEE2E2",borderRadius:14,padding:"22px 20px",border:"1.5px solid #FECACA"}}>
                  <div style={{fontSize:12,color:"#991B1B",fontWeight:600}}>OPTION A: Manual — Annual Staff Time</div>
                  <div style={{fontSize:36,fontWeight:900,color:"#DC2626",marginTop:4}}>180–252 hrs</div>
                  <div style={{fontSize:13,color:"#991B1B",marginTop:4}}>≈ £4,500–6,300/year in staff time</div>
                  <div style={{marginTop:10,height:8,borderRadius:4,background:"#FCA5A5",overflow:"hidden"}}>
                    <div style={{width:"100%",height:"100%",background:"#DC2626",borderRadius:4}} />
                  </div>
                </div>
                <div style={{background:"#D1FAE5",borderRadius:14,padding:"22px 20px",border:"1.5px solid #6EE7B7"}}>
                  <div style={{fontSize:12,color:"#065F46",fontWeight:600}}>OPTION B: Digital — Annual Staff Time</div>
                  <div style={{fontSize:36,fontWeight:900,color:"#059669",marginTop:4}}>42–72 hrs</div>
                  <div style={{fontSize:13,color:"#065F46",marginTop:4}}>≈ £1,050–1,800/year in staff time</div>
                  <div style={{marginTop:10,height:8,borderRadius:4,background:"#6EE7B7",overflow:"hidden"}}>
                    <div style={{width:"33%",height:"100%",background:"#059669",borderRadius:4}} />
                  </div>
                </div>
              </div>

              {/* Break-even */}
              <div style={{background:"linear-gradient(135deg,#0C2D48,#145374)",borderRadius:14,padding:"22px 26px",color:"#fff",marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,opacity:0.7}}>Annual Time Saving</div>
                    <div style={{fontSize:28,fontWeight:800,marginTop:2}}>138–180 hours/year</div>
                    <div style={{fontSize:13,opacity:0.8,marginTop:4}}>≈ £3,450–4,500/year saved in staff time across all parties</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,opacity:0.7}}>One-Off Development Investment</div>
                    <div style={{fontSize:22,fontWeight:800,marginTop:2}}>~60 hours (8–10 days)</div>
                    <div style={{fontSize:13,opacity:0.8,marginTop:4}}>Break-even within 4–5 months of operation</div>
                  </div>
                </div>
              </div>

              {/* Beyond time savings */}
              <div style={{background:"#fff",borderRadius:12,padding:18,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#0C2D48",marginBottom:10}}>Beyond Time Savings — What Manual Cannot Deliver</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[
                    {icon:"🔒",t:"Immutable Audit Trail",d:"Every action timestamped with user ID. Cannot be deleted or altered. Survives mailbox archival and staff turnover."},
                    {icon:"📄",t:"Auto-Generated Remittances",d:"Professional payment documents with bank details, itemised breakdown, and approval signatures — produced instantly."},
                    {icon:"📊",t:"Programme-Level Reporting",d:"Cross-practice dashboards showing approved spend, payment pipeline, LTC compliance — available in real time, not after hours of spreadsheet compilation."},
                  ].map((c,i) => (
                    <div key={i} style={{padding:"12px 14px",borderRadius:8,border:"1px solid #E2E8F0",textAlign:"center"}}>
                      <span style={{fontSize:22}}>{c.icon}</span>
                      <div style={{fontSize:13,fontWeight:700,color:"#0C2D48",marginTop:6}}>{c.t}</div>
                      <div style={{fontSize:11,color:"#64748B",lineHeight:1.5,marginTop:4}}>{c.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── LIVE PROTOTYPE ─── */}
          {section==="demo" && (() => {
            // Full interactive demo state
            const allDemoStaff = [
              {id:1,name:"Dr Aamer Badshah",role:"gp",cat:"new_sda",aT:"sessions",aV:4,pk:"parks"},
              {id:2,name:"Dr Jane Collins",role:"gp",cat:"buyback",aT:"sessions",aV:3,pk:"parks"},
              {id:3,name:"Sarah Mitchell",role:"anp",cat:"buyback",aT:"hours",aV:15,pk:"parks"},
              {id:4,name:"Dr Rachel Turner",role:"gp",cat:"new_sda",aT:"sessions",aV:6,pk:"brackley"},
              {id:5,name:"Tom Hayward",role:"acp",cat:"buyback",aT:"wte",aV:0.4,pk:"brackley"},
              {id:6,name:"Lisa Graves",role:"practice_nurse",cat:"buyback",aT:"hours",aV:12,pk:"towcester"},
              {id:7,name:"Dr Emily Ward",role:"gp",cat:"new_sda",aT:"sessions",aV:5,pk:"towcester"},
            ];
            const allDemoClaims = [
              {id:101,pk:"parks",month:"2026-04",status:"draft",
                lines:[
                  {name:"Dr Jane Collins",role:"gp",cat:"buyback",aT:"sessions",aV:3,ev:{}},
                  {name:"Sarah Mitchell",role:"anp",cat:"buyback",aT:"hours",aV:15,ev:{sda_slot:"SDA_Slots_Mitchell_Apr.pdf",sda_rota:"SDA_Rota_Mitchell_Apr.pdf"}},
                ]},
              {id:102,pk:"brackley",month:"2026-03",status:"submitted",submAt:"2026-03-05",
                lines:[{name:"Tom Hayward",role:"acp",cat:"buyback",aT:"wte",aV:0.4,ev:{sda_slot:"d",sda_rota:"d",ltc_slot:"d",ltc_rota:"d"}}]},
              {id:103,pk:"parks",month:"2026-03",status:"verified",submAt:"2026-03-02",verAt:"2026-03-04",verBy:"Malcolm Railson",
                lines:[{name:"Dr Aamer Badshah",role:"gp",cat:"new_sda",aT:"sessions",aV:4,ev:{sda_slot:"d",sda_rota:"d"}}]},
              {id:104,pk:"towcester",month:"2026-02",status:"approved",submAt:"2026-02-10",verAt:"2026-02-12",verBy:"Malcolm Railson",appAt:"2026-02-14",appBy:"Dr Mark Gray",
                remRef:"NRES-REM-2026-0214",payDue:"2026-02-28",payDate:"2026-02-27",payBy:"PML Finance",payReceived:"2026-03-01",payReceivedBy:"Practice",
                lines:[{name:"Dr Emily Ward",role:"gp",cat:"new_sda",aT:"sessions",aV:5,ev:{sda_slot:"d",sda_rota:"d"}}]},
              {id:105,pk:"towcester",month:"2026-03",status:"approved",submAt:"2026-03-03",verAt:"2026-03-05",verBy:"Amanda Palin",appAt:"2026-03-06",appBy:"Dr Mark Gray",
                remRef:"NRES-REM-2026-0306",payDue:"2026-03-20",
                lines:[
                  {name:"Lisa Graves",role:"practice_nurse",cat:"buyback",aT:"hours",aV:12,ev:{sda_slot:"d",sda_rota:"d",ltc_slot:"d",ltc_rota:"d"}},
                  {name:"Dr Emily Ward",role:"gp",cat:"new_sda",aT:"sessions",aV:5,ev:{sda_slot:"d",sda_rota:"d"}},
                ]},
            ];

            const rClaims = demoRole==="practice" ? allDemoClaims.filter(c=>c.pk==="parks")
              : demoRole==="verifier" ? allDemoClaims.filter(c=>["submitted","verified"].includes(c.status))
              : demoRole==="approver" ? allDemoClaims.filter(c=>["verified","approved"].includes(c.status))
              : allDemoClaims.filter(c=>c.status==="approved");

            const pStaff = allDemoStaff.filter(s=>s.pk==="parks");
            const counts = {draft:allDemoClaims.filter(c=>c.status==="draft").length,submitted:allDemoClaims.filter(c=>c.status==="submitted").length,
              verified:allDemoClaims.filter(c=>c.status==="verified").length,approved:allDemoClaims.filter(c=>c.status==="approved").length};
            const totalApp = allDemoClaims.filter(c=>c.status==="approved").reduce((s,c)=>s+c.lines.reduce((a,l)=>a+calc(l.role,l.aT,l.aV),0),0);

            const fMonth = m=>{const[y,mo]=m.split("-");return["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+mo]+" "+y;};
            const fDate = d=>d?new Date(d+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"";
            const getPS = c=>c.payReceived?"received":c.payDate?"paid":c.payDue?"due":"awaiting";

            return (
            <div>
              <SlideTitle sub="Interactive prototype — switch roles and explore the system">Live Prototype</SlideTitle>

              {/* App Shell */}
              <div style={{borderRadius:12,overflow:"hidden",border:"1.5px solid #CBD5E1",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}>
                {/* App header */}
                <div style={{background:"linear-gradient(135deg,#0C2D48,#145374)",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#10B981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff"}}>N</div>
                    <div><div style={{color:"#fff",fontSize:13,fontWeight:800}}>Notewell</div><div style={{color:"#7DD3FC",fontSize:9,letterSpacing:0.5}}>NRES SDA CLAIMS</div></div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4,background:"#0C2D4888",borderRadius:8,padding:"3px 4px"}}>
                    <span style={{color:"#7DD3FC",fontSize:9,fontWeight:600,padding:"0 6px"}}>VIEW AS</span>
                    {[{k:"practice",l:"🏥 Practice"},{k:"verifier",l:"🔍 Verifier"},{k:"approver",l:"✅ SNO"},{k:"finance",l:"💰 Finance"}].map(r=>(
                      <button key={r.k} onClick={()=>{setDemoRole(r.k);setDemoView("dashboard");setExpandedClaim(null);}} style={{
                        padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:demoRole===r.k?700:500,cursor:"pointer",
                        border:demoRole===r.k?"1px solid #10B981":"1px solid transparent",
                        background:demoRole===r.k?"#10B98122":"transparent",color:demoRole===r.k?"#10B981":"#94A3B8"}}>
                        {r.l}
                      </button>
                    ))}
                  </div>
                  <div style={{color:"#94A3B8",fontSize:10}}>
                    {demoRole==="practice"?"Sarah Berry — Practice":demoRole==="verifier"?"Malcolm Railson — Verifier":demoRole==="approver"?"Dr Mark Gray — SNO":"PML Finance"}
                  </div>
                </div>

                {/* App nav */}
                <div style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:"0 16px",display:"flex",gap:0}}>
                  {[
                    {k:"dashboard",l:"Dashboard",show:true},
                    {k:"roster",l:"Staff Roster",show:demoRole==="practice"},
                    {k:"claims",l:"Claims",show:true},
                    {k:"payments",l:"Payments",show:demoRole==="practice"||demoRole==="finance"},
                  ].filter(t=>t.show).map(t=>(
                    <button key={t.k} onClick={()=>{setDemoView(t.k);setExpandedClaim(null);}} style={{
                      padding:"10px 14px",fontSize:12,fontWeight:demoView===t.k?700:500,cursor:"pointer",border:"none",background:"none",
                      color:demoView===t.k?"#0C4A6E":"#64748B",borderBottom:demoView===t.k?"2px solid #0C4A6E":"2px solid transparent"}}>
                      {t.l}
                    </button>
                  ))}
                </div>

                {/* App content */}
                <div style={{background:"#F0F4F8",padding:"16px 18px",minHeight:400}}>

                  {/* Dashboard */}
                  {demoView==="dashboard" && (
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:12}}>
                        {demoRole==="practice"?"The Parks MC — Dashboard":demoRole==="verifier"?"Verification Dashboard":demoRole==="approver"?"SNO Approval Dashboard":"Finance Dashboard"}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
                        {[
                          {l:"Drafts",n:counts.draft,c:"#6B7280",bg:"#F3F4F6"},
                          {l:"Awaiting Verification",n:counts.submitted,c:"#2563EB",bg:"#DBEAFE"},
                          {l:"Awaiting SNO",n:counts.verified,c:"#D97706",bg:"#FEF3C7"},
                          {l:"Approved",n:counts.approved,c:"#059669",bg:"#D1FAE5"},
                        ].map((c,i)=>(
                          <div key={i} style={{background:c.bg,borderRadius:10,padding:"14px 12px",borderLeft:`4px solid ${c.c}`}}>
                            <div style={{fontSize:10,color:c.c,fontWeight:500}}>{c.l}</div>
                            <div style={{fontSize:24,fontWeight:800,color:c.c}}>{c.n}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{background:"linear-gradient(135deg,#059669,#047857)",borderRadius:10,padding:"14px 16px",color:"#fff",marginBottom:14}}>
                        <div style={{fontSize:10,opacity:0.7}}>Total Approved & Authorised</div>
                        <div style={{fontSize:26,fontWeight:800}}>{fm(totalApp)}</div>
                        <div style={{fontSize:10,opacity:0.6}}>Payable via PML (SNO) · NRES Programme Fund</div>
                      </div>
                      <div style={{background:"#fff",borderRadius:10,overflow:"hidden"}}>
                        <div style={{padding:"10px 14px",fontSize:12,fontWeight:700,color:"#0C2D48",borderBottom:"1px solid #F1F5F9"}}>
                          {demoRole==="verifier"?"Your Verification Queue":demoRole==="approver"?"Awaiting Your Approval":"Recent Claims"}
                        </div>
                        {rClaims.slice(0,4).map((c,i)=>{
                          const p2=PRACTICES.find(p=>p.key===c.pk); const tot=c.lines.reduce((s,l)=>s+calc(l.role,l.aT,l.aV),0);
                          return (
                            <div key={c.id} onClick={()=>{setDemoView("claims");setExpandedClaim(c.id);}} style={{
                              display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",
                              borderBottom:"1px solid #F8FAFC",cursor:"pointer"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <div>
                                <span style={{fontWeight:700,fontSize:12}}>{p2?.name}</span>
                                <span style={{color:"#94A3B8",fontSize:11,marginLeft:6}}>{fMonth(c.month)}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontWeight:800,fontSize:12}}>{fm(tot)}</span>
                                <Badge color={STATUS_CFG[c.status].c} bg={STATUS_CFG[c.status].bg}>{STATUS_CFG[c.status].l}</Badge>
                                {c.payDate && <Badge color={PAY_CFG[getPS(c)].c} bg={PAY_CFG[getPS(c)].bg}>{PAY_CFG[getPS(c)].i} {PAY_CFG[getPS(c)].l}</Badge>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Staff Roster */}
                  {demoView==="roster" && (
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={{fontSize:15,fontWeight:800,color:"#0C2D48"}}>The Parks MC — Staff Roster</div>
                        <button style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0C4A6E",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add Staff</button>
                      </div>
                      <div style={{background:"#fff",borderRadius:10,overflow:"hidden"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr style={{background:"#0C2D48"}}>
                            {["Name","Role","Route","Allocation","Monthly Cost"].map((h,i)=>(
                              <th key={i} style={{padding:"8px 12px",textAlign:i===4?"right":"left",color:"#7DD3FC",fontWeight:600,fontSize:10}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {pStaff.map((s,i)=>{const r=ROLES.find(x=>x.key===s.role);const mo=calc(s.role,s.aT,s.aV);
                              return (
                                <tr key={s.id} style={{borderBottom:"1px solid #F1F5F9",background:i%2?"#FAFAFA":"#fff"}}>
                                  <td style={{padding:"8px 12px",fontWeight:700}}>{s.name}</td>
                                  <td style={{padding:"8px 12px"}}>{r?.label}</td>
                                  <td style={{padding:"8px 12px"}}><Badge color={s.cat==="new_sda"?"#1D4ED8":"#92400E"} bg={s.cat==="new_sda"?"#DBEAFE":"#FEF3C7"}>{s.cat==="new_sda"?"Route 1":"Route 2"}</Badge></td>
                                  <td style={{padding:"8px 12px"}}>{s.aV} {s.aT==="sessions"?"sess":s.aT==="hours"?"hrs/wk":"WTE"}</td>
                                  <td style={{padding:"8px 12px",textAlign:"right"}}>
                                    <span onClick={()=>setShowCalc(showCalc===s.id?null:s.id)} style={{fontWeight:800,color:"#0C4A6E",cursor:"pointer",borderBottom:"1px dashed #0C4A6E"}}>{fm(mo)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {showCalc && (()=>{const s=pStaff.find(x=>x.id===showCalc);if(!s)return null;const r=ROLES.find(x=>x.key===s.role);const mo=calc(s.role,s.aT,s.aV);
                          return <div style={{padding:"8px 12px",background:"#EFF6FF",fontSize:10,color:"#1E40AF"}}>
                            <strong>Calc:</strong> {s.aV} {s.aT} × £{r.annual.toLocaleString()}/yr × {MULT.toFixed(4)} ÷ 12 = <strong>{fm(mo)}/month</strong></div>;
                        })()}
                        <div style={{padding:"10px 12px",background:"linear-gradient(135deg,#0C4A6E,#145374)",display:"flex",justifyContent:"space-between",alignItems:"center",color:"#fff"}}>
                          <span style={{fontSize:11,opacity:0.8}}>{pStaff.filter(s=>s.cat==="new_sda").length} New SDA · {pStaff.filter(s=>s.cat==="buyback").length} Buyback</span>
                          <span style={{fontSize:14,fontWeight:800}}>Monthly: {fm(pStaff.reduce((s,st)=>s+calc(st.role,st.aT,st.aV),0))}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Claims */}
                  {demoView==="claims" && (
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:12}}>
                        {demoRole==="practice"?"The Parks MC — Claims":demoRole==="verifier"?"Verification Queue":demoRole==="approver"?"SNO Approval Queue":"Approved Claims"}
                      </div>
                      {rClaims.map(cl=>{
                        const p2=PRACTICES.find(p=>p.key===cl.pk); const tot=cl.lines.reduce((s,l)=>s+calc(l.role,l.aT,l.aV),0);
                        const isExp=expandedClaim===cl.id; const hasBB=cl.lines.some(l=>l.cat==="buyback");
                        const ltcDue=cl.lines.filter(l=>l.cat==="new_sda"&&(!l.ev.ltc_slot||!l.ev.ltc_rota));
                        const ps=cl.status==="approved"?getPS(cl):null;
                        // Workflow steps
                        const steps=hasBB
                          ?[{k:"draft",c:"#6B7280"},{k:"submitted",c:"#2563EB"},{k:"verified",c:"#D97706"},{k:"approved",c:"#059669"}]
                          :[{k:"draft",c:"#6B7280"},{k:"submitted",c:"#2563EB"},{k:"approved",c:"#059669"}];
                        const curIdx=steps.findIndex(s=>s.k===(cl.status==="rejected"?"draft":cl.status));
                        return (
                          <div key={cl.id} style={{background:"#fff",borderRadius:10,marginBottom:10,borderLeft:`4px solid ${STATUS_CFG[cl.status].c}`,overflow:"hidden",border:"1px solid #E2E8F0"}}>
                            <div onClick={()=>setExpandedClaim(isExp?null:cl.id)} style={{padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div>
                                <span style={{fontWeight:800,fontSize:13}}>{p2?.name}</span>
                                <span style={{color:"#94A3B8",fontSize:11,marginLeft:6}}>{fMonth(cl.month)}</span>
                                {cl.lines.some(l=>l.cat==="new_sda") && <>{" "}<Badge color="#1D4ED8" bg="#DBEAFE">Route 1</Badge></>}
                                {hasBB && <>{" "}<Badge color="#92400E" bg="#FEF3C7">Route 2</Badge></>}
                                {ltcDue.length>0&&cl.status!=="draft" && <>{" "}<Badge color="#7C3AED" bg="#EDE9FE">⏳ LTC Due ({ltcDue.length})</Badge></>}
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontWeight:800,fontSize:14}}>{fm(tot)}</span>
                                <Badge color={STATUS_CFG[cl.status].c} bg={STATUS_CFG[cl.status].bg}>{STATUS_CFG[cl.status].l}</Badge>
                                {ps && <Badge color={PAY_CFG[ps].c} bg={PAY_CFG[ps].bg}>{PAY_CFG[ps].i} {PAY_CFG[ps].l}</Badge>}
                                <span style={{fontSize:12,color:"#94A3B8",transform:isExp?"rotate(180deg)":"none",transition:"0.2s"}}>▼</span>
                              </div>
                            </div>
                            {isExp && (
                              <div style={{borderTop:"1px solid #E2E8F0",padding:"12px 14px"}}>
                                {/* Stepper */}
                                <div style={{display:"flex",alignItems:"flex-start",gap:0,padding:"8px 0 4px",marginBottom:8}}>
                                  {steps.map((s,i)=>{
                                    const done=i<curIdx;const active=i===curIdx;
                                    return (
                                      <div key={s.k} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}>
                                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:60}}>
                                          <div style={{width:active?30:22,height:active?30:22,borderRadius:"50%",background:done||active?s.c:"#E5E7EB",
                                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:active?12:10,color:"#fff",fontWeight:700,
                                            boxShadow:active?`0 0 0 3px ${s.c}33`:"none"}}>{done?"✓":i+1}</div>
                                          <div style={{fontSize:10,fontWeight:active?700:400,color:done||active?s.c:"#94A3B8",marginTop:3}}>{STATUS_CFG[s.k].l}</div>
                                        </div>
                                        {i<steps.length-1 && <div style={{flex:1,height:2,background:done?s.c:"#E5E7EB",margin:"0 4px",marginBottom:18}} />}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* LTC outstanding banner */}
                                {ltcDue.length>0&&cl.status!=="draft" && (
                                  <div style={{background:"#FAF5FF",border:"1px solid #DDD6FE",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#6B21A8"}}>
                                    <strong>⏳ LTC Evidence Outstanding</strong> — {ltcDue.map(l=>l.name).join(", ")} need LTC Slot + Rota evidence in due course.
                                  </div>
                                )}

                                {/* Staff lines with evidence */}
                                {cl.lines.map((l,idx)=>{
                                  const mo=calc(l.role,l.aT,l.aV);const r2=ROLES.find(r=>r.key===l.role);
                                  const mand=l.cat==="buyback"?["sda_slot","sda_rota","ltc_slot","ltc_rota"]:["sda_slot","sda_rota"];
                                  const evDone=mand.filter(k=>l.ev[k]).length;
                                  return (
                                    <div key={idx} style={{border:`1px solid ${evDone===mand.length?"#10B981":"#F59E0B"}`,borderRadius:8,padding:10,marginBottom:8,background:evDone===mand.length?"#F0FDF4":"#FFFBEB"}}>
                                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                                          <span style={{fontWeight:700,fontSize:12}}>{l.name}</span>
                                          <span style={{fontSize:11,color:"#64748B"}}>{r2?.label}</span>
                                          <Badge color={l.cat==="new_sda"?"#1D4ED8":"#92400E"} bg={l.cat==="new_sda"?"#DBEAFE":"#FEF3C7"}>{l.cat==="new_sda"?"Route 1":"Route 2"}</Badge>
                                        </div>
                                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                                          <span style={{fontSize:11,color:"#64748B"}}>{l.aV} {l.aT==="sessions"?"sess":l.aT==="hours"?"hrs/wk":"WTE"}</span>
                                          <span style={{fontWeight:800,fontSize:13,color:"#0C4A6E"}}>{fm(mo)}</span>
                                        </div>
                                      </div>
                                      {/* Evidence grid */}
                                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4}}>
                                        {["sda_slot","sda_rota","ltc_slot","ltc_rota"].map(k=>{
                                          const has=!!l.ev[k]; const isM=mand.includes(k); const isLtc=k.startsWith("ltc");
                                          return (
                                            <div key={k} style={{padding:"5px 6px",borderRadius:5,fontSize:9,textAlign:"center",fontWeight:600,
                                              border:`1px solid ${has?"#10B981":isM?"#EF4444":"#DDD6FE"}`,
                                              background:has?"#D1FAE5":isM?"#FEE2E2":"#FAF5FF",
                                              color:has?"#065F46":isM?"#991B1B":"#7C3AED"}}>
                                              {EV_TYPES[k].icon} {has?"✓":isM?"Required":"Due"}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Totals & actions */}
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,padding:"10px 12px",background:"#F8FAFC",borderRadius:8}}>
                                  <div>
                                    <div style={{fontSize:10,color:"#64748B"}}>Total Claim</div>
                                    <div style={{fontSize:18,fontWeight:800}}>{fm(tot)}</div>
                                    <div style={{fontSize:9,color:"#94A3B8"}}>Incl. on-costs {(MULT*100-100).toFixed(2)}%</div>
                                  </div>
                                  <div style={{display:"flex",gap:6}}>
                                    {demoRole==="practice"&&cl.status==="draft" && <button style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#0C4A6E",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",opacity:0.5}}>☑ Submit</button>}
                                    {demoRole==="verifier"&&cl.status==="submitted" && <><button style={{padding:"6px 10px",borderRadius:6,border:"1px solid #DC2626",background:"#fff",color:"#DC2626",fontSize:11,cursor:"pointer"}}>Return</button><button style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#D97706",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>✅ Verify</button></>}
                                    {demoRole==="approver"&&cl.status==="verified" && <><button style={{padding:"6px 10px",borderRadius:6,border:"1px solid #DC2626",background:"#fff",color:"#DC2626",fontSize:11,cursor:"pointer"}}>Return</button><button style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#059669",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>🟢 Approve</button></>}
                                    {cl.status==="approved" && <button style={{padding:"6px 12px",borderRadius:6,border:"1px solid #0C4A6E",background:"#EFF6FF",color:"#0C4A6E",fontSize:11,fontWeight:700,cursor:"pointer"}}>📄 Remittance</button>}
                                  </div>
                                </div>

                                {/* Audit trail */}
                                {(cl.submAt||cl.verAt||cl.appAt) && (
                                  <div style={{marginTop:6,padding:"6px 10px",background:"#F0F4F8",borderRadius:6,fontSize:10,color:"#64748B",display:"flex",gap:12,flexWrap:"wrap"}}>
                                    {cl.submAt && <span>📤 Submitted {fDate(cl.submAt)}</span>}
                                    {cl.verAt && <span>✅ Verified by {cl.verBy} — {fDate(cl.verAt)}</span>}
                                    {cl.appAt && <span>🟢 Approved by {cl.appBy} — {fDate(cl.appAt)}</span>}
                                    {cl.payDate && <span>💸 Paid {fDate(cl.payDate)}</span>}
                                    {cl.payReceived && <span>✅ Receipt {fDate(cl.payReceived)}</span>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Payments Ledger */}
                  {demoView==="payments" && (()=>{
                    const lClaims = demoRole==="practice"
                      ? allDemoClaims.filter(c=>c.pk==="parks"&&c.status==="approved")
                      : allDemoClaims.filter(c=>c.status==="approved");
                    let run=0; const rows=lClaims.sort((a,b)=>a.month.localeCompare(b.month)).map(c=>{const amt=c.lines.reduce((s,l)=>s+calc(l.role,l.aT,l.aV),0);run+=amt;return{...c,amt,run};});
                    const paid=rows.filter(r=>r.payDate).reduce((s,r)=>s+r.amt,0);
                    return (
                      <div>
                        <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:12}}>
                          {demoRole==="practice"?"The Parks MC — Payment Ledger":"Payment Ledger — All Practices"}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                          <div style={{background:"#D1FAE5",borderRadius:10,padding:"12px",borderLeft:"3px solid #059669"}}><div style={{fontSize:10,color:"#065F46"}}>Approved</div><div style={{fontSize:20,fontWeight:800,color:"#059669"}}>{fm(run)}</div></div>
                          <div style={{background:"#DBEAFE",borderRadius:10,padding:"12px",borderLeft:"3px solid #2563EB"}}><div style={{fontSize:10,color:"#1D4ED8"}}>Paid</div><div style={{fontSize:20,fontWeight:800,color:"#2563EB"}}>{fm(paid)}</div></div>
                          <div style={{background:"#FEF3C7",borderRadius:10,padding:"12px",borderLeft:"3px solid #D97706"}}><div style={{fontSize:10,color:"#92400E"}}>Outstanding</div><div style={{fontSize:20,fontWeight:800,color:"#D97706"}}>{fm(run-paid)}</div></div>
                        </div>
                        <div style={{background:"#fff",borderRadius:10,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead><tr style={{background:"#0C2D48"}}>
                              {[demoRole!=="practice"&&"Practice","Period","Ref","Amount","Payment","Running Total"].filter(Boolean).map((h,i)=>(
                                <th key={i} style={{padding:"8px 10px",textAlign:h==="Amount"||h==="Running Total"?"right":"left",color:"#7DD3FC",fontWeight:600,fontSize:10}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {rows.map((c,i)=>{const p2=PRACTICES.find(p=>p.key===c.pk);const ps=getPS(c);
                                return (
                                  <tr key={c.id} style={{borderBottom:"1px solid #F1F5F9",background:i%2?"#FAFAFA":"#fff"}}>
                                    {demoRole!=="practice" && <td style={{padding:"7px 10px",fontWeight:600}}>{p2?.name}</td>}
                                    <td style={{padding:"7px 10px"}}>{fMonth(c.month)}</td>
                                    <td style={{padding:"7px 10px",fontFamily:"monospace",fontSize:9,color:"#64748B"}}>{c.remRef||"—"}</td>
                                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>{fm(c.amt)}</td>
                                    <td style={{padding:"7px 10px"}}><Badge color={PAY_CFG[ps].c} bg={PAY_CFG[ps].bg}>{PAY_CFG[ps].i} {PAY_CFG[ps].l}</Badge></td>
                                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"#0C4A6E"}}>{fm(c.run)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* App footer */}
                <div style={{background:"#0C2D48",padding:"6px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:9,color:"#475569"}}>Notewell · PCN Services Ltd · Prototype</span>
                  <span style={{fontSize:9,color:"#475569"}}>Switch roles above to see different user perspectives</span>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ─── IMPLEMENTATION PLAN ─── */}
          {section==="plan" && (
            <div>
              <SlideTitle sub="8 phases delivered over ~8 working days">Implementation Plan</SlideTitle>

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
                <Stat label="DEVELOPMENT" value={`${totalDev} hrs`} sub={`~${Math.ceil(totalDev/6)} working days`} color="#2563EB" bg="#DBEAFE" />
                <Stat label="TESTING" value={`${totalTest} hrs`} sub={`~${Math.ceil(totalTest/6)} working days`} color="#7C3AED" bg="#EDE9FE" />
                <Stat label="TOTAL EFFORT" value={`${totalHrs} hrs`} sub={`~${Math.ceil(totalHrs/6)} working days`} color="#0C4A6E" bg="#E0F2FE" />
                <Stat label="CALENDAR" value="8–10 days" sub="1.5–2 weeks" color="#059669" bg="#D1FAE5" />
              </div>

              <div style={{display:"grid",gap:6}}>
                {phases.map((p,i) => {
                  const total=p.dev+p.test; const isExp=expandedPhase===i;
                  return (
                    <div key={i} onClick={()=>setExpandedPhase(isExp?null:i)} style={{
                      background:"#fff",borderRadius:10,overflow:"hidden",cursor:"pointer",
                      border:isExp?"1.5px solid #0C4A6E":"1px solid #E2E8F0",
                    }}>
                      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:26,height:26,borderRadius:"50%",background:"#0C4A6E",
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#7DD3FC",fontWeight:700}}>{p.n}</div>
                          <div>
                            <div style={{fontWeight:700,fontSize:13}}>{p.l}</div>
                            <div style={{fontSize:11,color:"#64748B"}}>{p.d}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:14,fontWeight:800,color:"#0C4A6E"}}>{total} hrs</div>
                            <div style={{fontSize:10,color:"#94A3B8"}}>{p.dev}h dev · {p.test}h test</div>
                          </div>
                          <span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,
                            background:riskBg[p.risk],color:riskC[p.risk]}}>{p.risk.toUpperCase()}</span>
                        </div>
                      </div>
                      {isExp && (
                        <div style={{borderTop:"1px solid #E2E8F0",padding:"10px 16px",background:"#F8FAFC"}}>
                          <div style={{height:6,borderRadius:3,background:"#E2E8F0",overflow:"hidden",display:"flex"}}>
                            <div style={{width:`${(p.dev/total)*100}%`,background:"#2563EB"}} />
                            <div style={{width:`${(p.test/total)*100}%`,background:"#7C3AED"}} />
                          </div>
                          <div style={{display:"flex",gap:12,marginTop:6,fontSize:10}}>
                            <span style={{color:"#2563EB",fontWeight:600}}>■ Development: {p.dev}h</span>
                            <span style={{color:"#7C3AED",fontWeight:600}}>■ Testing: {p.test}h</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{marginTop:20,background:"#fff",borderRadius:12,padding:18,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#0C2D48",marginBottom:10}}>Suggested Schedule</div>
                <div style={{display:"grid",gridTemplateColumns:"70px 1fr",gap:"4px 14px",fontSize:12}}>
                  {[
                    ["Day 1","Config update + Practice details + Staff roster start"],
                    ["Day 2","Staff roster finish + Workflow visibility"],
                    ["Day 3","Evidence redesign (full day — highest complexity)"],
                    ["Day 4","LTC tracking + Remittance document start"],
                    ["Day 5","Remittance finish + Payment lifecycle start"],
                    ["Day 6","Payment lifecycle finish + email notifications"],
                    ["Day 7","Finance dashboard & practice ledger"],
                    ["Day 8","End-to-end testing + bug fixes + polish"],
                  ].map(([d,t],i)=>(
                    <div key={i} style={{display:"contents"}}>
                      <div style={{fontWeight:800,color:"#0C4A6E",padding:"4px 0"}}>{d}</div>
                      <div style={{color:"#475569",padding:"4px 0",borderBottom:i<7?"1px solid #F1F5F9":"none"}}>{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── THE ASK ─── */}
          {section==="ask" && (
            <div>
              <SlideTitle sub="Two options for the Programme Board to consider">Decision Required</SlideTitle>

              {/* Two options side by side */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}>
                {/* Option A */}
                <div style={{background:"#fff",borderRadius:14,overflow:"hidden",border:"2px solid #E2E8F0"}}>
                  <div style={{background:"#FEF3C7",padding:"16px 20px",borderBottom:"1px solid #FDE68A"}}>
                    <div style={{fontSize:11,color:"#92400E",fontWeight:700,letterSpacing:0.5}}>OPTION A</div>
                    <div style={{fontSize:20,fontWeight:800,color:"#0C2D48",marginTop:2}}>Manual Process</div>
                  </div>
                  <div style={{padding:20}}>
                    <div style={{display:"grid",gap:10,marginBottom:16}}>
                      {[
                        {l:"Setup Time",v:"~2 days",d:"Templates, training, shared drive"},
                        {l:"Monthly Effort (all parties)",v:"15–21 hours",d:"7 PMs + NRES team + SNO + Finance"},
                        {l:"Annual Staff Cost",v:"£4,500–6,300",d:"180–252 hours @ ~£25/hr avg"},
                        {l:"Ongoing Development",v:"None",d:"No system costs"},
                      ].map((r,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:i<3?"1px solid #F1F5F9":"none"}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:"#0C2D48"}}>{r.l}</div>
                            <div style={{fontSize:10,color:"#94A3B8"}}>{r.d}</div>
                          </div>
                          <div style={{fontSize:14,fontWeight:800,color:"#D97706",textAlign:"right"}}>{r.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:12,color:"#475569",lineHeight:1.6,padding:"10px 12px",background:"#FFFBEB",borderRadius:8}}>
                      <strong style={{color:"#92400E"}}>Trade-offs:</strong> No audit trail beyond email. No real-time visibility for practices. No automated remittances. Spreadsheet-dependent. Scales poorly. Manual calculation risk. Relies on individual diligence for evidence checking.
                    </div>
                  </div>
                </div>

                {/* Option B */}
                <div style={{background:"#fff",borderRadius:14,overflow:"hidden",border:"2px solid #10B981"}}>
                  <div style={{background:"#D1FAE5",padding:"16px 20px",borderBottom:"1px solid #6EE7B7"}}>
                    <div style={{fontSize:11,color:"#065F46",fontWeight:700,letterSpacing:0.5}}>OPTION B</div>
                    <div style={{fontSize:20,fontWeight:800,color:"#0C2D48",marginTop:2}}>Digital Solution (Notewell)</div>
                  </div>
                  <div style={{padding:20}}>
                    <div style={{display:"grid",gap:10,marginBottom:16}}>
                      {[
                        {l:"Development Time",v:"8–10 days",d:"One-off, phased delivery"},
                        {l:"Monthly Effort (all parties)",v:"3.5–6 hours",d:"Guided workflows, queue-based"},
                        {l:"Annual Staff Cost",v:"£1,050–1,800",d:"42–72 hours @ ~£25/hr avg"},
                        {l:"Annual Saving vs Manual",v:"£3,450–4,500",d:"Break-even in 4–5 months"},
                      ].map((r,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:i<3?"1px solid #F1F5F9":"none"}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:"#0C2D48"}}>{r.l}</div>
                            <div style={{fontSize:10,color:"#94A3B8"}}>{r.d}</div>
                          </div>
                          <div style={{fontSize:14,fontWeight:800,color:"#059669",textAlign:"right"}}>{r.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:12,color:"#475569",lineHeight:1.6,padding:"10px 12px",background:"#F0FDF4",borderRadius:8}}>
                      <strong style={{color:"#065F46"}}>Benefits:</strong> Immutable audit trail. Auto-generated remittances. Real-time visibility for all parties. Guided evidence uploads. Payment lifecycle tracking. Practice ledger. Programme-level dashboards. Scales to any number of practices.
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-year view */}
              <div style={{background:"#fff",borderRadius:14,padding:"20px 22px",border:"1px solid #E2E8F0",marginBottom:24}}>
                <div style={{fontSize:15,fontWeight:800,color:"#0C2D48",marginBottom:14}}>2-Year Programme Cost Comparison</div>
                <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:"0",fontSize:12}}>
                  <div style={{padding:"10px 14px",fontWeight:700,background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}></div>
                  <div style={{padding:"10px 14px",fontWeight:700,background:"#FEF3C7",borderBottom:"2px solid #E2E8F0",textAlign:"center",color:"#92400E"}}>Option A: Manual</div>
                  <div style={{padding:"10px 14px",fontWeight:700,background:"#D1FAE5",borderBottom:"2px solid #E2E8F0",textAlign:"center",color:"#065F46"}}>Option B: Digital</div>

                  {[
                    {l:"Setup / Development",a:"~£400 (2 days prep)",b:"~£1,500 (8–10 days)"},
                    {l:"Year 1 Running Cost",a:"£4,500–6,300",b:"£1,050–1,800"},
                    {l:"Year 2 Running Cost",a:"£4,500–6,300",b:"£1,050–1,800"},
                    {l:"2-Year Total",a:"£9,400–12,600",b:"£3,600–5,100",bold:true},
                    {l:"2-Year Saving",a:"—",b:"£5,800–7,500",bold:true,highlight:true},
                  ].map((r,i) => (
                    <div key={i} style={{display:"contents"}}>
                      <div style={{padding:"10px 14px",fontWeight:r.bold?800:600,color:"#0C2D48",borderBottom:"1px solid #F1F5F9",background:r.highlight?"#F0FDF4":"transparent"}}>{r.l}</div>
                      <div style={{padding:"10px 14px",textAlign:"center",fontWeight:r.bold?800:500,color:r.bold?"#DC2626":"#475569",borderBottom:"1px solid #F1F5F9",background:r.highlight?"#FEF2F2":"transparent"}}>{r.a}</div>
                      <div style={{padding:"10px 14px",textAlign:"center",fontWeight:r.bold?800:500,color:r.bold||r.highlight?"#059669":"#475569",borderBottom:"1px solid #F1F5F9",background:r.highlight?"#F0FDF4":"transparent",fontSize:r.highlight?14:12}}>{r.b}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What we need */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:24}}>
                <InfoCard icon="🗳️" title="Decision" accent="#0C4A6E">
                  The Board is asked to choose between Option A (manual process) and Option B (digital solution). Both can be operational for the April 2026 claiming cycle.
                </InfoCard>
                <InfoCard icon="📅" title="Timeline" accent="#2563EB">
                  If Option B is chosen, development begins immediately with phased delivery over 8–10 working days, targeting completion ahead of the first claiming month.
                </InfoCard>
                <InfoCard icon="🔐" title="Either Option" accent="#7C3AED">
                  Whichever option is chosen, practice bank details must be collected, and PML Finance workflow roles confirmed. The Part A guidance document is ready for distribution.
                </InfoCard>
              </div>

              <div style={{background:"linear-gradient(135deg,#0C2D48,#145374)",borderRadius:14,padding:"24px 28px",color:"#fff",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:800,marginBottom:8}}>Recommendation</div>
                <div style={{fontSize:15,opacity:0.9,lineHeight:1.7,maxWidth:650,margin:"0 auto"}}>
                  Option B delivers a £5,800–7,500 saving over the 2-year programme, provides the governance
                  and audit trail expected of a £2.34M public contract, and removes the operational risk of
                  spreadsheet and email dependency. The Board is asked to approve Option B for immediate implementation.
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer style={{background:"linear-gradient(135deg, #1A3A5C, #1E5F7A)",padding:"10px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span style={{fontSize:10,color:"#475569",fontFamily:"'DM Sans',sans-serif"}}>
          NRES SDA Claims System · Notewell by PCN Services Ltd · Programme Board Presentation · March 2026
        </span>
        <div style={{display:"flex",gap:8}}>
          {SECTIONS.map((s,i) => (
            <div key={s.id} onClick={()=>setSection(s.id)} style={{
              width:8,height:8,borderRadius:"50%",cursor:"pointer",
              background:section===s.id?"#10B981":"#0C2D48",transition:"background 0.2s",
            }} />
          ))}
        </div>
      </footer>
    </div>
  );
}
