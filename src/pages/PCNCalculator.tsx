import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Stars, Download, Plus, X, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

// ── 2026/27 DES rates ─────────────────────────────────────────────────────────
const RATES = {
  npp:   { rate: 1.76,    basis: 'registered', label: 'NPP (direct)', color: '#005eb8' },
  admin: { rate: 2.345,   basis: 'registered', label: 'Core admin',   color: '#0d9488' },
  cd:    { rate: 0.759,   basis: 'adjusted',   label: 'Clin. director', color: '#7c3aed' },
  ea:    { rate: 8.903,   basis: 'adjusted',   label: 'Enhanced access', color: '#d97706' },
  arrs:  { rate: 27.668,  basis: 'weighted',   label: 'ARRS',          color: '#059669' },
  gp:    { rate: 47100,   basis: 'practice',   label: 'GP reimb. (est)', color: '#374151' },
} as const;
type StreamKey = keyof typeof RATES;
const STREAM_KEYS: StreamKey[] = ['npp','admin','cd','ea','arrs','gp'];

interface Practice {
  id: string;
  name: string;
  ods: string;
  registered: string;
  adjusted: string;
  weighted: string;
}
interface CalcResult { npp:number; admin:number; cd:number; ea:number; arrs:number; gp:number; total:number }

function uid(){ return 'p' + Math.random().toString(36).slice(2,7); }
function blank(): Practice { return {id:uid(),name:'',ods:'',registered:'',adjusted:'',weighted:''}; }
function fmt(n:number){ return '£' + Math.round(n).toLocaleString('en-GB'); }
function calcPractice(p:Practice): CalcResult {
  const r = +p.registered||0, a = +p.adjusted||0, w = +p.weighted||0;
  const npp=r*RATES.npp.rate, admin=r*RATES.admin.rate, cd=a*RATES.cd.rate,
        ea=a*RATES.ea.rate, arrs=w*RATES.arrs.rate, gp=RATES.gp.rate;
  return { npp, admin, cd, ea, arrs, gp, total: npp+admin+cd+ea+arrs+gp };
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{background:'#003087',color:'#fff',padding:'10px 0',fontSize:13,fontFamily:'DM Sans,sans-serif'}}>
      <div style={{maxWidth:1100,margin:'0 auto',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:6,background:'linear-gradient(135deg,#60a5fa,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Stars size={16} color="#fff"/>
          </div>
          <span style={{fontWeight:600,letterSpacing:0.3}}>Notewell AI</span>
          <span style={{opacity:0.5,margin:'0 4px'}}>·</span>
          <span style={{opacity:0.85}}>PCN Funding Split Calculator 2026/27</span>
        </div>
        <a href="https://meetingmagic.lovable.app" target="_blank" rel="noopener noreferrer"
          style={{color:'#93c5fd',textDecoration:'none',fontSize:12,fontWeight:500}}>
          Go to Notewell →
        </a>
      </div>
    </div>
  );
}

