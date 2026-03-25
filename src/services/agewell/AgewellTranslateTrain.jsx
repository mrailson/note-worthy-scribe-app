/**
 * ═══════════════════════════════════════════════════════════════════
 *  Ageing Well Translate & Train
 *  A Notewell AI Service — branched from Live Translate (notewell-live-translate)
 *
 *  Branch:  agewell-translate-train
 *  Parent:  notewell-live-translate (GP practice service — kept separate)
 *  Reason:  Ageing Well neighbourhood teams require training mode, frailty
 *           scenarios, and multi-agency care context not needed in GP service.
 *
 *  Modes:
 *    1. Live Translate   — real-time bilingual consultation support
 *    2. Translate & Train — AI patient role-play with STT/TTS (10 scenarios)
 *
 *  TTS bridge: window.notewellTTS(text, langCode) — connect your service here
 *  STT:        Web Speech API (en-GB for clinician, target lang for patient TTS)
 *
 *  File: src/services/agewell/AgewellTranslateTrain.jsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import agewellLogo from "@/assets/agewell-logo.png";

const callAgewellAI = async ({ messages, system, max_tokens }) => {
  const { data, error } = await supabase.functions.invoke("agewell-ai", {
    body: { messages, system, max_tokens },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.text;
};

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
// Light, warm, accessible — Ageing Well brand palette
const T = {
  // Backgrounds
  pageBg:     "#F4F7F5",       // warm off-white with a hint of sage
  surfaceCard:"#FFFFFF",
  surfaceAlt: "#F0F5F2",       // very light sage tint
  surfaceTeal:"#E8F5F2",       // light teal wash
  surfaceAmb: "#FFF8ED",       // warm amber wash
  surfaceBlue:"#EEF4FF",       // soft blue wash

  // Primary — Teal (Ageing Well brand)
  teal:       "#0D9488",
  tealLight:  "#CCFBF1",
  tealDark:   "#0F766E",
  tealBorder: "#99E6DA",

  // Secondary — Warm green
  green:      "#16A34A",
  greenLight: "#DCFCE7",
  greenBorder:"#86EFAC",

  // Accent — Amber (warmth / care)
  amber:      "#D97706",
  amberLight: "#FEF3C7",
  amberBorder:"#FCD34D",

  // Danger / Safeguarding
  rose:       "#E11D48",
  roseLight:  "#FFE4E6",
  roseBorder: "#FDA4AF",

  // Text
  textPrimary:  "#1C2B2A",
  textSecondary:"#4B6860",
  textMuted:    "#8BA89E",
  textOnTeal:   "#FFFFFF",

  // Borders
  border:     "#D8E8E4",
  borderStrong:"#B0D0C8",

  // Status
  listening:  "#7C3AED",
  listeningBg:"#F3EFFE",
  listeningBorder:"#C4B5FD",
};

// ─── SCENARIO DATA ───────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id:"L1", category:"language", flag:"🇮🇳", lang:"Punjabi",
    ttsLang:"pa-IN", ttsFallback:"en-GB",
    title:"Medication Confusion – Frailty & Falls",
    patient:"Gurmail Kaur, 79",
    context:"T2DM, hypertension, recent fall at home. Daughter not present today.",
    badge:"Live Translate",
    difficulty:"Intermediate",
    opening:"ਮੇਰੀ ਧੀ ਅੱਜ ਨਹੀਂ ਆ ਸਕੀ... ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਉਂਦੀ।\n(My daughter couldn't come today... I don't understand.)",
    systemPrompt:`You are Gurmail Kaur, a 79-year-old Punjabi-speaking woman at a GP/Ageing Well appointment without her daughter. You have T2DM, hypertension, and recently fell going to the bathroom at 3am. You are confused about your medications — you may have doubled up on insulin yesterday (you have a blue box and a white box and cannot tell them apart). You are anxious and sometimes repeat yourself. Speak mostly in English but include occasional very short Punjabi phrases with English translations in brackets, e.g. "ਹਾਂ ਜੀ (yes)" or "ਮੈਨੂੰ ਨਹੀਂ ਪਤਾ (I don't know)". Keep non-English phrases short so TTS can handle them. You are frightened but cooperative. You worry about being a burden to your family. If asked directly about pain, admit your hip aches but minimise it. Be warm but nervous.`,
  },
  {
    id:"L2", category:"language", flag:"🇵🇱", lang:"Polish",
    ttsLang:"pl-PL", ttsFallback:"en-GB",
    title:"Social Isolation & Depression Screening",
    patient:"Stanisław Kowalski, 82",
    context:"Widower. Son moved to Manchester. Attends rarely — doesn't want to be a burden.",
    badge:"Live Translate",
    difficulty:"Advanced",
    opening:"Nie chcę tu być. Jestem dobrze, naprawdę.\n(I don't want to be here. I'm fine, really.)",
    systemPrompt:`You are Stanisław Kowalski, an 82-year-old Polish man living alone in the UK. Your wife died 3 years ago and your son moved to Manchester. You came only because a neighbour insisted. You feel you are wasting the clinician's time. Your English is limited but functional. Mix short Polish phrases (with English translations in brackets) into mostly English speech. You have lost weight, sleep badly, and rarely eat hot food. You are deeply lonely but will not admit it. Gradually open up if the clinician is gentle and patient. The key unlock: if asked directly whether you feel sad or lonely, pause and say quietly: "Może trochę... może. (Maybe a little... maybe.)" Then change subject. Do not give everything away early.`,
  },
  {
    id:"L3", category:"language", flag:"🇧🇩", lang:"Bengali",
    ttsLang:"bn-IN", ttsFallback:"en-GB",
    title:"End of Life – Patient Autonomy",
    patient:"Abdul Rahman, 76",
    context:"Advanced COPD. Family present but filtering information from patient.",
    badge:"Live Translate",
    difficulty:"Advanced",
    opening:"My son says I will get better... কিন্তু আমি কি সত্যিটা জানতে পারব না?\n(But can I not know the truth?)",
    systemPrompt:`You are Abdul Rahman, a 76-year-old Bangladeshi man with advanced COPD. Your son has been telling you that you will recover, but you sense something is wrong. Speak mostly in English with occasional short Bengali phrases and translations in brackets. You are dignified, calm, and occasionally cough. You want honest information. If the clinician speaks directly to you (bypassing family), respond with visible relief and become more open. You want to know whether you should make arrangements, see relatives abroad, and if you will be able to breathe more easily. Ask quietly: "Doctor... how long do I have? Please tell me the truth." You are not afraid of death — you are afraid of not being prepared.`,
  },
  {
    id:"L4", category:"language", flag:"🇷🇴", lang:"Romanian",
    ttsLang:"ro-RO", ttsFallback:"en-GB",
    title:"Chronic Pain & Work Pressure",
    patient:"Elena Popescu, 68",
    context:"Osteoarthritis. Still working as a cleaner. Stoic but struggling financially.",
    badge:"Live Translate",
    difficulty:"Intermediate",
    opening:"Durerea e mai rea dimineața... (The pain is worse in the mornings...) but I cannot stop working. I need money.",
    systemPrompt:`You are Elena Popescu, a 68-year-old Romanian woman working as a hospital cleaner despite severe osteoarthritis in both knees and right hip. You are proud and dismiss pain when asked directly. Mix short Romanian phrases (with translations in brackets) into mostly English speech. Your suffering becomes clear only if the clinician asks about your daily routine — you can barely climb stairs and cry alone at night. Your supervisor has threatened to let you go. You are worried about housing. If the clinician mentions benefits or a sick note, look uncertain — you don't want to be seen as a scrounger. Say: "In Romania, you work or you have nothing."`,
  },
  {
    id:"L5", category:"language", flag:"🇸🇴", lang:"Somali",
    ttsLang:"so-SO", ttsFallback:"en-GB",
    title:"Diabetes Management – Ramadan Fasting",
    patient:"Fadumo Hassan, 71",
    context:"T2DM poorly controlled. Ramadan fasting conflicting with medication schedule.",
    badge:"Live Translate",
    difficulty:"Intermediate",
    opening:"I think my medicine is wrong now I am fasting... Waa arrin adag. (It is not straightforward.) The tablets say take with food but I cannot eat until sunset.",
    systemPrompt:`You are Fadumo Hassan, a 71-year-old Somali woman with poorly controlled Type 2 diabetes. You are observing Ramadan and your usual medication schedule no longer fits. Ramadan is non-negotiable — you need the clinician to work around it. Mix short Somali phrases (with translations) into mostly English speech. You had a hypoglycaemic episode last week that frightened you. If the clinician shows cultural sensitivity, you become warm and collaborative. If dismissive, you close down. Ask: "Can my granddaughter learn what to do if it happens again?"`,
  },
  {
    id:"E1", category:"english", flag:"🇬🇧", lang:"English",
    ttsLang:"en-GB", ttsFallback:"en-GB",
    title:"Dementia & Carer Strain",
    patient:"Dorothy, 84 (husband Gerald, 81)",
    context:"Mild dementia, multiple medications, recent UTI. Husband is exhausted.",
    badge:"Care Training",
    difficulty:"Intermediate",
    opening:"I've taken my tablets. I think. Gerald gives them to me. Or was that yesterday? Gerald, did I take them? He worries so much, bless him.",
    systemPrompt:`You are Dorothy, an 84-year-old woman with mild dementia, brought by her husband Gerald. You are warm, chatty, and largely unaware of your confusion. You lose your thread mid-sentence, repeat questions, and refer to past events as if recent. You recently had a UTI that made your confusion much worse. When the clinician addresses Gerald, voice him too — he is exhausted, short-tempered but loving. If asked how he is coping, Gerald becomes emotional: "I just don't know how much longer I can..." then composes himself. Dorothy has occasional flashes of clear insight: "Sometimes I can't remember Gerald's face. Isn't that dreadful."`,
  },
  {
    id:"E2", category:"english", flag:"🇬🇧", lang:"English",
    ttsLang:"en-GB", ttsFallback:"en-GB",
    title:"Post-Discharge Confusion – Hip Fracture",
    patient:"Margaret, 81",
    context:"Home after hip fracture. Lives alone. Discharge letter missing. No nearby family.",
    badge:"Care Training",
    difficulty:"Foundation",
    opening:"They said there'd be a letter but I can't find it anywhere. I'm not sure what I'm allowed to do. Am I meant to be walking on it? Nobody really explained.",
    systemPrompt:`You are Margaret, an 81-year-old woman discharged from hospital two days ago following a hip fracture. You live alone — your daughter is in Australia. You are anxious, muddled, and in persistent pain you're unsure you can take anything for. You cannot find your discharge paperwork. You are worried about your cat who hasn't been fed properly. You ask repetitive questions. You mention in passing that a neighbour has been helping but you feel guilty asking. If the clinician is reassuring and practical, you visibly relax. You need a care plan, pain review, and community support — but won't ask for these directly.`,
  },
  {
    id:"E3", category:"english", flag:"🇬🇧", lang:"English",
    ttsLang:"en-GB", ttsFallback:"en-GB",
    title:"Refusing Care – Proud Elder",
    patient:"Ronald, 77",
    context:"Heart failure, COPD. Refuses package of care. Son is very concerned.",
    badge:"Care Training",
    difficulty:"Advanced",
    opening:"I don't need people coming round. I've managed on my own for twelve years and I'm not having strangers in my house going through my things.",
    systemPrompt:`You are Ronald, a 77-year-old retired engineer with heart failure and COPD. You live alone and fiercely guard your independence. You are sharp, articulate, and use dry humour as deflection. If the clinician engages you as an intelligent adult and explores your specific concerns (strangers, bad experience with a previous carer, loss of control) and offers a minimal opt-in approach, you begin to soften. The key unlock: you had a fall last month you told nobody about. You were on the floor for two hours. If asked directly and sensitively, you admit this quietly: "Two hours. I couldn't reach the phone. But I managed." That is the turning point.`,
  },
  {
    id:"E4", category:"english", flag:"🇬🇧", lang:"English",
    ttsLang:"en-GB", ttsFallback:"en-GB",
    title:"Masked Grief & Bereavement",
    patient:"Jean, 73",
    context:"Husband died 8 months ago. Presenting with insomnia. Grief is the real issue.",
    badge:"Care Training",
    difficulty:"Advanced",
    opening:"It's silly really, coming in about this. I just can't sleep. I thought maybe you could give me something. I don't want to make a fuss.",
    systemPrompt:`You are Jean, a 73-year-old woman whose husband of 48 years died 8 months ago. You present with insomnia but the underlying issue is profound grief and depression. You are self-effacing and apologetic. You have stopped cooking proper meals, rarely leave the house, and feel guilty when you enjoy yourself. You will not say 'grief' or 'depression' easily. If the clinician slows down and gently reflects back what you are saying, you gradually open up. Near the end of a well-handled consultation, you might cry quietly: "I just didn't think it would be this hard. We were together since I was nineteen." Do not give this away early.`,
  },
  {
    id:"E5", category:"english", flag:"🇬🇧", lang:"English",
    ttsLang:"en-GB", ttsFallback:"en-GB",
    title:"Safeguarding – Financial Abuse Indicators",
    patient:"Vera, 80",
    context:"Routine BP check. Nephew controls finances. Indicators of coercive control.",
    badge:"Safeguarding",
    difficulty:"Advanced",
    opening:"I'm fine, it's just the blood pressure check. My nephew sorts everything for me now, he's very good. I don't really deal with the money side anymore, he does all that.",
    systemPrompt:`You are Vera, an 80-year-old woman attending a routine blood pressure check. Your nephew has taken control of your finances and is gradually isolating you. You are lonely and slightly fearful but have been coached to say everything is fine. Your home is cold. You mention your nephew frequently and positively but there are contradictions — he 'looks after' your money but you had to borrow from a neighbour for bus fare. If asked open non-leading questions, small details emerge. If asked whether you ever feel worried or frightened, pause and say quietly: "He can get a bit... cross. If I ask about the bills." Then add: "But he means well." Do not push too hard or you will shut down.`,
  },
];

const BADGE_CFG = {
  "Live Translate":{ bg:T.tealLight,  text:T.tealDark,  border:T.tealBorder },
  "Care Training": { bg:T.greenLight, text:"#166534",   border:T.greenBorder },
  "Safeguarding":  { bg:T.amberLight, text:"#92400E",   border:T.amberBorder },
};
const DIFF_CFG = {
  "Foundation":   { color:"#166534", bg:"#DCFCE7" },
  "Intermediate": { color:"#92400E", bg:T.amberLight },
  "Advanced":     { color:"#9F1239", bg:T.roseLight },
};
const SILENCE_MS = 2200;

// ─── HOOKS ──────────────────────────────────────────────────────────────────

function useSTT({ onInterim, onFinal }) {
  const rRef = useRef(null);
  const timer = useRef(null);
  const [listening, setListening] = useState(false);
  const [ok, setOk] = useState(true);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  useEffect(()=>{ onFinalRef.current=onFinal; },[onFinal]);
  useEffect(()=>{ onInterimRef.current=onInterim; },[onInterim]);

  const stop = useCallback(()=>{
    clearTimeout(timer.current);
    rRef.current?.stop();
    setListening(false);
  },[]);

  const start = useCallback(()=>{
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ setOk(false); return; }
    const r = new SR();
    r.continuous=true; r.interimResults=true; r.lang="en-GB";
    rRef.current=r;
    r.onresult=(e)=>{
      let interim="", final="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0].transcript;
        if(e.results[i].isFinal) final+=t; else interim+=t;
      }
      if(interim) onInterimRef.current?.(interim);
      if(final){
        clearTimeout(timer.current);
        timer.current=setTimeout(()=>{ stop(); onFinalRef.current?.(final.trim()); }, SILENCE_MS);
      }
    };
    r.onerror=()=>setListening(false);
    r.onend=()=>setListening(false);
    r.start(); setListening(true);
  },[stop]);

  return { listening, ok, toggle:useCallback(()=>listening?stop():start(),[listening,stop,start]), stop };
}

function useTTS(){
  const [speaking,setSpeaking]=useState(false);
  const speak=useCallback(async(text,lang="en-GB",fallback="en-GB")=>{
    const clean=text.replace(/\(.*?\)/g,"").replace(/\*+/g,"").replace(/\n+/g,". ").trim();
    if(typeof window.notewellTTS==="function"){
      setSpeaking(true);
      try{ await window.notewellTTS(clean,lang); }finally{ setSpeaking(false); }
      return;
    }
    if(!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const trySpeak=(l)=>{
      const u=new SpeechSynthesisUtterance(clean);
      u.lang=l; u.rate=0.88; u.pitch=1.0;
      const voices=window.speechSynthesis.getVoices();
      const v=voices.find(x=>x.lang.startsWith(l.split("-")[0]))||voices.find(x=>x.lang.startsWith("en"))||voices[0];
      if(v) u.voice=v;
      u.onstart=()=>setSpeaking(true);
      u.onend=()=>setSpeaking(false);
      u.onerror=()=>{ if(l!==fallback) trySpeak(fallback); else setSpeaking(false); };
      window.speechSynthesis.speak(u);
    };
    trySpeak(lang);
  },[]);
  const stop=useCallback(()=>{ window.speechSynthesis?.cancel(); setSpeaking(false); },[]);
  return {speaking,speak,stop};
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

// ─── LOGO COMPONENTS ────────────────────────────────────────────────────────
function AgewellLogoLarge(){
  return <img src={agewellLogo} alt="Ageing Well" width={48} height={48} style={{objectFit:"contain"}}/>;
}
function AgewellLogoSmall(){
  return <img src={agewellLogo} alt="Ageing Well" width={22} height={22} style={{objectFit:"contain"}}/>;
}

function Waveform({active,color=T.teal,size=5}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:"3px",height:"22px"}}>
      {[1,2,3,2,4,3,2,1,3].map((h,i)=>(
        <div key={i} style={{
          width:`${size-1}px`, borderRadius:"2px", background:color,
          height: active?`${4+h*3}px`:"4px",
          animation: active?`aw-wave 0.9s ease-in-out infinite`:"none",
          animationDelay:`${i*0.07}s`,
          transition:"height 0.25s ease",
          opacity: active?1:0.25,
        }}/>
      ))}
    </div>
  );
}

function Pill({label,bg,text,border}){
  return(
    <span style={{background:bg,color:text,border:`1px solid ${border}`,
      fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:600,
      letterSpacing:"0.3px",whiteSpace:"nowrap",fontFamily:"system-ui,sans-serif"}}>
      {label}
    </span>
  );
}

function Avatar({flag,size=36}){
  return(
    <div style={{width:size,height:size,borderRadius:"50%",
      background:T.surfaceTeal,border:`2px solid ${T.tealBorder}`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.5,flexShrink:0}}>
      {flag}
    </div>
  );
}

// ─── LIVE TRANSLATE MODE ─────────────────────────────────────────────────────
// Branched from notewell-live-translate — core translation loop preserved

function LiveTranslateMode({ onBack }) {
  const LANGS=[
    {code:"pa-IN",label:"Punjabi",flag:"🇮🇳"},
    {code:"pl-PL",label:"Polish",flag:"🇵🇱"},
    {code:"bn-IN",label:"Bengali",flag:"🇧🇩"},
    {code:"ro-RO",label:"Romanian",flag:"🇷🇴"},
    {code:"so-SO",label:"Somali",flag:"🇸🇴"},
    {code:"ur-PK",label:"Urdu",flag:"🇵🇰"},
    {code:"ar-SA",label:"Arabic",flag:"🇸🇦"},
    {code:"fr-FR",label:"French",flag:"🇫🇷"},
    {code:"de-DE",label:"German",flag:"🇩🇪"},
    {code:"es-ES",label:"Spanish",flag:"🇪🇸"},
    {code:"it-IT",label:"Italian",flag:"🇮🇹"},
    {code:"hi-IN",label:"Hindi",flag:"🇮🇳"},
    {code:"zh-CN",label:"Mandarin",flag:"🇨🇳"},
    {code:"ru-RU",label:"Russian",flag:"🇷🇺"},
    {code:"tr-TR",label:"Turkish",flag:"🇹🇷"},
  ];
  const [targetLang,setTargetLang]=useState(LANGS[0]);
  const [transcript,setTranscript]=useState([]);
  const [interim,setInterim]=useState("");
  const [speakerMode,setSpeakerMode]=useState("clinician"); // clinician | patient
  const [translating,setTranslating]=useState(false);
  const {speaking,speak,stop:stopTTS}=useTTS();
  const bottomRef=useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[transcript,interim]);

  const handleFinal=useCallback(async(text)=>{
    if(!text) return;
    setInterim("");
    setTranslating(true);
    const isClinicianSpeaking=speakerMode==="clinician";
    const entry={id:Date.now(),speaker:speakerMode,original:text,translation:"..."};
    setTranscript(prev=>[...prev,entry]);

    try{
      const prompt=isClinicianSpeaking
        ?`Translate the following from English to ${targetLang.label}. Return ONLY the translation, nothing else:\n"${text}"`
        :`Translate the following from ${targetLang.label} to English. Return ONLY the translation, nothing else:\n"${text}"`;

      const translation = await callAgewellAI({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
      }) || "[Translation error]";
      setTranscript(prev=>prev.map(e=>e.id===entry.id?{...e,translation}:e));
      // Speak translation in target language (patient hears English translated to their language)
      if(isClinicianSpeaking){
        await speak(translation,targetLang.code,targetLang.code);
      } else {
        await speak(translation,"en-GB","en-GB");
      }
    } catch {
      setTranscript(prev=>prev.map(e=>e.id===entry.id?{...e,translation:"[Error translating]"}:e));
    }
    setTranslating(false);
  },[speakerMode,targetLang,speak]);

  const {listening,ok,toggle,stop:stopSTT}=useSTT({onInterim:setInterim,onFinal:handleFinal});

  const clearSession=()=>{
    stopSTT(); stopTTS(); setTranscript([]); setInterim("");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Sub-header */}
      <div style={{background:T.surfaceTeal,borderBottom:`1px solid ${T.tealBorder}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <button onClick={onBack} style={btnStyle("outline")}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:T.tealDark,fontSize:15}}>🌍 Live Translate</div>
          <div style={{fontSize:12,color:T.textSecondary}}>Real-time bilingual consultation support</div>
        </div>
        {/* Language picker */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:T.textSecondary,fontWeight:600}}>Patient language:</span>
          <select value={targetLang.code} onChange={e=>setTargetLang(LANGS.find(l=>l.code===e.target.value))}
            style={{background:"white",border:`1px solid ${T.tealBorder}`,borderRadius:7,padding:"5px 10px",fontSize:13,color:T.textPrimary,cursor:"pointer"}}>
            {LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
        </div>
        <button onClick={clearSession} style={btnStyle("ghost")}>Clear</button>
      </div>

      {/* Speaker toggle */}
      <div style={{padding:"10px 20px",background:T.surfaceCard,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:12,color:T.textSecondary,fontWeight:600}}>Speaking:</span>
        {["clinician","patient"].map(s=>(
          <button key={s} onClick={()=>setSpeakerMode(s)} style={{
            background:speakerMode===s?(s==="clinician"?T.teal:T.green):"white",
            border:`1.5px solid ${speakerMode===s?(s==="clinician"?T.teal:T.green):T.border}`,
            color:speakerMode===s?"white":T.textSecondary,
            padding:"5px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600,
            transition:"all 0.15s",
          }}>
            {s==="clinician"?"👨‍⚕️ Clinician (EN)":"🧓 Patient ("+targetLang.label+")"}
          </button>
        ))}
        <div style={{marginLeft:"auto",fontSize:11,color:T.textMuted}}>
          {speakerMode==="clinician"?`English → ${targetLang.label}`:`${targetLang.label} → English`}
        </div>
      </div>

      {/* Transcript */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
        {transcript.length===0&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>
            <div style={{fontSize:36,marginBottom:12}}>🌍</div>
            <div style={{fontSize:14,fontWeight:600,color:T.textSecondary}}>Ready to translate</div>
            <div style={{fontSize:12,marginTop:4}}>Select speaker mode, press the microphone, and speak</div>
          </div>
        )}
        {transcript.map(e=>(
          <div key={e.id} style={{display:"flex",flexDirection:"column",gap:4,animation:"aw-fadein 0.2s ease"}}>
            <div style={{fontSize:10,color:T.textMuted,fontWeight:600,
              paddingLeft:e.speaker==="patient"?0:undefined,
              textAlign:e.speaker==="clinician"?"right":"left"}}>
              {e.speaker==="clinician"?"👨‍⚕️ CLINICIAN":"🧓 PATIENT"}
            </div>
            <div style={{display:"flex",gap:8,flexDirection:e.speaker==="clinician"?"row-reverse":"row",alignItems:"flex-start"}}>
              <div style={{maxWidth:"75%",display:"flex",flexDirection:"column",gap:4}}>
                <div style={{
                  padding:"10px 14px",borderRadius:e.speaker==="clinician"?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:e.speaker==="clinician"?T.surfaceBlue:T.surfaceTeal,
                  border:`1px solid ${e.speaker==="clinician"?"#C7D7F8":T.tealBorder}`,
                  fontSize:13,color:T.textPrimary,lineHeight:1.6,
                }}>
                  <div style={{fontSize:10,color:T.textMuted,fontWeight:600,marginBottom:3}}>ORIGINAL</div>
                  {e.original}
                </div>
                <div style={{
                  padding:"10px 14px",borderRadius:e.speaker==="clinician"?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:e.speaker==="clinician"?T.tealLight:T.surfaceBlue,
                  border:`1px solid ${e.speaker==="clinician"?T.tealBorder:"#C7D7F8"}`,
                  fontSize:13,color:T.textPrimary,lineHeight:1.6,
                }}>
                  <div style={{fontSize:10,color:T.textMuted,fontWeight:600,marginBottom:3}}>TRANSLATION</div>
                  {e.translation}
                </div>
              </div>
            </div>
          </div>
        ))}
        {interim&&(
          <div style={{display:"flex",justifyContent:speakerMode==="clinician"?"flex-end":"flex-start"}}>
            <div style={{background:T.listeningBg,border:`1px dashed ${T.listeningBorder}`,color:T.listening,
              borderRadius:12,padding:"9px 14px",fontSize:12,fontStyle:"italic",maxWidth:"70%"}}>
              {interim}<span style={{animation:"aw-blink 0.8s infinite"}}>▍</span>
            </div>
          </div>
        )}
        {translating&&(
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{background:T.surfaceTeal,border:`1px solid ${T.tealBorder}`,borderRadius:10,
              padding:"8px 16px",fontSize:12,color:T.tealDark,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:14,height:14,border:`2px solid ${T.teal}`,borderTopColor:"transparent",
                borderRadius:"50%",animation:"aw-spin 0.7s linear infinite"}}/>
              Translating…
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Mic bar */}
      <MicBar listening={listening} speaking={speaking} ok={ok} onToggle={toggle} onStopTTS={stopTTS}
        hint={speakerMode==="clinician"?`Clinician speaks English → translated to ${targetLang.label}`:`Patient speaks ${targetLang.label} → translated to English`}/>
    </div>
  );
}

// ─── TRAINING MODE ────────────────────────────────────────────────────────────

function TrainingMode({ onBack }) {
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState("all");
  const [messages,setMessages]=useState([]);
  const [interim,setInterim]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [autoSpeak,setAutoSpeak]=useState(true);
  const [manualText,setManualText]=useState("");
  const bottomRef=useRef(null);
  const {speaking,speak,stop:stopTTS}=useTTS();

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,interim,aiLoading]);

  const handleFinal=useCallback(async(text)=>{
    if(!text||!selected) return;
    setInterim("");
    await sendMsg(text);
  },[selected,messages,autoSpeak]); // eslint-disable-line

  const {listening,ok,toggle,stop:stopSTT}=useSTT({onInterim:setInterim,onFinal:handleFinal});

  const sendMsg=useCallback(async(text)=>{
    if(!text.trim()||!selected) return;
    const um={role:"user",content:text.trim()};
    const hist=[...messages,um];
    setMessages(hist); setManualText("");
    setAiLoading(true); stopTTS();
    try{
      const reply = await callAgewellAI({
        messages: hist.map(m=>({role:m.role,content:m.content})),
        system: selected.systemPrompt,
        max_tokens: 1000,
      }) || "...";
      setMessages(p=>[...p,{role:"assistant",content:reply}]);
      if(autoSpeak) await speak(reply,selected.ttsLang,selected.ttsFallback);
    } catch {
      setMessages(p=>[...p,{role:"assistant",content:"⚠️ Connection error. Please try again."}]);
    }
    setAiLoading(false);
  },[messages,selected,autoSpeak,speak,stopTTS]);

  const startScenario=(s)=>{
    stopSTT(); stopTTS();
    setSelected(s);
    setMessages([{role:"assistant",content:s.opening}]);
    setInterim(""); setManualText("");
    if(autoSpeak) setTimeout(()=>speak(s.opening,s.ttsLang,s.ttsFallback),300);
  };

  const endSession=()=>{ stopSTT(); stopTTS(); setSelected(null); setMessages([]); setInterim(""); };

  const filtered=tab==="all"?SCENARIOS:SCENARIOS.filter(s=>s.category===tab);

  // ── Active session ────────────────────────────────────────────────
  if(selected){
    const b=BADGE_CFG[selected.badge];
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
        {/* Session header */}
        <div style={{background:T.surfaceTeal,borderBottom:`1px solid ${T.tealBorder}`,padding:"10px 18px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",flexShrink:0}}>
          <button onClick={endSession} style={btnStyle("outline")}>← Scenarios</button>
          <Avatar flag={selected.flag} size={34}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,color:T.textPrimary,fontSize:14}}>{selected.title}</span>
              <Pill label={selected.badge} {...b}/>
              <Pill label={selected.difficulty} bg={DIFF_CFG[selected.difficulty].bg} text={DIFF_CFG[selected.difficulty].color} border="transparent"/>
            </div>
            <div style={{fontSize:11,color:T.textSecondary,marginTop:1}}>{selected.patient} · {selected.context}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {speaking&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:T.greenLight,border:`1px solid ${T.greenBorder}`,borderRadius:7,padding:"4px 10px"}}>
                <Waveform active color={T.green} size={4}/>
                <span style={{fontSize:10,color:T.green,fontWeight:700}}>SPEAKING</span>
                <button onClick={stopTTS} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:T.textMuted,padding:0}}>■</button>
              </div>
            )}
            {listening&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:T.listeningBg,border:`1px solid ${T.listeningBorder}`,borderRadius:7,padding:"4px 10px"}}>
                <Waveform active color={T.listening} size={4}/>
                <span style={{fontSize:10,color:T.listening,fontWeight:700}}>LISTENING</span>
              </div>
            )}
            <button onClick={()=>setAutoSpeak(!autoSpeak)} style={{
              background:autoSpeak?T.tealLight:T.surfaceAlt,
              border:`1px solid ${autoSpeak?T.tealBorder:T.border}`,
              color:autoSpeak?T.tealDark:T.textMuted,
              borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600,
            }}>
              🔊 {autoSpeak?"Auto ON":"Auto OFF"}
            </button>
            <button onClick={()=>startScenario(selected)} style={btnStyle("ghost")}>↺ Restart</button>
          </div>
        </div>

        {/* Role strip */}
        <div style={{display:"flex",background:T.surfaceCard,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{flex:1,padding:"5px 18px",borderRight:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.amber}}/>
            <span style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:1}}>AI PATIENT · {selected.patient.split(",")[0].toUpperCase()}</span>
          </div>
          <div style={{flex:1,padding:"5px 18px",display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.teal}}/>
            <span style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:1}}>YOU · CLINICIAN / CARE WORKER</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:12,background:T.pageBg}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:8,animation:"aw-fadein 0.2s ease",alignItems:"flex-end"}}>
              {m.role==="assistant"&&<Avatar flag={selected.flag} size={30}/>}
              <div style={{
                maxWidth:"68%",padding:"11px 15px",
                borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                background:m.role==="user"?T.surfaceBlue:T.surfaceCard,
                border:`1px solid ${m.role==="user"?"#C7D7F8":T.border}`,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                color:T.textPrimary,fontSize:13,lineHeight:1.65,whiteSpace:"pre-wrap",
              }}>
                {m.content}
              </div>
              {m.role==="user"&&(
                <div style={{width:30,height:30,borderRadius:"50%",background:T.surfaceBlue,
                  border:`2px solid ${T.tealBorder}`,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:12,flexShrink:0,color:T.tealDark,fontWeight:700}}>
                  Rx
                </div>
              )}
            </div>
          ))}
          {interim&&(
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <div style={{maxWidth:"68%",padding:"9px 14px",borderRadius:"16px 16px 4px 16px",
                background:T.listeningBg,border:`1.5px dashed ${T.listeningBorder}`,
                color:T.listening,fontSize:12,fontStyle:"italic",lineHeight:1.6}}>
                {interim}<span style={{animation:"aw-blink 0.8s infinite"}}>▍</span>
              </div>
            </div>
          )}
          {aiLoading&&(
            <div style={{display:"flex",justifyContent:"flex-start",gap:8,alignItems:"flex-end"}}>
              <Avatar flag={selected.flag} size={30}/>
              <div style={{background:T.surfaceCard,border:`1px solid ${T.border}`,
                borderRadius:"16px 16px 16px 4px",padding:"12px 16px",
                display:"flex",gap:5,alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                {[0,1,2].map(d=>(
                  <div key={d} style={{width:7,height:7,borderRadius:"50%",background:T.teal,
                    animation:"aw-wave 1.1s ease-in-out infinite",animationDelay:`${d*0.18}s`}}/>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{padding:"12px 18px",background:T.surfaceCard,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={manualText} onChange={e=>setManualText(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMsg(manualText); }}}
              placeholder="Or type your clinician response and press Enter…"
              style={{flex:1,background:T.surfaceAlt,border:`1.5px solid ${T.border}`,borderRadius:8,
                padding:"9px 14px",color:T.textPrimary,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            <button onClick={()=>sendMsg(manualText)} disabled={!manualText.trim()||aiLoading}
              style={btnStyle("primary")}>Send</button>
          </div>
          <MicBar listening={listening} speaking={speaking} ok={ok} onToggle={toggle} onStopTTS={stopTTS}
            hint={ok?"Press mic · Speak your response · Auto-sends after pause":"STT unavailable — use text input above (Chrome/Edge)"}/>
        </div>
      </div>
    );
  }

  // ── Scenario selector ─────────────────────────────────────────────
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:T.surfaceTeal,borderBottom:`1px solid ${T.tealBorder}`,padding:"12px 20px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={onBack} style={btnStyle("outline")}>← Back</button>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:T.tealDark,fontSize:15}}>🎭 Translate & Train</div>
            <div style={{fontSize:12,color:T.textSecondary}}>AI plays the patient · You are the clinician or care worker</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Pill label="🌍 5 Language" bg={T.tealLight} text={T.tealDark} border={T.tealBorder}/>
            <Pill label="🇬🇧 5 English" bg={T.greenLight} text="#166534" border={T.greenBorder}/>
          </div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {[["all","All"],["language","🌍 Language"],["english","🇬🇧 English"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              background:tab===k?T.teal:"white",
              border:`1.5px solid ${tab===k?T.teal:T.tealBorder}`,
              color:tab===k?"white":T.tealDark,
              padding:"5px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:600,
              transition:"all 0.15s",fontFamily:"inherit",
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"18px 20px",
        display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",
        gap:14,alignContent:"start",background:T.pageBg}}>
        {filtered.map(s=>{
          const b=BADGE_CFG[s.badge];
          const d=DIFF_CFG[s.difficulty];
          return(
            <div key={s.id} onClick={()=>startScenario(s)} style={{
              background:T.surfaceCard,border:`1.5px solid ${T.border}`,borderRadius:14,
              padding:"18px",cursor:"pointer",position:"relative",overflow:"hidden",
              boxShadow:"0 1px 6px rgba(0,0,0,0.06)",transition:"all 0.18s",
            }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.teal; e.currentTarget.style.boxShadow="0 4px 18px rgba(13,148,136,0.15)"; e.currentTarget.style.transform="translateY(-2px)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,0.06)"; e.currentTarget.style.transform="translateY(0)"; }}>
              {/* Top accent */}
              <div style={{position:"absolute",top:0,left:0,right:0,height:4,
                background:s.category==="language"?T.teal:T.green,borderRadius:"14px 14px 0 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,marginTop:4}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:24}}>{s.flag}</span>
                  <div>
                    <div style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:1}}>{s.id} · {s.lang}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}}>
                  <Pill label={s.badge} {...b}/>
                  <Pill label={s.difficulty} bg={d.bg} text={d.color} border="transparent"/>
                </div>
              </div>
              <div style={{fontWeight:700,fontSize:14,color:T.textPrimary,marginBottom:4,lineHeight:1.3}}>{s.title}</div>
              <div style={{fontSize:12,color:T.tealDark,marginBottom:6,fontStyle:"italic",fontWeight:600}}>{s.patient}</div>
              <div style={{fontSize:12,color:T.textSecondary,marginBottom:12,lineHeight:1.5}}>{s.context}</div>
              <div style={{background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:8,
                padding:"9px 11px",fontSize:11,color:T.textSecondary,lineHeight:1.55,fontStyle:"italic"}}>
                "{s.opening.length>95?s.opening.slice(0,95)+"…":s.opening}"
              </div>
              <div style={{marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:6}}>
                  <span style={{fontSize:10,color:T.teal,fontWeight:600}}>🎤 STT</span>
                  <span style={{fontSize:10,color:T.green,fontWeight:600}}>🔊 TTS</span>
                </div>
                <span style={{color:T.teal,fontSize:12,fontWeight:700}}>Begin →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MIC BAR (shared) ────────────────────────────────────────────────────────
function MicBar({listening,speaking,ok,onToggle,onStopTTS,hint}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <button onClick={onToggle} disabled={!ok}
        style={{
          width:50,height:50,borderRadius:"50%",flexShrink:0,
          background:listening?"#EF4444":T.teal,
          border:`2px solid ${listening?"#DC2626":T.tealDark}`,
          color:"white",fontSize:20,cursor:ok?"pointer":"not-allowed",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:listening?"0 0 0 6px #FCA5A422":"0 2px 8px rgba(13,148,136,0.3)",
          animation:listening?"aw-pulse 1.4s ease-in-out infinite":"none",
          transition:"all 0.2s",
        }}
        title={listening?"Stop listening":"Start listening"}>
        {listening?"⏹":"🎤"}
      </button>
      <div style={{flex:1}}>
        {listening?(
          <div>
            <div style={{fontSize:12,color:T.listening,fontWeight:600}}>Listening… speak, then pause to send</div>
            <div style={{marginTop:4}}><Waveform active color={T.listening} size={4}/></div>
          </div>
        ):speaking?(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Waveform active color={T.green} size={4}/>
            <span style={{fontSize:12,color:T.green,fontWeight:600}}>Speaking…</span>
            <button onClick={onStopTTS} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:11,textDecoration:"underline"}}>stop</button>
          </div>
        ):(
          <div style={{fontSize:11,color:T.textMuted}}>{hint}</div>
        )}
      </div>
    </div>
  );
}

// ─── BUTTON STYLE HELPER ─────────────────────────────────────────────────────
function btnStyle(v="primary"){
  const base={padding:"7px 16px",borderRadius:8,cursor:"pointer",fontSize:12,
    fontWeight:600,fontFamily:"inherit",transition:"all 0.15s"};
  if(v==="primary") return{...base,background:T.teal,border:"none",color:"white",boxShadow:"0 1px 4px rgba(13,148,136,0.25)"};
  if(v==="outline") return{...base,background:"white",border:`1.5px solid ${T.tealBorder}`,color:T.tealDark};
  if(v==="ghost")   return{...base,background:"transparent",border:`1px solid ${T.border}`,color:T.textSecondary};
  return base;
}

// ─── MEETING NOTES MODE ──────────────────────────────────────────────────────
/**
 *  Branch: agewell-meeting-notes
 *  Parent: notewell-meeting-notes (GP practice service — kept separate)
 *  Reason: Ageing Well teams require MDT/neighbourhood/care-review templates,
 *          multi-agency attendees, frailty-aware AI summarisation, and
 *          escalation flagging not appropriate in the GP meeting notes service.
 */

const MEETING_TYPES = [
  { id:"mdt",       label:"MDT Care Review",          icon:"👥", prompt:"multi-disciplinary team care review for a complex or frail patient" },
  { id:"home",      label:"Home Visit",                icon:"🏠", prompt:"home visit assessment by a care worker or clinician" },
  { id:"frailty",   label:"Frailty Assessment",        icon:"🩺", prompt:"frailty and falls risk assessment" },
  { id:"care_plan", label:"Care Plan Review",          icon:"📋", prompt:"care plan review meeting with patient and/or family" },
  { id:"nbhd",      label:"Neighbourhood Team Meeting",icon:"🌿", prompt:"Ageing Well neighbourhood team operational or clinical meeting" },
  { id:"safeguard", label:"Safeguarding Review",       icon:"🛡️", prompt:"safeguarding concern review involving multiple agencies" },
  { id:"discharge", label:"Discharge Planning",        icon:"🏥", prompt:"hospital discharge planning meeting" },
  { id:"general",   label:"General Meeting",           icon:"📝", prompt:"general team or operational meeting" },
];

const SPEAKER_COLOURS = [
  { bg:"#EEF4FF", border:"#C7D7F8", text:"#1E40AF" },
  { bg:"#F0FDF4", border:"#86EFAC", text:"#166534" },
  { bg:"#FFF8ED", border:"#FCD34D", text:"#92400E" },
  { bg:"#FDF4FF", border:"#E9D5FF", text:"#6B21A8" },
  { bg:"#FFF1F2", border:"#FDA4AF", text:"#9F1239" },
];

function MeetingNotesMode({ onBack }) {
  // ── Session setup state ──────────────────────────────────────────
  const [phase, setPhase]               = useState("setup");      // setup | recording | notes
  const [meetingType, setMeetingType]   = useState(MEETING_TYPES[0]);
  const [location, setLocation]         = useState("");
  const [attendees, setAttendees]       = useState([
    { id:1, name:"", role:"" },
    { id:2, name:"", role:"" },
  ]);
  const [activeSpeaker, setActiveSpeaker] = useState(0);          // index into attendees

  // ── Recording state ──────────────────────────────────────────────
  const [transcript, setTranscript]     = useState([]);           // [{speakerIdx, text, ts}]
  const [interim, setInterim]           = useState("");
  const [elapsed, setElapsed]           = useState(0);
  const timerRef                        = useRef(null);
  const startTime                       = useRef(null);

  // ── Notes state ──────────────────────────────────────────────────
  const [notes, setNotes]               = useState(null);
  const [generating, setGenerating]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes]   = useState("");

  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[transcript,interim]);

  // ── Timer ────────────────────────────────────────────────────────
  useEffect(()=>{
    if(phase==="recording"){
      startTime.current = Date.now() - elapsed*1000;
      timerRef.current = setInterval(()=>{
        setElapsed(Math.floor((Date.now()-startTime.current)/1000));
      },1000);
    } else {
      clearInterval(timerRef.current);
    }
    return ()=>clearInterval(timerRef.current);
  },[phase]);

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── STT ──────────────────────────────────────────────────────────
  const handleFinal = useCallback((text)=>{
    if(!text) return;
    setInterim("");
    setTranscript(prev=>[...prev,{
      id: Date.now(),
      speakerIdx: activeSpeaker,
      text: text.trim(),
      ts: fmtTime(elapsed),
    }]);
  },[activeSpeaker, elapsed]);

  const { listening, ok, toggle, stop:stopSTT } = useSTT({
    onInterim: setInterim,
    onFinal:   handleFinal,
  });

  // ── Generate Notes ───────────────────────────────────────────────
  const generateNotes = async () => {
    if(!transcript.length) return;
    setGenerating(true);

    const speakerMap = attendees.reduce((acc,a,i)=>{
      acc[i] = (a.name||`Speaker ${i+1}`) + (a.role ? ` (${a.role})`:"");
      return acc;
    },{});

    const rawTranscript = transcript
      .map(e=>`[${e.ts}] ${speakerMap[e.speakerIdx]||`Speaker ${e.speakerIdx+1}`}: ${e.text}`)
      .join("\n");

    const mtLabel = meetingType.label;
    const loc     = location || "Not specified";
    const date    = new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
    const attendeeList = attendees.filter(a=>a.name).map(a=>`${a.name}${a.role?` — ${a.role}`:""}`).join(", ") || "Not recorded";

    const prompt = `You are a clinical note-taker for an Ageing Well neighbourhood care team. 
Generate structured meeting notes from the following transcript of a ${meetingType.prompt}.

MEETING DETAILS:
- Type: ${mtLabel}
- Date: ${date}
- Location: ${loc}
- Attendees: ${attendeeList}
- Duration: ${fmtTime(elapsed)}

TRANSCRIPT:
${rawTranscript}

Generate notes in the following exact structure. Use plain text, no markdown symbols like ** or ##.
Use clear section headers in CAPITALS followed by a colon.

MEETING SUMMARY:
[2-4 sentence overview of the meeting purpose and key discussion points]

KEY CLINICAL OBSERVATIONS:
[Bullet list of clinical or care observations raised. Write "None recorded" if not applicable.]

DECISIONS MADE:
[Bullet list of decisions reached during this meeting]

ACTION ITEMS:
[List each action as: Action — Owner — Target Date. Write "None recorded" if none.]

FOLLOW-UP REQUIRED:
[Bullet list of follow-up items, referrals, or next steps]

ESCALATION FLAGS:
[Any safeguarding concerns, urgent clinical issues, or items requiring immediate escalation. Write "None identified" if none.]

NEXT MEETING / REVIEW DATE:
[If discussed, state it. Otherwise write "Not discussed."]

Keep language professional, concise, and appropriate for an NHS neighbourhood care record.`;

    try {
      const text = await callAgewellAI({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      }) || "Error generating notes.";
      setNotes(text);
      setEditedNotes(text);
      setPhase("notes");
    } catch {
      setNotes("⚠️ Connection error. Please try again.");
    }
    setGenerating(false);
  };

  const copyToClipboard = async () => {
    const header = `AGEING WELL NEIGHBOURHOOD CARE — ${meetingType.label.toUpperCase()}\n`
      + `Date: ${new Date().toLocaleDateString("en-GB")}\n`
      + `Location: ${location||"Not specified"}\n`
      + `Attendees: ${attendees.filter(a=>a.name).map(a=>`${a.name}${a.role?` (${a.role})`:""}`).join(", ")||"Not recorded"}\n`
      + `Duration: ${fmtTime(elapsed)}\n`
      + `Generated by: Notewell AI — Ageing Well Meeting Notes Branch\n`
      + `\n${"─".repeat(60)}\n\n`
      + (editingNotes ? editedNotes : notes);
    await navigator.clipboard.writeText(header);
    setCopied(true);
    setTimeout(()=>setCopied(false),2500);
  };

  const addAttendee = () => setAttendees(prev=>[...prev,{id:Date.now(),name:"",role:""}]);
  const removeAttendee = (id) => setAttendees(prev=>prev.filter(a=>a.id!==id));
  const updateAttendee = (id,field,val) => setAttendees(prev=>prev.map(a=>a.id===id?{...a,[field]:val}:a));

  const reset = () => {
    stopSTT();
    setPhase("setup"); setTranscript([]); setInterim("");
    setElapsed(0); setNotes(null); setEditedNotes(""); setEditingNotes(false); setActiveSpeaker(0);
  };

  // ── Render: SETUP ────────────────────────────────────────────────
  if(phase==="setup") return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:T.surfaceTeal,borderBottom:`1px solid ${T.tealBorder}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onBack} style={btnStyle("outline")}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:T.tealDark,fontSize:15}}>Care Notes</div>
          <div style={{fontSize:12,color:T.textSecondary}}>Ageing Well branch · Live transcription + AI structured notes</div>
        </div>
        <div style={{fontSize:10,color:T.textMuted,fontFamily:"monospace",background:T.surfaceCard,border:`1px solid ${T.border}`,borderRadius:6,padding:"3px 8px"}}>
          agewell-meeting-notes
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px",background:T.pageBg}}>
        <div style={{maxWidth:640,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

          {/* Meeting type */}
          <div style={{background:T.surfaceCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <div style={{fontWeight:700,color:T.textPrimary,marginBottom:12,fontSize:14}}>Meeting Type</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
              {MEETING_TYPES.map(mt=>(
                <div key={mt.id} onClick={()=>setMeetingType(mt)} style={{
                  padding:"10px 12px",borderRadius:9,cursor:"pointer",
                  background:meetingType.id===mt.id?T.tealLight:T.surfaceAlt,
                  border:`1.5px solid ${meetingType.id===mt.id?T.teal:T.border}`,
                  transition:"all 0.15s",
                }}>
                  <div style={{fontSize:18,marginBottom:3}}>{mt.icon}</div>
                  <div style={{fontSize:12,fontWeight:600,color:meetingType.id===mt.id?T.tealDark:T.textPrimary}}>{mt.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div style={{background:T.surfaceCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <div style={{fontWeight:700,color:T.textPrimary,marginBottom:10,fontSize:14}}>Location / Setting</div>
            <input value={location} onChange={e=>setLocation(e.target.value)}
              placeholder="e.g. Oak Lane Medical Practice, Patient's home, Video call…"
              style={{width:"100%",background:T.surfaceAlt,border:`1.5px solid ${T.border}`,borderRadius:8,
                padding:"10px 14px",fontSize:13,color:T.textPrimary,outline:"none",fontFamily:"inherit"}}/>
          </div>

          {/* Attendees */}
          <div style={{background:T.surfaceCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:700,color:T.textPrimary,fontSize:14}}>Attendees</div>
              <button onClick={addAttendee} style={btnStyle("outline")}>+ Add</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {attendees.map((a,i)=>{
                const sc = SPEAKER_COLOURS[i%SPEAKER_COLOURS.length];
                return(
                  <div key={a.id} style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:sc.bg,
                      border:`1.5px solid ${sc.border}`,display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:11,fontWeight:700,color:sc.text,flexShrink:0}}>
                      {i+1}
                    </div>
                    <input value={a.name} onChange={e=>updateAttendee(a.id,"name",e.target.value)}
                      placeholder={`Name (Speaker ${i+1})`}
                      style={{flex:1,background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:7,
                        padding:"8px 11px",fontSize:12,color:T.textPrimary,outline:"none",fontFamily:"inherit"}}/>
                    <input value={a.role} onChange={e=>updateAttendee(a.id,"role",e.target.value)}
                      placeholder="Role / Organisation"
                      style={{flex:1,background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:7,
                        padding:"8px 11px",fontSize:12,color:T.textPrimary,outline:"none",fontFamily:"inherit"}}/>
                    {attendees.length>1&&(
                      <button onClick={()=>removeAttendee(a.id)} style={{background:"none",border:"none",
                        color:T.textMuted,cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:10,fontSize:11,color:T.textMuted}}>
              You can add more attendees during the session. Names are used in the transcript and AI notes.
            </div>
          </div>

          <button onClick={()=>setPhase("recording")} style={{
            ...btnStyle("primary"),padding:"14px",fontSize:15,borderRadius:12,
            boxShadow:"0 3px 12px rgba(13,148,136,0.3)",letterSpacing:"0.3px",
          }}>
            🎙️ Start Recording Session
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render: RECORDING ────────────────────────────────────────────
  if(phase==="recording") return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Recording header */}
      <div style={{background:T.surfaceTeal,borderBottom:`1px solid ${T.tealBorder}`,padding:"10px 18px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",
            animation:"aw-pulse-red 1.2s ease-in-out infinite"}}/>
          <span style={{fontFamily:"monospace",fontSize:15,fontWeight:700,color:T.tealDark}}>{fmtTime(elapsed)}</span>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,color:T.textPrimary}}>{meetingType.icon} {meetingType.label}</div>
          <div style={{fontSize:11,color:T.textSecondary}}>{location||"Location not set"} · {transcript.length} segments</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {listening&&(
            <div style={{display:"flex",alignItems:"center",gap:6,background:T.listeningBg,
              border:`1px solid ${T.listeningBorder}`,borderRadius:7,padding:"4px 10px"}}>
              <Waveform active color={T.listening} size={3}/>
              <span style={{fontSize:10,color:T.listening,fontWeight:700}}>RECORDING</span>
            </div>
          )}
          <button onClick={()=>{stopSTT();generateNotes();}} disabled={!transcript.length||generating}
            style={{...btnStyle("primary"),opacity:transcript.length?1:0.5}}>
            {generating?"Generating…":"✨ Generate Notes"}
          </button>
          <button onClick={reset} style={btnStyle("ghost")}>✕ Discard</button>
        </div>
      </div>

      {/* Speaker selector */}
      <div style={{background:T.surfaceCard,borderBottom:`1px solid ${T.border}`,
        padding:"8px 18px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",flexShrink:0}}>
        <span style={{fontSize:11,color:T.textSecondary,fontWeight:600,marginRight:4}}>Speaking:</span>
        {attendees.map((a,i)=>{
          const sc=SPEAKER_COLOURS[i%SPEAKER_COLOURS.length];
          return(
            <button key={a.id} onClick={()=>setActiveSpeaker(i)} style={{
              background:activeSpeaker===i?sc.bg:"white",
              border:`1.5px solid ${activeSpeaker===i?sc.border:T.border}`,
              color:activeSpeaker===i?sc.text:T.textSecondary,
              padding:"5px 12px",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,
              transition:"all 0.15s",fontFamily:"inherit",
            }}>
              {a.name||`Speaker ${i+1}`}
              {a.role&&<span style={{fontWeight:400,opacity:0.75}}> · {a.role}</span>}
            </button>
          );
        })}
        <button onClick={addAttendee} style={{...btnStyle("ghost"),padding:"4px 10px",fontSize:11}}>+ Add speaker</button>
      </div>

      {/* Live transcript */}
      <div style={{flex:1,overflowY:"auto",padding:"14px 18px",background:T.pageBg,display:"flex",flexDirection:"column",gap:8}}>
        {transcript.length===0&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted}}>
            <div style={{fontSize:36,marginBottom:10}}>🎙️</div>
            <div style={{fontSize:14,fontWeight:600,color:T.textSecondary}}>Ready to record</div>
            <div style={{fontSize:12,marginTop:4}}>Select the active speaker, then press the microphone to begin</div>
          </div>
        )}
        {transcript.map((seg)=>{
          const sc=SPEAKER_COLOURS[seg.speakerIdx%SPEAKER_COLOURS.length];
          const a=attendees[seg.speakerIdx];
          return(
            <div key={seg.id} style={{animation:"aw-fadein 0.2s ease",display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:sc.bg,
                border:`1.5px solid ${sc.border}`,display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:10,fontWeight:700,color:sc.text,flexShrink:0}}>
                {(a?.name||"?").charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"baseline",marginBottom:2}}>
                  <span style={{fontSize:11,fontWeight:700,color:sc.text}}>{a?.name||`Speaker ${seg.speakerIdx+1}`}</span>
                  {a?.role&&<span style={{fontSize:10,color:T.textMuted}}>{a.role}</span>}
                  <span style={{fontSize:10,color:T.textMuted,fontFamily:"monospace",marginLeft:"auto"}}>{seg.ts}</span>
                </div>
                <div style={{background:T.surfaceCard,border:`1px solid ${T.border}`,borderRadius:"4px 12px 12px 12px",
                  padding:"9px 13px",fontSize:13,color:T.textPrimary,lineHeight:1.6,
                  boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
                  {seg.text}
                </div>
              </div>
            </div>
          );
        })}
        {interim&&(
          <div style={{display:"flex",gap:10,alignItems:"flex-start",opacity:0.75}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:T.listeningBg,
              border:`1.5px dashed ${T.listeningBorder}`,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,color:T.listening,flexShrink:0}}>
              {(attendees[activeSpeaker]?.name||"?").charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:T.listening,marginBottom:2}}>
                {attendees[activeSpeaker]?.name||`Speaker ${activeSpeaker+1}`}
              </div>
              <div style={{background:T.listeningBg,border:`1.5px dashed ${T.listeningBorder}`,
                borderRadius:"4px 12px 12px 12px",padding:"9px 13px",fontSize:13,
                color:T.listening,lineHeight:1.6,fontStyle:"italic"}}>
                {interim}<span style={{animation:"aw-blink 0.8s infinite"}}>▍</span>
              </div>
            </div>
          </div>
        )}
        {generating&&(
          <div style={{display:"flex",justifyContent:"center",padding:"20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,background:T.tealLight,
              border:`1px solid ${T.tealBorder}`,borderRadius:10,padding:"12px 20px",fontSize:13,color:T.tealDark}}>
              <div style={{width:16,height:16,border:`2px solid ${T.teal}`,borderTopColor:"transparent",
                borderRadius:"50%",animation:"aw-spin 0.7s linear infinite"}}/>
              AI is generating your structured meeting notes…
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Mic bar */}
      <div style={{padding:"12px 18px",background:T.surfaceCard,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
        <MicBar listening={listening} speaking={false} ok={ok} onToggle={toggle} onStopTTS={()=>{}}
          hint={ok
            ?"Select speaker above · Press mic · Speak · Auto-captures on pause"
            :"STT unavailable — type segments manually (Chrome / Edge recommended)"}/>
        {!ok&&(
          <div style={{marginTop:8,display:"flex",gap:8}}>
            <input id="manual-seg" placeholder="Type spoken text manually and press Add…"
              style={{flex:1,background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:7,
                padding:"8px 12px",fontSize:12,color:T.textPrimary,outline:"none",fontFamily:"inherit"}}/>
            <button onClick={()=>{
              const el=document.getElementById("manual-seg");
              if(el.value.trim()) handleFinal(el.value.trim());
              el.value="";
            }} style={btnStyle("primary")}>Add</button>
          </div>
        )}
      </div>

      <style>{`@keyframes aw-pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}`}</style>
    </div>
  );

  // ── Render: NOTES ────────────────────────────────────────────────
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:T.surfaceTeal,borderBottom:`1px solid ${T.tealBorder}`,padding:"10px 18px",
        display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",flexShrink:0}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,color:T.tealDark}}>✅ Notes Generated</div>
          <div style={{fontSize:11,color:T.textSecondary}}>
            {meetingType.icon} {meetingType.label} · {fmtTime(elapsed)} · {transcript.length} segments · {new Date().toLocaleDateString("en-GB")}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={copyToClipboard} style={{...btnStyle("primary"),background:copied?"#16A34A":T.teal}}>
            {copied?"✓ Copied!":"📋 Copy Notes"}
          </button>
          <button onClick={()=>setEditingNotes(!editingNotes)} style={btnStyle("outline")}>
            {editingNotes?"👁 Preview":"✏️ Edit"}
          </button>
          <button onClick={()=>setPhase("recording")} style={btnStyle("ghost")}>← Back to Recording</button>
          <button onClick={reset} style={btnStyle("ghost")}>✕ New Session</button>
        </div>
      </div>

      {/* Notes metadata strip */}
      <div style={{background:T.surfaceCard,borderBottom:`1px solid ${T.border}`,
        padding:"8px 18px",display:"flex",gap:16,flexWrap:"wrap",flexShrink:0}}>
        {[
          ["Meeting",`${meetingType.icon} ${meetingType.label}`],
          ["Date", new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})],
          ["Location", location||"Not specified"],
          ["Duration", fmtTime(elapsed)],
          ["Attendees", attendees.filter(a=>a.name).length||"Not recorded"],
        ].map(([k,v])=>(
          <div key={k}>
            <div style={{fontSize:9,color:T.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{k}</div>
            <div style={{fontSize:12,color:T.textPrimary,fontWeight:600}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Notes body */}
      <div style={{flex:1,overflowY:"auto",padding:"20px",background:T.pageBg}}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          {editingNotes?(
            <textarea value={editedNotes} onChange={e=>setEditedNotes(e.target.value)}
              style={{width:"100%",minHeight:"60vh",background:T.surfaceCard,
                border:`1.5px solid ${T.tealBorder}`,borderRadius:12,
                padding:"18px",fontSize:13,color:T.textPrimary,lineHeight:1.8,
                fontFamily:"'Courier New', monospace",outline:"none",resize:"vertical"}}/>
          ):(
            <div style={{background:T.surfaceCard,border:`1px solid ${T.border}`,borderRadius:14,
              padding:"24px 28px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
              {/* Notewell header */}
              <div style={{borderBottom:`2px solid ${T.tealBorder}`,paddingBottom:14,marginBottom:20,
                display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:T.tealDark,
                    fontFamily:"Georgia,'Times New Roman',serif"}}>
                    {meetingType.icon} {meetingType.label}
                  </div>
                  <div style={{fontSize:12,color:T.textSecondary,marginTop:2}}>
                    Ageing Well Neighbourhood Care · {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:T.textMuted,fontWeight:700,letterSpacing:1}}>NOTEWELL AI</div>
                  <div style={{fontSize:9,color:T.textMuted}}>agewell-meeting-notes</div>
                </div>
              </div>

              {/* Parsed note sections */}
              {(editingNotes?editedNotes:notes).split("\n\n").map((block,i)=>{
                const lines = block.split("\n");
                const isHeader = lines[0].match(/^[A-Z\s\/]+:$/);
                if(isHeader){
                  const headerText = lines[0].replace(":","");
                  const body = lines.slice(1).join("\n").trim();
                  const sectionColours = {
                    "ESCALATION FLAGS":    { bg:T.roseLight,  border:T.roseBorder,  text:T.rose },
                    "SAFEGUARDING":        { bg:T.amberLight, border:T.amberBorder, text:T.amber },
                    "ACTION ITEMS":        { bg:T.surfaceBlue,border:"#C7D7F8",     text:"#1E40AF" },
                    "KEY CLINICAL OBSERVATIONS":{ bg:T.tealLight,border:T.tealBorder,text:T.tealDark },
                  };
                  const sc = Object.entries(sectionColours).find(([k])=>headerText.includes(k))?.[1]
                    || {bg:T.surfaceAlt,border:T.border,text:T.textSecondary};
                  return(
                    <div key={i} style={{marginBottom:16,borderRadius:10,overflow:"hidden",
                      border:`1px solid ${sc.border}`}}>
                      <div style={{background:sc.bg,padding:"8px 14px",
                        fontSize:11,fontWeight:800,color:sc.text,letterSpacing:"0.8px",textTransform:"uppercase"}}>
                        {headerText}
                      </div>
                      <div style={{padding:"12px 14px",fontSize:13,color:T.textPrimary,lineHeight:1.75,whiteSpace:"pre-wrap"}}>
                        {body||"—"}
                      </div>
                    </div>
                  );
                }
                return(
                  <p key={i} style={{fontSize:13,color:T.textPrimary,lineHeight:1.75,marginBottom:10,whiteSpace:"pre-wrap"}}>
                    {block}
                  </p>
                );
              })}

              <div style={{borderTop:`1px solid ${T.border}`,marginTop:20,paddingTop:12,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:10,color:T.textMuted}}>
                  Generated by Notewell AI · Ageing Well Meeting Notes Branch · MHRA Class I
                </div>
                <div style={{fontSize:10,color:T.textMuted}}>
                  {transcript.length} transcript segments · {fmtTime(elapsed)} recorded
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({onSelect}){
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
      padding:"32px 24px",background:T.pageBg,gap:20,overflowY:"auto"}}>
      {/* Hero: logo + title + subtitle */}
      <div style={{textAlign:"center",maxWidth:500}}>
        <h1 style={{fontSize:26,fontWeight:800,color:T.tealDark,margin:"0 0 6px",letterSpacing:"-0.5px",
          fontFamily:"Georgia, 'Times New Roman', serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          <AgewellLogoLarge/> Ageing Well Live Services
        </h1>
        <p style={{fontSize:13,color:T.textSecondary,margin:0,lineHeight:1.6}}>
          A Notewell AI service for neighbourhood care teams
        </p>
      </div>

      {/* Mode cards */}
      <div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center",width:"100%",maxWidth:960}}>
        {[
          {key:"translate",title:"Live Translate",desc:"Real-time bilingual support for consultations. Clinician and patient speak — instant translation both ways.",features:["15 languages","Real-time STT","TTS playback","Full transcript"],color:T.teal,light:T.tealLight,border:T.tealBorder,
            icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>},
          {key:"train",title:"Skills Practice",desc:"Build confidence with AI role-play — 5 language and 5 English Ageing Well care scenarios",features:["10 scenarios","Voice interaction","Live transcription","Safeguarding incl."],color:T.green,light:T.greenLight,border:T.greenBorder,
            icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#378ADD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
          {key:"notes",title:"Care Notes",desc:"Live transcription that auto-populates the Ageing Well Patient Support Plan — ready for the clinical system.",features:["8 Ageing Well templates","Multi-speaker STT","Patient Support Plan","Export to record"],color:T.amber,light:T.amberLight,border:T.amberBorder,
            icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>},
        ].map(m=>(
          <div key={m.key} onClick={()=>onSelect(m.key)} style={{
            flex:"1 1 260px",maxWidth:300,background:T.surfaceCard,border:`2px solid ${T.border}`,borderRadius:16,
            padding:"24px",cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",transition:"all 0.2s",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",
          }}
          onMouseEnter={e=>{ e.currentTarget.style.borderColor=m.color; e.currentTarget.style.boxShadow=`0 6px 24px ${m.color}22`; e.currentTarget.style.transform="translateY(-3px)"; }}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.07)"; e.currentTarget.style.transform="translateY(0)"; }}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:5,background:m.color,borderRadius:"16px 16px 0 0"}}/>
            <div style={{marginBottom:10}}>{m.icon}</div>
            <div style={{fontWeight:800,fontSize:17,color:T.textPrimary,marginBottom:6,fontFamily:"Georgia,'Times New Roman',serif"}}>{m.title}</div>
            <p style={{fontSize:12,color:T.textSecondary,lineHeight:1.6,margin:"0 0 14px"}}>{m.desc}</p>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {m.features.map(f=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:m.color,flexShrink:0}}/>
                  <span style={{fontSize:11,color:T.textSecondary,fontWeight:500}}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:"auto",paddingTop:18,display:"flex",justifyContent:"flex-end"}}>
              <div style={{background:m.color,color:"white",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700}}>Open →</div>
            </div>
          </div>
        ))}
      </div>

      {/* Badge */}
      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.tealLight,
        border:`1px solid ${T.tealBorder}`,borderRadius:20,padding:"3px 12px"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:T.teal}}/>
        <span style={{fontSize:10,color:T.tealDark,fontWeight:700,letterSpacing:1}}>NOTEWELL AI · AGEING WELL BRANCH</span>
      </div>

      {/* Intro text container */}
      <div style={{maxWidth:720,width:"100%",background:T.surfaceAlt,border:`1px solid ${T.border}`,
        borderRadius:14,padding:"18px 24px",textAlign:"center"}}>
        <p style={{fontSize:13,color:T.textSecondary,lineHeight:1.7,margin:"0 0 10px"}}>
          AI-powered tools for neighbourhood care teams working with frail elderly patients.
          Translate consultations in real time, capture structured care notes — automatically
          formatted into the standard Ageing Well Patient Support Plan — and build clinical
          confidence through AI skills practice scenarios.
        </p>
        <p style={{fontSize:12,color:T.teal,fontStyle:"italic",margin:0,fontWeight:500,lineHeight:1.6}}>
          Supporting multilingual care, clinical confidence, and better documentation across your neighbourhood.
        </p>
      </div>

      {/* How it works */}
      <div style={{maxWidth:720,width:"100%",background:T.surfaceAlt,border:`1px solid ${T.border}`,
        borderRadius:14,padding:"16px 24px"}}>
        <div style={{fontSize:12,fontWeight:600,color:T.textSecondary,marginBottom:12,textAlign:"center"}}>How it works</div>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:0,flexWrap:"wrap"}}>
          {[
            {label:"Record",desc:"Start a live session — consultation, MDT, home visit or care review",bg:"#E1F5EE",text:"#0F6E56",
              icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
            {label:"Generate",desc:"AI structures the notes into the Ageing Well Patient Support Plan",bg:"#E6F1FB",text:"#185FA5",
              icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>},
            {label:"Export",desc:"Download and add the completed form to the patient record",bg:"#FAEEDA",text:"#854F0B",
              icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>},
          ].map((step,i)=>(
            <div key={step.label} style={{display:"flex",alignItems:"flex-start",gap:0}}>
              <div style={{background:step.bg,borderRadius:10,padding:"12px 14px",minWidth:140,maxWidth:180,textAlign:"center"}}>
                <div style={{marginBottom:6,display:"flex",justifyContent:"center"}}>{step.icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:step.text,marginBottom:4}}>{step.label}</div>
                <div style={{fontSize:11,color:step.text,opacity:0.85,lineHeight:1.5}}>{step.desc}</div>
              </div>
              {i<2&&<span style={{fontSize:18,color:T.textMuted,padding:"18px 8px 0",alignSelf:"flex-start"}}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div style={{textAlign:"center",maxWidth:460}}>
        <p style={{fontSize:11,color:T.textMuted,lineHeight:1.7,margin:0}}>
          This service is branched from Notewell GP services to provide Ageing Well neighbourhood
          teams with translation, training, and care notes capabilities separate from GP practice deployments.<br/>
          <strong style={{color:T.textSecondary}}>MHRA Class I · DCB0129 · DTAC compliant · 3 branched services</strong>
        </p>
      </div>
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────

export default function AgewellTranslateTrain(){
  const [mode,setMode]=useState("home"); // home | translate | train | notes
  const [userMenuOpen,setUserMenuOpen]=useState(false);
  const [userInitials,setUserInitials]=useState("?");
  const navigate=useNavigate();
  const menuRef=useRef(null);

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(data?.user){
        const meta=data.user.user_metadata||{};
        const name=meta.full_name||meta.name||data.user.email||"";
        const parts=name.trim().split(/\s+/);
        setUserInitials(parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():name.slice(0,2).toUpperCase());
      }
    });
  },[]);

  useEffect(()=>{
    if(!userMenuOpen) return;
    const handler=(e)=>{if(menuRef.current&&!menuRef.current.contains(e.target)) setUserMenuOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[userMenuOpen]);

  const handleLogout=async()=>{
    await supabase.auth.signOut();
    navigate("/");
  };

  const pillStyle={
    background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",
    color:"white",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",
  };

  return(
    <div style={{
      fontFamily:"'Segoe UI', system-ui, -apple-system, sans-serif",
      height:"100vh", display:"flex", flexDirection:"column",
      background:T.pageBg, color:T.textPrimary, overflow:"hidden",
    }}>
      <style>{`
        @keyframes aw-wave  { 0%,100%{transform:scaleY(0.5)} 50%{transform:scaleY(1.2)} }
        @keyframes aw-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes aw-fadein{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes aw-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes aw-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,0.3)} 50%{box-shadow:0 0 0 8px rgba(124,58,237,0)} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:${T.surfaceAlt}}
        ::-webkit-scrollbar-thumb{background:${T.tealBorder};border-radius:3px}
        input::placeholder{color:${T.textMuted}}
      `}</style>

      {/* Global header */}
      <div style={{
        background:`linear-gradient(135deg, ${T.tealDark} 0%, ${T.teal} 100%)`,
        padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0,
        boxShadow:"0 2px 12px rgba(13,148,136,0.2)",
      }}>
        {/* Back to Notewell */}
        <button onClick={()=>navigate("/")} style={{
          ...pillStyle,fontSize:11,padding:"4px 10px",opacity:0.85,
        }}>← Notewell</button>

        {/* Title */}
        <div>
          <div style={{fontWeight:800,fontSize:15,color:"white",letterSpacing:"-0.2px",
            fontFamily:"Georgia,'Times New Roman',serif"}}>
            Ageing Well Live Services
          </div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",letterSpacing:"1px",fontWeight:600}}>
            NOTEWELL AI · NEIGHBOURHOOD CARE SERVICE
          </div>
        </div>

        {/* Spacer */}
        <div style={{flex:1}}/>

        {/* Nav pills */}
        {mode!=="home"&&(
          <button onClick={()=>setMode("home")} style={pillStyle}>⌂ Home</button>
        )}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {mode==="home"&&[["translate","Translate"],["train","Train"],["notes","Notes"]].map(([k,l])=>(
            <button key={k} onClick={()=>setMode(k)} style={pillStyle}>{l}</button>
          ))}
        </div>

        {/* User avatar + dropdown */}
        <div ref={menuRef} style={{position:"relative"}}>
          <button onClick={()=>setUserMenuOpen(v=>!v)} style={{
            width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.2)",
            border:"1px solid rgba(255,255,255,0.3)",color:"white",fontSize:11,fontWeight:700,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",
          }}>{userInitials}</button>
          {userMenuOpen&&(
            <div style={{
              position:"absolute",right:0,top:34,background:"white",borderRadius:10,
              boxShadow:"0 8px 24px rgba(0,0,0,0.15)",border:`1px solid ${T.border}`,
              minWidth:180,zIndex:999,overflow:"hidden",animation:"aw-fadein 0.15s ease",
            }}>
              <button onClick={()=>{setUserMenuOpen(false);navigate("/profile");}} style={{
                display:"block",width:"100%",textAlign:"left",padding:"10px 16px",
                background:"none",border:"none",cursor:"pointer",fontSize:13,color:T.textPrimary,fontFamily:"inherit",
              }}>My profile</button>
              <button onClick={()=>{setUserMenuOpen(false);navigate("/");}} style={{
                display:"block",width:"100%",textAlign:"left",padding:"10px 16px",
                background:"none",border:"none",cursor:"pointer",fontSize:13,color:T.textPrimary,fontFamily:"inherit",
              }}>← Back to Notewell</button>
              <div style={{height:1,background:T.border,margin:"2px 0"}}/>
              <button onClick={handleLogout} style={{
                display:"block",width:"100%",textAlign:"left",padding:"10px 16px",
                background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#DC2626",fontFamily:"inherit",
              }}>Log out</button>
            </div>
          )}
        </div>
      </div>

      {/* Mode breadcrumb */}
      {mode!=="home"&&(
        <div style={{background:T.surfaceCard,borderBottom:`1px solid ${T.border}`,
          padding:"6px 20px",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <span style={{fontSize:11,color:T.textMuted}}>Ageing Well</span>
          <span style={{fontSize:11,color:T.textMuted}}>›</span>
          <span style={{fontSize:11,color:T.teal,fontWeight:700}}>
            {mode==="translate"?"Live Translate":mode==="train"?"Translate & Train":"Care Notes"}
          </span>
        </div>
      )}

      {/* Content area */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {mode==="home"    && <HomeScreen onSelect={setMode}/>}
        {mode==="translate"&&<LiveTranslateMode onBack={()=>setMode("home")}/>}
        {mode==="train"   &&<TrainingMode onBack={()=>setMode("home")}/>}
        {mode==="notes"   &&<MeetingNotesMode onBack={()=>setMode("home")}/>}
      </div>
    </div>
  );
}
