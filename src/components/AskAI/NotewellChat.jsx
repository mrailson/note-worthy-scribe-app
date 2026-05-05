/**
 * Notewell AI Chat — Complete Component
 * Includes: streaming chat, Word/Excel/PowerPoint/diagram generation,
 * file upload, PII guardrails, 7-day history, paste fix, PNG fix,
 * My Profile & Custom Instructions modal, FRED guide, Runware image generation
 * Props: user { name, initials, role, jobTitle, practice{...}, neighbourhood, icb }
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PencilLine, X } from "lucide-react";
import { toast } from "sonner";

import * as XLSX from 'xlsx-js-style';
import pptxgen from 'pptxgenjs';
import { lazy, Suspense } from "react";
import AskAIImageStudio from "@/components/AskAI/AskAIImageStudio";
import { ASK_AI_IMAGE_STUDIO_ENABLED } from "@/components/AskAI/askAIImageStudioTemplates";

const AIVoiceStudio = lazy(() => import("@/components/ai4gp/AIVoiceStudio"));

const NHS = {
  blue:"#005EB8", darkBlue:"#003087", brightBlue:"#0072CE",
  lightBlue:"#41B6E6", aquaBlue:"#00A9CE", green:"#009639",
  warmYellow:"#FFB81C", red:"#DA291C", purple:"#7C2855",
  darkGrey:"#231F20", midGrey:"#425563", paleGrey:"#E8EDEE",
};
const DEFAULT_SETTINGS = {
  responseLength:"balanced", tone:"professional", includeUserContext:true,
  fontSize:"medium", sidebarMode:"collapsed", compactMessages:false, showClinicalCaveats:true,
  useLetterhead:true, showDocFooter:true, includeLogoInDocx:true, includePracticeDetails:true,
  visibleRoles:{"Practice Manager":true,"GP Partner":true,"Admin / Reception":true,"PCN Manager":true,"Ageing Well":true},
};
const FONT_SCALE = { small:0.84, medium:0.91, large:0.98 };

function useViewport(){
  const [vp,setVp]=useState(()=>classify(window.innerWidth));
  useEffect(()=>{const ro=new ResizeObserver(()=>setVp(classify(window.innerWidth)));ro.observe(document.documentElement);return()=>ro.disconnect();},[]);
  return vp;
}
function classify(w){ return w<600?"mobile":w<1100?"compact":w<1600?"standard":"wide"; }

const PII_PATTERNS=[
  {pattern:/\b(NHS\s*n(o|umber)\.?)\s*[:=]?\s*\d{3}\s?\d{3}\s?\d{4}/i,label:"NHS Number"},
  {pattern:/\bDOB\s*[:=]\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/i,label:"Date of Birth"},
];
function detectPII(t){ return PII_PATTERNS.find(p=>p.pattern.test(t)); }

const uid=()=>Math.random().toString(36).slice(2,10);
const fmt=d=>d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const fmtDate=d=>d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
const fmtSize=b=>b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";
const ALLOWED_TYPES=["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain","text/csv","image/png","image/jpeg","image/webp","image/gif"];
const IMAGE_TYPES=new Set(["image/png","image/jpeg","image/webp","image/gif"]);
function readBase64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});}
function triggerDownload(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.style.position="fixed";a.style.top="-9999px";a.style.left="-9999px";document.body.appendChild(a);a.dispatchEvent(new MouseEvent("click",{bubbles:false,cancelable:true,view:window}));document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),2000);}
// FIX 1: 30-second timeout on script load
async function loadScript(url,g){
  if(window[g])return window[g];
  await new Promise((res,rej)=>{
    const s=document.createElement("script");s.src=url;
    const timeout=setTimeout(()=>{rej(new Error("Script load timeout — check your connection"));},30000);
    s.onload=()=>{clearTimeout(timeout);res();};
    s.onerror=()=>{clearTimeout(timeout);rej(new Error("Script load failed — check your connection"));};
    document.head.appendChild(s);
  });
  return window[g];
}

// ── localStorage keys ─────────────────────────────────────────────────────────
const HIST_KEY         = "nw_ai_conv_list";
const msgKey           = id=>`nw_ai_msgs_${id}`;
const PROFILE_KEY      = "nw_ai_user_profile";
const INSTRUCTIONS_KEY = "nw_ai_instructions";
const LAST_CONV_KEY    = "nw_ai_last_conv";   // FIX 3: persist active conv across navigation/remounts
const RETENTION        = 7*24*60*60*1000;
// FIX 2: MAX_CONVS from 60 to 50
const MAX_CONVS        = 50;

function pruneOld(arr,field="updatedAt"){const c=Date.now()-RETENTION;return arr.filter(i=>new Date(i[field]).getTime()>c);}
// FIX 2: Filter out blank titles and conversations with no messages in saveHistory
function saveHistory(conversations){try{const pruned=pruneOld(conversations);const valid=pruned.filter(c=>c.title&&c.title.trim().length>0&&localStorage.getItem(msgKey(c.id)));const p=valid.slice(0,MAX_CONVS);localStorage.setItem(HIST_KEY,JSON.stringify(p));const live=new Set(p.map(c=>c.id));Object.keys(localStorage).filter(k=>k.startsWith("nw_ai_msgs_")).forEach(k=>{if(!live.has(k.replace("nw_ai_msgs_","")))localStorage.removeItem(k);});}catch{}}
// FIX 2: Filter out blank titles in loadHistory
function loadHistory(){try{const s=localStorage.getItem(HIST_KEY);if(!s)return[];return pruneOld(JSON.parse(s)).filter(c=>c.title&&c.title.trim().length>0).map(c=>({...c,updatedAt:new Date(c.updatedAt)}));}catch{return[];}}
function saveMsgs(convId,msgs){try{const t=msgs.filter(m=>!m.streaming).map(m=>({...m,timestamp:m.timestamp instanceof Date?m.timestamp.toISOString():m.timestamp,files:(m.files||[]).map(f=>({name:f.name,mediaType:f.mediaType,size:f.size})),artifact:m.artifact||null}));localStorage.setItem(msgKey(convId),JSON.stringify(t));}catch{}}
function loadMsgs(convId){try{const s=localStorage.getItem(msgKey(convId));if(!s)return[];return JSON.parse(s).map(m=>({...m,timestamp:new Date(m.timestamp)}));}catch{return[];}}
function groupByDate(convs){
  const today=new Date();today.setHours(0,0,0,0);
  const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
  const thisWeek=new Date(today);thisWeek.setDate(today.getDate()-7);
  const g={"Today":[],"Yesterday":[],"Earlier this week":[],"Last 7 days":[]};
  convs.forEach(c=>{const d=new Date(c.updatedAt);d.setHours(0,0,0,0);if(d>=today)g.Today.push(c);else if(d>=yesterday)g.Yesterday.push(c);else if(d>=thisWeek)g["Earlier this week"].push(c);else g["Last 7 days"].push(c);});
  return g;
}

// ── Artifacts ─────────────────────────────────────────────────────────────────
const ARTIFACT_TYPES={
  docx:{label:"Word Document",icon:"📝",ext:".doc",colour:"#2B579A"},
  xlsx:{label:"Excel Report",icon:"📊",ext:".xlsx",colour:"#217346"},
  pptx:{label:"Presentation",icon:"🖥️",ext:".pptx",colour:"#D24726"},
  image:{label:"Diagram / Image",icon:"🎨",ext:".svg",colour:"#7C2855"},
};
function parseArtifact(text){
  const m=text.match(/<<ARTIFACT_START>>([\s\S]*?)<<ARTIFACT_END>>/);if(!m)return null;
  const raw=m[1].trim();const svgMatch=raw.match(/"svg"\s*:\s*"([\s\S]*?)"(?=\s*[,}])/);
  if(svgMatch){try{return JSON.parse(raw);}catch{try{const w=raw.replace(/"svg"\s*:\s*"[\s\S]*?"(?=\s*[,}])/,'"svg":"__SVG__"');const obj=JSON.parse(w);obj.svg=svgMatch[1].replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\"/g,'"');return obj;}catch{return null;}}}
  try{return JSON.parse(raw);}catch{return null;}
}
function stripArtifact(t){
  // Strip complete artifact blocks
  let s = t.replace(/\n?<<ARTIFACT_START>>[\s\S]*?<<ARTIFACT_END>>\n?/g,"").trim();
  // Also strip incomplete artifact blocks (during streaming, END hasn't arrived yet)
  s = s.replace(/\n?<<ARTIFACT_START>>[\s\S]*$/g,"").trim();
  return s;
}
function hasArtifactStart(t){return t.includes("<<ARTIFACT_START>>");}
function hasArtifactEnd(t){return t.includes("<<ARTIFACT_END>>");}
function InlineArtifactCard({artifact,streaming,onOpen}){
  const t = artifact ? ARTIFACT_TYPES[artifact.type] : null;
  const typeLabel = t?.label || "Document";
  const typeIcon = t?.icon || "📄";
  const colour = t?.colour || "#005EB8";
  if(streaming && !artifact){
    // Streaming: we saw <<ARTIFACT_START>> but no <<ARTIFACT_END>> yet
    return(
      <div style={{background:"#fff",border:"1.5px solid #E8EDEE",borderLeft:`4px solid #005EB8`,borderRadius:8,padding:"14px 16px",margin:"10px 0",display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:"1.4rem",animation:"nwSpin .8s linear infinite",display:"inline-block"}}>📄</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:"0.84rem",color:"#003087"}}>Generating document…</div>
          <div style={{fontSize:"0.72rem",color:"#425563",marginTop:2}}>Building your document, please wait</div>
        </div>
        <span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:"#005EB8",animation:"nwBlink .8s step-end infinite"}}/>
      </div>
    );
  }
  if(!artifact) return null;
  return(
    <div onClick={()=>onOpen?.(artifact)} style={{background:"#fff",border:"1.5px solid "+colour+"33",borderLeft:"4px solid "+colour,borderRadius:8,padding:"14px 16px",margin:"10px 0",cursor:"pointer",transition:"all .17s"}}
      onMouseEnter={e=>{e.currentTarget.style.background=colour+"08";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,.08)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:"1.6rem"}}>{typeIcon}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:"0.84rem",color:colour}}>{artifact.title||"Document"}</div>
          <div style={{fontSize:"0.69rem",color:"#425563",marginTop:1}}>{artifact.filename||"document"}{t?.ext||""}</div>
          <div style={{fontSize:"0.69rem",color:"#8896A6",marginTop:2}}>{typeLabel} — ready to download</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={e=>{e.stopPropagation();onOpen?.(artifact);}} style={{background:colour,color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",cursor:"pointer",fontWeight:600,fontSize:"0.77rem",minHeight:34}}>⬇ Download</button>
          <button onClick={e=>{e.stopPropagation();onOpen?.(artifact);}} style={{background:"#F0F4F8",color:colour,border:`1.5px solid ${colour}33`,borderRadius:7,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:"0.77rem",minHeight:34}}>Preview</button>
        </div>
      </div>
    </div>
  );
}

function isSalutation(s){const sals=['mr','mrs','ms','miss','dr','prof','rev','sir','mx'];return sals.includes((s||'').trim().toLowerCase().replace(/\./g,''));}
async function generateDocxBlob(a, docSettings={}){
  const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const addrHtml = s => String(s||"").split(/\n/).map(l=>esc(l.trim())).filter(Boolean).join("<br>");

  const useLetterheadEarly = docSettings.useLetterhead !== false;
  const titleText = (a.title||"Document").trim().toLowerCase();
  let firstH1Skipped = false;
  const body = (a.sections||[]).map((s,si)=>{
    switch(s.type){
      case"h1":    if(useLetterheadEarly && !firstH1Skipped){firstH1Skipped=true; return"";} return`<h1>${esc(s.text)}</h1>`;
      case"h2":    return`<h2>${esc(s.text)}</h2>`;
      case"h3":    return`<h3>${esc(s.text)}</h3>`;
      case"p":     return`<p>${esc(s.text)}</p>`;
      case"bullets":  return`<ul>${(s.items||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`;
      case"numbered": return`<ol>${(s.items||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</ol>`;
      case"callout":
      case"callout_info": return`<div style="background:#EDF4FF;border-left:4px solid #005EB8;padding:8pt 12pt;margin:10pt 0"><p style="margin:0">${esc(s.text)}</p></div>`;
      case"callout_warning": return`<div style="background:#FFF8E1;border-left:4px solid #FFB81C;padding:8pt 12pt;margin:10pt 0"><p style="margin:0 0 4pt 0;font-weight:700;color:#7A5700">⚠ ${esc(s.title||"Important")}</p><p style="margin:0">${esc(s.text)}</p></div>`;
      case"callout_danger":  return`<div style="background:#FFF0F0;border-left:4px solid #DA291C;padding:8pt 12pt;margin:10pt 0"><p style="margin:0 0 4pt 0;font-weight:700;color:#B71C1C">🚨 ${esc(s.title||"Critical")}</p><p style="margin:0">${esc(s.text)}</p></div>`;
      case"callout_success": return`<div style="background:#E8F5E9;border-left:4px solid #009639;padding:8pt 12pt;margin:10pt 0"><p style="margin:0 0 4pt 0;font-weight:700;color:#1B5E20">✓ ${esc(s.title||"Note")}</p><p style="margin:0">${esc(s.text)}</p></div>`;
      case"table":{
        const cw = s.colWidths;
        const cg = cw?`<colgroup>${cw.map(w=>`<col style="width:${w}%">`).join("")}</colgroup>`:"";
        return`<table>${cg}<thead><tr>${(s.headers||[]).map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${(s.rows||[]).map((r,ri)=>{const hl=s.rowHighlights&&s.rowHighlights[String(ri)];const bg=hl==="warning"?' style="background:#FFF8E1"':hl==="danger"?' style="background:#FFF0F0"':hl==="success"?' style="background:#E8F5E9"':"";return`<tr${bg}>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`;}).join("")}</tbody></table>`;
      }
      case"hr":        return`<hr style="border:none;border-top:1.5px solid #C8D3DC;margin:16pt 0">`;
      case"pagebreak": return`<br style="page-break-before:always">`;
      case"recipient": return`<div style="margin:12pt 0 16pt 0"><p style="line-height:1.6;margin:0">${addrHtml(s.address)}</p>${s.salutation?`<p style="margin:14pt 0 0 0">${esc(s.salutation)}</p>`:""}</div>`;
      case"signature": return`<div style="margin:24pt 0 0 0"><p style="margin:0 0 24pt 0">${esc(s.closing||"Yours sincerely,")}</p><p style="margin:0;font-weight:700">${esc(s.name||a.meta?.author||"")}</p>${(s.jobTitle||a.meta?.jobTitle)?`<p style="margin:2pt 0 0 0;color:#005EB8">${esc(s.jobTitle||a.meta?.jobTitle||"")}</p>`:""}${(s.organisation||a.meta?.organisation)?`<p style="margin:2pt 0 0 0;color:#425563">${esc(s.organisation||a.meta?.organisation||"")}</p>`:""}</div>`;
      case"checklist": return`<table style="border:none;margin:10pt 0">${(s.items||[]).map(i=>{const txt=typeof i==="string"?i:i.text||i;const chk=typeof i==="object"&&i.checked;return`<tr><td style="border:none;width:20pt;vertical-align:top;padding:3pt 4pt;font-size:12pt">${chk?"☑":"☐"}</td><td style="border:none;vertical-align:top;padding:3pt 4pt">${esc(txt)}</td></tr>`;}).join("")}</table>`;
      case"doccontrol":{
        const fields=[["Document Title",esc(a.title||s.title||"")],["Version",esc(s.version||"1.0")],["Date",esc(s.date||new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}))],["Author",esc(s.author||a.meta?.author||"")],["Review Date",esc(s.reviewDate||"")],["Approved By",esc(s.approvedBy||"")],["Status",esc(s.status||"Draft")]].filter(([,v])=>v);
        return`<h2 style="font-size:13pt;color:#003087;margin-bottom:8pt">Document Control</h2><table style="width:60%;margin-bottom:16pt">${fields.map(([k,v])=>`<tr><td style="background:#005EB8;color:#fff;font-weight:700;padding:5pt 8pt;width:40%">${k}</td><td style="padding:5pt 8pt">${v}</td></tr>`).join("")}</table>`;
      }
      default: return"";
    }
  }).join("\n");

  const m = a.meta || {};
  const useLetterhead = docSettings.useLetterhead !== false;
  const showDocFooter = docSettings.showDocFooter !== false;
  const includeLogo = docSettings.includeLogoInDocx !== false;
  const includePracticeDetails = docSettings.includePracticeDetails !== false;

  let logoHtml = "";
  if(useLetterhead && includeLogo && m.logoUrl){
    try{
      const resp = await fetch(m.logoUrl);
      if(resp.ok){
        const blob = await resp.blob();
        // Resize logo to max 320px wide before embedding to keep file size small
        const resizedB64 = await new Promise((resolve, reject)=>{
          const reader = new FileReader();
          reader.onload = ()=>{
            const img = new Image();
            img.onload = ()=>{
              const MAX_W = 320, MAX_H = 96;
              let w = img.width, h = img.height;
              if(w > MAX_W || h > MAX_H){
                const scale = Math.min(MAX_W/w, MAX_H/h);
                w = Math.round(w*scale); h = Math.round(h*scale);
              }
              const c = document.createElement("canvas");
              c.width = w; c.height = h;
              const ctx = c.getContext("2d");
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              ctx.drawImage(img, 0, 0, w, h);
              resolve({dataUrl: c.toDataURL("image/png", 0.9), w, h});
            };
            img.onerror = ()=>reject(new Error("logo load failed"));
            img.src = reader.result;
          };
          reader.onerror = ()=>reject(reader.error);
          reader.readAsDataURL(blob);
        });
        // Use HTML width/height attributes (Word ignores CSS for images)
        const dispW = Math.min(resizedB64.w, 160);
        const dispH = Math.round((dispW / resizedB64.w) * resizedB64.h);
        logoHtml = `<img src="${resizedB64.dataUrl}" alt="${esc(m.organisation||"")}" width="${dispW}" height="${dispH}" style="height:${dispH}px;max-width:${dispW}px;object-fit:contain;display:block;margin-bottom:5pt"/>`;
      }
    }catch(e){console.warn("Logo embed failed:",e);}
  }

  const contactParts = [];
  if(m.phone)   contactParts.push(esc(m.phone));
  if(m.email)   contactParts.push(`<a href="mailto:${esc(m.email)}" style="color:#005EB8">${esc(m.email)}</a>`);
  if(m.website) contactParts.push(`<a href="${esc(m.website)}" style="color:#005EB8">${esc(m.website)}</a>`);
  const contactLine = contactParts.join("  &middot;  ");

  const addrHtml2 = m.address ? `<div style="font-size:9pt;color:#425563;line-height:1.5">${String(m.address).split(/\n/).map(l=>esc(l.trim())).filter(Boolean).join("<br>")}</div>` : "";

  const practiceBlock = includePracticeDetails ? `${logoHtml}<div style="font-size:13pt;font-weight:700;color:#003087;margin-bottom:2pt">${esc(m.organisation||"")}</div>${addrHtml2}${contactLine?`<div style="font-size:9pt;color:#425563;margin-top:3pt">${contactLine}</div>`:""}` : (includeLogo ? logoHtml : "");

  const letterhead = useLetterhead ? `<table style="width:100%;border-collapse:collapse;border:none;margin-bottom:12pt"><tr><td style="border:none;vertical-align:top;padding:0;width:60%">${practiceBlock}</td><td style="border:none;vertical-align:top;text-align:right;padding:0">${m.author?`<div style="font-size:9pt;color:#425563;margin-bottom:3pt">${esc(m.senderLabel||m.author)}</div>`:""}${m.jobTitle&&!isSalutation(m.jobTitle)?`<div style="font-size:9pt;color:#003087;font-weight:600">${esc(m.jobTitle)}</div>`:""}<div style="font-size:9pt;color:#888;margin-top:6pt">${m.date||new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div></td></tr></table><div style="border-top:2.5px solid #005EB8;margin-bottom:14pt"></div><h1 style="font-size:16pt;color:#003087;border:none;padding:0;margin-top:0">${esc(a.title||"Document")}</h1>` : `<h1>${esc(a.title||"Document")}</h1>`;

  const footer = showDocFooter
    ? `<div class="footer">${esc(m.author||"")}${m.jobTitle&&!isSalutation(m.jobTitle)?` &middot; ${esc(m.jobTitle)}`:""}${m.organisation?` &middot; ${esc(m.organisation)}`:""}${contactLine?`<br>${contactLine}`:""}<br>Generated by Notewell AI &middot; DCB0129/DCB0160 &middot; MHRA Class I &middot; ICO ZB226324 &middot; Always apply professional judgement.</div>`
    : "";

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>@page{margin:2cm}body{font-family:Arial,sans-serif;font-size:11pt;color:#231F20}h1{font-size:18pt;color:#003087;border-bottom:2px solid #005EB8;padding-bottom:4pt;margin-top:0}h2{font-size:14pt;color:#003087;margin-top:16pt}h3{font-size:12pt;color:#005EB8;margin-top:12pt}p{line-height:1.6;margin:6pt 0}ul,ol{margin:6pt 0;padding-left:24pt}li{margin:3pt 0;line-height:1.5}table{border-collapse:collapse;width:100%;margin:12pt 0}th{background:#005EB8;color:#fff;padding:6pt 8pt;font-size:10pt;text-align:left}td{border:1px solid #C8D3DC;padding:5pt 8pt;font-size:10pt;vertical-align:top}tr:nth-child(even) td{background:#F0F4F8}.footer{font-size:8pt;color:#999;border-top:1px solid #ddd;margin-top:24pt;padding-top:6pt}</style></head><body>${letterhead}${body}${footer}</body></html>`;

  return new Blob([html], {type:"application/msword"});
}
function generateXlsxBlob(a){
  const wb = XLSX.utils.book_new();
  const NHS_GREEN  = "217346";
  const NHS_LGREEN = "E8F5EC";
  const NHS_TOTAL  = "C6EFCE";
  const WHITE      = "FFFFFF";
  const BORDER     = { style:"thin", color:{ rgb:"C8D8C8" } };
  const cellBorder = { top:BORDER, bottom:BORDER, left:BORDER, right:BORDER };
  for(const sheet of (a.sheets||[])){
    const headers = sheet.headers || [];
    const dataRows = sheet.rows || [];
    const numRows = dataRows.length;
    const numCols = headers.length;
    // Build totals row if requested or if sheet has totalsRow flag
    let totalsRow = null;
    if(sheet.totalsRow && numRows > 0){
      totalsRow = headers.map((h,ci) => {
        // Sum numeric-looking columns
        const vals = dataRows.map(r => r[ci]);
        const allNum = vals.every(v => v === null || v === undefined || typeof v === "number");
        if(allNum && vals.some(v => typeof v === "number")){
          const col = XLSX.utils.encode_col(ci);
          return { f: `SUM(${col}2:${col}${numRows+1})` };
        }
        return ci === 0 ? "TOTALS" : "";
      });
    }
    // Build the AOA for aoa_to_sheet (headers + data rows only)
    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Style header row
    for(let ci = 0; ci < numCols; ci++){
      const addr = XLSX.utils.encode_cell({ r:0, c:ci });
      if(!ws[addr]) ws[addr] = { v: headers[ci], t:"s" };
      ws[addr].s = {
        font:  { bold:true, color:{ rgb:WHITE }, name:"Calibri", sz:10 },
        fill:  { fgColor:{ rgb:NHS_GREEN }, patternType:"solid" },
        alignment: { horizontal:"left", vertical:"center", wrapText:true },
        border: cellBorder,
      };
    }
    // Style data rows + apply number formats
    for(let ri = 0; ri < numRows; ri++){
      for(let ci = 0; ci < numCols; ci++){
        const addr = XLSX.utils.encode_cell({ r:ri+1, c:ci });
        if(!ws[addr]) continue;
        const raw = dataRows[ri][ci];
        const isEven = ri % 2 === 0;
        const cellStyle = {
          font: { name:"Calibri", sz:10 },
          fill: { fgColor:{ rgb: isEven ? WHITE : "F0F8F0" }, patternType:"solid" },
          alignment: { vertical:"center", wrapText:false },
          border: cellBorder,
        };
        const hdr = (headers[ci]||"").toLowerCase();
        const isCurrency = /£|cost|amount|pay|salary|rate|fee|budget|spend|price/.test(hdr);
        const isPct      = /%|percent|proportion/.test(hdr);
        const isDate     = /date/.test(hdr);
        if(isCurrency && typeof raw === "number"){
          cellStyle.numFmt = '"£"#,##0.00';
          ws[addr].t = "n";
        } else if(isPct && typeof raw === "number"){
          cellStyle.numFmt = '0.00"%"';
          ws[addr].t = "n";
        } else if(isDate && typeof raw === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)){
          cellStyle.alignment.horizontal = "center";
        } else if(typeof raw === "number"){
          cellStyle.numFmt = "#,##0.00";
          ws[addr].t = "n";
        }
        ws[addr].s = cellStyle;
      }
    }
    // Inject formula cells from the formulas array
    if(sheet.formulas && Array.isArray(sheet.formulas)){
      for(const f of sheet.formulas){
        if(!f.cell || !f.formula) continue;
        ws[f.cell] = {
          t: "n",
          f: f.formula.replace(/^=/, ""),
          s: {
            font: { name:"Calibri", sz:10, bold: f.bold||false },
            fill: { fgColor:{ rgb: f.highlight ? "FFF2CC" : WHITE }, patternType:"solid" },
            numFmt: f.numFmt || (f.formula.toLowerCase().includes("sum") ? '"£"#,##0.00' : "General"),
            border: cellBorder,
          }
        };
      }
    }
    // Append totals row at the bottom
    if(totalsRow){
      const totalsRowIndex = numRows + 1;
      totalsRow.forEach((val, ci) => {
        const addr = XLSX.utils.encode_cell({ r: totalsRowIndex, c: ci });
        const isFormulaCell = val && typeof val === "object" && val.f;
        ws[addr] = isFormulaCell
          ? { t:"n", f: val.f, s:{
              font:{ bold:true, name:"Calibri", sz:10 },
              fill:{ fgColor:{ rgb:NHS_TOTAL }, patternType:"solid" },
              numFmt:'"£"#,##0.00',
              border:cellBorder,
            }}
          : { t:"s", v: val||"", s:{
              font:{ bold:true, name:"Calibri", sz:10 },
              fill:{ fgColor:{ rgb:NHS_TOTAL }, patternType:"solid" },
              border:cellBorder,
            }};
      });
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      range.e.r = totalsRowIndex;
      ws["!ref"] = XLSX.utils.encode_range(range);
    }
    // Column widths
    if(sheet.columnWidths){
      ws["!cols"] = sheet.columnWidths.map(w => ({ wch: w }));
    }
    // Freeze top row
    ws["!freeze"] = { xSplit:0, ySplit:1, topLeftCell:"A2", activePane:"bottomLeft", state:"frozen" };
    // Autofilter on header row
    const lastCol = XLSX.utils.encode_col(numCols - 1);
    const lastDataRow = numRows + 1;
    ws["!autofilter"] = { ref: `A1:${lastCol}${lastDataRow}` };
    // Row height for header
    ws["!rows"] = [{ hpt: 20 }, ...Array(numRows).fill({ hpt: 16 })];
    XLSX.utils.book_append_sheet(wb, ws, sheet.name || "Sheet1");
  }
  return new Blob(
    [XLSX.write(wb, { bookType:"xlsx", type:"array", cellStyles:true })],
    { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );
}
async function generatePptxBlob(a){
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  const DARK = "003087", MID = "005EB8", WHITE = "FFFFFF", GREY = "425563";
  (a.slides || []).forEach((slide, idx) => {
    const s = pptx.addSlide();
    const dark = idx === 0 || idx === (a.slides.length - 1);
    s.background = { fill: dark ? DARK : WHITE };
    // Top accent bar
    s.addShape('rect', { x:0, y:0, w:"100%", h:0.08, fill:{color:MID}, line:{type:"none"} });
    // Footer bar
    s.addShape('rect', { x:0, y:6.9, w:"100%", h:0.25, fill:{color:dark?"002060":"F0F4F8"}, line:{type:"none"} });
    s.addText("Notewell AI · DCB0129/DCB0160 · NHS Primary Care", {
      x:0.3, y:6.92, w:9, h:0.18,
      fontSize:7, color:dark?"6699CC":GREY, fontFace:"Arial", italic:true
    });
    s.addText(`${idx+1}/${a.slides.length}`, {
      x:9.5, y:6.92, w:0.8, h:0.18,
      fontSize:7, color:dark?"6699CC":GREY, fontFace:"Arial", align:"right"
    });
    const TC = dark ? WHITE : DARK;
    switch(slide.layout){
      case "title":
        s.addShape('rect', { x:0.5,y:1.5,w:9.3,h:3.8, fill:{color:"002060"}, line:{color:"41B6E6",pt:1}, rounding:true });
        s.addText(slide.title||"", { x:0.8,y:1.9,w:8.7,h:1.8, fontSize:38,bold:true,color:WHITE,fontFace:"Arial Black",align:"center",valign:"middle",wrap:true });
        if(slide.subtitle) s.addText(slide.subtitle, { x:0.8,y:3.7,w:8.7,h:0.9, fontSize:16,color:"41B6E6",fontFace:"Arial",align:"center",wrap:true });
        if(slide.meta) s.addText(slide.meta, { x:0.8,y:5.4,w:8.7,h:0.6, fontSize:11,color:"8899AA",fontFace:"Arial",align:"center" });
        break;
      case "stat":
        s.addText(slide.title||"", { x:0.4,y:0.15,w:9.5,h:0.7, fontSize:26,bold:true,color:TC,fontFace:"Arial Black",wrap:true });
        s.addShape('rect', { x:0.4,y:0.9,w:9.5,h:0.03, fill:{color:MID},line:{type:"none"} });
        const stats = slide.stats || [];
        const cw = 9.4 / Math.max(stats.length, 1);
        stats.forEach((st, i) => {
          const x = 0.4 + i * cw;
          s.addShape('rect', { x:x+0.1,y:1.1,w:cw-0.2,h:4.0, fill:{color:dark?"002060":"EDF4FF"}, line:{color:MID,pt:1}, rounding:true });
          s.addText(st.value||"", { x:x+0.1,y:1.5,w:cw-0.2,h:1.8, fontSize:52,bold:true,color:MID,fontFace:"Arial Black",align:"center",valign:"middle" });
          s.addText(st.label||"", { x:x+0.1,y:3.3,w:cw-0.2,h:0.8, fontSize:12,color:dark?WHITE:GREY,fontFace:"Arial",align:"center",wrap:true });
        });
        break;
      case "two-col":
        s.addText(slide.title||"", { x:0.4,y:0.15,w:9.5,h:0.75, fontSize:26,bold:true,color:TC,fontFace:"Arial Black",wrap:true });
        s.addShape('rect', { x:0.4,y:0.95,w:9.5,h:0.03, fill:{color:MID},line:{type:"none"} });
        ["left","right"].forEach((side,i) => {
          const col = slide[side] || {};
          const xOff = i === 0 ? 0.4 : 5.2;
          if(col.heading){
            s.addShape('rect', { x:xOff,y:1.1,w:4.4,h:0.4, fill:{color:MID},line:{type:"none"},rounding:true });
            s.addText(col.heading, { x:xOff+0.1,y:1.12,w:4.2,h:0.36, fontSize:12,bold:true,color:WHITE,fontFace:"Arial",valign:"middle" });
          }
          if(col.bullets?.length){
            s.addText(
              col.bullets.map(b => ({ text:"  "+b, options:{ bullet:{type:"bullet",code:"2022",color:MID}, fontSize:12, color:dark?WHITE:"231F20", fontFace:"Arial", paraSpaceAfter:5 }})),
              { x:xOff, y:1.6, w:4.4, h:5, wrap:true, valign:"top" }
            );
          }
        });
        s.addShape('rect', { x:4.95,y:1.0,w:0.03,h:5.8, fill:{color:"DDDDDD"},line:{type:"none"} });
        break;
      default: {
        // Title
        s.addText(slide.title||"", { x:0.4,y:0.2,w:9.5,h:0.8, fontSize:28,bold:true,color:TC,fontFace:"Arial Black",wrap:true });
        // Separator bar under title
        s.addShape('rect', { x:0.4,y:1.06,w:9.5,h:0.03, fill:{color:MID},line:{type:"none"} });
        if(slide.bullets?.length){
          const count = slide.bullets.length;
          // Dynamic font size — fewer bullets = bigger, more bullets = smaller
          const fontSize =
            count <= 2 ? 20 :
            count === 3 ? 17 :
            count === 4 ? 15 :
            count <= 6 ? 13 : 11;
          // Dynamic paragraph spacing — fewer bullets = more air
          const paraSpaceAfter =
            count <= 2 ? 20 :
            count === 3 ? 14 :
            count === 4 ? 10 :
            count <= 6 ? 6 : 4;
          // Content starts slightly lower for breathing room after separator
          const contentY = 1.22;
          s.addText(
            slide.bullets.map((b, bi) => ({
              text: "  " + b,
              options: {
                bullet: { type:"bullet", code:"2022", color:MID },
                // First bullet is slightly larger and bold — acts as a lead statement
                fontSize: bi === 0 && count >= 2 ? fontSize + 2 : fontSize,
                bold: bi === 0 && count >= 2,
                color: dark ? WHITE : (bi === 0 ? DARK : "231F20"),
                fontFace: "Arial",
                paraSpaceAfter,
              }
            })),
            { x:0.4, y:contentY, w:9.4, h:5.5, fontFace:"Arial", wrap:true, valign:"top" }
          );
        } else if(slide.body){
          s.addText(slide.body, { x:0.4,y:1.25,w:9.4,h:5.5, fontSize:14,color:dark?WHITE:"231F20",fontFace:"Arial",wrap:true,valign:"top" });
        }
        break;
      }
    }
    // Speaker notes — wire up if the AI provides them
    if(slide.notes){
      s.addNotes(slide.notes);
    }
  });
  return new Blob(
    [await pptx.write({ outputType:"arraybuffer" })],
    { type:"application/vnd.openxmlformats-officedocument.presentationml.presentation" }
  );
}
function downloadSvg(a){triggerDownload(new Blob([a.svg],{type:"image/svg+xml"}),(a.filename||"diagram")+".svg");}
async function downloadPng(a){
  const svgStr=a.svg||"";
  let w=800,h=500;
  const vb=svgStr.match(/viewBox=["']([^"']+)["']/);if(vb){const p=vb[1].trim().split(/[\s,]+/);if(p.length>=4){w=parseFloat(p[2])||800;h=parseFloat(p[3])||500;}}
  const wM=svgStr.match(/\swidth=["'](\d+(?:\.\d+)?)["']/);const hM=svgStr.match(/\sheight=["'](\d+(?:\.\d+)?)["']/);
  if(wM&&!svgStr.match(/width=["']100%["']/))w=parseFloat(wM[1])||w;
  if(hM&&!svgStr.match(/height=["']100%["']/))h=parseFloat(hM[1])||h;
  const svgE=svgStr.replace(/<svg([^>]*)>/,(_,attrs)=>{const c=attrs.replace(/\s+width=["'][^"']*["']/g,"").replace(/\s+height=["'][^"']*["']/g,"");return`<svg${c} width="${w}" height="${h}">`;});
  return new Promise((resolve,reject)=>{
    let encoded;try{encoded=btoa(unescape(encodeURIComponent(svgE)));}catch(e){try{encoded=btoa(svgE);}catch(e2){reject(new Error("SVG encoding failed"));return;}}
    const img=new Image();
    img.onload=()=>{const sc=2;const cv=document.createElement("canvas");cv.width=w*sc;cv.height=h*sc;const ctx=cv.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(sc,sc);ctx.drawImage(img,0,0,w,h);cv.toBlob(blob=>{if(blob){triggerDownload(blob,(a.filename||"diagram")+".png");resolve();}else reject(new Error("PNG generation failed — try SVG instead"));},"image/png");};
    img.onerror=()=>reject(new Error("Could not render SVG — try SVG download instead"));
    img.src=`data:image/svg+xml;base64,${encoded}`;
  });
}

// ── Runware image detection (FIX 6) ───────────────────────────────────────────
const IMAGE_GEN_PATTERNS = [
  /generate\s+(?:an?\s+)?image/i,
  /create\s+(?:an?\s+)?photo/i,
  /make\s+(?:an?\s+)?picture/i,
  // Narrowed: only match "draw" when followed by visual content words
  // Prevents false positives on "draw up minutes", "draw blood", "draw a conclusion"
  /\bdraw\s+(?:an?\s+)?(?:image|picture|sketch|illustration|portrait|logo|icon|banner|poster|graphic)\b/i,
  // Narrowed: only match "illustrate" when it refers to an actual image
  /\billustrate\s+(?:this\s+)?(?:with\s+)?(?:an?\s+)?(?:image|picture|diagram|visual|graphic)\b/i,
  /\bAI\s+image\s+of\b/i,
  /\bimage\s+of\b/i,
  /\bphoto\s+of\b/i,
  /create\s+(?:an?\s+)?image/i,
  /show\s+me\s+(?:an?\s+)?picture/i,
  /generate\s+(?:an?\s+)?picture/i,
];
const DIAGRAM_PATTERNS = [/\bdiagram\b/i, /\bflowchart\b/i, /\bchart\b/i, /\bprocess\s+map\b/i, /\binfographic\b/i];
function isRunwareImageRequest(text) {
  if (DIAGRAM_PATTERNS.some(p => p.test(text))) return false;
  return IMAGE_GEN_PATTERNS.some(p => p.test(text));
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(user,settings,userProfile,customInstructions){
  const rawJT=user.jobTitle||'';const SALS=['mr','mrs','ms','miss','dr','prof','rev','sir','mx'];const isSal=SALS.includes(rawJT.trim().toLowerCase().replace(/\./g,''));const resolvedJobTitle=isSal?(user.role||''):(rawJT||user.role||'');const salPrefix=isSal?rawJT.trim()+' ':'';const authorName=salPrefix+user.name;
  const ctx=settings.includeUserContext?`
USER CONTEXT (personalise all responses with this):
- Name: ${authorName}${resolvedJobTitle?` | Role / Job Title: ${resolvedJobTitle}`:""}
- Practice/PCN: ${user.practice.name} (ODS: ${user.practice.odsCode||""})${user.practice.address?`\n  - Address: ${user.practice.address}`:""}${user.practice.phone?`\n  - Phone: ${user.practice.phone}`:""}${user.practice.email?`\n  - Email: ${user.practice.email}`:""}${user.practice.website?`\n  - Website: ${user.practice.website}`:""}
- Neighbourhood: ${user.neighbourhood||""} | ICB: ${user.icb||""}
- Clinical system: ${user.practice.clinicalSystem||""}
Use the practice name in drafted documents automatically.`:"";
  const extraProfile=userProfile?.trim()?`\n\nADDITIONAL USER CONTEXT (user-provided — treat as authoritative):\n${userProfile.trim()}`:"";
  const instructions=customInstructions?.trim()?`\n\nCUSTOM INSTRUCTIONS (follow in every response):\n${customInstructions.trim()}`:"";
  return `You are Notewell AI Assistant — an NHS-grade clinical AI for primary care professionals.
${ctx}${extraProfile}${instructions}

TONE: ${settings.tone==="clinical"?"Precise clinical language.":settings.tone==="conversational"?"Plain conversational English.":"Clear professional NHS standard."}
LENGTH: ${settings.responseLength==="concise"?"Brief, bullet-focused.":settings.responseLength==="detailed"?"Comprehensive with full context.":"Thorough but efficient."}

GUARDRAILS (mandatory — never override):
- Never reproduce real patient PII/PHI. If detected, stop and ask the user to anonymise it.
- Never give definitive clinical diagnoses — always caveat clinical thinking.
- Always recommend clinical oversight for outputs used in patient care.
- Safeguarding: always recommend immediate escalation.
- Medication dosing: always recommend BNF/local formulary verification.
- In all documents and letters, ${resolvedJobTitle?`use the user's actual Role ("${resolvedJobTitle}") in sign-offs.`:"omit job title from sign-offs if not known."} Never use placeholder text like [Your Job Title], [Job Title], [Role], or [Title].

ARTIFACT GENERATION — Word docs, Excel, PowerPoint, diagrams:
Give 1-2 sentence confirmation then append:
<<ARTIFACT_START>>
{ ...valid JSON only... }
<<ARTIFACT_END>>

DOCX: {"type":"docx","title":"...","filename":"kebab","meta":{"author":"${authorName}","jobTitle":"${resolvedJobTitle||""}","organisation":"${user.practice.name}","address":"${user.practice.address||""}","phone":"${user.practice.phone||""}","email":"${user.practice.email||""}","website":"${user.practice.website||""}","logoUrl":"${user.practice.logoUrl||""}","senderLabel":"${authorName}","date":"${new Date().toLocaleDateString("en-GB")}"},"sections":[{"type":"doccontrol","version":"1.0","reviewDate":"...","approvedBy":"...","status":"Draft"},{"type":"recipient","address":"Name\\nTitle\\nOrganisation\\nAddress","salutation":"Dear Dr Smith,"},{"type":"h1","text":"..."},{"type":"h2","text":"..."},{"type":"h3","text":"..."},{"type":"p","text":"..."},{"type":"bullets","items":["..."]},{"type":"numbered","items":["..."]},{"type":"checklist","items":[{"text":"Item one","checked":false},{"text":"Item two","checked":true}]},{"type":"callout_info","text":"..."},{"type":"callout_warning","title":"Important","text":"..."},{"type":"callout_danger","title":"Critical","text":"..."},{"type":"callout_success","title":"Good practice","text":"..."},{"type":"table","headers":["A","B","C"],"rows":[["val","val","val"]],"colWidths":[40,30,30],"rowHighlights":{"0":"warning"}},{"type":"hr"},{"type":"signature","closing":"Yours sincerely,","name":"...","jobTitle":"...","organisation":"..."},{"type":"pagebreak"}]}
Always use meta.jobTitle for the author role in sign-offs. Never write placeholder text like [Your Job Title], [Job Title], [Role], or [Title] — the real values are always provided in meta.
DOCX RULES:
- For formal letters: always include a recipient block, then body sections, then a signature block at the end
- For policies and SOPs: start with a doccontrol block showing version, review date and status
- For clinical guidelines: use callout_danger for contraindications, callout_warning for cautions, callout_success for recommended actions
- Use h3 for sub-sections within an h2 section — three heading levels are supported
- Use checklist for any compliance checklist, induction plan, or audit form
- Use colWidths on tables when columns have naturally different content widths (e.g. [40,20,20,20])
XLSX: {"type":"xlsx","title":"...","filename":"kebab","sheets":[{"name":"Sheet1","headers":["Col A","Col B","Cost (£)"],"rows":[["data","data",1500],["data","data",null]],"columnWidths":[25,20,14],"formulas":[{"cell":"C3","formula":"=SUM(C2:C2)","numFmt":"\\"£\\"#,##0.00"}],"totalsRow":true}]}
XLSX RULES:
- For calculated cells, put null in rows and add a formula entry instead
- Use formulas for: SUM totals, running totals, COUNTIF counts, IF status checks, VLOOKUP lookups, percentage calculations, date differences with DATEDIF, weighted averages
- For currency columns name headers with £ or "cost/amount/pay/salary/rate/fee/budget" — they auto-format as £
- For percentage columns name headers with "%" or "percent" — they auto-format as %
- Set totalsRow:true on any sheet with numeric columns — it adds a SUM row automatically
- Always provide columnWidths — aim for 12-25 characters depending on content
- Use multiple sheets when data naturally separates (e.g. Summary + Detail + Lookup tabs)
- For VLOOKUP: source data goes on a lookup sheet, formulas reference it cross-sheet e.g. =VLOOKUP(A2,Lookup!A:B,2,FALSE)
PPTX: {"type":"pptx","title":"...","filename":"kebab","meta":{"author":"${user.name}","organisation":"${user.practice.name}"},"slides":[{"layout":"title","title":"...","subtitle":"...","meta":"${user.practice.name}"},{"layout":"content","title":"...","bullets":["..."],"notes":"speaker notes here"},{"layout":"two-col","title":"...","left":{"heading":"...","bullets":[]},"right":{"heading":"...","bullets":[]}},{"layout":"stat","title":"...","stats":[{"value":"...","label":"..."}]}]}
PPTX RULES:
- Maximum 4 bullets per content slide — split into multiple slides if more content
- Fewer bullets = bigger, bolder text — aim for 3-4 per slide for best visual impact
- Always add a "notes" field on each content slide with presenter talking points
- Use "stat" layout for slides with 2-4 key numbers/metrics
- Use "two-col" layout for comparisons, before/after, pros/cons
- First and last slides auto-render as dark NHS navy — always use "title" layout for slide 1
IMAGE: {"type":"image","title":"...","filename":"kebab","alt":"description","svg":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 500' width='800' height='500'>...</svg>"}
SVG colours: #003087 #005EB8 #0072CE #41B6E6 #009639 #DA291C #FFB81C. No JS. Escape quotes as \\".

LOCAL NORTHAMPTONSHIRE GUIDANCE — whenever you recommend checking local guidance, always include the relevant URL as a markdown link inline:
- Primary Care Portal: [Northamptonshire Primary Care Portal](https://www.icnorthamptonshire.org.uk/primarycareportal/)
- Northamptonshire Formulary: [Northamptonshire Formulary](https://www.icnorthamptonshire.org.uk/primarycareportal/)
- ICB Main Site: [ICB Northamptonshire](https://www.icnorthamptonshire.org.uk)
- Individual Funding Requests: [IFR Process](https://www.icnorthamptonshire.org.uk/ifr)
- Weight Management / GLP-1: [Tirzepatide / GLP-1 Guidance](https://www.icnorthamptonshire.org.uk/tirzepatide)
- ADHD / Autism: [ADHD & Autism Pathway](https://www.icnorthamptonshire.org.uk/autism-adhd)
- OpenPrescribing Northants: [OpenPrescribing ICB QPM](https://openprescribing.net/icb/QPM/)
- BNF Online: [BNF](https://bnf.nice.org.uk/)
- NICE CKS: [NICE CKS](https://cks.nice.org.uk/)
- MHRA Drug Safety: [MHRA Drug Safety Updates](https://www.gov.uk/drug-safety-update)
Always format URLs as markdown links: [Label](URL)`;
}

function renderMd(t){
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/`([^`]+)`/g,`<code style="background:#eef2f7;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:.87em">$1</code>`)
    .replace(/^### (.+)$/gm,`<h3 style="font-size:.94em;font-weight:700;margin:9px 0 3px;color:#003087">$1</h3>`)
    .replace(/^## (.+)$/gm,`<h2 style="font-size:1.04em;font-weight:700;margin:12px 0 4px;color:#003087">$1</h2>`)
    .replace(/^# (.+)$/gm,`<h1 style="font-size:1.14em;font-weight:700;margin:13px 0 5px;color:#003087">$1</h1>`)
    .replace(/^\s*[-*] (.+)$/gm,`<li style="margin:2px 0;padding-left:2px">$1</li>`)
    .replace(/^\d+\. (.+)$/gm,`<li style="margin:2px 0">$1</li>`)
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g,m=>`<ul style="padding-left:18px;margin:6px 0">${m}</ul>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#005EB8;text-decoration:underline">$1</a>')
    .replace(/\n{2,}/g,"</p><p style='margin:6px 0'>").replace(/\n/g,"<br>");
}

// ── Profile & Instructions Modal ──────────────────────────────────────────────
const PROFILE_SUGGESTIONS=[
  "I primarily focus on Enhanced Access and ARRS workforce planning.",
  "I work mainly in SystmOne and prefer SystmOne-specific guidance.",
  "I have a clinical background — include clinical detail where relevant.",
  "I manage both EMIS and SystmOne practices across the PCN.",
  "I'm the lead for digital transformation and prefer tech-forward solutions.",
  "I work closely with community nursing and social prescribing teams.",
  "I cover multiple PCNs and need responses applicable across practices.",
  "I'm new to NHS primary care management — keep jargon to a minimum.",
];
const INSTRUCTION_SUGGESTIONS=[
  "Always end documents with a clear 'Next Steps / Actions' section.",
  "Format letters with a reference number at the top (e.g. REF: BTL-2026-001).",
  "Keep responses concise — I prefer bullet points over long paragraphs.",
  "Always include a 'Key Risks' section in governance or board documents.",
  "When drafting emails, include a brief subject line suggestion.",
  "Use plain English — avoid jargon wherever possible.",
  "Include relevant NHS policy or contract references where applicable.",
  "Flag anything needing clinical sign-off with a ⚕️ symbol.",
  "Present information in tables rather than prose where possible.",
  "Start every response with a one-sentence summary before the detail.",
];

function UserProfileModal({user,onClose,vp,onNavigateHome,initialTab="profile",settings=DEFAULT_SETTINGS,saveSettings}){
  const [tab,setTab]=useState(initialTab);
  const [pt,setPt]=useState(()=>{try{return localStorage.getItem(PROFILE_KEY)||"";}catch{return "";}});
  const [it,setIt]=useState(()=>{try{return localStorage.getItem(INSTRUCTIONS_KEY)||"";}catch{return "";}});
  const [saved,setSaved]=useState(false);
  const [kbDocs,setKbDocs]=useState([]);
  const [kbLoading,setKbLoading]=useState(false);
  const [kbCategories,setKbCategories]=useState([]);
  const [kbSearch,setKbSearch]=useState("");
  const isMobile=vp==="mobile";
  const save=()=>{try{localStorage.setItem(PROFILE_KEY,pt);localStorage.setItem(INSTRUCTIONS_KEY,it);setSaved(true);setTimeout(()=>{setSaved(false);onClose();},900);}catch{alert("Could not save — storage may be full.");}};
  const append=(setter,cur,text)=>setter(cur+(cur.trim()?"\n":"")+text);
  const autoSummary=[user.name&&`Name: ${user.name}`,user.role&&`Role: ${user.role}`,user.practice?.name&&`Practice: ${user.practice.name}`,user.practice?.odsCode&&`ODS: ${user.practice.odsCode}`,user.practice?.clinicalSystem&&`System: ${user.practice.clinicalSystem}`,user.pcn&&`PCN: ${user.pcn}`,user.neighbourhood&&`Neighbourhood: ${user.neighbourhood}`,user.icb&&`ICB: ${user.icb}`].filter(Boolean);

  // Load KB docs when tab selected
  useEffect(()=>{
    if(tab!=="kb")return;
    setKbLoading(true);
    const loadKB=async()=>{
      try{
        const [catsRes,docsRes]=await Promise.all([
          supabase.from("kb_categories").select("*").order("sort_order"),
          supabase.from("kb_documents").select("*, kb_categories(*)").eq("is_active",true).eq("status","indexed").order("uploaded_at",{ascending:false}).limit(50)
        ]);
        if(catsRes.data)setKbCategories(catsRes.data);
        if(docsRes.data)setKbDocs(docsRes.data);
      }catch(e){console.error("KB load error:",e);}
      setKbLoading(false);
    };
    loadKB();
  },[tab]);

  const filteredKb=kbSearch.trim()?kbDocs.filter(d=>d.title.toLowerCase().includes(kbSearch.toLowerCase())||d.summary?.toLowerCase().includes(kbSearch.toLowerCase())):kbDocs;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",padding:isMobile?0:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:isMobile?"100%":600,maxHeight:isMobile?"92dvh":"88vh",background:"#fff",borderRadius:isMobile?"20px 20px 0 0":16,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 -4px 40px rgba(0,0,0,0.18)",animation:"nwSlideUp .25s ease"}}>
        {isMobile&&<div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px",background:"#fff",flexShrink:0}}><div style={{width:40,height:4,borderRadius:2,background:"#D1D5DB"}}/></div>}
        <div style={{padding:"14px 20px 12px",background:"linear-gradient(135deg,#003087,#005EB8)",color:"#fff",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontWeight:900,fontSize:"1rem",color:"#fff",letterSpacing:"-.01em"}}>Notewell</div>
              <div style={{width:1,height:16,background:"rgba(255,255,255,.3)"}}/>
              <div>
                <div style={{fontWeight:700,fontSize:"1rem"}}>My Profile &amp; Instructions</div>
                <div style={{fontSize:"0.72rem",opacity:.7}}>Saved to this browser · {user.practice.shortName}</div>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",color:"#fff",borderRadius:8,padding:"8px 12px",fontSize:"1rem",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {[["profile","👤 My Profile"],["instructions","⚙️ Instructions"],["kb","📚 Knowledge Base"],["documents","📄 Documents"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",border:"none",cursor:"pointer",borderRadius:20,fontSize:"0.77rem",fontWeight:tab===t?700:400,background:tab===t?"rgba(255,255,255,.25)":"transparent",color:"#fff",minHeight:36}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"16px 20px"}}>
          {tab==="profile"&&(
            <div>
              <div style={{background:"#F0F4F8",borderRadius:10,padding:"11px 14px",marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:"0.79rem",color:"#003087",marginBottom:7,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{background:"#005EB8",color:"#fff",borderRadius:4,padding:"1px 7px",fontSize:"0.66rem"}}>AUTO</span>
                  Loaded from your Notewell account
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"3px 14px"}}>
                  {autoSummary.map((l,i)=><span key={i} style={{fontSize:"0.76rem",color:"#425563",lineHeight:1.7}}>✓ {l}</span>)}
                </div>
                <p style={{fontSize:"0.7rem",color:"#425563",margin:"8px 0 0",fontStyle:"italic"}}>To update these, edit your Notewell account profile.</p>
              </div>
              <label style={{fontWeight:700,fontSize:"0.84rem",color:"#003087",display:"block",marginBottom:5}}>Additional context</label>
              <p style={{fontSize:"0.77rem",color:"#425563",margin:"0 0 8px",lineHeight:1.55}}>Tell the AI anything extra about your role or focus areas.</p>
              <textarea value={pt} onChange={e=>setPt(e.target.value.slice(0,1000))} placeholder={"• I primarily focus on Enhanced Access and ARRS workforce planning\n• I have a clinical background — include clinical detail where relevant"} rows={4} style={{width:"100%",border:"1.5px solid #E8EDEE",borderRadius:9,padding:"10px 12px",fontSize:"16px",color:"#231F20",lineHeight:1.6,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#0072CE"} onBlur={e=>e.target.style.borderColor="#E8EDEE"}/>
              <div style={{textAlign:"right",fontSize:"0.66rem",color:pt.length>900?"#DA291C":"#425563",marginTop:3,marginBottom:12}}>{pt.length} / 1000</div>
              <div style={{fontWeight:700,fontSize:"0.77rem",color:"#003087",marginBottom:7}}>💡 Quick-add</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {PROFILE_SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>append(setPt,pt,s)} style={{background:"#EDF4FF",border:"1.5px solid #005EB833",borderRadius:20,padding:"6px 11px",cursor:"pointer",fontSize:"0.72rem",color:"#003087",lineHeight:1.4,minHeight:36}} onMouseEnter={e=>e.currentTarget.style.background="#D5E8FF"} onMouseLeave={e=>e.currentTarget.style.background="#EDF4FF"}>+ {s.length>46?s.slice(0,46)+"…":s}</button>)}
              </div>
              {/* Role pill visibility toggles */}
              <div style={{marginTop:18}}>
                <div style={{fontWeight:700,fontSize:"0.84rem",color:"#003087",marginBottom:5}}>Role pills</div>
                <p style={{fontSize:"0.77rem",color:"#425563",margin:"0 0 10px",lineHeight:1.55}}>Choose which role pills appear on the welcome screen.</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {Object.keys(DEFAULT_SETTINGS.visibleRoles).map(role=>{
                    const on=settings.visibleRoles?.[role]!==false;
                    return(
                      <div key={role} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:on?"#F0F8FF":"#F9FAFB",border:"1.5px solid "+(on?"#005EB833":"#E8EDEE"),borderRadius:10,minHeight:42}}>
                        <span style={{fontSize:"0.79rem",fontWeight:600,color:on?"#003087":"#999"}}>{({"Practice Manager":"🗂️","GP Partner":"🩺","Admin / Reception":"📋","PCN Manager":"🏥","Ageing Well":"🧓"})[role]||"💼"} {role}</span>
                        <button onClick={()=>{const vr={...DEFAULT_SETTINGS.visibleRoles,...settings.visibleRoles,[role]:!on};saveSettings({visibleRoles:vr});}} style={{width:42,height:24,borderRadius:12,border:"none",cursor:"pointer",background:on?"#005EB8":"#D1D5DB",position:"relative",transition:"background .2s",flexShrink:0}}>
                          <span style={{position:"absolute",top:2,left:on?20:2,width:20,height:20,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,.2)",transition:"left .2s"}}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {tab==="instructions"&&(
            <div>
              <label style={{fontWeight:700,fontSize:"0.84rem",color:"#003087",display:"block",marginBottom:5}}>Custom instructions</label>
              <p style={{fontSize:"0.77rem",color:"#425563",margin:"0 0 8px",lineHeight:1.55}}>How should the AI respond? Formatting, structure, always/never rules.</p>
              <textarea value={it} onChange={e=>setIt(e.target.value.slice(0,1000))} placeholder={"• Always end documents with a 'Next Steps / Actions' section\n• Keep responses concise — bullet points over paragraphs\n• Format letters with a reference number at the top"} rows={5} style={{width:"100%",border:"1.5px solid #E8EDEE",borderRadius:9,padding:"10px 12px",fontSize:"16px",color:"#231F20",lineHeight:1.6,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#0072CE"} onBlur={e=>e.target.style.borderColor="#E8EDEE"}/>
              <div style={{textAlign:"right",fontSize:"0.66rem",color:it.length>900?"#DA291C":"#425563",marginTop:3,marginBottom:it.trim()?8:12}}>{it.length} / 1000</div>
              {it.trim()&&<div style={{background:"#F0F8F0",border:"1.5px solid #00963944",borderRadius:9,padding:"8px 13px",marginBottom:14,fontSize:"0.76rem",color:"#003087"}}><strong style={{color:"#009639"}}>✓ Active</strong> — these instructions apply to every new conversation.</div>}
              <div style={{fontWeight:700,fontSize:"0.77rem",color:"#003087",marginBottom:7}}>💡 Quick-add</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {INSTRUCTION_SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>append(setIt,it,s)} style={{background:"#EDF4FF",border:"1.5px solid #005EB833",borderRadius:20,padding:"6px 11px",cursor:"pointer",fontSize:"0.72rem",color:"#003087",lineHeight:1.4,minHeight:36}} onMouseEnter={e=>e.currentTarget.style.background="#D5E8FF"} onMouseLeave={e=>e.currentTarget.style.background="#EDF4FF"}>+ {s.length>46?s.slice(0,46)+"…":s}</button>)}
              </div>
            </div>
          )}
          {tab==="documents"&&(
            <div>
              <div style={{fontWeight:700,fontSize:"0.84rem",color:"#003087",marginBottom:5}}>Word Document Settings</div>
              <p style={{fontSize:"0.77rem",color:"#425563",margin:"0 0 14px",lineHeight:1.55}}>Control what appears in downloaded Word documents.</p>
              {[
                {key:"useLetterhead", label:"Practice letterhead", desc:"Show your practice name, address, logo and contact details at the top of every Word document."},
                {key:"includeLogoInDocx", label:"Include practice logo in documents", desc:"When enabled, your practice logo appears in the header of downloaded Word documents. Disable to export clean documents without a logo."},
                {key:"includePracticeDetails", label:"Include practice details in document header", desc:"When enabled, the document header shows the practice name, address, phone, email and website. Disable to omit practice details from the header."},
                {key:"showDocFooter", label:"Document footer", desc:"Show author, job title and Notewell compliance information at the bottom of every Word document."},
              ].map(({key,label,desc})=>{
                const val = settings?.[key] !== false;
                return(
                  <div key={key} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 14px",background:"#F8FAFC",borderRadius:9,border:"1.5px solid #E8EDEE",marginBottom:10}}>
                    <button
                      onClick={()=>saveSettings&&saveSettings({[key]:!val})}
                      style={{
                        flexShrink:0, marginTop:2,
                        width:42, height:24, borderRadius:12, border:"none", cursor:"pointer",
                        background:val?"#005EB8":"#D1D5DB", position:"relative", transition:"background .2s",
                      }}
                    >
                      <span style={{
                        position:"absolute", top:3, left:val?20:3,
                        width:18, height:18, borderRadius:9,
                        background:"#fff", transition:"left .2s",
                        boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                        display:"block",
                      }}/>
                    </button>
                    <div>
                      <div style={{fontWeight:600,fontSize:"0.81rem",color:"#003087",marginBottom:2}}>{label}</div>
                      <div style={{fontSize:"0.72rem",color:"#425563",lineHeight:1.5}}>{desc}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{background:"#EDF4FF",borderLeft:"3px solid #005EB8",padding:"8px 12px",borderRadius:"0 6px 6px 0",marginTop:6}}>
                <p style={{margin:0,fontSize:"0.74rem",color:"#003087",lineHeight:1.5}}>
                  💡 Tip: turn off the letterhead for internal notes and working documents. Leave it on for letters, policies and documents you'll share externally.
                </p>
              </div>
            </div>
          )}
          {tab==="kb"&&(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div style={{fontWeight:700,fontSize:"0.88rem",color:"#003087"}}>📚 Loaded Knowledge Base</div>
                  <div style={{fontSize:"0.74rem",color:"#425563",marginTop:2}}>Showing the active indexed documents currently loaded into Ask AI</div>
                </div>
                {/* FIX 3: Fixed KB navigation to prevent race condition */}
                <button onClick={()=>{onClose();setTimeout(()=>{window.location.assign('/knowledge-base');},200);}} style={{background:"#EDF4FF",border:"1.5px solid #005EB833",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:"0.74rem",color:"#003087",fontWeight:600,minHeight:36}} onMouseEnter={e=>e.currentTarget.style.background="#D5E8FF"} onMouseLeave={e=>e.currentTarget.style.background="#EDF4FF"}>Open full page →</button>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                <div style={{background:"#F8FAFC",border:"1px solid #E8EDEE",borderRadius:9,padding:"8px 12px",fontSize:"0.74rem",color:"#003087",fontWeight:600}}>Loaded: {kbDocs.length} documents</div>
                <div style={{background:"#F8FAFC",border:"1px solid #E8EDEE",borderRadius:9,padding:"8px 12px",fontSize:"0.74rem",color:"#425563"}}>Active only · Indexed only</div>
              </div>
              <input value={kbSearch} onChange={e=>setKbSearch(e.target.value)} placeholder="Search loaded documents…" style={{width:"100%",border:"1.5px solid #E8EDEE",borderRadius:9,padding:"8px 12px",fontSize:"16px",color:"#231F20",outline:"none",boxSizing:"border-box",marginBottom:12}} onFocus={e=>e.target.style.borderColor="#0072CE"} onBlur={e=>e.target.style.borderColor="#E8EDEE"}/>
              {kbLoading?(
                <div style={{textAlign:"center",padding:24,color:"#425563",fontSize:"0.83rem"}}>Loading…</div>
              ):filteredKb.length===0?(
                <div style={{textAlign:"center",padding:24}}>
                  <div style={{fontSize:"1.4rem",marginBottom:8}}>📭</div>
                  <div style={{color:"#425563",fontSize:"0.83rem",fontWeight:500}}>No documents found</div>
                  <div style={{color:"#768692",fontSize:"0.76rem",marginTop:4}}>Contact your administrator to add content.</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredKb.map(doc=>{
                    const cat=doc.kb_categories;
                    return(
                      <div key={doc.id} style={{border:"1.5px solid #E8EDEE",borderRadius:10,padding:"10px 13px",background:"#FAFBFC"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                          {cat&&<span style={{fontSize:"0.68rem",fontWeight:600,padding:"2px 8px",borderRadius:12,background:`${cat.colour}15`,color:cat.colour,border:`1px solid ${cat.colour}40`}}>{cat.icon} {cat.name}</span>}
                        </div>
                        <div style={{fontWeight:600,fontSize:"0.83rem",color:"#003087",marginBottom:3}}>{doc.title}</div>
                        {doc.summary&&<div style={{fontSize:"0.76rem",color:"#425563",lineHeight:1.5,marginBottom:6}}>{doc.summary.length>120?doc.summary.slice(0,120)+"…":doc.summary}</div>}
                        {!!doc.keywords?.length&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>{doc.keywords.slice(0,6).map((kw,i)=><span key={i} style={{fontSize:"0.66rem",padding:"2px 7px",borderRadius:999,border:"1px solid #D5E8FF",background:"#EDF4FF",color:"#003087"}}>{kw}</span>)}</div>}
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",fontSize:"0.7rem",color:"#768692"}}>
                          {doc.source&&<span>{doc.source}</span>}
                          {doc.effective_date&&<span>· {new Date(doc.effective_date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span>}
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:8}}>
                          {doc.file_url&&<button onClick={()=>window.open(doc.file_url,"_blank")} style={{background:"#F0F4F8",border:"1px solid #E8EDEE",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:"0.72rem",color:"#003087",fontWeight:500,minHeight:32}}>📄 Open</button>}
                          <button onClick={()=>{onClose();setTimeout(()=>{const ta=document.querySelector("textarea");if(ta){ta.value=`Tell me about: ${doc.title}`;ta.dispatchEvent(new Event("input",{bubbles:true}));}},300);}} style={{background:"#005EB8",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:"0.72rem",color:"#fff",fontWeight:600,minHeight:32}}>💬 Ask AI</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid #E8EDEE",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafbfc",flexShrink:0}}>
          <div>{(pt.trim()||it.trim())&&<button onClick={()=>{setPt("");setIt("");}} style={{background:"none",border:"none",cursor:"pointer",color:"#DA291C",fontSize:"0.77rem",padding:0,minHeight:44}}>🗑 Clear all</button>}</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{background:"#F0F4F8",border:"none",borderRadius:8,padding:"10px 18px",cursor:"pointer",color:"#425563",fontWeight:600,fontSize:"0.87rem",minHeight:44}}>Cancel</button>
            {tab!=="kb"&&<button onClick={save} style={{background:saved?"#009639":"#005EB8",border:"none",borderRadius:8,padding:"10px 24px",cursor:"pointer",color:"#fff",fontWeight:700,fontSize:"0.87rem",minWidth:90,minHeight:44,transition:"background .2s"}}>{saved?"✓ Saved!":"Save"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guide Modal ───────────────────────────────────────────────────────────────
const CAPABILITIES=[{icon:"💬",title:"Chat & Ask",colour:NHS.blue,desc:"NHS primary care, policies, contracts, ARRS, governance, clinical queries."},{icon:"📊",title:"Excel Reports",colour:"#217346",desc:"Spreadsheets, trackers, dashboards — real .xlsx files."},{icon:"🖥️",title:"Presentations",colour:"#D24726",desc:"NHS-styled PowerPoint decks for board meetings."},{icon:"📎",title:"File Upload",colour:NHS.aquaBlue,desc:"Attach PDFs, Word docs, images for analysis."}];

function GuideModal({user,onClose,vp}){
  const isMobile=vp==="mobile";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",padding:isMobile?0:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:isMobile?"100%":580,maxHeight:isMobile?"90dvh":"85vh",background:"#fff",borderRadius:isMobile?"20px 20px 0 0":16,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 -4px 40px rgba(0,0,0,0.18)",animation:"nwSlideUp .25s ease"}}>
        {isMobile&&<div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px",background:"#fff",flexShrink:0}}><div style={{width:40,height:4,borderRadius:2,background:"#D1D5DB"}}/></div>}
        <div style={{padding:"14px 20px 10px",background:`linear-gradient(135deg,${NHS.darkBlue},${NHS.blue})`,color:"#fff",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:800,fontSize:"1rem",marginBottom:2}}>🤖 Getting the best results from Notewell AI</div>
              <div style={{fontSize:"0.72rem",opacity:.65}}>Tips for {user.role} at {user.practice.shortName}</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",color:"#fff",borderRadius:8,padding:"8px 12px",fontSize:"1rem",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"14px 18px"}}>
          <div style={{fontWeight:700,fontSize:"0.88rem",color:NHS.darkBlue,marginBottom:8}}>What can I do?</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:7,marginBottom:14}}>
            {CAPABILITIES.map((c,i)=><div key={i} style={{display:"flex",gap:8,padding:"8px 10px",background:c.colour+"09",border:`1.5px solid ${c.colour}22`,borderRadius:9,alignItems:"flex-start"}}><span style={{fontSize:"1.1rem",flexShrink:0}}>{c.icon}</span><div><div style={{fontWeight:700,fontSize:"0.79rem",color:c.colour}}>{c.title}</div><div style={{fontSize:"0.72rem",color:NHS.midGrey,lineHeight:1.5}}>{c.desc}</div></div></div>)}
          </div>
          <div style={{fontWeight:700,fontSize:"0.88rem",color:NHS.darkBlue,marginBottom:8}}>💡 Tips</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:14}}>
            {["Be specific — 'ARRS budget for 2026/27 South Northamptonshire' beats 'ARRS info'",`Say 'Create a Word SOP for ${user.practice.shortName}...' to get a downloadable .doc`,`Add context: 'I need this for a CQC inspection at ${user.practice.name}'`,`Upload PDFs or images and say 'Summarise this document'`,"Request Excel spreadsheets, PowerPoint decks, or diagrams directly",`Set up your profile for personalised responses`].map((t,i)=><div key={i} style={{fontSize:"0.78rem",color:NHS.darkGrey,padding:"5px 10px",background:"#F8FAFC",borderRadius:7,border:`1px solid ${NHS.paleGrey}`,lineHeight:1.5}}>✓ {t}</div>)}
          </div>
          <div style={{background:`${NHS.warmYellow}15`,border:`1.5px solid ${NHS.warmYellow}55`,borderRadius:9,padding:"8px 12px",fontSize:"0.76rem",lineHeight:1.6,color:NHS.darkGrey}}>
            <strong style={{color:"#B56200"}}>⚠️ Clinical safety:</strong> Notewell AI is a decision-support tool. Always apply professional clinical judgement. AI outputs should be verified before use in patient care.
          </div>
        </div>
        <div style={{padding:"12px 20px",borderTop:`1px solid ${NHS.paleGrey}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafbfc",flexShrink:0}}>
          <span style={{fontSize:"0.72rem",color:NHS.midGrey}}>Always available via <strong>?</strong></span>
          <button onClick={onClose} style={{background:NHS.blue,border:"none",borderRadius:8,padding:"10px 24px",cursor:"pointer",color:"#fff",fontWeight:700,fontSize:"0.87rem",minHeight:44}}>Got it ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Artifact Panel ────────────────────────────────────────────────────────────
// FIX 1: Enhanced PPTX download with spinner, error display, success confirmation, timeout
function ArtifactPanel({artifact,onClose,vp,panelWidth,onSetWidth,settings=DEFAULT_SETTINGS,saveSettings}){
  const [gen,setGen]=useState(false);const [err,setErr]=useState(null);const [done,setDone]=useState(null);
  const [genLabel,setGenLabel]=useState(null);
  const type=ARTIFACT_TYPES[artifact.type]||ARTIFACT_TYPES.docx;const isImg=artifact.type==="image";
  const dl=useCallback(async(fmt="default")=>{
    setGen(true);setErr(null);setDone(null);
    if(artifact.type==="pptx") setGenLabel("Building presentation...");
    else setGenLabel("Generating...");
    try{
      if(artifact.type==="docx")triggerDownload(await generateDocxBlob(artifact, settings),(artifact.filename||"document")+".doc");
      else if(artifact.type==="xlsx")triggerDownload(generateXlsxBlob(artifact),(artifact.filename||"report")+".xlsx");
      else if(artifact.type==="pptx")triggerDownload(await generatePptxBlob(artifact),(artifact.filename||"presentation")+".pptx");
      else if(isImg){if(fmt==="png")await downloadPng(artifact);else downloadSvg(artifact);}
      setDone(fmt);setGenLabel(null);setTimeout(()=>setDone(null),4000);
    }catch(e){
      setErr(e.message||"⚠️ Download failed — try again or check connection");
      setGenLabel(null);
    }finally{setGen(false);}
  },[artifact]);
  return(<div style={{background:"#fff",borderLeft:`1px solid ${NHS.paleGrey}`,display:"flex",flexDirection:"column",boxShadow:"-4px 0 20px rgba(0,0,0,0.07)",height:"100%"}}>
    <div style={{padding:"12px 14px",background:`linear-gradient(135deg,${type.colour},${type.colour}CC)`,display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
      <div style={{fontSize:"1.3rem"}}>{type.icon}</div>
      <div style={{flex:1,overflow:"hidden"}}>
        <div style={{fontWeight:700,fontSize:"0.87rem",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{artifact.title||type.label}</div>
        <div style={{fontSize:"0.66rem",color:"rgba(255,255,255,.65)",marginTop:1}}>{type.label} · Notewell AI</div>
      </div>
      {onSetWidth&&(
        <div style={{display:"flex",gap:3,alignItems:"center",marginRight:6}}>
          {[
            {label:"S",w:320,title:"Narrow"},
            {label:"M",w:460,title:"Medium"},
            {label:"L",w:580,title:"Wide"},
            {label:"XL",w:780,title:"Extra wide"},
          ].map(({label,w,title})=>(
            <button key={label} onClick={()=>onSetWidth(w)} title={title} style={{
              background:panelWidth===w?"rgba(255,255,255,.35)":"rgba(255,255,255,.12)",
              border:"1px solid rgba(255,255,255,.3)",borderRadius:4,color:"#fff",
              fontSize:"0.62rem",fontWeight:700,padding:"2px 6px",cursor:"pointer",transition:"all .13s",
            }}>{label}</button>
          ))}
        </div>
      )}
      <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",cursor:"pointer",color:"#fff",borderRadius:7,padding:"5px 8px"}}>✕</button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"13px 14px"}}>
      {isImg&&artifact.svg?(<div><div style={{background:"#fafbfc",borderRadius:9,border:`1px solid ${NHS.paleGrey}`,padding:11,marginBottom:9,overflow:"auto"}}><div dangerouslySetInnerHTML={{__html:artifact.svg}} style={{display:"flex",justifyContent:"center"}}/></div>{artifact.alt&&<p style={{fontSize:"0.73rem",color:NHS.midGrey,margin:0,fontStyle:"italic"}}>↑ {artifact.alt}</p>}</div>)
      :(<ArtifactPreview artifact={artifact}/>)}
    </div>
    <div style={{padding:"12px 14px",borderTop:`1px solid ${NHS.paleGrey}`,background:"#fafbfc",flexShrink:0}}>
      {err&&<div style={{background:"#FFF5F5",border:`1px solid ${NHS.red}`,borderRadius:6,padding:"5px 9px",fontSize:"0.74rem",color:NHS.red,marginBottom:7}}>⚠️ {err}</div>}
      {isImg?(<div style={{display:"flex",gap:7}}><button onClick={(e)=>{e.stopPropagation();e.preventDefault();dl("svg");}} disabled={gen} style={{flex:1,padding:"9px 6px",border:"none",borderRadius:8,cursor:gen?"wait":"pointer",background:done==="svg"?NHS.green:type.colour,color:"#fff",fontWeight:700,fontSize:"0.81rem"}}>⬇ SVG</button><button onClick={(e)=>{e.stopPropagation();e.preventDefault();dl("png");}} disabled={gen} style={{flex:1,padding:"9px 6px",border:"none",borderRadius:8,cursor:gen?"wait":"pointer",background:done==="png"?NHS.green:type.colour+"CC",color:"#fff",fontWeight:700,fontSize:"0.81rem"}}>{gen?<span style={{animation:"nwSpin .8s linear infinite",display:"inline-block"}}>⏳</span>:"⬇"} PNG</button></div>)
      :(<button onClick={(e)=>{e.stopPropagation();e.preventDefault();dl();}} disabled={gen} style={{width:"100%",padding:"10px",border:"none",borderRadius:8,cursor:gen?"wait":"pointer",background:done?NHS.green:gen?NHS.midGrey:type.colour,color:"#fff",fontWeight:700,fontSize:"0.87rem",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        {gen?<><span style={{animation:"nwSpin .8s linear infinite",display:"inline-block"}}>⏳</span>{genLabel||"Generating..."}</>:done?<>✓ Downloaded!</>:<>{type.icon} Download {type.label}</>}
      </button>)}
      <div style={{fontSize:"0.62rem",color:NHS.midGrey,textAlign:"center",marginTop:6}}>Generated locally · not stored on any server</div>
    </div>
  </div>);
}

function ArtifactPreview({artifact}){
  if(artifact.type==="docx")return(<div style={{fontFamily:"Georgia,serif",fontSize:"0.85rem",lineHeight:1.7,color:NHS.darkGrey}}><div style={{background:NHS.darkBlue,color:"#fff",padding:"9px 12px",borderRadius:7,marginBottom:11}}><div style={{fontWeight:700,fontSize:"0.98rem"}}>{artifact.title}</div>{artifact.meta&&<div style={{fontSize:"0.69rem",opacity:.65,marginTop:2}}>{artifact.meta.author}{artifact.meta.jobTitle?` · ${artifact.meta.jobTitle}`:""}{artifact.meta.organisation?` · ${artifact.meta.organisation}`:""}</div>}</div>{(artifact.sections||[]).map((s,i)=>{switch(s.type){case"h1":return<h2 key={i} style={{fontSize:"1.06rem",fontWeight:700,color:NHS.darkBlue,borderBottom:`2px solid ${NHS.blue}`,paddingBottom:3,marginTop:11}}>{s.text}</h2>;case"h2":return<h3 key={i} style={{fontSize:"0.92rem",fontWeight:700,color:NHS.darkBlue,marginTop:9}}>{s.text}</h3>;case"p":return<p key={i} style={{margin:"5px 0"}}>{s.text}</p>;case"callout":return<div key={i} style={{background:"#EDF4FF",borderLeft:`3px solid ${NHS.blue}`,padding:"7px 10px",borderRadius:"0 5px 5px 0",margin:"7px 0",fontSize:"0.82rem"}}>{s.text}</div>;case"bullets":return<ul key={i} style={{paddingLeft:16,margin:"5px 0"}}>{(s.items||[]).map((it,j)=><li key={j} style={{margin:"2px 0"}}>{it}</li>)}</ul>;case"numbered":return<ol key={i} style={{paddingLeft:16,margin:"5px 0"}}>{(s.items||[]).map((it,j)=><li key={j} style={{margin:"2px 0"}}>{it}</li>)}</ol>;case"table":return<table key={i} style={{width:"100%",borderCollapse:"collapse",margin:"8px 0",fontSize:"0.76rem"}}><thead><tr>{(s.headers||[]).map((h,j)=><th key={j} style={{background:NHS.blue,color:"#fff",padding:"4px 7px",textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>{(s.rows||[]).map((r,j)=><tr key={j} style={{background:j%2===0?"#fff":NHS.paleGrey}}>{r.map((c,k)=><td key={k} style={{padding:"3px 7px",borderBottom:`1px solid ${NHS.paleGrey}`}}>{c}</td>)}</tr>)}</tbody></table>;default:return null;}})}</div>);
  if(artifact.type==="xlsx")return(<div><div style={{background:"#217346",color:"#fff",padding:"9px 12px",borderRadius:7,marginBottom:10}}><div style={{fontWeight:700}}>{artifact.title}</div><div style={{fontSize:"0.69rem",opacity:.75,marginTop:1}}>{(artifact.sheets||[]).length} sheet(s)</div></div>{(artifact.sheets||[]).map((sheet,i)=><div key={i} style={{marginBottom:13}}><div style={{fontWeight:700,fontSize:"0.79rem",color:NHS.darkBlue,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><span style={{background:"#217346",color:"#fff",borderRadius:3,padding:"0 5px",fontSize:"0.69rem"}}>{sheet.name}</span><span style={{color:NHS.midGrey,fontWeight:400}}>{(sheet.rows||[]).length} rows</span></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.75rem"}}><thead><tr>{(sheet.headers||[]).map((h,j)=><th key={j} style={{background:"#217346",color:"#fff",padding:"4px 7px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{(sheet.rows||[]).slice(0,8).map((r,j)=><tr key={j} style={{background:j%2===0?"#fff":"#F0F8F0"}}>{r.map((c,k)=><td key={k} style={{padding:"3px 7px",borderBottom:"1px solid #e0ede0"}}>{c}</td>)}</tr>)}</tbody></table></div>{(sheet.rows||[]).length>8&&<div style={{fontSize:"0.68rem",color:NHS.midGrey,marginTop:3,textAlign:"center"}}>+{sheet.rows.length-8} more rows in downloaded file</div>}</div>)}</div>);
  if(artifact.type==="pptx")return(<div><div style={{background:"#D24726",color:"#fff",padding:"9px 12px",borderRadius:7,marginBottom:10}}><div style={{fontWeight:700}}>{artifact.title}</div><div style={{fontSize:"0.69rem",opacity:.75,marginTop:1}}>{(artifact.slides||[]).length} slides</div></div>{(artifact.slides||[]).map((slide,i)=><div key={i} style={{border:`1px solid ${NHS.paleGrey}`,borderRadius:7,marginBottom:6,overflow:"hidden",background:i===0||i===(artifact.slides.length-1)?NHS.darkBlue:"#fff"}}><div style={{padding:"5px 9px",background:i===0||i===(artifact.slides.length-1)?NHS.darkBlue:NHS.paleGrey,display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:"0.64rem",background:i===0||i===(artifact.slides.length-1)?"rgba(255,255,255,.15)":NHS.blue+"22",color:i===0||i===(artifact.slides.length-1)?"rgba(255,255,255,.5)":NHS.midGrey,borderRadius:3,padding:"0 5px",fontWeight:700}}>{i+1}</span><span style={{fontSize:"0.77rem",fontWeight:600,color:i===0||i===(artifact.slides.length-1)?"#fff":NHS.darkBlue,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{slide.title}</span><span style={{fontSize:"0.63rem",color:i===0||i===(artifact.slides.length-1)?"rgba(255,255,255,.4)":NHS.midGrey}}>{slide.layout}</span></div>{(slide.subtitle||slide.bullets?.length||slide.stats?.length)&&<div style={{padding:"7px 9px"}}>{slide.subtitle&&<p style={{fontSize:"0.74rem",color:i===0||i===(artifact.slides.length-1)?"#41B6E6":NHS.midGrey,margin:"0 0 3px",fontStyle:"italic"}}>{slide.subtitle}</p>}{slide.bullets?.slice(0,3).map((b,j)=><div key={j} style={{fontSize:"0.72rem",color:i===0||i===(artifact.slides.length-1)?"rgba(255,255,255,.7)":NHS.darkGrey,display:"flex",gap:4,marginBottom:2}}><span style={{color:NHS.brightBlue,flexShrink:0}}>•</span><span>{b.length>80?b.slice(0,80)+"…":b}</span></div>)}{slide.stats&&<div style={{display:"flex",gap:6,marginTop:4}}>{slide.stats.slice(0,3).map((st,j)=><div key={j} style={{flex:1,textAlign:"center",background:NHS.blue+"22",borderRadius:5,padding:"3px 5px"}}><div style={{fontWeight:700,fontSize:"0.87rem",color:NHS.brightBlue}}>{st.value}</div><div style={{fontSize:"0.63rem",color:NHS.midGrey}}>{st.label}</div></div>)}</div>}</div>}</div>)}</div>);
  return null;
}

function UserAvatar({user,size=32}){return<div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,background:`linear-gradient(135deg,${NHS.blue},${NHS.darkBlue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,color:"#fff",border:"2px solid rgba(255,255,255,.2)"}}>{user.initials}</div>;}
function PracticeLogo({practice,size=26}){if(practice.logoUrl)return<img src={practice.logoUrl} alt={practice.name} style={{width:size,height:size,objectFit:"contain",borderRadius:5}}/>;const init=(practice.shortName||practice.name||"?").split(/\s+/).map(w=>w[0]).join("").slice(0,3);return<div style={{width:size,height:size,borderRadius:6,background:`linear-gradient(135deg,${practice.primaryColour||NHS.blue},${NHS.darkBlue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.28,fontWeight:900,color:"#fff",flexShrink:0}}>{init}</div>;}

const FOLLOW_UP_SUGGESTIONS=["Tell me more","Summarise as bullet points","Draft this as a letter"];

function MessageBubble({msg,user,settings,compact,hasPanel,vp,isLast,onFollowUp,onOpenArtifact}){
  const isUser=msg.role==="user";const [copied,setCopied]=useState(false);const [feedback,setFeedback]=useState(null);
  const display=stripArtifact(msg.content);const fs=FONT_SCALE[settings.fontSize||"medium"];
  const isMobile=vp==="mobile";
  
  // FIX 6: Render generated images inline
  if(!isUser && msg.generatedImage) {
    return(
      <div style={{display:"flex",gap:compact?8:11,marginBottom:compact?13:18,alignItems:"flex-start"}}>
        <img src="/android-chrome-192x192.png" alt="Notewell AI" style={{width:compact?27:33,height:compact?27:33,borderRadius:"50%",flexShrink:0,objectFit:"cover",boxShadow:"0 2px 8px rgba(0,0,0,.1)",background:"#fff"}}/>
        <div style={{maxWidth:hasPanel?"84%":"74%",minWidth:60}}>
          <div style={{fontSize:"0.64rem",color:NHS.midGrey,marginBottom:3}}>Notewell AI · {fmt(msg.timestamp)}</div>
          <div style={{background:"#fff",borderRadius:"15px 15px 15px 4px",padding:compact?"8px 12px":"11px 15px",boxShadow:"0 2px 10px rgba(0,0,0,.07)",border:`1px solid ${NHS.paleGrey}`,lineHeight:1.65,fontSize:`${fs}rem`}}>
            {msg.imageError ? (
              <div>
                <span dangerouslySetInnerHTML={{__html:renderMd(display)}}/>
              </div>
            ) : msg.imageUrl ? (
              <div>
                <p style={{margin:"0 0 8px"}}>{display}</p>
                <img src={msg.imageUrl} style={{maxWidth:"100%",borderRadius:12,marginTop:8,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}} alt="Generated image"/>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={async()=>{try{const resp=await fetch(msg.imageUrl);const blob=await resp.blob();triggerDownload(blob,"notewell-image.png");}catch{alert("Download failed");}}} style={{background:NHS.blue,border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",color:"#fff",fontWeight:600,fontSize:"0.79rem",minHeight:36}}>⬇ Download PNG</button>
                  {msg.onRegenerate&&<button onClick={msg.onRegenerate} style={{background:"#F0F4F8",border:`1px solid ${NHS.paleGrey}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",color:NHS.darkGrey,fontWeight:600,fontSize:"0.79rem",minHeight:36}}>🔄 Regenerate</button>}
                </div>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{animation:"nwSpin .8s linear infinite",display:"inline-block"}}>🎨</span>
                <span>{display}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return(<div style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:compact?8:11,marginBottom:compact?13:18,alignItems:"flex-start"}}>
    {isUser?<UserAvatar user={user} size={compact?27:33}/>:<img src="/android-chrome-192x192.png" alt="Notewell AI" style={{width:compact?27:33,height:compact?27:33,borderRadius:"50%",flexShrink:0,objectFit:"cover",boxShadow:"0 2px 8px rgba(0,0,0,.1)",background:"#fff"}}/>}
    <div style={{maxWidth:hasPanel?"84%":"74%",minWidth:60}}>
      <div style={{fontSize:"0.64rem",color:NHS.midGrey,marginBottom:3,textAlign:isUser?"right":"left"}}>{isUser?user.name:"Notewell AI"} · {fmt(msg.timestamp)}</div>
      {msg.files?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5,justifyContent:isUser?"flex-end":"flex-start"}}>{msg.files.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:3,background:"#EDF4FF",border:`1px solid ${NHS.lightBlue}`,borderRadius:6,padding:"2px 6px",fontSize:"0.71rem",color:NHS.darkBlue}}>📎 {f.name}{f.size&&<span style={{color:NHS.midGrey}}> {fmtSize(f.size)}</span>}</div>)}</div>}
      {/* Inline artifact card: streaming (loading) or completed */}
      {!isUser && !msg.artifact && msg.streaming && hasArtifactStart(msg.content) && <InlineArtifactCard streaming artifact={null}/>}
      {!isUser && msg.artifact && <InlineArtifactCard artifact={msg.artifact} onOpen={onOpenArtifact}/>}
      <div style={{background:isUser?NHS.blue:"#fff",color:isUser?"#fff":NHS.darkGrey,borderRadius:isUser?"15px 15px 4px 15px":"15px 15px 15px 4px",padding:compact?"8px 12px":"11px 15px",boxShadow:"0 2px 10px rgba(0,0,0,.07)",border:isUser?"none":`1px solid ${NHS.paleGrey}`,lineHeight:1.65,fontSize:`${fs}rem`,...(!isUser && !display.trim() ? {display:"none"} : {})}}>
        {isUser?<span style={{whiteSpace:"pre-wrap"}}>{display}</span>:msg.streaming?<><span dangerouslySetInnerHTML={{__html:renderMd(display)}}/>{!hasArtifactStart(msg.content)&&<span style={{display:"inline-block",width:6,height:13,background:NHS.blue,marginLeft:2,borderRadius:2,animation:"nwBlink .8s step-end infinite",verticalAlign:"text-bottom"}}/>}</>:<span dangerouslySetInnerHTML={{__html:renderMd(display)}}/>}
      </div>
      {/* KB source chips */}
      {!isUser&&!msg.streaming&&msg.kbSources?.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:5}}>
          {msg.kbSources.map((s,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:3,background:"#F0F4F8",border:`1px solid ${NHS.paleGrey}`,borderRadius:12,padding:"2px 8px",fontSize:"0.68rem",color:NHS.midGrey}}>📋 {s.title}{s.effective_date&&<span>· {new Date(s.effective_date).toLocaleDateString("en-GB",{month:"short",year:"numeric"})}</span>}</span>)}
        </div>
      )}
      {!isUser&&!msg.streaming&&<div style={{display:"flex",gap:4,marginTop:4}}>{[{l:copied?"✓ Copied":"⎘ Copy",fn:()=>{navigator.clipboard.writeText(display);setCopied(true);setTimeout(()=>setCopied(false),1500)},a:copied},{l:"👍",fn:()=>setFeedback("up"),a:feedback==="up",ac:NHS.green},{l:"👎",fn:()=>setFeedback("down"),a:feedback==="down",ac:NHS.red}].map((b,i)=><button key={i} onClick={b.fn} style={{background:b.a?(b.ac||NHS.blue)+"22":"transparent",border:`1px solid ${b.a?(b.ac||NHS.blue):NHS.paleGrey}`,borderRadius:5,padding:isMobile?"8px 12px":"2px 7px",cursor:"pointer",fontSize:"0.71rem",color:b.a?(b.ac||NHS.blue):NHS.midGrey,minHeight:isMobile?36:undefined}}>{b.l}</button>)}</div>}
      {!isUser&&!msg.streaming&&settings.showClinicalCaveats&&display.length>60&&<div style={{fontSize:"0.64rem",color:NHS.midGrey,marginTop:4,padding:"2px 7px",background:"#f8f9fa",borderRadius:4,borderLeft:`3px solid ${NHS.warmYellow}`}}>⚕️ Apply clinical judgement before acting on AI output in patient care.</div>}
      {/* Follow-up suggestion chips — only on the last assistant message */}
      {!isUser&&!msg.streaming&&isLast&&onFollowUp&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
          {FOLLOW_UP_SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>onFollowUp(s)} style={{background:"#EDF4FF",border:`1.5px solid ${NHS.brightBlue}33`,borderRadius:20,padding:"5px 12px",cursor:"pointer",fontSize:"0.73rem",color:NHS.blue,fontWeight:500,transition:"all .13s",minHeight:32}} onMouseEnter={e=>{e.currentTarget.style.background="#D5E8FF";e.currentTarget.style.borderColor=NHS.brightBlue;}} onMouseLeave={e=>{e.currentTarget.style.background="#EDF4FF";e.currentTarget.style.borderColor=NHS.brightBlue+"33";}}>{s}</button>)}
        </div>
      )}
    </div>
  </div>);
}