// ── Rate reference ────────────────────────────────────────────────────────────
function RateReference() {
  const [open,setOpen] = useState(false);
  return (
    <div style={{marginBottom:16}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'none',border:'none',cursor:'pointer',textAlign:'left',fontSize:13,fontWeight:600,color:'#374151'}}>
        <span>2026/27 Network Contract DES payment rates</span>
        <span style={{fontSize:11,color:'#9ca3af'}}>{open?'▲ hide':'▼ show'}</span>
      </button>
      {open && (
        <div style={{padding:'0 16px 16px'}}>
          {([
            ['Network Participation Payment','£1.76','per registered patient','direct to practice','#eff6ff','#1d4ed8'],
            ['Core Admin / L&M','£2.345','per registered patient','2025/26 + 3.5%','#f0fdf4','#166534'],
            ['Clinical Director','£0.759','per adjusted patient','2025/26 + 3.5%','#f0fdf4','#166534'],
            ['Enhanced Access','£8.903','per adjusted patient','confirmed NHS England','#f0fdf4','#166534'],
            ['ARRS','£27.668','per weighted patient','confirmed NHS England','#f0fdf4','#166534'],
            ['GP Reimbursement','~£47,100','per practice avg','£292m ÷ ~6,200 practices','#fffbeb','#92400e'],
          ] as const).map(([label,rate,basis,note,bg,tc])=>(
            <div key={label} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 10px',borderRadius:6,background:bg,marginBottom:4,fontSize:12}}>
              <span style={{fontWeight:600,minWidth:200,color:tc}}>{label}</span>
              <span style={{fontWeight:700,minWidth:70,color:tc}}>{rate}</span>
              <span style={{color:'#6b7280',minWidth:140}}>{basis}</span>
              <span style={{color:'#9ca3af',fontSize:11}}>{note}</span>
            </div>
          ))}
          <p style={{fontSize:11,color:'#9ca3af',marginTop:8,lineHeight:1.5}}>
            ARRS + Enhanced Access confirmed from NHS England DES specification 26 March 2026. Core Admin/CD uplifted 3.5% from 2025/26 (final SFE expected May 2026). GP Reimbursement formula unpublished — shown as national average. Always verify with your ICB notification.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PCNCalculator() {
  const [practices, setPractices] = useState<Practice[]>([blank(),blank(),blank()]);
  const [pcnName, setPcnName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundMeta, setFoundMeta] = useState('');
  const [options, setOptions] = useState<{code:string;name:string;icb?:string}[]>([]);
  const [dataNote, setDataNote] = useState('');

  const results = useMemo(()=> practices.map(p=>({...calcPractice(p),name:p.name||'(unnamed)'})),[practices]);
  const grandTotal = useMemo(()=> results.reduce((s,r)=>s+r.total,0),[results]);
  const totalReg = useMemo(()=> practices.reduce((s,p)=>s+(+p.registered||0),0),[practices]);
  const hasData = practices.some(p=>+p.registered>0||+p.adjusted>0||+p.weighted>0);

  const handleSearch = useCallback(async()=>{
    if(searchQuery.trim().length < 2) return;
    setSearching(true);
    setSearchError('');
    setOptions([]);
    setFoundMeta('');
    try {
      const { data, error } = await supabase.functions.invoke('pcn-data-search',{
        body: { query: searchQuery.trim() }
      });
      if(error) throw error;
      if(data.status === 'found'){
        setPcnName(data.pcnName || searchQuery);
        setPractices(data.practices.map((p:any)=>({
          id: uid(),
          name: p.name||'',
          ods: p.ods||'',
          registered: String(p.registered||''),
          adjusted: String(p.adj||p.adjusted||''),
          weighted: String(p.wgt||p.weighted||''),
        })));
        setFoundMeta(`${data.practices.length} practices · ${data.dataDate||''} · ${data.sourceNote||'NHS Digital'}`);
        setDataNote(data.practices[0]?.adjNote?.toLowerCase().includes('estimated')
          ? 'Registered lists from NHS Digital. Adjusted and weighted populations are estimated (×0.97 / ×1.025) — update with your ICB notification letter for exact figures.'
          : 'Data from NHS England 2026/27 sources. Verify adjusted and weighted populations against your ICB notification letter.');
        setOptions([]);
      } else if(data.status === 'multiple'){
        setOptions(data.options||[]);
      } else {
        setSearchError(data.message||'No PCN found with that name. Try adding your county, e.g. "Brackley Northamptonshire".');
      }
    } catch(e:any){
      setSearchError('Search failed — ' + (e?.message||'try again or enter practices manually below.'));
    }
    setSearching(false);
  },[searchQuery]);

  const updatePractice = useCallback((id:string, field:keyof Practice, value:string)=>{
    setPractices(prev=>prev.map(p=>p.id===id?{...p,[field]:value}:p));
  },[]);
  const removePractice = useCallback((id:string)=>{ setPractices(prev=>prev.filter(p=>p.id!==id)); },[]);
  const addPractice = useCallback(()=>{ setPractices(prev=>[...prev,blank()]); },[]);

  const handleExport = useCallback(()=>{
    const hdr = ['Practice','ODS','Registered','Adjusted','Weighted',...STREAM_KEYS.map(k=>RATES[k].label),'Total','% Share'];
    const rows = practices.map(p=>{
      const r = calcPractice(p);
      const tot = r.total;
      return [p.name||'(unnamed)',p.ods||'',+p.registered||0,+p.adjusted||0,+p.weighted||0,
        ...STREAM_KEYS.map(k=>Math.round(r[k])),Math.round(tot),
        grandTotal?+(tot/grandTotal*100).toFixed(1):0];
    });
    const totRow = ['TOTALS','','','','',
      ...STREAM_KEYS.map(k=>Math.round(results.reduce((s,r)=>s+r[k],0))),
      Math.round(grandTotal),100];
    rows.push(totRow as any);
    const ws = XLSX.utils.aoa_to_sheet([hdr,...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '2026-27 Funding Split');
    const buf = XLSX.write(wb,{bookType:'xlsx',type:'array'});
    saveAs(new Blob([buf],{type:'application/octet-stream'}),
      `${(pcnName||'PCN').replace(/[^a-z0-9]/gi,'_')}_funding_split_2627.xlsx`);
  },[practices,results,grandTotal,pcnName]);

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:'DM Sans,system-ui,sans-serif'}}>
      <TopBar/>
      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 24px 60px'}}>
        {/* Page title */}
        <div style={{marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#005eb8,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Stars size={20} color="#fff"/>
            </div>
            <h1 style={{fontSize:22,fontWeight:700,color:'#111827',margin:0}}>PCN Funding Split Calculator</h1>
            <span style={{fontSize:12,fontWeight:600,padding:'2px 8px',borderRadius:10,background:'#dbeafe',color:'#1e40af'}}>2026/27</span>
          </div>
          <p style={{fontSize:13,color:'#6b7280',margin:'4px 0 0 46px'}}>Network Contract DES — enter your PCN name to pull live practice data, or add practices manually</p>
        </div>

        {/* Search */}
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20,marginBottom:16}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}
              placeholder="Enter PCN name, e.g. Brackley & Towcester"
              style={{flex:1,minWidth:240,padding:'9px 14px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14,outline:'none'}}
              onFocus={e=>{e.target.style.borderColor='#005eb8';e.target.style.boxShadow='0 0 0 3px rgba(0,94,184,.1)'}}
              onBlur={e=>{e.target.style.borderColor='#d1d5db';e.target.style.boxShadow='none'}}
            />
            <button onClick={handleSearch} disabled={searching}
              style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',borderRadius:8,border:'none',background:searching?'#93c5fd':'#005eb8',color:'#fff',fontSize:13,fontWeight:600,cursor:searching?'wait':'pointer'}}>
              {searching?<span style={{display:'inline-block',width:14,height:14,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>:<Search size={14}/>}
              {searching?'Searching…':'Search'}
            </button>
          </div>
          {searchError && <p style={{color:'#dc2626',fontSize:12,marginTop:8,display:'flex',alignItems:'center',gap:4}}><AlertCircle size={13}/>{searchError}</p>}
          {options.length>0 && (
            <div style={{marginTop:12}}>
              <p style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:6}}>Multiple PCNs found — select yours:</p>
              {options.map(o=>(
                <button key={o.code} onClick={()=>{setSearchQuery(o.name);setOptions([]);setTimeout(handleSearch,50);}}
                  style={{width:'100%',textAlign:'left',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px',cursor:'pointer',marginBottom:5,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontWeight:600}}>{o.name}</span>
                  {o.icb&&<span style={{fontSize:11,color:'#6b7280'}}>{o.icb}</span>}
                  <span style={{marginLeft:'auto',fontSize:11,color:'#9ca3af'}}>{o.code}</span>
                </button>
              ))}
            </div>
          )}
          {foundMeta && (
            <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,background:'#ecfdf5',border:'1px solid #d1fae5',fontSize:12}}>
              <CheckCircle2 size={14} color="#059669"/>
              <span style={{fontWeight:600,color:'#065f46'}}>{pcnName}</span>
              <span style={{color:'#6b7280'}}>{foundMeta}</span>
              <button onClick={()=>{setFoundMeta('');setSearchQuery('');setDataNote('');}} style={{marginLeft:'auto',fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid #d1fae5',background:'#fff',cursor:'pointer',color:'#6b7280'}}>New search</button>
            </div>
          )}
          {dataNote && <p style={{fontSize:11,color:'#92400e',background:'#fffbeb',padding:'8px 12px',borderRadius:6,marginTop:8,lineHeight:1.5}}>{dataNote}</p>}
        </div>

        {/* Rate reference */}
        <RateReference/>

        {/* PCN name */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <label style={{fontSize:13,fontWeight:600,color:'#374151',whiteSpace:'nowrap'}}>PCN name</label>
          <input value={pcnName} onChange={e=>setPcnName(e.target.value)}
            placeholder="e.g. Brackley & Towcester PCN"
            style={{maxWidth:400,width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:14,outline:'none'}}
            onFocus={e=>{e.target.style.borderColor='#005eb8'}} onBlur={e=>{e.target.style.borderColor='#d1d5db'}}/>
        </div>

        {/* Practices table */}
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,marginBottom:20,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid #f3f4f6',flexWrap:'wrap'}}>
            <span style={{fontSize:14,fontWeight:700,color:'#111827'}}>Member practices</span>
            <button onClick={addPractice}
              style={{display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:600,color:'#005eb8',background:'none',border:'1px solid #bfdbfe',borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
              <Plus size={12}/> Add row
            </button>
            <span style={{fontSize:11,color:'#9ca3af',flex:1}}>Edit any field to override · Adjusted &amp; Weighted: verify with ICB letter</span>
            <button onClick={handleExport} disabled={!hasData}
              style={{display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:600,color:hasData?'#fff':'#9ca3af',background:hasData?'#059669':'#e5e7eb',border:'none',borderRadius:6,padding:'6px 14px',cursor:hasData?'pointer':'default'}}>
              <Download size={12}/> Export XLSX
            </button>
          </div>

          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  {([['Practice name','left','160px'],['ODS','center','80px'],
                    ['Registered list','right','115px'],['Adjusted pop.','right','115px'],
                    ['Weighted pop.','right','115px'],['','center','36px']] as const).map(([h,a,w],i)=>(
                    <th key={i} style={{padding:'8px 10px',textAlign:a as any,fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:0.5,minWidth:w,borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {practices.map(p=>(
                  <tr key={p.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'6px 10px'}}>
                      <input value={p.name} onChange={e=>updatePractice(p.id,'name',e.target.value)}
                        placeholder="Practice name" style={{width:'100%',border:'none',outline:'none',fontSize:13,background:'transparent'}}/>
                    </td>
                    <td style={{padding:'6px 10px'}}>
                      <input value={p.ods} onChange={e=>updatePractice(p.id,'ods',e.target.value)}
                        placeholder="ODS" style={{width:'100%',border:'none',outline:'none',fontSize:13,textAlign:'center',background:'transparent'}}/>
                    </td>
                    {(['registered','adjusted','weighted'] as const).map(f=>(
                      <td key={f} style={{padding:'6px 10px'}}>
                        <input type="number" value={p[f]} onChange={e=>updatePractice(p.id,f,e.target.value)}
                          placeholder="0" min="0"
                          style={{width:'100%',border:'none',outline:'none',fontSize:13,textAlign:'right',background:'transparent'}}/>
                      </td>
                    ))}
                    <td style={{padding:'6px 4px',textAlign:'center'}}>
                      <button onClick={()=>removePractice(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:16,lineHeight:1,padding:'2px 4px'}} onMouseEnter={e=>(e.currentTarget.style.color='#dc2626')} onMouseLeave={e=>(e.currentTarget.style.color='#9ca3af')}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results */}
        {hasData && (
          <>
            {/* KPI cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:20}}>
              {[
                {l:'Total PCN DES',v:fmt(grandTotal),a:'#005eb8'},
                {l:'Practices',v:String(practices.length),a:'#374151'},
                {l:'Total registered',v:totalReg.toLocaleString('en-GB'),a:'#374151'},
                {l:'Average per practice',v:practices.length?fmt(grandTotal/practices.length):'—',a:'#059669'},
              ].map(k=>(
                <div key={k.l} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'16px 18px',borderTop:`3px solid ${k.a}`}}>
                  <div style={{fontSize:11,color:'#6b7280',textTransform:'uppercase',letterSpacing:0.5,marginBottom:4}}>{k.l}</div>
                  <div style={{fontSize:20,fontWeight:700,color:k.a}}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* Results table */}
            <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,marginBottom:20,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#f9fafb'}}>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:11,borderBottom:'2px solid #e5e7eb',minWidth:140}}>Practice</th>
                      {STREAM_KEYS.map(k=>(
                        <th key={k} style={{padding:'10px 8px',textAlign:'right',fontWeight:600,fontSize:10,textTransform:'uppercase',letterSpacing:0.5,borderBottom:'2px solid #e5e7eb',minWidth:85}}>
                          <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:RATES[k].color,marginRight:4,verticalAlign:'middle'}}/>
                          {RATES[k].label}
                        </th>
                      ))}
                      <th style={{padding:'10px 8px',textAlign:'right',fontWeight:700,fontSize:11,borderBottom:'2px solid #e5e7eb',minWidth:90}}>Total</th>
                      <th style={{padding:'10px 8px',textAlign:'right',fontWeight:600,fontSize:11,borderBottom:'2px solid #e5e7eb',minWidth:60}}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r,i)=>{
                      const pw = grandTotal?(r.total/grandTotal*100):0;
                      return (
                        <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                          <td style={{padding:'8px 12px',fontWeight:600,color:'#111827',fontSize:13}}>
                            {r.name}
                            <div style={{height:3,borderRadius:2,background:'#e5e7eb',marginTop:4}}>
                              <div style={{height:3,borderRadius:2,background:'#005eb8',width:`${pw}%`,transition:'width 0.3s'}}/>
                            </div>
                          </td>
                          {STREAM_KEYS.map(k=>(
                            <td key={k} style={{padding:'8px',textAlign:'right',color:'#374151',fontVariantNumeric:'tabular-nums'}}>{fmt(r[k])}</td>
                          ))}
                          <td style={{padding:'8px',textAlign:'right',fontWeight:700,color:'#111827',fontVariantNumeric:'tabular-nums'}}>{fmt(r.total)}</td>
                          <td style={{padding:'8px',textAlign:'right',color:'#6b7280',fontVariantNumeric:'tabular-nums'}}>
                            {pw.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'#f0f9ff',borderTop:'2px solid #bfdbfe'}}>
                      <td style={{padding:'10px 12px',fontWeight:700,color:'#005eb8',fontSize:13}}>Totals</td>
                      {STREAM_KEYS.map(k=>(
                        <td key={k} style={{padding:'10px 8px',textAlign:'right',fontWeight:700,color:'#005eb8',fontVariantNumeric:'tabular-nums'}}>{fmt(results.reduce((s,r)=>s+r[k],0))}</td>
                      ))}
                      <td style={{padding:'10px 8px',textAlign:'right',fontWeight:700,color:'#005eb8',fontSize:14,fontVariantNumeric:'tabular-nums'}}>{fmt(grandTotal)}</td>
                      <td style={{padding:'10px 8px',textAlign:'right',fontWeight:700,color:'#005eb8'}}>
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Bar chart */}
            <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20,marginBottom:20}}>
              <h3 style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:16}}>Distribution by practice — all funding streams</h3>
              {results.map((r,i)=>{
                const pw = grandTotal?(r.total/grandTotal*100):0;
                return (
                  <div key={i} style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                      <span style={{fontWeight:600,color:'#111827'}}>{r.name}</span>
                      <span style={{color:'#6b7280'}}>{fmt(r.total)} · {pw.toFixed(1)}%</span>
                    </div>
                    <div style={{display:'flex',height:22,borderRadius:6,overflow:'hidden',background:'#f3f4f6'}}>
                      {STREAM_KEYS.map(k=>{
                        const sw = grandTotal?(r[k]/grandTotal*100):0;
                        return sw>0.05?<div key={k} style={{width:`${sw}%`,background:RATES[k].color,transition:'width 0.3s'}} title={`${RATES[k].label}: ${fmt(r[k])}`}/>:null;
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:12}}>
                {STREAM_KEYS.map(k=>(
                  <span key={k} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#6b7280'}}>
                    <span style={{width:10,height:10,borderRadius:3,background:RATES[k].color,display:'inline-block'}}/>
                    {RATES[k].label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{textAlign:'center',padding:'24px 0',fontSize:10,color:'#9ca3af',lineHeight:1.8}}>
          Notewell AI · PCN Services Ltd · Built by Malcolm Railson, Brackley &amp; Towcester PCN · {' '}
          Rates: NHS England DES spec 26 March 2026 · Always verify with ICB notification · {' '}
          MHRA Class I · DCB0129/DCB0160 · ICO ZB226324
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
