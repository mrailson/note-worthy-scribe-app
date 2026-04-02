import { useState } from "react";
const T = {
  navy:"#0C2D48",deep:"#0C2D48",emerald:"#059669",lightEm:"#10B981",
  r1:"#1565C0",r2:"#E65100",gold:"#BF8C00",
  bg:"#FAF6F0",card:"#fff",surface:"#F5F0E8",border:"#E0D6C8",
  text:"#2C2418",sub:"#6B5D4F",muted:"#8D7B68",
};
const fonts=`'Source Serif 4','Georgia',serif`;
const sans=`'DM Sans','Segoe UI',sans-serif`;

export default function SDAClaimingGuide(){
  const [tab,setTab]=useState("overview");
  return(
<div style={{fontFamily:sans,background:T.bg,minHeight:"100%",height:"100%",color:T.text,overflowY:"auto"}}>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<header style={{background:"linear-gradient(135deg, #1A3A5C 0%, #1E5F7A 50%, #2A7A94 100%)",padding:"32px 48px 24px",position:"relative"}}>
<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 80% 20%,rgba(255,255,255,0.08) 0%,transparent 60%)"}}/>
<div style={{position:"relative"}}>
<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
<div style={{width:36,height:36,borderRadius:8,background:T.emerald,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff"}}>N</div>
<div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:T.muted}}>ENN PROGRAMME · BOARD BRIEFING</div>
</div>
<h1 style={{fontFamily:fonts,fontSize:38,fontWeight:800,color:"#fff",margin:"0 0 8px",lineHeight:1.1,letterSpacing:-0.5}}>Part A: Same Day Access Claiming Guide</h1>
<p style={{fontSize:14,color:"#D4E4F0",margin:0,fontWeight:400,maxWidth:600}}>How ENN practices claim for SDA resource — the two routes, evidence requirements, and approval process</p>
</div>
</header>
<nav style={{padding:"0 48px",background:T.card,borderBottom:`1px solid ${T.border}`,display:"flex",gap:0}}>
{[{id:"overview",l:"Overview & Two Routes"},{id:"evidence",l:"Evidence Requirements"},{id:"workflow",l:"Approval Workflow"},{id:"example",l:"Worked Example"}].map(t=>
<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"14px 24px",fontSize:13,fontWeight:tab===t.id?700:500,cursor:"pointer",border:"none",background:"none",color:tab===t.id?T.navy:T.muted,borderBottom:tab===t.id?`2px solid ${T.emerald}`:"2px solid transparent",transition:"all 0.15s",letterSpacing:0.2}}>{t.l}</button>
)}
</nav>
<main style={{maxWidth:1080,margin:"0 auto",padding:"32px 48px 60px"}}>