// ── FIX 4: Role-based suggestions ─────────────────────────────────────────────
const ROLE_SUGGESTIONS = {
  "Practice Manager": [
    "📄 Draft a staff sickness absence return to work letter",
    "💼 What ARRS roles can we claim reimbursement for in 2026/27?",
    "📊 Create an Excel tracker for ARRS staff, WTE, costs and contract end dates",
    "📋 What are the Network Contract DES 2026/27 key requirements and deadlines?",
    "✅ Write a CQC-ready infection control policy for our practice",
    "📧 Draft an email to patients about appointment access changes",
    "How do I set up a new LES agreement with the ICB?",
    "What are the QOF indicators I need to report on this quarter?",
    "Draft a business continuity plan for a GP practice",
    "What policies must be reviewed annually for CQC compliance?",
    "Write a Word template for a significant event analysis (SEA)",
    "How do I handle a patient removal from the practice list?",
    "What is the process for an Individual Funding Request (IFR)?",
    "Create a GDPR-compliant patient data breach response checklist",
    "What DBS checks are required for different staff roles?",
    "Draft a job description for a Social Prescribing Link Worker",
    "How do I complete the DSPT submission for our practice?",
    "What are the GPAD slot type configurations needed for access reporting?",
    "What notice periods apply under Agenda for Change?"
  ],
  "GP Partner": [
    "📋 Summarise the key changes in the GP contract for 2026/27",
    "📝 Draft a partnership meeting agenda covering finance, workforce and QOF performance",
    "📊 What are the current IIF indicator domains and payment thresholds?",
    "🤝 Help me review our PCN DES participation agreement obligations",
    "💊 What's the Northamptonshire formulary position on semaglutide?",
    "📋 What are the NICE criteria for starting a GLP-1 in type 2 diabetes?",
    "🚦 Is doxazosin XL on the Northamptonshire formulary?",
    "📝 Write a referral letter for a patient with uncontrolled hypertension",
    "🔬 What monitoring does methotrexate require in primary care?",
    "🩺 What are the QOF indicators for diabetes review 2026/27?",
    "A consultant has asked me to prescribe a RED formulary drug. Do I have to?",
    "What are my responsibilities for structured medication reviews?",
    "Explain the traffic light formulary system for prescribing",
    "What should I document when declining to sign an SCA?",
    "How do I report a significant event to NHS England?",
    "What are the dementia diagnosis rate targets for Northamptonshire?",
    "What are the current ADHD prescribing rules in Northamptonshire?",
    "Write a clinical audit protocol for antibiotic prescribing",
    "What vaccinations are due at the 12-month child health check?",
    "What QOF disease registers do I need to maintain?"
  ],
  "Admin / Reception": [
    "📄 Draft a patient letter for a missed appointment",
    "📞 Create a phone script for redirecting patients to community pharmacy",
    "📋 What are the Enhanced Access appointment booking rules?",
    "📝 Help me write a template response to a patient complaint",
    "📧 Draft a patient letter about a change to opening hours",
    "📄 Write a repeat prescription request policy for patients",
    "📋 What is the process for a subject access request under GDPR?",
    "✅ Create a new patient registration checklist for our practice",
    "📊 Create a spreadsheet to track appointment DNA rates by month",
    "What is the correct procedure for deducting a deceased patient?",
    "What are the rules for releasing medical records to solicitors?",
    "How do I handle a request for a private sick note?",
    "What is the process for ordering vaccines through ImmForm?",
    "How do I set up a new user account on EMIS/SystmOne?",
    "How do I process a temporary patient registration?",
    "Draft a patient information leaflet about our online services",
    "What is the process for scanning and workflow of clinical post?",
    "How do I add a carer flag to a patient record?",
    "What forms are needed for a cremation request?",
    "How do I request patient transport for a vulnerable patient?"
  ],
  "PCN Manager": [
    "📊 Create a workforce planning tracker for our PCN ARRS staff",
    "📄 What are the PCN DES service requirements for 2026/27?",
    "📝 Draft a business case template for a new PCN-funded role",
    "📋 Summarise the current IIF indicators and how payments are calculated",
    "💼 What ARRS roles are available and what are the reimbursement rates?",
    "✅ Draft a PCN board report template",
    "📧 Write a communication to member practices about Enhanced Access",
    "Draft the agenda for a PCN board meeting",
    "What are the 18 ICB metrics for the NRES neighbourhood programme?",
    "Explain the buy-back methodology for the New Models programme",
    "What ARRS roles require 70% vs 100% reimbursement?",
    "Draft an MOU clause covering sick pay for neighbourhood staff",
    "Create a PowerPoint for an ICB board presentation on PCN performance",
    "What are the GPAD slot type requirements for SDA reporting?",
    "What is the process for submitting monthly ARRS claims via CQRS?",
    "Draft a workforce plan for an ARRS recruitment round",
    "What governance documents are required for a New Models pilot?",
    "Create an Excel dashboard for PCN QOF performance tracking",
    "Write a risk register template for PCN governance",
    "Draft a board paper on neighbourhood care implementation progress"
  ],
  "Ageing Well": [
    "📋 Generate a Personalised Care and Support Plan (PCSP) for a frail elderly patient",
    "🏥 Draft a Care Home weekly round template with RAG review status per resident",
    "💊 Run a STOPP/START polypharmacy review on a sample medication list",
    "📝 Produce an Anticipatory Care Plan aligned to ReSPECT",
    "🚶 Falls multifactorial risk assessment with intervention plan",
    "👥 MDT meeting agenda for over-75s with eFI > 0.36",
    "🧠 Draft a dementia diagnosis communication letter for patient and family",
    "🤝 Carer support pack with local signposting",
    "🕊️ End of Life conversation guide for the GP consultation",
    "📊 Define cohort logic to identify patients eligible for proactive Ageing Well review",
    "🧠 Complete a 4AT delirium screen with TIME bundle management plan",
    "💊 Structured Medication Review using the NHS 7-Steps framework",
    "🚑 Draft an Urgent Community Response referral for admission avoidance",
    "⚖️ Mental Capacity Act assessment with 2-stage test and best interests",
    "🛡️ Safeguarding Adults referral with Making Safeguarding Personal",
    "🍽️ MUST nutrition screen with food-first action plan",
    "📞 72-hour post-discharge follow-up consultation template",
    "🤝 Social prescribing referral with holistic rationale and local services",
    "🕯️ Bereavement support pack with 6-week and 6-month follow-up plan",
    "📋 Annual over-75 health check template with full CGA domains"
  ]
};

function WelcomeScreen({user,vp,onSuggestion,onHelp,onProfile,onPopulateInput,onOpenImageStudio,settings}){
  const h=new Date().getHours();
  const g=h<12?"morning":h<17?"afternoon":"evening";
  const isMobile=vp==="mobile";
  const getRoleKey=(r)=>{
    const s=(r||"").toLowerCase();
    if(s.includes("gp")||s.includes("doctor")||s.includes("clinical")||s.includes("clinician"))return"GP Partner";
    if(s.includes("pcn")||s.includes("network")||s.includes("neighbourhood"))return"PCN Manager";
    if(s.includes("manager")||s.includes("pm")||s.includes("practice manager"))return"Practice Manager";
    if(s.includes("admin")||s.includes("reception")||s.includes("coordinator")||s.includes("practice user"))return"Admin / Reception";
    if(s.includes("ageing")||s.includes("aging")||s.includes("frailty")||s.includes("elderly"))return"Ageing Well";
    return"Practice Manager";
  };
  const vr=settings?.visibleRoles||DEFAULT_SETTINGS.visibleRoles;
  const ROLES=Object.keys(ROLE_SUGGESTIONS).filter(r=>vr[r]!==false);
  const [activeRole,setActiveRole]=useState(()=>{const def=getRoleKey(user.role);return ROLES.includes(def)?def:ROLES[0]||"Practice Manager";});
  const scrollRef=useRef(null);
  const [canScrollLeft,setCanScrollLeft]=useState(false);
  const [canScrollRight,setCanScrollRight]=useState(true);
  const checkScroll=()=>{
    const el=scrollRef.current;
    if(!el)return;
    setCanScrollLeft(el.scrollLeft>8);
    setCanScrollRight(el.scrollLeft<el.scrollWidth-el.clientWidth-8);
  };
  useEffect(()=>{
    const el=scrollRef.current;
    if(!el)return;
    el.addEventListener("scroll",checkScroll,{passive:true});
    checkScroll();
    return()=>el.removeEventListener("scroll",checkScroll);
  },[activeRole]);
  const nudge=(dir)=>{
    const el=scrollRef.current;
    if(!el)return;
    el.scrollBy({left:dir*220,behavior:"smooth"});
  };
  const suggestions=ROLE_SUGGESTIONS[activeRole]||[];
  const ROLE_ICONS={
    "Practice Manager":"🗂️",
    "GP Partner":"🩺",
    "Admin / Reception":"📋",
    "PCN Manager":"🏥",
    "Ageing Well":"🧓",
  };
  return(
    <div style={{
      flex:1,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      padding:isMobile?"20px 12px":"28px 20px",
      textAlign:"center",maxWidth:720,
      margin:"0 auto",width:"100%"
    }}>
      {/* Avatar + greeting */}
      <img src="/notewell-chat-icon.png" alt="Notewell AI"
        style={{width:56,height:56,borderRadius:"50%",
          marginBottom:10,objectFit:"cover",
          boxShadow:"0 8px 28px rgba(0,114,206,.25)"}}/>
      <h2 style={{fontSize:"1.18rem",fontWeight:700,
        color:NHS.darkBlue,margin:"0 0 3px"}}>
        Good {g}, {user.name.split(" ")[0]}
      </h2>
      <p style={{color:NHS.midGrey,margin:"0 0 3px",
        fontSize:"0.78rem"}}>
        {user.role} · {user.practice.name}
      </p>
      <p style={{margin:"0 0 16px"}}>
        <button onClick={onHelp} style={{background:"none",
          border:"none",cursor:"pointer",color:NHS.brightBlue,
          fontWeight:600,fontSize:"0.78rem",padding:0,
          textDecoration:"underline"}}>
          How to get best results →
        </button>
        {" · "}
        <button onClick={onProfile} style={{background:"none",
          border:"none",cursor:"pointer",color:NHS.brightBlue,
          fontWeight:600,fontSize:"0.78rem",padding:0,
          textDecoration:"underline"}}>
          Set up my profile →
        </button>
      </p>
      {ASK_AI_IMAGE_STUDIO_ENABLED&&(
        <button onClick={onOpenImageStudio} style={{width:"100%",maxWidth:360,margin:"0 0 14px",background:"#fff",border:`1.5px solid ${NHS.lightBlue}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",boxShadow:"0 4px 16px rgba(0,114,206,.10)",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
          <span style={{width:42,height:42,borderRadius:10,background:NHS.blue+"14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.35rem",flexShrink:0}}>🎨</span>
          <span style={{flex:1}}>
            <span style={{display:"block",fontWeight:800,color:NHS.darkBlue,fontSize:"0.9rem"}}>Create an image</span>
            <span style={{display:"block",color:NHS.midGrey,fontSize:"0.75rem",lineHeight:1.4}}>Use NHS-ready poster, social and website templates</span>
          </span>
          <span style={{color:NHS.blue,fontWeight:800}}>›</span>
        </button>
      )}
      {/* Role pills */}
      <div style={{display:"flex",gap:6,marginBottom:12,
        flexWrap:"wrap",justifyContent:"center",
        width:"100%"}}>
        {ROLES.map(r=>(
          <button key={r} onClick={()=>setActiveRole(r)}
            style={{
              display:"flex",alignItems:"center",gap:5,
              padding:"6px 14px",
              background:activeRole===r?NHS.blue:"#fff",
              color:activeRole===r?"#fff":NHS.darkBlue,
              border:`1.5px solid ${activeRole===r?NHS.blue:NHS.paleGrey}`,
              borderRadius:24,fontSize:"0.74rem",
              fontWeight:600,cursor:"pointer",
              transition:"all .17s",
              boxShadow:activeRole===r?"0 3px 10px rgba(0,94,184,.28)":"none",
            }}
            onMouseEnter={e=>{
              if(activeRole!==r){
                e.currentTarget.style.borderColor=NHS.blue;
                e.currentTarget.style.color=NHS.blue;
              }
            }}
            onMouseLeave={e=>{
              if(activeRole!==r){
                e.currentTarget.style.borderColor=NHS.paleGrey;
                e.currentTarget.style.color=NHS.darkBlue;
              }
            }}>
            <span style={{fontSize:"0.85rem"}}>
              {ROLE_ICONS[r]||"💼"}
            </span>
            {r}
          </button>
        ))}
      </div>
      {/* Scrollable suggestions row with nav arrows */}
      <div style={{position:"relative",width:"100%",maxWidth:680}}>
        {/* Left fade + arrow */}
        {canScrollLeft&&(
          <>
            <div style={{
              position:"absolute",left:0,top:0,
              width:48,height:"100%",zIndex:2,
              background:"linear-gradient(to right,#f8fafc,transparent)",
              pointerEvents:"none",borderRadius:"10px 0 0 10px"
            }}/>
            <button onClick={()=>nudge(-1)} style={{
              position:"absolute",left:0,top:"50%",
              transform:"translateY(-50%)",zIndex:3,
              width:28,height:28,borderRadius:"50%",
              background:NHS.blue,color:"#fff",border:"none",
              cursor:"pointer",display:"flex",
              alignItems:"center",justifyContent:"center",
              fontSize:"0.8rem",
              boxShadow:"0 2px 8px rgba(0,94,184,.35)",
            }}>‹</button>
          </>
        )}
        {/* Right fade + arrow */}
        {canScrollRight&&(
          <>
            <div style={{
              position:"absolute",right:0,top:0,
              width:48,height:"100%",zIndex:2,
              background:"linear-gradient(to left,#f8fafc,transparent)",
              pointerEvents:"none",
              borderRadius:"0 10px 10px 0"
            }}/>
            <button onClick={()=>nudge(1)} style={{
              position:"absolute",right:0,top:"50%",
              transform:"translateY(-50%)",zIndex:3,
              width:28,height:28,borderRadius:"50%",
              background:NHS.blue,color:"#fff",border:"none",
              cursor:"pointer",display:"flex",
              alignItems:"center",justifyContent:"center",
              fontSize:"0.8rem",
              boxShadow:"0 2px 8px rgba(0,94,184,.35)",
            }}>›</button>
          </>
        )}
        {/* Cards */}
        <div ref={scrollRef} className="nw-sc" style={{
          display:"flex",
          flexDirection:"row",
          overflowX:"auto",
          overflowY:"visible",
          flexWrap:"nowrap",
          gap:10,
          padding:"6px 4px 10px",
          scrollbarWidth:"none",
          msOverflowStyle:"none",
          WebkitOverflowScrolling:"touch",
          scrollBehavior:"smooth",
        }}>
          <style>{`
            .nw-sc::-webkit-scrollbar{display:none}
            .nw-sc{scrollbar-width:none}
            .nw-suggestion-card .nw-insert-btn{opacity:.6}
            .nw-suggestion-card:hover .nw-insert-btn{opacity:1}
          `}</style>
          {suggestions.map((s,i)=>(
            <div key={i} role="button" tabIndex={0} onClick={()=>onSuggestion(s)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSuggestion(s);}}}
              className="nw-suggestion-card"
              style={{
                flex:"0 0 175px",
                minWidth:175,
                maxWidth:175,
                height:82,
                background:"#fff",
                border:`1.5px solid ${NHS.paleGrey}`,
                borderRadius:12,
                padding:"28px 12px 10px 12px",
                cursor:"pointer",
                textAlign:"left",
                fontSize:"0.76rem",
                color:NHS.darkGrey,
                lineHeight:1.45,
                boxShadow:"0 2px 8px rgba(0,0,0,.05)",
                transition:"all .17s",
                overflow:"hidden",
                display:"-webkit-box",
                WebkitLineClamp:3,
                WebkitBoxOrient:"vertical",
                textOverflow:"ellipsis",
                wordBreak:"break-word",
                position:"relative",
                boxSizing:"border-box",
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.borderColor=NHS.brightBlue;
                e.currentTarget.style.transform="translateY(-3px)";
                e.currentTarget.style.boxShadow="0 6px 18px rgba(0,114,206,.14)";
                e.currentTarget.style.background="#F0F6FF";
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.borderColor=NHS.paleGrey;
                e.currentTarget.style.transform="translateY(0)";
                e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.05)";
                e.currentTarget.style.background="#fff";
              }}>
              <span style={{
                position:"absolute",top:8,left:9,
                fontSize:"0.62rem",
                background:NHS.blue+"18",
                color:NHS.blue,
                borderRadius:20,padding:"1px 7px",
                fontWeight:600,
              }}>{i+1}</span>
              <button type="button" className="nw-insert-btn" title="Insert prompt to edit before sending" aria-label="Insert this prompt into the chat box to edit before sending" onClick={e=>{e.stopPropagation();onPopulateInput?.(s);}} onKeyDown={e=>e.stopPropagation()} style={{position:"absolute",top:4,right:5,width:28,height:28,border:"none",borderRadius:8,background:"transparent",color:NHS.midGrey,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"opacity .17s,color .17s,background .17s"}} onMouseEnter={e=>{e.currentTarget.style.color=NHS.blue;e.currentTarget.style.background=NHS.blue+"12";}} onMouseLeave={e=>{e.currentTarget.style.color=NHS.midGrey;e.currentTarget.style.background="transparent";}}>
                <PencilLine size={15} strokeWidth={2.2}/>
              </button>
              {s}
            </div>
          ))}
        </div>
        {/* Dot counter */}
        <div style={{
          textAlign:"center",marginTop:4,
          fontSize:"0.69rem",color:NHS.midGrey
        }}>
          {suggestions.length} suggestions · scroll or use arrows to browse
        </div>
      </div>
    </div>
  );
}

function Sidebar({conversations,activeId,onSelect,onNew,onDelete,user,settings,vp,forceOpen,onToggle,onNavigateHome,onOpenKB}){
  const isMobile=vp==="mobile";
  const collapsed=forceOpen?false:settings.sidebarMode==="collapsed"||(settings.sidebarMode!=="expanded");
  const w=collapsed?0:vp==="wide"?255:230;
  const sidebarStyle=isMobile?{
    position:"fixed",top:0,left:0,bottom:0,zIndex:200,
    width:forceOpen?260:0,overflow:"hidden",
    background:NHS.darkBlue,display:"flex",flexDirection:"column",
    transition:"width .24s",
    boxShadow:forceOpen?"4px 0 24px rgba(0,0,0,0.35)":"none",
  }:{
    width:w,minWidth:w,background:NHS.darkBlue,display:"flex",flexDirection:"column",
    transition:"width .24s,min-width .24s",overflow:"hidden",
  };
  // FIX 2: Additional guard filter for blank titles
  const validConvs = conversations.filter(c => c.title && c.title.trim().length > 0);
  const groups=groupByDate(validConvs);
  return(
    <>
      {isMobile&&forceOpen&&(
        <div onClick={onToggle} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:199,animation:"nwFadeIn .2s ease"}}/>
      )}
      <div style={sidebarStyle}>
        <div style={{padding:collapsed?"11px 7px":"11px 12px",display:"flex",flexDirection:"column",gap:collapsed?0:6,borderBottom:"1px solid rgba(255,255,255,.1)",flexShrink:0}}>
          {/* Notewell home link */}
          {!collapsed && (
            <button
              onClick={() => onNavigateHome?.()}
              style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:7,padding:"5px 9px",cursor:"pointer",color:"rgba(255,255,255,.7)",fontSize:"0.73rem",fontWeight:700,display:"flex",alignItems:"center",gap:5,width:"100%",textAlign:"left",minHeight:34,letterSpacing:"-.01em"}}
              onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,.14)"}
              onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,.06)"}
            >
              <span>←</span>
              <span style={{fontWeight:900,fontSize:"0.8rem",color:"#fff"}}>Notewell</span>
              <span style={{opacity:.5,fontSize:"0.7rem"}}>/ Ask AI</span>
            </button>
          )}
          {/* Practice + toggle row */}
          <div style={{display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between"}}>
            {!collapsed && (
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <PracticeLogo practice={user.practice} size={22}/>
                <div style={{color:"rgba(255,255,255,.5)",fontSize:"0.6rem"}}>last 7 days</div>
              </div>
            )}
            <button onClick={onToggle} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:6,padding:"3px 7px",cursor:"pointer",color:"#fff",fontSize:".87rem",minWidth:32,minHeight:32}}>{collapsed?"›":"‹"}</button>
          </div>
        </div>
        <div style={{padding:"10px 12px 4px",flexShrink:0}}>
          <button onClick={()=>{onNew();if(isMobile)onToggle();}} style={{background:"rgba(255,255,255,.1)",border:"1.5px solid rgba(255,255,255,.2)",borderRadius:9,padding:"10px 14px",cursor:"pointer",color:"#fff",width:"100%",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:8,minHeight:44}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"}>
            <span>✏️</span>New conversation
          </button>
        </div>
        {!collapsed&&<div style={{padding:"0 12px 10px",flexShrink:0}}>
          <button onClick={()=>{onOpenKB?.();if(isMobile)onToggle();}} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px 12px",cursor:"pointer",color:"rgba(255,255,255,.65)",width:"100%",fontSize:"0.76rem",display:"flex",alignItems:"center",gap:7,minHeight:38}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.12)";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.color="rgba(255,255,255,.65)";}}>
            <span>📚</span>Knowledge Base
          </button>
        </div>}
        <div style={{flex:1,overflowY:"auto",padding:"0 10px 10px"}}>
          {Object.entries(groups).map(([label,convs])=>convs.length===0?null:(
            <div key={label}>
              <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,.32)",padding:"10px 4px 5px",letterSpacing:".07em",textTransform:"uppercase"}}>{label}</div>
              {convs.map(c=>(
                <div key={c.id} style={{position:"relative",marginBottom:3}}>
                  <button onClick={()=>{onSelect(c.id);if(isMobile)onToggle();}} style={{background:c.id===activeId?"rgba(255,255,255,.15)":"transparent",border:"none",borderRadius:8,padding:"10px 36px 10px 10px",cursor:"pointer",width:"100%",textAlign:"left",color:"#fff",minHeight:44,transition:"background .13s"}}
                    onMouseEnter={e=>{if(c.id!==activeId)e.currentTarget.style.background="rgba(255,255,255,.08)";}}
                    onMouseLeave={e=>{if(c.id!==activeId)e.currentTarget.style.background="transparent";}}>
                    <div style={{fontSize:"0.8rem",fontWeight:c.id===activeId?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.hasArtifact&&<span style={{marginRight:5}}>{ARTIFACT_TYPES[c.artifactType]?.icon||"📎"}</span>}{c.title}</div>
                    <div style={{fontSize:"0.63rem",color:"rgba(255,255,255,.32)",marginTop:2}}>{fmtDate(c.updatedAt)}</div>
                  </button>
                  <button onClick={()=>onDelete(c.id)} style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.25)",fontSize:"0.8rem",padding:isMobile?"8px 10px":"4px 6px",minWidth:isMobile?40:undefined,minHeight:isMobile?44:undefined,display:"flex",alignItems:"center",justifyContent:"center",transition:"color .13s"}} onMouseEnter={e=>e.currentTarget.style.color=NHS.red} onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.25)"}>🗑</button>
                </div>
              ))}
            </div>
          ))}
          {validConvs.length===0&&<div style={{fontSize:"0.77rem",color:"rgba(255,255,255,.28)",padding:"16px 4px",textAlign:"center"}}>No conversations yet</div>}
        </div>
        <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,.07)",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <UserAvatar user={user} size={26}/>
          <div style={{flex:1,overflow:"hidden"}}>
            <div style={{fontSize:"0.75rem",fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
            <div style={{fontSize:"0.61rem",color:"rgba(255,255,255,.34)"}}>DCB0129/0160 · MHRA Class I</div>
          </div>
        </div>
      </div>
    </>
  );
}

const CLIENT_SEARCH_TRIGGERS = [
  'latest', 'current', 'recent', 'update', '2025', '2026',
  'des ', 'pcn des', 'arrs', 'network contract', 'les ',
  'guidance', 'has changed', 'new policy', 'announcement',
  'nice', 'nhse', 'nhs england', 'formulary', 'tariff',
  'reimbursement rate', 'qof', 'iif', 'caip', 'gpad',
  'enhanced access', 'pharmacy first', 'icb', 'spec',
  'this year', 'this month', 'april 2025', 'april 2026'
];
function messageNeedsSearch(text) {
  const lower = text.toLowerCase();
  return CLIENT_SEARCH_TRIGGERS.some(t => lower.includes(t));
}

async function callClaude(messages, systemPrompt, onChunk, onKbSources, latestMessage) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const endpoint = `${supabaseUrl}/functions/v1/notewell-ask-ai`;

  const { data: { session } } = await supabase.auth.getSession();

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token || supabaseKey}`,
      "apikey": supabaseKey,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      systemPrompt,
      latestMessage: latestMessage || "",
      messages: messages.map(m => ({
        role: m.role,
        content: m.files?.length
          ? [
              ...m.files.map(f => ({
                type: f.mediaType?.includes("image") ? "image" : "document",
                source: { type: "base64", media_type: f.mediaType, data: f.data },
              })),
              { type: "text", text: m.content },
            ]
          : m.content,
      })),
    }),
  });

  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e.error?.message || e.error || `API error ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        if (currentEvent === "kb_sources") {
          const sources = JSON.parse(raw);
          onKbSources?.(sources);
          currentEvent = "";
          continue;
        }
        if (currentEvent === "web_search_sources") {
          // Web search sources received — could extend UI later
          currentEvent = "";
          continue;
        }
        const d = JSON.parse(raw).delta?.text;
        if (d) onChunk(d);
      } catch {}
      currentEvent = "";
    }
  }
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function NotewellChat({ user, onNavigateHome }) {
  const vp=useViewport();
  const [settings, setSettings]=useState(()=>{try{const s=localStorage.getItem("nw_ai_settings");return s?{...DEFAULT_SETTINGS,...JSON.parse(s)}:DEFAULT_SETTINGS;}catch{return DEFAULT_SETTINGS;}});
  const saveSettings = (patch) => {
    const next = {...settings, ...patch};
    setSettings(next);
    try{ localStorage.setItem("nw_ai_settings", JSON.stringify(next)); }catch{}
  };
  const [conversations,setConversations]=useState(()=>loadHistory());
  const [activeConvId,setActiveConvId]=useState(null);
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [files,setFiles]=useState([]);
  const [isLoading,setIsLoading]=useState(false);
  const [guardrailAlert,setGuardrailAlert]=useState(null);
  const [fileError,setFileError]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const [activeArtifact,setActiveArtifact]=useState(null);
  const [showAskAIImageStudio,setShowAskAIImageStudio]=useState(false);

  // Panel width state with persistence
  const PANEL_WIDTH_KEY='nw_panel_width';
  const DEFAULT_PANEL_W=460;
  const MIN_PANEL_W=300;
  const MAX_PANEL_W=780;
  const [panelWidth,setPanelWidth]=useState(()=>{
    try{const saved=localStorage.getItem(PANEL_WIDTH_KEY);return saved?parseInt(saved):DEFAULT_PANEL_W;}catch{return DEFAULT_PANEL_W;}
  });
  const savePanelWidth=(w)=>{
    const clamped=Math.max(MIN_PANEL_W,Math.min(MAX_PANEL_W,w));
    setPanelWidth(clamped);
    try{localStorage.setItem(PANEL_WIDTH_KEY,String(clamped));}catch{}
    return clamped;
  };

  // Drag-to-resize logic
  const dragRef=useRef(null);
  const isDragging=useRef(false);
  const dragStart=useRef({x:0,w:0});
  const onDragStart=(e)=>{
    isDragging.current=true;
    dragStart.current={x:e.clientX,w:panelWidth};
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
  };
  useEffect(()=>{
    const onMove=(e)=>{
      if(!isDragging.current)return;
      const delta=dragStart.current.x-e.clientX;
      savePanelWidth(dragStart.current.w+delta);
    };
    const onUp=()=>{
      if(!isDragging.current)return;
      isDragging.current=false;
      document.body.style.cursor='';
      document.body.style.userSelect='';
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };
  },[panelWidth]);
  const [sidebarForceOpen,setSidebarForceOpen]=useState(false);
  const [showGuide,setShowGuide]=useState(()=>localStorage.getItem("nw_ai_welcomed")!=="1");
  const [showProfile,setShowProfile]=useState(false);
  const [profileInitialTab,setProfileInitialTab]=useState("profile");
  const [userProfile,setUserProfile]=useState(()=>{try{return localStorage.getItem(PROFILE_KEY)||"";}catch{return "";}});
  const [customInstructions,setCustomInstructions]=useState(()=>{try{return localStorage.getItem(INSTRUCTIONS_KEY)||"";}catch{return "";}});
  const bottomRef=useRef(null);const textareaRef=useRef(null);const fileInputRef=useRef(null);
  const accumRef=useRef("");const streamingIdRef=useRef(null);
  // Speech-to-text state
  const [isListening,setIsListening]=useState(false);
  const [interimText,setInterimText]=useState("");
  const [speechError,setSpeechError]=useState(null);
  const speechRef=useRef(null);

  // ── Voice Panel state (desktop only) ─────────────────────────────────────
  const [showVoiceStudio,setShowVoiceStudio]=useState(false);
  const startListening=useCallback(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setSpeechError("Speech recognition requires Chrome or Safari 17+");return;}
    setSpeechError(null);setInterimText("");
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang="en-GB";r.maxAlternatives=1;
    r.onstart=()=>setIsListening(true);
    r.onresult=(ev)=>{let interim="";for(let i=ev.resultIndex;i<ev.results.length;i++){const t=ev.results[i][0].transcript;if(ev.results[i].isFinal){setInput(p=>(p?p+" ":"")+t.trim());setInterimText("");}else{interim+=t;}}setInterimText(interim);};
    r.onerror=(ev)=>{if(ev.error==="no-speech"||ev.error==="aborted")return;setIsListening(false);setSpeechError("Mic error: "+ev.error);};
    r.onend=()=>{setIsListening(false);setInterimText("");};
    r.start();speechRef.current=r;
  },[]);
  const stopListening=useCallback(()=>{if(speechRef.current){speechRef.current.stop();speechRef.current=null;}setIsListening(false);setInterimText("");},[]);
  useEffect(()=>()=>{if(speechRef.current){speechRef.current.stop();}},[]);
  const compact=settings.compactMessages||vp==="compact"||vp==="mobile";
  const systemPrompt=buildSystemPrompt(user,settings,userProfile,customInstructions);
  const profileActive=!!(userProfile.trim()||customInstructions.trim());

  useEffect(()=>{if(conversations.length>0)saveHistory(conversations);},[conversations]);
  useEffect(()=>{if(activeConvId&&messages.length>0){const done=messages.filter(m=>!m.streaming);if(done.length>0)saveMsgs(activeConvId,done);}},[messages,activeConvId]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,isLoading]);
  useEffect(()=>{if(textareaRef.current){textareaRef.current.style.height="auto";textareaRef.current.style.height=Math.min(textareaRef.current.scrollHeight,150)+"px";}},[input]);

  // Restore streamed content when tab becomes visible again
  useEffect(()=>{
    const handleVisibility=()=>{
      if(document.visibilityState==='visible'){
        if(streamingIdRef.current&&accumRef.current.length>0){
          setMessages(p=>p.map(m=>m.id===streamingIdRef.current&&m.content===''?{...m,content:accumRef.current}:m));
          return;
        }
        try{
          const raw=localStorage.getItem('nw_stream_partial');
          if(raw){const saved=JSON.parse(raw);if(saved.convId===activeConvId&&Date.now()-saved.ts<300000&&saved.content.length>0){setMessages(p=>p.map(m=>m.id===saved.id&&m.content===''?{...m,content:saved.content,streaming:false}:m));}}
        }catch{}
      }
    };
    document.addEventListener('visibilitychange',handleVisibility);
    return()=>document.removeEventListener('visibilitychange',handleVisibility);
  },[activeConvId]);

  const newConv=useCallback(()=>{const id=uid();setConversations(p=>[{id,title:"New conversation",updatedAt:new Date()},...p]);setActiveConvId(id);setMessages([]);setFiles([]);setInput("");setGuardrailAlert(null);setActiveArtifact(null);setSidebarForceOpen(false);},[]);

  // FIX 3: Persist the active conversation ID so tab navigation / remounts restore session
  useEffect(()=>{
    if(activeConvId){try{localStorage.setItem(LAST_CONV_KEY,activeConvId);}catch{}}
  },[activeConvId]);

  // FIX 3 (v2): On mount, restore last session instead of always creating a new blank
  // conversation. We do NOT check loadHistory() here because of a save-order race:
  // saveHistory (conversations effect, line ~1206) runs before saveMsgs (messages effect,
  // line ~1207) in the same render cycle. If the tab was switched mid-stream the conv is
  // absent from HIST_KEY even though nw_ai_msgs_{id} IS populated. Restore from msgs alone.
  useEffect(()=>{
    let restored=false;
    try{
      const lastId=localStorage.getItem(LAST_CONV_KEY);
      if(lastId){
        const msgs=loadMsgs(lastId);
        if(msgs.length>0){
          setActiveConvId(lastId);
          setMessages(msgs);
          // Re-add to sidebar if history missed it (race condition)
          setConversations(p=>{
            if(p.find(c=>c.id===lastId))return p;
            const firstUser=msgs.find(m=>m.role==="user");
            const title=firstUser?.content
              ?(firstUser.content.length>44?firstUser.content.slice(0,44)+"\u2026":firstUser.content)
              :"Restored conversation";
            return [{id:lastId,title,updatedAt:new Date()},...p];
          });
          const lastAI=[...msgs].reverse().find(m=>m.role==="assistant"&&m.artifact);
          setActiveArtifact(lastAI?.artifact||null);
          restored=true;
        }
      }
    }catch{}
    if(!restored)newConv();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleProfileSaved=useCallback(()=>{
    setUserProfile(localStorage.getItem(PROFILE_KEY)||"");
    setCustomInstructions(localStorage.getItem(INSTRUCTIONS_KEY)||"");
    setShowProfile(false);
  },[]);

  const selectConv=useCallback((id)=>{setActiveConvId(id);const saved=loadMsgs(id);setMessages(saved);setFiles([]);setInput("");setGuardrailAlert(null);const lastAI=[...saved].reverse().find(m=>m.role==="assistant"&&m.artifact);setActiveArtifact(lastAI?.artifact||null);setSidebarForceOpen(false);},[]);
  const deleteConv=useCallback((id)=>{setConversations(p=>p.filter(c=>c.id!==id));localStorage.removeItem(msgKey(id));if(id===activeConvId)newConv();},[activeConvId,newConv]);

  const handleFiles=useCallback(async(nf)=>{
    setFileError(null);const valid=[];
    for(const f of nf){
      if(!ALLOWED_TYPES.includes(f.type)){setFileError(`"${f.name}" — unsupported type.`);continue;}
      if(f.size>10485760){setFileError(`"${f.name}" exceeds 10 MB.`);continue;}
      if(files.length+valid.length>=5){setFileError("Max 5 files per message.");break;}
      const data=await readBase64(f);
      // Anthropic only accepts images and PDFs as native attachments. For Word/Excel/PowerPoint/CSV/TXT
      // we extract the text up-front via the extract-document-text edge function and pass it as inline
      // text. This avoids "Anthropic API error: 400 — unsupported document media type".
      const isImage=IMAGE_TYPES.has(f.type);
      const isPdf=f.type==="application/pdf";
      let extractedText=null;
      if(!isImage&&!isPdf){
        let fileType=null;
        if(f.type.includes("word")||f.type==="application/msword")fileType="word";
        else if(f.type.includes("sheet")||f.type==="application/vnd.ms-excel")fileType="excel";
        else if(f.type.includes("presentation"))fileType="powerpoint";
        else if(f.type==="text/plain"||f.type==="text/csv")fileType="text";
        try{
          if(fileType==="text"){
            extractedText=atob(data);
          }else if(fileType){
            const{data:res,error}=await supabase.functions.invoke("extract-document-text",{
              body:{fileType,fileName:f.name,dataUrl:`data:${f.type};base64,${data}`}
            });
            if(error)throw error;
            extractedText=res?.extractedText||"";
          }
        }catch(err){
          console.error("Document text extraction failed",err);
          setFileError(`Could not read "${f.name}". Please convert to PDF and re-attach.`);
          continue;
        }
        if(!extractedText||!extractedText.trim()){
          setFileError(`"${f.name}" appears empty or unreadable. Please convert to PDF and re-attach.`);
          continue;
        }
      }
      valid.push({name:f.name,mediaType:f.type,size:f.size,data,extractedText});
    }
    setFiles(p=>[...p,...valid]);
  },[files]);

  const handlePaste=useCallback((e)=>{
    const cd=e.clipboardData;if(!cd)return;
    // Check for image files in clipboard
    const imageFiles=[];
    if(cd.files&&cd.files.length>0){for(const f of cd.files){if(IMAGE_TYPES.has(f.type))imageFiles.push(f);}}
    if(cd.items){for(const item of cd.items){if(item.kind==="file"&&IMAGE_TYPES.has(item.type)){const f=item.getAsFile();if(f&&!imageFiles.some(x=>x.size===f.size&&x.type===f.type))imageFiles.push(f);}}}
    // Handle images
    if(imageFiles.length>0){
      const now=new Date();const ts=now.getFullYear()+String(now.getMonth()+1).padStart(2,"0")+String(now.getDate()).padStart(2,"0")+"-"+String(now.getHours()).padStart(2,"0")+String(now.getMinutes()).padStart(2,"0")+String(now.getSeconds()).padStart(2,"0");
      const renamed=imageFiles.map((f,i)=>{const ext=f.type.split("/")[1]||"png";const name=`pasted-image-${ts}${imageFiles.length>1?`-${i+1}`:""}.${ext}`;return new File([f],name,{type:f.type});});
      handleFiles(renamed);
      toast.success("Image attached",{duration:2000});
    }
    // Handle text paste (allow default if no images, or insert manually if images present too)
    const text=cd.getData("text/plain");
    if(text){e.stopPropagation();const ta=textareaRef.current;if(ta){e.preventDefault();const start=ta.selectionStart;const end=ta.selectionEnd;const newVal=input.slice(0,start)+text+input.slice(end);setInput(newVal);requestAnimationFrame(()=>{if(textareaRef.current){textareaRef.current.selectionStart=start+text.length;textareaRef.current.selectionEnd=start+text.length;}});}}
    else if(imageFiles.length>0){e.preventDefault();}
  },[input,handleFiles]);

  // FIX 6: Runware image generation handler
  const handleRunwareImage = useCallback(async (text, userMsg) => {
    const aiId = uid();
    const tempContent = "🎨 Generating image — this takes a few seconds...";
    setMessages(p => [...p, { id: aiId, role: "assistant", content: tempContent, timestamp: new Date(), streaming: false, generatedImage: true }]);
    
    try {
      const formData = new FormData();
      formData.append('prompt', text);
      formData.append('mode', 'generation');
      formData.append('size', '1024x1024');
      formData.append('quality', 'high');

      const { data, error } = await supabase.functions.invoke('runware-image-generation', { body: formData });

      if (error) throw error;
      if (!data?.imageUrl) throw new Error("No image returned");

      const regenerate = () => handleRunwareImage(text, userMsg);
      setMessages(p => p.map(m => m.id === aiId ? {
        ...m,
        content: "Here's your generated image:",
        imageUrl: data.imageUrl,
        onRegenerate: regenerate,
        generatedImage: true,
      } : m));
    } catch (e) {
      setMessages(p => p.map(m => m.id === aiId ? {
        ...m,
        content: "Image generation failed — try a different description, or use the full [Image Studio →](/image-create) for more options.",
        imageError: true,
        generatedImage: true,
      } : m));
    }
  }, []);

  const send=useCallback(async(override)=>{
    const text=(override??input).trim();if(!text&&files.length===0)return;if(isLoading)return;
    const pii=detectPII(text);if(pii){setGuardrailAlert(`Possible ${pii.label} detected. Please anonymise patient data before submitting.`);return;}
    const userMsg={id:uid(),role:"user",content:text,files:files.slice(),timestamp:new Date()};
    const newMsgs=[...messages,userMsg];setMessages(newMsgs);setInput("");setFiles([]);setIsLoading(true);
    if(messages.length===0){const title=text.length>44?text.slice(0,44)+"…":text;setConversations(p=>p.map(c=>c.id===activeConvId?{...c,title,updatedAt:new Date()}:c));}

    // Route image requests into the Ask AI Image Studio templates instead of the retired generator.
    if (ASK_AI_IMAGE_STUDIO_ENABLED && isRunwareImageRequest(text) && files.length === 0) {
      setShowAskAIImageStudio(true);
      setMessages(p => [...p, { id: uid(), role: "assistant", content: "Opening Image Studio — choose a template to create your image.", timestamp: new Date() }]);
      setIsLoading(false);
      setConversations(p=>p.map(c=>c.id===activeConvId?{...c,updatedAt:new Date()}:c));
      return;
    }

    const aiId=uid();accumRef.current="";streamingIdRef.current=aiId;let kbSources=[];const isSearching=messageNeedsSearch(text);
    setMessages(p=>[...p,
      ...(isSearching?[{id:uid(),role:"search-indicator",content:"🔍 Searching NHS sources...",timestamp:new Date()}]:[]),
      {id:aiId,role:"assistant",content:"",timestamp:new Date(),streaming:true,kbSources:[]}
    ]);
    try{
      await callClaude(newMsgs,systemPrompt,chunk=>{
        accumRef.current+=chunk;
        try{localStorage.setItem('nw_stream_partial',JSON.stringify({id:aiId,convId:activeConvId,content:accumRef.current,ts:Date.now()}));}catch{}
        setMessages(p=>p.filter(m=>m.role!=="search-indicator").map(m=>m.id===aiId?{...m,content:accumRef.current}:m));
      },sources=>{kbSources=sources;setMessages(p=>p.map(m=>m.id===aiId?{...m,kbSources:sources}:m));},text);
      const artifact=parseArtifact(accumRef.current);
      try{localStorage.removeItem('nw_stream_partial');}catch{}
      if(artifact){setMessages(p=>p.filter(m=>m.role!=="search-indicator").map(m=>m.id===aiId?{...m,content:accumRef.current,streaming:false,artifact,kbSources}:m));setActiveArtifact(artifact);setConversations(p=>p.map(c=>c.id===activeConvId?{...c,updatedAt:new Date(),hasArtifact:true,artifactType:artifact.type}:c));}
      else{setMessages(p=>p.filter(m=>m.role!=="search-indicator").map(m=>m.id===aiId?{...m,content:accumRef.current,streaming:false,kbSources}:m));setConversations(p=>p.map(c=>c.id===activeConvId?{...c,updatedAt:new Date()}:c));}
      streamingIdRef.current=null;
    }catch(e){
      try{localStorage.removeItem('nw_stream_partial');}catch{}
      setMessages(p=>p.filter(m=>m.role!=="search-indicator").map(m=>m.id===aiId?{...m,content:accumRef.current.length>20?accumRef.current:`⚠️ Error: ${e.message}`,streaming:false}:m));
      streamingIdRef.current=null;
    }
    setIsLoading(false);
  },[input,files,messages,isLoading,activeConvId,systemPrompt,handleRunwareImage]);

  const ig=vp==="wide"?"0 7%":vp==="standard"?"0 2%":"0";

  return(
    <div style={{display:"flex",height:"100%",fontFamily:"'Trebuchet MS','Frutiger',Arial,sans-serif",background:"#F0F4F8",overflow:"hidden",position:"relative"}}>
      <style>{`
        @keyframes nwBlink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes nwBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
        @keyframes nwFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes nwSpin{to{transform:rotate(360deg)}}
        @keyframes nwSlideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        @keyframes nwSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes nwVoiceBar{0%{height:4px}100%{height:16px}}
        @keyframes nwPulseRed{0%,100%{border-color:#DC2626;box-shadow:0 0 0 3px rgba(220,38,38,.15)}50%{border-color:#EF4444;box-shadow:0 0 0 6px rgba(220,38,38,.25)}}
        @keyframes nwVoicePulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.18);opacity:1}}
        @keyframes nwVoiceRipple{0%{transform:scale(.8);opacity:.6}100%{transform:scale(2.2);opacity:0}}
        .nw-wrap *{box-sizing:border-box}
        .nw-wrap ::-webkit-scrollbar{width:5px}
        .nw-wrap ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:3px}
      `}</style>

      {showGuide&&<GuideModal user={user} onClose={()=>{setShowGuide(false);localStorage.setItem("nw_ai_welcomed","1");}} vp={vp}/>}
      {showProfile&&<UserProfileModal user={user} onClose={handleProfileSaved} vp={vp} onNavigateHome={onNavigateHome} initialTab={profileInitialTab} settings={settings} saveSettings={saveSettings}/>}

      <Sidebar conversations={conversations} activeId={activeConvId} onSelect={selectConv} onNew={newConv} onDelete={deleteConv} user={user} settings={settings} vp={vp} forceOpen={sidebarForceOpen} onToggle={()=>setSidebarForceOpen(o=>!o)} onNavigateHome={onNavigateHome} onOpenKB={()=>{setProfileInitialTab("kb");setShowProfile(true);}}/>

      <div className="nw-wrap" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",minWidth:0}} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(Array.from(e.dataTransfer.files));}}>
        {dragOver&&<div style={{position:"absolute",inset:0,background:"rgba(0,114,206,.08)",border:`3px dashed ${NHS.brightBlue}`,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",color:NHS.blue,fontWeight:700}}>📎 Drop to attach</div>}

        {/* NHS Blue Banner — matching ENN/NRES dashboard style */}
        <div style={{background:"linear-gradient(to right, #005EB8, #003087, #002060)",color:"#fff",padding:vp==="mobile"?"0 10px":"0 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,height:48,boxShadow:"0 2px 6px rgba(0,0,0,.15)"}}>
          <div style={{display:"flex",alignItems:"center",gap:vp==="mobile"?8:12,minWidth:0}}>
            {/* Home */}
            <button
              onClick={() => onNavigateHome?.()}
              style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"5px 6px",borderRadius:8,color:"#fff",fontSize:"0.82rem",fontWeight:700,minHeight:40,transition:"opacity .13s",opacity:.9}}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"}
              onMouseLeave={e=>e.currentTarget.style.opacity=".9"}
              title="Back to Notewell"
              aria-label="Back to Notewell"
            >
              <img src="/android-chrome-192x192.png" alt="Notewell AI" style={{width:24,height:24,borderRadius:"50%",flexShrink:0,objectFit:"cover",background:"#fff"}} onError={e=>{e.currentTarget.style.display="none";}}/>
              {vp !== "mobile" && <span style={{fontWeight:800,letterSpacing:"-.01em"}}>Notewell AI</span>}
            </button>

            {/* Hamburger — mobile only */}
            {vp === "mobile" && (
              <button onClick={() => setSidebarForceOpen(o => !o)}
                style={{background:"transparent",border:"none",cursor:"pointer",color:"rgba(255,255,255,.8)",fontSize:"1.2rem",padding:"6px 4px",minWidth:40,minHeight:40,display:"flex",alignItems:"center",justifyContent:"center"}}
                aria-label="Open conversation history">☰</button>
            )}

            {/* Divider */}
            <div style={{width:1,height:20,background:"rgba(255,255,255,.3)",flexShrink:0}}/>

            {/* Context */}
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
              <span style={{fontSize:"0.82rem",color:"rgba(255,255,255,.92)",fontWeight:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {vp==="mobile"?"AI Assistant":"Notewell AI Assistant"}
              </span>
              <span style={{display:"flex",alignItems:"center",gap:3,fontSize:"0.65rem",color:"rgba(255,255,255,.7)"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#00A499",display:"inline-block"}}/>
                Ready
                {profileActive && <span style={{marginLeft:2}}>· Profile active</span>}
              </span>
              </div>
            {/* + New Chat — left side */}
            <button onClick={()=>{newConv();}} style={{background:"transparent",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:"0.74rem",color:"#fff",transition:"all .13s",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.15)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}} title="New conversation">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {vp!=="compact"&&vp!=="mobile"&&" New Chat"}
            </button>

            {/* History toggle — left side */}
            <button onClick={()=>setSidebarForceOpen(o=>!o)} style={{background:sidebarForceOpen?"rgba(255,255,255,.18)":"transparent",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:"0.74rem",color:"#fff",transition:"all .13s",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.2)";}} onMouseLeave={e=>{e.currentTarget.style.background=sidebarForceOpen?"rgba(255,255,255,.18)":"transparent";}} title="Toggle chat history">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
              {vp!=="compact"&&vp!=="mobile"&&" History"}
            </button>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:vp==="mobile"?4:6,flexShrink:0}}>
            {activeArtifact&&vp!=="compact"&&<button onClick={()=>setActiveArtifact(null)} style={{background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.25)",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:"0.74rem",color:"#fff",display:"flex",alignItems:"center",gap:4}}>{ARTIFACT_TYPES[activeArtifact.type]?.icon} {(activeArtifact.title||"").slice(0,20)}{(activeArtifact.title||"").length>20?"…":""}</button>}

            {/* My Profile button */}
            <button onClick={()=>{setProfileInitialTab("profile");setShowProfile(true);}} style={{background:profileActive?"rgba(255,255,255,.15)":"transparent",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:"0.77rem",color:"#fff",transition:"all .13s",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.2)";}} onMouseLeave={e=>{e.currentTarget.style.background=profileActive?"rgba(255,255,255,.15)":"transparent";}} title="My Profile & Custom Instructions">
              👤{vp!=="compact"&&" My Profile"}{profileActive&&<span style={{width:6,height:6,borderRadius:"50%",background:"#00A499",display:"inline-block",flexShrink:0}}/>}
            </button>


            {/* Voice Studio button */}
            <button onClick={()=>setShowVoiceStudio(true)} style={{background:"transparent",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:"0.77rem",color:"#fff",transition:"all .13s",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.15)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}} title="AI Voice Studio">🎙{vp!=="compact"&&" Voice"}</button>

            {/* Guide button */}
            <button onClick={()=>setShowGuide(true)} style={{background:"transparent",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:7,padding:"4px 9px",cursor:"pointer",fontSize:"0.77rem",color:"#fff",transition:"all .13s",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.15)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>? {vp!=="compact"&&"Guide"}</button>
            
          </div>
        </div>




        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:vp==="compact"?"12px 11px":"16px 16px"}}>
          <div style={{margin:"0 auto",padding:ig}}>
            {messages.length===0&&!isLoading?<WelcomeScreen user={user} vp={vp} onSuggestion={t=>send(t)} onHelp={()=>setShowGuide(true)} onProfile={()=>{setProfileInitialTab("profile");setShowProfile(true);}} onOpenImageStudio={()=>setShowAskAIImageStudio(true)} onPopulateInput={t=>setInput(prev=>{const next=prev.trim()?`${prev}\n${t}`:t;requestAnimationFrame(()=>{const ta=textareaRef.current;if(ta){ta.focus();ta.setSelectionRange(next.length,next.length);ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,150)+"px";}});return next;})} settings={settings}/>:messages.map((m,idx)=>m.role==="search-indicator"?<div key={m.id} style={{animation:"nwFadeIn .18s ease",padding:"0 "+ig,marginBottom:6}}><div style={{fontSize:"0.73rem",color:"#005EB8",fontStyle:"italic",marginTop:4,display:"flex",alignItems:"center",gap:6}}><span style={{display:"inline-block",width:14,height:14,border:"2px solid #005EB8",borderTopColor:"transparent",borderRadius:"50%",animation:"nwSpin .8s linear infinite"}}/>Searching NHS sources…</div></div>:<div key={m.id} style={{animation:"nwFadeIn .18s ease"}}><MessageBubble msg={m} user={user} settings={settings} compact={compact} hasPanel={!!activeArtifact&&vp!=="compact"} vp={vp} isLast={idx===messages.length-1} onFollowUp={t=>send(t)} onOpenArtifact={a=>setActiveArtifact(activeArtifact?.title===a.title?null:a)}/></div>)}
            {isLoading&&messages[messages.length-1]?.role!=="assistant"&&(<div style={{display:"flex",gap:compact?8:11,marginBottom:14,alignItems:"flex-start"}}><img src="/android-chrome-192x192.png" alt="Notewell AI" style={{width:compact?27:33,height:compact?27:33,borderRadius:"50%",flexShrink:0,objectFit:"cover",background:"#fff"}}/><div style={{background:"#fff",border:`1px solid ${NHS.paleGrey}`,borderRadius:"15px 15px 15px 4px",padding:"10px 14px",boxShadow:"0 2px 10px rgba(0,0,0,.06)",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:NHS.lightBlue,display:"inline-block",animation:`nwBounce 1.2s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>)}
            <div ref={bottomRef}/>
          </div>
        </div>


        {/* Input */}
        <div style={{padding:vp==="mobile"?"8px 12px calc(12px + env(safe-area-inset-bottom, 0px))":(vp==="compact"?"9px 11px 12px":"11px 16px 14px"),background:"#fff",borderTop:vp==="mobile"?"none":`1px solid ${NHS.paleGrey}`,flexShrink:0}}>
          <div style={{maxWidth:"100%",margin:"0 auto",padding:ig}}>
            {guardrailAlert&&<div style={{background:"#FFF5F5",border:`1.5px solid ${NHS.red}`,borderRadius:9,padding:"7px 13px",display:"flex",gap:7,alignItems:"flex-start",marginBottom:7,fontSize:"0.79rem",animation:"nwFadeIn .2s ease"}}><span style={{flexShrink:0}}>⚠️</span><div style={{flex:1,color:"#7a1010"}}><strong style={{color:NHS.red}}>Patient Data Warning</strong><p style={{margin:"2px 0 0"}}>{guardrailAlert}</p></div><button onClick={()=>setGuardrailAlert(null)} style={{background:"none",border:"none",cursor:"pointer",color:NHS.red,fontSize:".88rem",padding:0,flexShrink:0}}>✕</button></div>}
            {fileError&&<div style={{background:"#FFF5EC",border:`1px solid ${NHS.warmYellow}`,borderRadius:7,padding:"4px 11px",fontSize:"0.75rem",color:"#7a4a00",marginBottom:6,display:"flex",justifyContent:"space-between"}}><span>⚠️ {fileError}</span><button onClick={()=>setFileError(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#7a4a00"}}>✕</button></div>}
            {files.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6,alignItems:"flex-end"}}>
              {files.map((f,i)=>{
                const isImg=IMAGE_TYPES.has(f.mediaType);
                return isImg?(
                  <div key={i} style={{position:"relative",width:68,height:68,borderRadius:8,overflow:"hidden",border:`1.5px solid ${NHS.lightBlue}`,background:"#F0F4F8",animation:"nwFadeIn .2s ease",flexShrink:0}} title={`${f.name} · ${fmtSize(f.size)}`}>
                    <img src={`data:${f.mediaType};base64,${f.data}`} alt={f.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} aria-label={`Remove attachment ${f.name}`} style={{position:"absolute",top:2,right:2,width:20,height:20,borderRadius:"50%",background:"rgba(0,0,0,.55)",border:"none",cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",lineHeight:1}}>✕</button>
                  </div>
                ):(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:3,background:"#EDF4FF",border:`1px solid ${NHS.lightBlue}`,borderRadius:6,padding:"2px 6px",fontSize:"0.71rem",color:NHS.darkBlue}}>📎 {f.name} <span style={{color:NHS.midGrey}}>{fmtSize(f.size)}</span><button onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))} aria-label={`Remove attachment ${f.name}`} style={{background:"none",border:"none",cursor:"pointer",color:NHS.midGrey,padding:0,fontSize:".76rem"}}>✕</button></div>
                );
              })}
            </div>}
            
            <div style={{position:"relative",border:`1.5px solid ${isListening?NHS.red:NHS.paleGrey}`,borderRadius:12,background:"#F8FAFC",boxShadow:isListening?"0 0 0 3px rgba(220,38,38,.15)":"0 2px 10px rgba(0,0,0,.05)",transition:"border-color .17s,box-shadow .17s",animation:isListening?"nwPulseRed 1.5s ease-in-out infinite":"none"}} onFocusCapture={e=>{if(!isListening){e.currentTarget.style.borderColor=NHS.brightBlue;e.currentTarget.style.boxShadow=`0 0 0 3px rgba(0,114,206,.08)`;}}} onBlurCapture={e=>{if(!isListening){e.currentTarget.style.borderColor=NHS.paleGrey;e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,.05)";}}}>
              {input.length>0&&<button type="button" onClick={()=>{setInput("");requestAnimationFrame(()=>textareaRef.current?.focus());}} title="Clear input" aria-label="Clear the input box" style={{position:"absolute",top:8,right:8,zIndex:2,width:24,height:24,border:"none",borderRadius:7,background:"transparent",color:"#9CA3AF",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:1,transition:"opacity .17s,color .17s,background .17s"}} onMouseEnter={e=>{e.currentTarget.style.color=NHS.blue;e.currentTarget.style.background=NHS.blue+"12";}} onMouseLeave={e=>{e.currentTarget.style.color="#9CA3AF";e.currentTarget.style.background="transparent";}}>
                <X size={15} strokeWidth={2.3}/>
              </button>}
              <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();if(input.length>0){setInput("");requestAnimationFrame(()=>textareaRef.current?.focus());}else{textareaRef.current?.blur();}return;}if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} onPaste={handlePaste} placeholder="Ask anything, or request an Excel report or PowerPoint…" rows={1} disabled={isLoading} style={{width:"100%",border:"none",background:"transparent",padding:input.length>0?(compact?"9px 40px 6px 12px":"12px 42px 6px 14px"):(compact?"9px 12px 6px":"12px 14px 6px"),resize:"none",overflowY:"auto",maxHeight:"150px",fontSize:vp==="mobile"?"16px":`${FONT_SCALE[settings.fontSize||"medium"]}rem`,color:NHS.darkGrey,lineHeight:1.6,fontFamily:"inherit"}}/>
              {/* Listening waveform + interim text */}
              {isListening&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"2px 12px 6px"}}>
                <div style={{display:"flex",alignItems:"center",gap:2,height:16}}>{[0,1,2,3,4].map(i=><div key={i} style={{width:3,borderRadius:2,background:"#2563eb",animation:`nwVoiceBar .8s ease-in-out ${i*0.12}s infinite alternate`,height:6}}/>)}</div>
                <span style={{fontSize:"0.74rem",color:"#2563eb",fontWeight:600}}>Listening…</span>
                {interimText&&<span style={{fontSize:"0.74rem",color:"#2563eb",background:"#EFF6FF",borderRadius:12,padding:"1px 8px",opacity:.7,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{interimText}</span>}
              </div>}
              {speechError&&<div style={{padding:"2px 12px 6px",fontSize:"0.72rem",color:"#b91c1c"}}>{speechError}</div>}
              <div style={{display:"flex",alignItems:"center",padding:"4px 8px 8px",gap:5}}>
                <button onClick={()=>fileInputRef.current?.click()} disabled={isLoading||files.length>=5} style={{background:"none",border:`1px solid ${NHS.paleGrey}`,borderRadius:7,padding:"3px 8px",cursor:files.length>=5?"not-allowed":"pointer",color:files.length>=5?"#ccc":NHS.midGrey,fontSize:"0.77rem",display:"flex",alignItems:"center",gap:3}} onMouseEnter={e=>{if(files.length<5)e.currentTarget.style.borderColor=NHS.brightBlue;}} onMouseLeave={e=>e.currentTarget.style.borderColor=NHS.paleGrey}>📎 {vp!=="compact"&&"Attach"}{files.length>0&&<span style={{background:NHS.blue,color:"#fff",borderRadius:9,padding:"0 4px",fontSize:".6rem",fontWeight:700}}>{files.length}</span>}</button>
                <input ref={fileInputRef} type="file" multiple accept={ALLOWED_TYPES.join(",")} style={{display:"none"}} onChange={e=>{handleFiles(Array.from(e.target.files));e.target.value="";}}/>
                {/* Mic button */}
                <button onClick={()=>{if(isListening)stopListening();else startListening();}} disabled={isLoading} style={{width:vp==="mobile"?44:36,height:vp==="mobile"?44:36,borderRadius:8,border:"none",cursor:isLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .17s",background:isListening?NHS.red:"#F0F4F8",color:isListening?"#fff":"#6B7280",boxShadow:isListening?"0 0 0 4px rgba(220,38,38,0.2)":"none",flexShrink:0}} title={isListening?"Stop listening":"Voice input"} aria-label={isListening?"Stop listening":"Voice input"}>
                  {isListening?<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                </button>
                {/* Clear attachments button */}
                {files.length>0&&<button onClick={()=>setFiles([])} style={{width:36,height:36,borderRadius:8,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:"#F0F4F8",color:"#6B7280",flexShrink:0,transition:"all .17s"}} onMouseEnter={e=>{e.currentTarget.style.background="#FEE2E2";e.currentTarget.style.color="#DC2626";}} onMouseLeave={e=>{e.currentTarget.style.background="#F0F4F8";e.currentTarget.style.color="#6B7280";}} title="Clear attachments" aria-label="Clear attachments">
                  <X size={16} strokeWidth={2.2}/>
                </button>}
                
                <div style={{flex:1}}/>
                {input.length>180&&<span style={{fontSize:"0.64rem",color:NHS.midGrey}}>{input.length}</span>}
                <button onClick={()=>send()} disabled={isLoading||(!input.trim()&&files.length===0)} style={{background:(isLoading||(!input.trim()&&files.length===0))?NHS.paleGrey:NHS.blue,border:"none",borderRadius:8,padding:compact?"5px 12px":"7px 16px",cursor:isLoading||(!input.trim()&&files.length===0)?"not-allowed":"pointer",color:"#fff",fontWeight:700,fontSize:"0.84rem",display:"flex",alignItems:"center",gap:4,transition:"all .17s",boxShadow:isLoading?"none":`0 2px 8px rgba(0,94,184,.26)`}} onMouseEnter={e=>{if(!isLoading&&(input.trim()||files.length>0))e.currentTarget.style.background=NHS.darkBlue;}} onMouseLeave={e=>{if(!isLoading&&(input.trim()||files.length>0))e.currentTarget.style.background=NHS.blue;}}>{isLoading?[0,1,2].map(i=><span key={i} style={{width:4,height:4,borderRadius:"50%",background:"#fff",display:"inline-block",animation:`nwBounce 1.2s ease-in-out ${i*.2}s infinite`}}/>):"Send ↑"}</button>
              </div>
            </div>
            <div style={{fontSize:"0.61rem",color:NHS.midGrey,textAlign:"center",marginTop:6}}>Notewell AI may make mistakes — apply clinical judgement · <span style={{color:NHS.blue}}>DCB0129/DCB0160</span> · MHRA Class I · <span style={{color:NHS.blue}}>ICO ZB226324</span></div>
          </div>
        </div>
      </div>

      {/* Artifact panel — desktop with drag handle */}
      {activeArtifact&&vp!=="compact"&&vp!=="mobile"&&(
        <>
          <div ref={dragRef} onMouseDown={onDragStart} style={{width:6,background:"transparent",cursor:"col-resize",flexShrink:0,position:"relative",zIndex:10,transition:"background .15s",display:"flex",alignItems:"center",justifyContent:"center"}} onMouseEnter={e=>{e.currentTarget.style.background=NHS.blue+"33";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}} title="Drag to resize panel">
            <div style={{width:2,height:40,background:NHS.paleGrey,borderRadius:2}}/>
          </div>
          <div style={{width:panelWidth,minWidth:MIN_PANEL_W,maxWidth:MAX_PANEL_W,flexShrink:0,animation:"nwSlideIn .22s ease",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <ArtifactPanel artifact={activeArtifact} onClose={()=>setActiveArtifact(null)} vp={vp} panelWidth={panelWidth} onSetWidth={savePanelWidth} settings={settings} saveSettings={saveSettings}/>
          </div>
        </>
      )}
      {/* Artifact panel — mobile/compact overlay */}
      {activeArtifact&&(vp==="compact"||vp==="mobile")&&(
        <div style={{position:"fixed",left:0,right:0,top:48,bottom:0,zIndex:50,background:"rgba(0,0,0,.45)",animation:"nwFadeIn .2s ease"}} onClick={()=>setActiveArtifact(null)}>
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:"90vw",maxWidth:480,background:"#fff",animation:"nwSlideIn .22s ease",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <ArtifactPanel artifact={activeArtifact} onClose={()=>setActiveArtifact(null)} vp={vp} panelWidth={480} onSetWidth={null} settings={settings} saveSettings={saveSettings}/>
          </div>
        </div>
      )}

      {/* AI Voice Studio Modal */}
      {showVoiceStudio&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",animation:"nwFadeIn .15s ease"}} onClick={()=>setShowVoiceStudio(false)}>
        <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:720,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.25)",animation:"nwFadeIn .2s ease"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid #E8EDEE",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:"1rem",color:"#231F20"}}>🎙 AI Voice Studio</div>
            <button onClick={()=>setShowVoiceStudio(false)} style={{width:32,height:32,borderRadius:8,border:"1px solid #E8EDEE",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem",color:"#425563"}} aria-label="Close">✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:0}}>
            <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#425563"}}>Loading…</div>}>
              <AIVoiceStudio/>
            </Suspense>
          </div>
        </div>
      </div>}

      <AskAIImageStudio open={showAskAIImageStudio} onClose={()=>setShowAskAIImageStudio(false)} />

    </div>
  );
}