{tab==="overview"&&(<div>
<div style={{textAlign:"center",margin:"0 0 40px"}}>
<div style={{display:"inline-block",maxWidth:560}}>
<div style={{width:48,height:48,borderRadius:"50%",background:`${T.gold}18`,border:`1.5px solid ${T.gold}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 14px"}}>🧩</div>
<h2 style={{fontFamily:fonts,fontSize:26,fontWeight:800,color:T.navy,margin:"0 0 10px"}}>The "Golden Rule" of Additionality</h2>
<p style={{fontSize:14,color:T.sub,lineHeight:1.8,margin:0}}>Every claim under ENN must demonstrate that the funded activity is <strong style={{color:T.navy}}>genuinely additional</strong> — new work that would not have occurred without the programme. No additionality, no payment.</p>
</div></div>
<div style={{display:"flex",alignItems:"center",gap:16,margin:"0 0 24px"}}><div style={{height:1,flex:1,background:T.border}}/><span style={{fontSize:12,fontWeight:600,color:T.muted,letterSpacing:0.5}}>TWO CLAIMING ROUTES</span><div style={{height:1,flex:1,background:T.border}}/></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 48px 1fr",gap:0,marginBottom:36}}>
<div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
<div style={{padding:"20px 24px",borderBottom:`1px solid ${T.border}`}}>
<div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:T.r1,marginBottom:4}}>ROUTE 1</div>
<div style={{fontFamily:fonts,fontSize:22,fontWeight:800,color:T.navy}}>New SDA Resource</div>
<div style={{fontSize:13,color:T.sub,marginTop:6,lineHeight:1.6}}>Recruiting new staff specifically to provide SDA capacity that did not previously exist</div>
</div>
<div style={{padding:"20px 24px",display:"grid",gap:16}}>
{[{icon:"👤",title:"Who this applies to",body:"A new GP, ACP, ANP or equivalent brought in specifically for SDA. Must be genuinely additional — new capacity, not a replacement. If part-SDA, only the SDA portion is claimed."},
{icon:"💡",title:"Why it's additional",body:"The new post itself proves additionality — it represents SDA capacity that didn't previously exist. The hire is the evidence of new work."},
{icon:"📎",title:"Evidence at submission",body:"SDA Slot Type Report and SDA Rota Report are mandatory. These confirm the hire is actively delivering SDA appointments."},
{icon:"⏳",title:"LTC evidence obligation",body:"LTC (Part B) evidence is not required for submission but must follow in due course. The practice must demonstrate matching LTC provision of equivalent time and cost value."},
{icon:"⚡",title:"Approval path",body:"Draft → Submitted → Approved by SNO. No intermediate verification step — new hires are straightforward to validate."}
].map((item,i)=>
<div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
<div style={{width:32,height:32,borderRadius:8,background:`${T.r1}0A`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{item.icon}</div>
<div><div style={{fontSize:12,fontWeight:700,color:T.navy,marginBottom:2}}>{item.title}</div><div style={{fontSize:12,color:T.sub,lineHeight:1.7}}>{item.body}</div></div>
</div>)}
</div></div>
<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{width:1,flex:1,background:T.border}}/><div style={{width:36,height:36,borderRadius:"50%",background:T.navy,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:800,margin:"8px 0"}}>VS</div><div style={{width:1,flex:1,background:T.border}}/></div>
<div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
<div style={{padding:"20px 24px",borderBottom:`1px solid ${T.border}`}}>
<div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:T.r2,marginBottom:4}}>ROUTE 2</div>
<div style={{fontFamily:fonts,fontSize:22,fontWeight:800,color:T.navy}}>Buyback of Existing Staff</div>
<div style={{fontSize:13,color:T.sub,marginTop:6,lineHeight:1.6}}>Claiming for existing staff whose current SDA time is formally attributed to the ENN programme</div>
</div>
<div style={{padding:"20px 24px",display:"grid",gap:16}}>
{[{icon:"👥",title:"Who this applies to",body:"An existing GP, ACP or ANP already providing SDA. Only the portion demonstrably spent providing SDA can be claimed — not general clinical time."},
{icon:"⚖️",title:"Why additionality is harder",body:"The SDA activity already exists — it is not additional in itself. Additionality must be proven through Part B: new, unfunded LTC work generated by formally freeing up capacity."},
{icon:"📎",title:"Evidence at submission",body:"All 4 documents mandatory: SDA Slot Type, SDA Rota, LTC Slot Type, LTC Rota. Submission is blocked until all four are uploaded."},
{icon:"🔒",title:"The Part B trigger",body:"Payment is NOT released on Part A alone. LTC evidence must prove that new, unfunded LTC appointments have been delivered as a direct result of the buyback."},
{icon:"🔍",title:"Approval path",body:"Draft → Submitted → Verified by Rebecca/Team → Approved by SNO. Extra verification because buyback evidence requires closer scrutiny."}
].map((item,i)=>
<div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
<div style={{width:32,height:32,borderRadius:8,background:`${T.r2}0A`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{item.icon}</div>
<div><div style={{fontSize:12,fontWeight:700,color:T.navy,marginBottom:2}}>{item.title}</div><div style={{fontSize:12,color:T.sub,lineHeight:1.7}}>{item.body}</div></div>
</div>)}
</div></div>
</div>
<div style={{background:T.surface,borderRadius:12,padding:"24px 28px",border:`1px solid ${T.border}`}}>
<div style={{fontFamily:fonts,fontSize:18,fontWeight:800,color:T.navy,marginBottom:12}}>The Key Distinction</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
<div style={{display:"flex",gap:12}}><div style={{width:4,borderRadius:2,background:T.r1,flexShrink:0}}/><div><div style={{fontSize:13,fontWeight:700,color:T.r1,marginBottom:4}}>Route 1 — New Hire</div><div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>The additionality IS the new post. SDA evidence confirms delivery. LTC evidence follows in due course to show matching provision.</div></div></div>
<div style={{display:"flex",gap:12}}><div style={{width:4,borderRadius:2,background:T.r2,flexShrink:0}}/><div><div style={{fontSize:13,fontWeight:700,color:T.r2,marginBottom:4}}>Route 2 — Buyback</div><div style={{fontSize:13,color:T.sub,lineHeight:1.7}}>The SDA already exists — NOT additional. Additionality proven through Part B LTC evidence showing the buyback generated new, unfunded LTC work. Without Part B, no payment.</div></div></div>
</div></div>
</div>)}

{tab==="evidence"&&(<div>
<div style={{marginBottom:28}}><h2 style={{fontFamily:fonts,fontSize:26,fontWeight:800,color:T.navy,margin:"0 0 6px"}}>Evidence Requirements</h2><p style={{fontSize:14,color:T.sub,margin:0}}>What each practice must submit — and when</p></div>
<div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:32,background:T.card}}>
<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
<thead><tr>
<th style={{padding:"14px 20px",textAlign:"left",background:T.navy,color:"#B8A898",fontWeight:600,fontSize:11,letterSpacing:0.5,width:"24%"}}>EVIDENCE</th>
<th style={{padding:"14px 20px",textAlign:"center",background:T.r1,color:"#fff",fontWeight:700,fontSize:11,letterSpacing:0.5,width:"26%"}}>ROUTE 1: NEW SDA</th>
<th style={{padding:"14px 20px",textAlign:"center",background:T.r2,color:"#fff",fontWeight:700,fontSize:11,letterSpacing:0.5,width:"26%"}}>ROUTE 2: BUYBACK</th>
<th style={{padding:"14px 20px",textAlign:"left",background:T.navy,color:"#B8A898",fontWeight:600,fontSize:11,letterSpacing:0.5,width:"24%"}}>WHEN</th>
</tr></thead>
<tbody>
{[{doc:"Part A Claim Form",r1:"Required",r1d:"Hire details, role, WTE, start",r2:"Required",r2d:"Clinician, sessions, SDA attribution",when:"At submission",s1:"req",s2:"req"},
{doc:"SDA Slot Type Report",r1:"Mandatory",r1d:"Confirms new hire delivers SDA",r2:"Mandatory",r2d:"Shows SDA appointment codes",when:"With Part A claim",s1:"req",s2:"req"},
{doc:"SDA Rota Report",r1:"Mandatory",r1d:"Sessions rostered for SDA",r2:"Mandatory",r2d:"SDA sessions for buyback clinician",when:"With Part A claim",s1:"req",s2:"req"},
{doc:"LTC Slot Type Report",r1:"Due in course",r1d:"Equivalent new LTC appointments",r2:"Mandatory",r2d:"Confirms new unfunded LTC work",when:"For payment release",s1:"due",s2:"req"},
{doc:"LTC Rota Report",r1:"Due in course",r1d:"New LTC sessions in rota",r2:"Mandatory",r2d:"New LTC sessions from buyback",when:"For payment release",s1:"due",s2:"req"},
].map((r,i)=>
<tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
<td style={{padding:"14px 20px",fontWeight:700,color:T.navy}}>{r.doc}</td>
<td style={{padding:"14px 20px",textAlign:"center"}}><span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:r.s1==="req"?`${T.emerald}14`:"#7C3AED0A",color:r.s1==="req"?T.emerald:"#7C3AED",border:`1px solid ${r.s1==="req"?`${T.emerald}33`:"#7C3AED22"}`}}>{r.s1==="req"?"✓ "+r.r1:"⏳ "+r.r1}</span><div style={{fontSize:10,color:T.muted,marginTop:4}}>{r.r1d}</div></td>
<td style={{padding:"14px 20px",textAlign:"center"}}><span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:`${T.emerald}14`,color:T.emerald,border:`1px solid ${T.emerald}33`}}>✓ {r.r2}</span><div style={{fontSize:10,color:T.muted,marginTop:4}}>{r.r2d}</div></td>
<td style={{padding:"14px 20px",fontSize:12,color:T.sub}}>{r.when}</td>
</tr>)}
</tbody></table></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}>
<div style={{background:T.card,borderRadius:12,padding:"22px 24px",border:`1px solid ${T.border}`}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><div style={{width:3,height:20,borderRadius:2,background:T.r1}}/><span style={{fontFamily:fonts,fontSize:16,fontWeight:800,color:T.navy}}>Part A — SDA Evidence</span></div>
{[{icon:"📊",title:"SDA Slot Type Report",body:"Export from EMIS/SystmOne showing appointment types coded as 'Same Day Access' for the clinician. Must identify clinician and volume of SDA appointments."},
{icon:"📅",title:"SDA Rota Report",body:"Rota extract showing sessions (e.g. Mon/Wed/Fri AM) where the clinician is rostered for SDA during the claim period."}
].map((d,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:i===0?14:0}}><span style={{fontSize:20,flexShrink:0,marginTop:2}}>{d.icon}</span><div><div style={{fontSize:13,fontWeight:700,color:T.navy,marginBottom:2}}>{d.title}</div><div style={{fontSize:12,color:T.sub,lineHeight:1.7}}>{d.body}</div></div></div>)}
</div>
<div style={{background:T.card,borderRadius:12,padding:"22px 24px",border:`1px solid ${T.border}`}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><div style={{width:3,height:20,borderRadius:2,background:T.r2}}/><span style={{fontFamily:fonts,fontSize:16,fontWeight:800,color:T.navy}}>Part B — LTC Evidence</span></div>
{[{icon:"📊",title:"LTC Slot Type Report",body:"Report showing LTC appointment types (e.g. 'LTC Review', 'Chronic Disease Management') delivered as matching output. Must be demonstrably new."},
{icon:"📅",title:"LTC Rota Report",body:"Rota showing new LTC sessions added as a result of the SDA buyback. Must cover same period and demonstrate additionality."}
].map((d,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:i===0?14:0}}><span style={{fontSize:20,flexShrink:0,marginTop:2}}>{d.icon}</span><div><div style={{fontSize:13,fontWeight:700,color:T.navy,marginBottom:2}}>{d.title}</div><div style={{fontSize:12,color:T.sub,lineHeight:1.7}}>{d.body}</div></div></div>)}
</div></div>
<div style={{background:`${T.gold}08`,borderRadius:12,padding:"18px 22px",border:`1px solid ${T.gold}33`}}>
<div style={{fontFamily:fonts,fontSize:15,fontWeight:700,color:"#8B6914",marginBottom:6}}>Part B is never a payment claim</div>
<div style={{fontSize:13,color:"#6B5210",lineHeight:1.7}}>Part B (LTC evidence) is solely the evidence requirement that triggers release of the Part A payment. Submitting a Part B payment claim is expressly not permitted. Incomplete claims are <strong>held — not rejected</strong> — pending evidence.</div>
</div>
</div>)}

{tab==="workflow"&&(<div>
<div style={{marginBottom:28}}><h2 style={{fontFamily:fonts,fontSize:26,fontWeight:800,color:T.navy,margin:"0 0 6px"}}>Approval Workflow</h2><p style={{fontSize:14,color:T.sub,margin:0}}>How claims move from draft to payment — by route</p></div>
<div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,padding:"28px",marginBottom:20}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}><div style={{width:3,height:18,borderRadius:2,background:T.r2}}/><span style={{fontFamily:fonts,fontSize:18,fontWeight:800,color:T.navy}}>Route 2: Buyback — Two-Stage Approval</span></div>
<div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:0,marginBottom:20}}>
{[{n:"1",l:"Draft",s:"Practice builds",c:T.muted},{n:"2",l:"Submitted",s:"4 evidence uploaded",c:T.r1},{n:"3",l:"Verified",s:"Rebecca / Team",c:"#D97706",a:true},{n:"4",l:"Approved",s:"SNO",c:T.emerald},{n:"5",l:"Paid",s:"SNO Finance",c:"#7C3AED"}].map((s,i)=>
<div key={i} style={{display:"flex",alignItems:"center",flex:i<4?1:"none"}}>
<div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:80}}>
<div style={{width:s.a?40:32,height:s.a?40:32,borderRadius:"50%",background:s.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:s.a?15:13,color:"#fff",fontWeight:700,boxShadow:s.a?`0 0 0 4px ${s.c}22`:"none"}}>{s.n}</div>
<div style={{fontSize:12,fontWeight:700,color:s.c,marginTop:6}}>{s.l}</div>
<div style={{fontSize:10,color:T.muted,textAlign:"center",marginTop:2}}>{s.s}</div>
</div>{i<4&&<div style={{flex:1,height:2,background:T.border,margin:"0 4px",alignSelf:"flex-start",marginTop:s.a?19:15}}/>}</div>)}
</div>
<div style={{padding:"12px 16px",background:`${T.r2}06`,borderRadius:8,border:`1px solid ${T.r2}18`,fontSize:12,color:T.r2,lineHeight:1.6}}><strong>Why the extra verification step?</strong> Buyback evidence requires closer scrutiny — verifiers check all 4 documents are present, correctly labelled, and genuinely demonstrate additionality.</div>
</div>
<div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,padding:"28px",marginBottom:28}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}><div style={{width:3,height:18,borderRadius:2,background:T.r1}}/><span style={{fontFamily:fonts,fontSize:18,fontWeight:800,color:T.navy}}>Route 1: New SDA — Direct to SNO</span></div>
<div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:0,marginBottom:20}}>
{[{n:"1",l:"Draft",s:"Practice builds",c:T.muted},{n:"2",l:"Submitted",s:"SDA evidence uploaded",c:T.r1},{n:"3",l:"Approved",s:"SNO",c:T.emerald},{n:"4",l:"Paid",s:"SNO Finance",c:"#7C3AED"}].map((s,i)=>
<div key={i} style={{display:"flex",alignItems:"center",flex:i<3?1:"none"}}>
<div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:90}}>
<div style={{width:32,height:32,borderRadius:"50%",background:s.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:700}}>{s.n}</div>
<div style={{fontSize:12,fontWeight:700,color:s.c,marginTop:6}}>{s.l}</div>
<div style={{fontSize:10,color:T.muted,textAlign:"center",marginTop:2}}>{s.s}</div>
</div>{i<3&&<div style={{flex:1,height:2,background:T.border,margin:"0 4px",alignSelf:"flex-start",marginTop:15}}/>}</div>)}
</div>
<div style={{padding:"12px 16px",background:`${T.r1}06`,borderRadius:8,border:`1px solid ${T.r1}18`,fontSize:12,color:T.r1,lineHeight:1.6}}><strong>No verification needed.</strong> New post is additional by definition. SDA reports confirm delivery. Straight to SNO. LTC tracked separately.</div>
</div>
<div style={{padding:"16px 20px",background:"#DC262608",borderRadius:10,border:"1px solid #DC262618",marginBottom:28}}><div style={{fontSize:13,fontWeight:700,color:"#DC2626",marginBottom:4}}>If a claim is returned</div><div style={{fontSize:12,color:"#7F1D1D",lineHeight:1.7}}>At any stage, a claim can be returned with notes. Evidence is locked while under review — edit and resubmit once returned.</div></div>
<div style={{fontFamily:fonts,fontSize:18,fontWeight:800,color:T.navy,marginBottom:16}}>Roles & Responsibilities</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14}}>
{[{who:"Practice Manager",icon:"🏥",tasks:["Maintain staff roster","Upload evidence from EMIS/SystmOne","Submit monthly claims","Confirm declaration","Confirm payment receipt"],c:T.r1},
{who:"Rebecca / Team",icon:"🔍",tasks:["Verify buyback evidence (Route 2)","Check all 4 docs present & correct","Return with notes if incomplete","Pass verified claims to SNO","Track LTC evidence obligations"],c:"#D97706"},
{who:"SNO",icon:"✅",tasks:["Final approval on all claims","Route 1: approves from submitted","Route 2: approves from verified","Can return claims with notes","Approval authorises payment"],c:T.emerald},
{who:"SNO Finance",icon:"💰",tasks:["Set payment due dates","Process BACS payments","Confirm payment made","Send remittance advice","Maintain payment records"],c:"#7C3AED"}
].map((p,i)=>
<div key={i} style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,padding:"18px 16px"}}>
<div style={{fontSize:22,marginBottom:8}}>{p.icon}</div>
<div style={{fontSize:13,fontWeight:700,color:p.c,marginBottom:10}}>{p.who}</div>
{p.tasks.map((t,j)=><div key={j} style={{fontSize:11,color:T.sub,display:"flex",gap:6,alignItems:"flex-start",marginBottom:4,lineHeight:1.5}}><div style={{width:4,height:4,borderRadius:2,background:p.c,flexShrink:0,marginTop:6}}/>{t}</div>)}
</div>)}
</div>
</div>)}

{tab==="example"&&(<div>
<div style={{marginBottom:28}}><h2 style={{fontFamily:fonts,fontSize:26,fontWeight:800,color:T.navy,margin:"0 0 6px"}}>Worked Examples</h2><p style={{fontSize:14,color:T.sub,margin:0}}>Side-by-side: how the same practice claims under each route</p></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:32}}>
<div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
<div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,background:`${T.r1}04`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:T.r1}}>ROUTE 1 EXAMPLE</div><div style={{fontFamily:fonts,fontSize:18,fontWeight:800,color:T.navy,marginTop:2}}>New SDA Resource</div></div>
<div style={{padding:22}}>
<div style={{background:T.surface,borderRadius:8,padding:14,marginBottom:18,fontSize:12,color:T.sub,lineHeight:1.7}}><strong style={{color:T.navy}}>Practice:</strong> Harborough Fields Surgery · <strong style={{color:T.navy}}>Clinician:</strong> Dr Sarah Patel (GP)<br/><strong style={{color:T.navy}}>Arrangement:</strong> Newly recruited, 4 SDA sessions/week, wholly dedicated<br/><strong style={{color:T.navy}}>Start:</strong> July 2026</div>
{[{n:"1",t:"Claim submitted",d:"Registers Dr Patel: GP, 4 sessions, New SDA. Uploads SDA Slot Type and Rota. Confirms declaration."},
{n:"2",t:"Approved by SNO",d:"SNO reviews — genuinely additional, didn't exist before. Approved."},
{n:"3",t:"Monthly amount",d:"4 × £11,000 × 1.2938 ÷ 12 = £4,739.73/month"},
{n:"4",t:"LTC evidence follows",d:"Practice uploads LTC reports showing matching provision. System tracks until complete."}
].map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:12}}><div style={{width:24,height:24,borderRadius:"50%",background:T.r1,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{s.n}</div><div><div style={{fontSize:12,fontWeight:700,color:T.navy}}>{s.t}</div><div style={{fontSize:11,color:T.sub,lineHeight:1.6}}>{s.d}</div></div></div>)}
</div></div>
<div style={{background:T.card,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
<div style={{padding:"16px 22px",borderBottom:`1px solid ${T.border}`,background:`${T.r2}04`}}><div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:T.r2}}>ROUTE 2 EXAMPLE</div><div style={{fontFamily:fonts,fontSize:18,fontWeight:800,color:T.navy,marginTop:2}}>Buyback of Existing Staff</div></div>
<div style={{padding:22}}>
<div style={{background:T.surface,borderRadius:8,padding:14,marginBottom:18,fontSize:12,color:T.sub,lineHeight:1.7}}><strong style={{color:T.navy}}>Practice:</strong> Rushden Medical Centre · <strong style={{color:T.navy}}>Clinician:</strong> Jane Smith (ACP)<br/><strong style={{color:T.navy}}>Arrangement:</strong> 0.4 WTE buyback, existing SDA mornings (Mon/Wed/Fri AM)<br/><strong style={{color:T.navy}}>Goal:</strong> Dedicate freed capacity to new LTC reviews</div>
{[{n:"1",t:"Part A evidence uploaded",d:"SDA Slot Type Report (coded 'Same Day Access') and SDA Rota (Mon/Wed/Fri AM sessions)."},
{n:"2",t:"Part B evidence uploaded",d:"LTC Slot Type (new LTC Review appointments) and LTC Rota (new sessions). All 4 mandatory — submit unlocks."},
{n:"3",t:"Verified by ENN team",d:"Rebecca/Team check all 4 docs — clinician matches, period correct, LTC is demonstrably new."},
{n:"4",t:"Approved & paid",d:"0.4 WTE × £50,000 × 1.2938 ÷ 12 = £2,156.33/month. Remittance generated."}
].map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:12}}><div style={{width:24,height:24,borderRadius:"50%",background:T.r2,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{s.n}</div><div><div style={{fontSize:12,fontWeight:700,color:T.navy}}>{s.t}</div><div style={{fontSize:11,color:T.sub,lineHeight:1.6}}>{s.d}</div></div></div>)}
</div></div>
</div>
<div style={{background:"linear-gradient(135deg, #1A3A5C, #1E5F7A)",borderRadius:12,padding:"26px 28px",color:"#fff"}}>
<div style={{fontFamily:fonts,fontSize:20,fontWeight:800,marginBottom:18}}>Cost Calculation Methodology</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
{[{type:"Sessions (GPs)",formula:"Sessions × Annual Session Rate × 1.2938 ÷ 12",ex:"4 × £11,000 × 1.2938 ÷ 12 = £4,739.73",note:"GP rates are per-session, not salary"},
{type:"Hours",formula:"(Hours ÷ 37.5) × Annual Salary × 1.2938 ÷ 12",ex:"15h ÷ 37.5 = 0.4 WTE × £55,000 × 1.2938 ÷ 12 = £2,371.97",note:"Converted to WTE fraction first"},
{type:"WTE",formula:"WTE × Annual Salary × 1.2938 ÷ 12",ex:"0.4 × £50,000 × 1.2938 ÷ 12 = £2,156.33",note:"Direct WTE fraction applied"}
].map((c,i)=>
<div key={i} style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:16}}>
<div style={{fontSize:13,fontWeight:700,color:"#5EEAD4",marginBottom:8}}>{c.type}</div>
<div style={{fontSize:11,color:"#CBD5E1",lineHeight:1.6,marginBottom:8}}>{c.formula}</div>
<div style={{fontSize:11,fontFamily:"'DM Sans',monospace",background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"8px 10px",color:"#E2E8F0",lineHeight:1.4,marginBottom:8}}>{c.ex}</div>
<div style={{fontSize:10,color:"#94A3B8"}}>{c.note}</div>
</div>)}
</div>
<div style={{marginTop:16,padding:"12px 16px",background:"rgba(255,255,255,0.08)",borderRadius:8,fontSize:12,color:"#CBD5E1",lineHeight:1.6}}><strong style={{color:"#5EEAD4"}}>On-costs:</strong> Employer NI (15%) + Employer Pension (14.38%) = 29.38%. Applied as ×1.2938 multiplier. Centrally managed — practices do not calculate this themselves.</div>
</div>
</div>)}

</main>
<footer style={{borderTop:`1px solid ${T.border}`,padding:"16px 48px",display:"flex",justifyContent:"space-between",background:T.card}}>
<div style={{fontSize:11,color:T.muted}}>ENN Part A: SDA Claiming Guide · Notewell</div>
<div style={{fontSize:11,color:T.muted}}>Prepared by Rebecca Gane, ENN Transformation Manager · March 2026</div>
</footer>
</div>);
}
