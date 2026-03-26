/**
 * ═══════════════════════════════════════════════════════════════════
 *  Patient Support Plan — Guided Assessment
 *  Ageing Well Care Notes · Notewell AI
 *
 *  30-section clinical assessment form with demo auto-fill,
 *  live transcript panel, scored questionnaires, and summary view.
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DemoToolbar } from "@/components/agewell/DemoToolbar";
import { DEMO_PATIENT } from "@/constants/demoData";

/* ─── NHS colour palette ──────────────────────────────────────────── */
const C = {
  blue: "#005EB8", dark: "#003087", light: "#41B6E6", aqua: "#00A9CE",
  green: "#009639", amber: "#ED8B00", red: "#DA291C",
  bg: "#FAFAF5", text: "#1a1a2e", mid: "#4a4a6a", dim: "#8888a0", bdr: "#E8E8EE",
};

/* ─── 30 SECTIONS ─────────────────────────────────────────────────── */
const SECS = [
  { id: "demo", t: "Patient Details", ic: "👤", fields: [
    {k:"nhsNumber",l:"NHS Number"},{k:"surgery",l:"Surgery"},{k:"pharmacy",l:"Pharmacy"},
    {k:"supportWorker",l:"Support Worker"},{k:"title",l:"Title"},{k:"name",l:"Name"},
    {k:"preferredName",l:"Preferred Name"},{k:"dob",l:"Date of Birth"},{k:"age",l:"Age"},
    {k:"phone",l:"Phone Number"},{k:"address",l:"Address",ta:true},
  ]},
  { id: "consent", t: "Consent & Next of Kin", ic: "🤝", fields: [
    {k:"consentName",l:"Consent Name"},{k:"relationship",l:"Relationship"},
    {k:"nokPhone",l:"Phone"},{k:"nokEmail",l:"Email"},
  ]},
  { id: "dates", t: "Key Dates", ic: "📅", fields: [
    {k:"dateRef",l:"Date of Referral"},{k:"dateFirst",l:"First Contact"},
    {k:"dateAssess",l:"Assessment"},{k:"dateMDT",l:"MDT"},{k:"dateReview",l:"6 Week Review"},
  ]},
  { id: "obs", t: "Observations", ic: "🩺", fields: [
    {k:"rockwood",l:"Rockwood Score"},{k:"pulse",l:"Pulse"},
    {k:"falls12m",l:"Falls (12 months)"},{k:"respRate",l:"Respiratory Rate"},
    {k:"o2sat",l:"O2 Saturation"},{k:"temp",l:"Temperature"},
    {k:"bp1sit",l:"BP 1st Sitting"},{k:"bp2sit",l:"BP 2nd Sitting"},
    {k:"bp1stand",l:"BP 1st Standing"},{k:"bp2stand",l:"BP 2nd Standing"},
    {k:"tug",l:"Timed Get Up and Go",ta:true},
  ]},
  { id: "important", t: "What Is Important", ic: "💛", fields: [{k:"important",l:"What matters most",ta:true}] },
  { id: "health", t: "Health and Concerns", ic: "❤️", fields: [
    {k:"healthNotes",l:"Health worries",ta:true},{k:"bones",l:"Broken bones"},
    {k:"remoteMon",l:"Remote monitoring"},{k:"painCourse",l:"Pain course"},
  ]},
  { id: "sleep", t: "Sleep Patterns", ic: "😴", fields: [
    {k:"sleepRoutine",l:"Routine",ta:true},{k:"sleepDiff",l:"Difficulties",ta:true},{k:"sleepQual",l:"Quality"},
  ]},
  { id: "nutrition", t: "Nutrition", ic: "🍎", fields: [
    {k:"nutQual",l:"Good or poor"},{k:"malnourished",l:"Malnourished"},{k:"nutSupps",l:"Supplements"},
  ]},
  { id: "senses", t: "Eye, Hearing, Dental", ic: "👁️", fields: [
    {k:"eyeTest",l:"Last eye test"},{k:"hearTest",l:"Last hearing test"},{k:"dentist",l:"Last dentist"},
    {k:"senseConcerns",l:"Concerns",ta:true},
  ]},
  { id: "meds", t: "Medication", ic: "💊", fields: [
    {k:"medWorries",l:"Worries",ta:true},{k:"medSide",l:"Side effects"},
    {k:"blister",l:"Blister pack"},{k:"copd",l:"COPD Rescue pack"},
  ]},
  { id: "immun", t: "Immunisations", ic: "💉", fields: [
    {k:"covid",l:"Covid-19"},{k:"flu",l:"Flu"},{k:"rsv",l:"RSV"},
    {k:"shingles",l:"Shingles"},{k:"pneumo",l:"Pneumococcal"},
  ]},
  { id: "cont", t: "Continence", ic: "🚿", fields: [
    {k:"contFreq",l:"Frequency"},{k:"contUrg",l:"Urgency"},{k:"contIssues",l:"Issues",ta:true},
  ]},
  { id: "mood", t: "Mood and Mental Health", ic: "🧠", fields: [
    {k:"moodNotes",l:"Observations",ta:true},{k:"memConcerns",l:"Memory concerns",ta:true},
  ]},
  { id: "home", t: "Home and Environment", ic: "🏠", fields: [
    {k:"livesWith",l:"Lives with"},{k:"dwelling",l:"Dwelling"},{k:"ownership",l:"Ownership"},
    {k:"hazards",l:"Hazards?"},{k:"stairs",l:"Stairs?"},{k:"access",l:"Access issues?"},
  ]},
  { id: "mobility", t: "Mobility", ic: "🚶", fields: [
    {k:"mobFalls",l:"Falls"},{k:"aidsPlace",l:"Aids in place"},
    {k:"aidsReq",l:"Aids required"},{k:"transfers",l:"Transfers"},
  ]},
  { id: "support", t: "Existing Support", ic: "🤲", fields: [{k:"existSupp",l:"Family, friends, carers etc.",ta:true}] },
  { id: "pcare", t: "Personal Care", ic: "🛁", fields: [
    {k:"pCare",l:"Bathing, dressing etc.",ta:true},{k:"pCareSupp",l:"Existing support?",ta:true},
  ]},
  { id: "social", t: "Social Activities", ic: "🎭", fields: [
    {k:"socDo",l:"What they like to do",ta:true},{k:"socWant",l:"What they want to do again",ta:true},
  ]},
  { id: "transport", t: "Transport", ic: "🚗", fields: [
    {k:"ownVeh",l:"Own vehicle"},{k:"pubTrans",l:"Public transport"},{k:"transDiff",l:"Difficulties",ta:true},
  ]},
  { id: "benefits", t: "Benefits and Finance", ic: "💷", fields: [
    {k:"finIssues",l:"Concerns",ta:true},{k:"aa",l:"Receiving AA?"},{k:"poa",l:"POA in place?"},
  ]},
  { id: "safety", t: "Safety and Registers", ic: "🔒", fields: [
    {k:"blueBadge",l:"Blue Badge"},{k:"lifeline",l:"Lifeline"},
    {k:"keysafe",l:"Keysafe"},{k:"smoke",l:"Smoke alarms"},
  ]},
  { id: "safeguard", t: "Safeguarding", ic: "🛡️", fields: [{k:"sgConcerns",l:"Concerns",ta:true},{k:"sgSubmitted",l:"Submitted?"}] },
  { id: "other", t: "Anything Else", ic: "📝", fields: [
    {k:"otherNotes",l:"Notes",ta:true},{k:"refCarers",l:"Refer to Carers?"},{k:"refASC",l:"Refer to ASC?"},
  ]},
  { id: "phq9", t: "PHQ-9 Depression", ic: "📋", q: "phq9" },
  { id: "gad7", t: "GAD-7 Anxiety", ic: "📋", q: "gad7" },
  { id: "cit6", t: "6-CIT Cognitive", ic: "🧩", q: "cit" },
  { id: "frat2", t: "FRAT Falls Risk", ic: "⚠️", q: "frat" },
  { id: "ons4", t: "ONS4 Wellbeing", ic: "🌟", q: "ons" },
  { id: "action", t: "Action Plan", ic: "✅", ap: true },
];

/* ─── DEMO TRANSCRIPTS + EXTRACTED DATA ───────────────────────────── */
const DEMOS = {
  demo: {
    lines: [
      {s:"W",t:"Good morning! I am Sarah from the Age Well team. Could you confirm your full name for me?"},
      {s:"P",t:"Oh hello love, yes, come in come in. It is Margaret Dorothy Wilson. My late husband always called me Maggie though, everyone does really."},
      {s:"W",t:"Lovely, and Maggie is what you prefer to be called?"},
      {s:"P",t:"Yes please dear. Mrs Wilson makes me feel like my mother-in-law! She was a proper battleaxe, God rest her."},
      {s:"W",t:"And your date of birth Maggie?"},
      {s:"P",t:"Fourteenth of March 1938. I am 88 now, can you believe it? I do not feel it most days. Well, some days I do."},
      {s:"W",t:"You are looking very well for it! And your phone number?"},
      {s:"P",t:"Oh let me think, it is 01604 832471. My daughter got me one of those mobile phones but I can never find the thing."},
      {s:"W",t:"And you are registered at Brackley Medical Centre?"},
      {s:"P",t:"Yes, been there forty years. Dr Patel is lovely."},
    ],
    data: {name:"Margaret Dorothy Wilson",preferredName:"Maggie",dob:"14/03/1938",age:"88",title:"Mrs",phone:"01604 832471",surgery:"Brackley Medical Centre",supportWorker:"Sarah (Age Well)"},
  },
  consent: {
    lines: [
      {s:"W",t:"Maggie, do you have someone who can act on your behalf if needed?"},
      {s:"P",t:"Oh yes, my daughter Linda. Linda Hartley. She lives over in Towcester, about twenty minutes away. She is ever so good, comes round twice a week usually. Tuesdays and Saturdays normally. She does my big shop for me."},
      {s:"W",t:"That is lovely. And do you have a phone number for Linda?"},
      {s:"P",t:"Yes, let me find my book... here it is. 07700 142389. She works at the school so sometimes she cannot answer during the day but she always rings back."},
      {s:"W",t:"And an email for her?"},
      {s:"P",t:"I think it is linda.hartley something or other... linda.hartley@gmail.com I think. She set it up on my tablet for me but I never use the thing."},
    ],
    data: {consentName:"Linda Hartley",relationship:"Daughter",nokPhone:"07700 142389",nokEmail:"linda.hartley@gmail.com"},
  },
  obs: {
    lines: [
      {s:"W",t:"Right Maggie, I am going to do some observations now if that is alright. Just your blood pressure and a few bits."},
      {s:"P",t:"Oh yes, the doctor does that. Mine is always a bit high she says. I do worry about it."},
      {s:"W",t:"Let us have a look. OK that is 142 over 84 sitting down. I will do a second one... 138 over 82. Can you stand up for me?"},
      {s:"P",t:"Give me a moment love, my knees are not what they were. There we go."},
      {s:"W",t:"Well done. Standing is 130 over 78, and second reading 128 over 76. Good. Your pulse is 72 and nice and regular. Oxygen levels are 96 percent, temperature 36.4. Breathing rate looks about 16."},
      {s:"P",t:"Is all that alright then?"},
      {s:"W",t:"All looking pretty reasonable Maggie. Now have you had any falls in the last year?"},
      {s:"P",t:"Well I had a bit of a tumble in the kitchen back in, oh when was it, September I think. I slipped on the mat. And then I tripped on the step going into the garden about two months ago. I did not hurt myself badly either time though, just a bruise on my hip."},
      {s:"W",t:"Now I am going to do the timed get up and go test. I need you to stand up from this chair without using the arms, walk to the door, turn around and come back."},
      {s:"P",t:"Without using my arms? I will try..."},
      {s:"W",t:"That is fine, take your time. And that was 14 seconds."},
    ],
    data: {bp1sit:"142/84",bp2sit:"138/82",bp1stand:"130/78",bp2stand:"128/76",pulse:"72 bpm, regular",o2sat:"96%",temp:"36.4C",respRate:"16/min",rockwood:"5 - Mildly frail",falls12m:"2 falls (Sept - slipped on kitchen mat; Jan - tripped on garden step). No serious injury, bruised hip.",tug:"14 seconds. Required arms of chair to stand. Slightly unsteady on turn."},
  },
  important: {
    lines: [
      {s:"W",t:"Maggie, I would like to understand what matters most to you. What is really important in your life?"},
      {s:"P",t:"Well, the most important thing to me is staying here in this house. I have been here since 1982, my husband and I moved in when the children were small. All my memories are here. I know every inch of this place."},
      {s:"P",t:"And my grandchildren. Oh they are wonderful. Little Archie is five now and Poppy is seven. They come every Sunday with Linda and we have lunch together. That is what I live for really. I could not bear to be somewhere I could not see them."},
      {s:"W",t:"That sounds lovely. Anything else that matters to you?"},
      {s:"P",t:"My garden. I used to be out there every day. I cannot do what I used to but I still love sitting out there with my roses. My David planted those roses the year we moved in. I would be heartbroken if I could not get out to them."},
    ],
    data: {important:"Remaining in own home (since 1982, strong emotional attachment). Sunday lunch with grandchildren Archie (5) and Poppy (7) via daughter Linda - key motivator. Garden access essential - roses planted by late husband David, deep sentimental value. Independence and familiar surroundings paramount."},
  },
  health: {
    lines: [
      {s:"W",t:"Can you tell me about your health Maggie? Any worries or concerns?"},
      {s:"P",t:"Well where do I start! My knees are terrible, the doctor says it is osteoarthritis. Both knees. Some days I can barely get up the stairs. I take paracetamol for it but it does not always touch it."},
      {s:"P",t:"And I get a bit short of breath sometimes, especially if I am doing too much. The doctor put me on an inhaler a couple of years ago. I think it is called Ventolin or something like that."},
      {s:"W",t:"Have you had any broken bones?"},
      {s:"P",t:"I broke my wrist about six years ago. Fell in the car park at Tesco of all places. It was icy. My daughter was furious with the store. It healed fine though."},
      {s:"W",t:"And has anyone talked to you about remote monitoring or anything like that?"},
      {s:"P",t:"No, nobody has mentioned that. What is it?"},
    ],
    data: {healthNotes:"Bilateral osteoarthritis in both knees - significant impact on mobility and stairs. Takes paracetamol PRN, not always effective. Mild breathlessness on exertion - uses Ventolin inhaler (prescribed approx 2 years ago). Generally positive outlook despite pain.",bones:"Left wrist fracture approx 6 years ago (fall in icy car park). Healed well, no ongoing issues.",remoteMon:"Not currently discussed. Patient unaware of service - to be explored.",painCourse:"Not referred. May benefit given chronic bilateral knee OA pain."},
  },
  sleep: {
    lines: [
      {s:"W",t:"How are you sleeping Maggie?"},
      {s:"P",t:"Oh not great to be honest. I go to bed about half ten, watch a bit of telly in bed. But I lie there for ages sometimes. My mind just goes round and round. Worrying about things, you know."},
      {s:"P",t:"And then I am up two or three times in the night for the toilet. By the time I get back to bed I am wide awake. I probably get about five hours if I am lucky. I used to sleep like a log but not anymore."},
      {s:"W",t:"Do you nap during the day?"},
      {s:"P",t:"I do nod off in my chair after lunch sometimes. About half an hour usually. I try not to but I just cannot help it."},
    ],
    data: {sleepRoutine:"Bed approx 22:30. Watches TV in bed before sleep. Naps in chair after lunch for approx 30 minutes.",sleepDiff:"Takes a long time to fall asleep - reports racing thoughts and worry. Wakes 2-3 times per night for toilet. Difficulty returning to sleep after waking. Estimated 5 hours total sleep.",sleepQual:"Poor - significant disruption from nocturia and anxiety. Daytime somnolence."},
  },
  nutrition: {
    lines: [
      {s:"W",t:"How is your appetite Maggie? Are you eating well?"},
      {s:"P",t:"Well I do try. I have my porridge in the morning, I have always had that. But I am not always that hungry at lunchtime. Sometimes I just have a biscuit and a cup of tea. My daughter tells me off about it."},
      {s:"P",t:"I do have a proper dinner though. Linda brings me those meal things from Cook, you know the frozen ones. They are actually quite nice. I have those most evenings with some vegetables."},
      {s:"W",t:"And are you drinking enough?"},
      {s:"P",t:"I have my tea. Probably four or five cups a day. Water, not so much. I know I should but I do not like it much."},
    ],
    data: {nutQual:"Moderate - adequate breakfast and evening meal, but poor lunch intake (often just biscuit and tea). Relies on frozen prepared meals (Cook) for evening meal, brought by daughter.",malnourished:"At risk - skipping lunch regularly. Low fluid intake (mainly tea, 4-5 cups/day, minimal water).",nutSupps:"None currently. Consider nutritional assessment if weight loss identified."},
  },
  meds: {
    lines: [
      {s:"W",t:"Can we talk about your medications Maggie? Do you have any worries about them?"},
      {s:"P",t:"I take so many pills I rattle! Let me think. There is the blood pressure one, amlodipine I think. And the cholesterol one, starts with an S. And paracetamol for my knees. And the inhaler. Oh and the doctor gave me something for my waterworks a few months ago, oxybutynin or something."},
      {s:"P",t:"The oxybutynin makes my mouth ever so dry though. I mentioned it to the doctor but she said to give it a bit longer."},
      {s:"W",t:"Do you have a blister pack?"},
      {s:"P",t:"No, I just have the normal boxes. Linda helped me get one of those daily pill box things with the days on. That helps me remember."},
      {s:"W",t:"And does the pharmacy deliver?"},
      {s:"P",t:"Yes, Jardines in Brackley deliver every month. They are very good actually."},
    ],
    data: {medWorries:"Patient on multiple medications - amlodipine (hypertension), statin (cholesterol), paracetamol PRN (OA pain), Ventolin inhaler (breathlessness), oxybutynin (urinary frequency). Reports dry mouth as side effect of oxybutynin - has been discussed with GP, advised to continue. Uses daily pill organiser box.",medSide:"Dry mouth from oxybutynin - ongoing, reported to GP.",blister:"No blister pack. Uses 7-day pill organiser box (arranged by daughter).",copd:"No COPD rescue pack."},
  },
  home: {
    lines: [
      {s:"W",t:"Tell me about your home Maggie. Who else lives here?"},
      {s:"P",t:"Just me now. Since David passed in 2019. It is a three bedroom semi, we bought it in 1982. It is all paid for thankfully."},
      {s:"W",t:"And how are the stairs for you?"},
      {s:"P",t:"Well that is the thing. I have got a bannister on one side but going up is really hard with my knees. I go up on my bottom sometimes if they are really bad. Coming down I hold on tight. I am always worried I will fall."},
      {s:"P",t:"My daughter keeps saying I should have a stairlift but I do not know. It seems like such a big thing. And the bathroom is upstairs so I have to manage it."},
      {s:"W",t:"Any trip hazards I can see? Loose rugs or cables?"},
      {s:"P",t:"Well there is that rug in the hallway, Linda is always telling me to get rid of it. And the step down into the garden is quite steep. That is where I tripped last time."},
    ],
    data: {livesWith:"Lives alone since bereavement (husband David, 2019)",dwelling:"3-bed semi-detached house",ownership:"Owner occupied, mortgage paid off",hazards:"Loose rug in hallway (trip risk). Steep step down to garden (site of previous fall).",stairs:"Significant difficulty - sometimes goes upstairs on bottom. Has bannister one side only. Bathroom upstairs only. Daughter has suggested stairlift, patient ambivalent. HIGH PRIORITY.",access:"Garden step is steep and has caused a fall. Needs assessment for grab rail or ramp."},
  },
  mobility: {
    lines: [
      {s:"W",t:"How is your mobility generally Maggie? Getting around the house?"},
      {s:"P",t:"I manage but I am slow. I use the furniture to steady myself, you know, go from the chair to the sideboard to the door frame. I do not have a walking stick or anything. My friend Doris has a frame but I am not that bad yet, I hope."},
      {s:"W",t:"How about getting in and out of bed?"},
      {s:"P",t:"That is a struggle actually. The bed is quite low and with my knees it takes me a while. I sort of roll sideways and push myself up. Sometimes it takes three or four goes in the morning."},
      {s:"W",t:"And transfers, like getting on and off the toilet?"},
      {s:"P",t:"I have to hold onto the sink to get up off the toilet. It is not ideal. And the bath, well I have not had a proper bath in months. I just stand at the sink. I am too frightened of slipping."},
    ],
    data: {mobFalls:"2 falls in 12 months. Uses furniture for support around house ('furniture surfing'). No walking aid currently.",aidsPlace:"Bannister one side of stairs only. No other aids in place.",aidsReq:"Walking stick assessment recommended. Bed raiser assessment needed (bed too low). Toilet frame/raised seat. Bath board or shower assessment - patient not bathing due to fear of falling. PRIORITY.",transfers:"Difficulty rising from bed (bed too low, multiple attempts). Holds sink to rise from toilet. Unable to use bath safely."},
  },
  social: {
    lines: [
      {s:"W",t:"What do you like to do Maggie? How do you spend your time?"},
      {s:"P",t:"Well I used to do so much. I was in the WI for thirty years, did the flower arranging at church, played bridge on a Thursday. But since Covid and then David passing, I just sort of stopped everything."},
      {s:"P",t:"Now I mainly watch the telly and do my crossword. My neighbour Pat comes for tea on a Wednesday which is nice. But I do get lonely. The days are very long when you are on your own."},
      {s:"W",t:"Is there anything you would like to get back to?"},
      {s:"P",t:"I would love to go back to the church. I miss it terribly. And there is a coffee morning at the village hall on Fridays that Pat goes to. I would like to try that but I cannot get there. It is too far to walk and I gave up driving two years ago."},
    ],
    data: {socDo:"Currently: watches TV, crosswords, weekly tea with neighbour Pat (Wednesdays). Previously very active: WI member (30 years), church flower arranging, Thursday bridge club. Became socially isolated during Covid, then bereavement. Reports significant loneliness.",socWant:"Would like to return to church (strong desire). Interested in Friday coffee morning at village hall but cannot get there independently. Consider social prescribing referral and transport support."},
  },
  transport: {
    lines: [
      {s:"W",t:"How do you get around Maggie? Do you drive?"},
      {s:"P",t:"No I gave that up about two years ago. My eyesight was not good enough and I did not feel safe. I miss it dreadfully though. I felt so independent with my little car."},
      {s:"P",t:"Linda takes me to my appointments mostly. But I feel guilty asking her, she is so busy with the children and her job. If she cannot do it I just cancel the appointment. I know I should not but what else can I do?"},
      {s:"W",t:"Have you heard of the community transport service?"},
      {s:"P",t:"Someone mentioned it but I do not know anything about it really. Is it expensive?"},
    ],
    data: {ownVeh:"No - gave up driving 2 years ago due to poor eyesight. Significant loss of independence.",pubTrans:"Does not use. No accessible bus route nearby.",transDiff:"Relies entirely on daughter Linda for transport to appointments. Cancels appointments when daughter unavailable - CLINICAL RISK. Not aware of community transport options. Refer to community transport service and provide information. Transport barrier to social activities (church, coffee morning)."},
  },
  benefits: {
    lines: [
      {s:"W",t:"Can I ask about your finances Maggie? Are you managing alright?"},
      {s:"P",t:"Well, we were always comfortable. David had his pension and I have my state pension. But the heating bills have been frightening lately. I do worry about it. I keep the heating off in the bedrooms now."},
      {s:"W",t:"Are you receiving Attendance Allowance?"},
      {s:"P",t:"No, what is that? Nobody has mentioned it to me."},
      {s:"W",t:"It is a benefit for people over 65 who need help with personal care or supervision. You might well qualify. And do you have Power of Attorney set up?"},
      {s:"P",t:"Linda has been saying we should do that but we have not got round to it. It is one of those things you keep putting off is it not."},
    ],
    data: {finIssues:"Managing on state pension and late husband's pension. Concerned about rising heating costs - keeping heating off in bedrooms to save money (risk of cold-related illness). Would benefit from benefits check.",aa:"Not receiving Attendance Allowance. Not previously aware of it. Likely to qualify given care needs - REFER for benefits check and AA application support.",poa:"No POA in place. Daughter Linda aware of need but not yet arranged. Advise to arrange LPA for Health and Finance as priority."},
  },
  safety: {
    lines: [
      {s:"W",t:"A few safety questions Maggie. Do you have a lifeline or pendant alarm?"},
      {s:"P",t:"No, Linda keeps going on about it but I have not done anything about it. I suppose I should really, especially after my falls."},
      {s:"W",t:"Do you have a keysafe on the property?"},
      {s:"P",t:"No. I leave a spare key under the pot by the back door. I know that is probably not very sensible!"},
      {s:"W",t:"And your smoke alarms, are they working?"},
      {s:"P",t:"I think so. One went off when I burned the toast last week so that one works at least! I am not sure about the one upstairs."},
      {s:"W",t:"Do you have a Blue Badge?"},
      {s:"P",t:"No, I did not think I could get one now I do not drive."},
    ],
    data: {lifeline:"Not in place. Daughter has suggested. RECOMMEND given falls history and living alone. Provide information and support application.",keysafe:"Not in place. Currently leaves key under flowerpot (security risk). RECOMMEND keysafe installation.",smoke:"Downstairs alarm confirmed working. Upstairs alarm status unknown - needs checking. Refer for fire safety check.",blueBadge:"Not in place. Patient unaware can be used as passenger. Discuss and support application if appropriate."},
  },
  pcare: {
    lines: [
      {s:"W",t:"How do you manage with washing and dressing Maggie?"},
      {s:"P",t:"Well I manage my top half fine. But bending down for my socks and shoes is really difficult. Sometimes I just wear slip-on shoes because I cannot manage the laces. And tights, forget it, I have not worn tights in years."},
      {s:"P",t:"As for bathing, well like I said, I have not had a proper bath in months. I do a strip wash at the sink. I would love a proper shower but I have not got one. Just the bath and I am too frightened of slipping."},
      {s:"W",t:"Is anyone helping you with personal care at the moment?"},
      {s:"P",t:"No. I manage. I do not want strangers coming in and seeing me like that. Linda helps me wash my hair over the kitchen sink on Saturdays. That is about it."},
    ],
    data: {pCare:"Manages upper body washing independently. Struggles with lower body - difficulty bending (OA knees). Cannot manage socks, laces, or tights. Uses slip-on shoes only. Not bathing - strip wash at sink due to fear of falling in bath. No shower installed. Hair washed weekly over kitchen sink by daughter. Dignity and independence very important to patient.",pCareSupp:"No formal care in place. Resistant to external carers (privacy/dignity concerns). Daughter Linda assists with hair washing weekly (Saturdays). Assess for OT referral - shower installation, long-handled aids for dressing (sock aid, shoe horn, perching stool)."},
  },
  support: {
    lines: [
      {s:"W",t:"Who supports you at the moment Maggie? Friends, family, any services?"},
      {s:"P",t:"Well there is Linda of course. She is my rock. Comes Tuesdays and Saturdays. Does the shopping, helps with bits around the house. My son Robert lives in Edinburgh so I do not see him much. He phones on Sundays though."},
      {s:"P",t:"My neighbour Pat is lovely. She checks on me most days, just pops her head round the door. And her husband Jim cuts the grass for me in the summer. I do not know what I would do without them honestly."},
      {s:"P",t:"I do not have any carers or anything like that coming in. Just my family and Pat."},
    ],
    data: {existSupp:"Daughter Linda Hartley - primary informal carer. Visits Tuesdays and Saturdays, does shopping, household support, hair washing. Son Robert in Edinburgh - weekly phone contact (Sundays). Neighbour Pat - daily welfare check, weekly tea (Wednesdays). Pat's husband Jim - garden maintenance (summer). No formal care services in place. Consider carer's assessment for Linda given regular caring role."},
  },
};

const PHQ9_QS = ["Little interest or pleasure in doing things","Feeling down, depressed, or hopeless","Trouble falling or staying asleep","Feeling tired or having little energy","Poor appetite or overeating","Feeling bad about yourself","Trouble concentrating","Moving or speaking slowly or being restless","Thoughts of being better off dead or hurting yourself"];
const GAD7_QS = ["Feeling nervous, anxious or on edge","Not being able to stop worrying","Worrying too much about different things","Trouble relaxing","Being so restless it is hard to sit still","Becoming easily annoyed or irritable","Feeling afraid something awful might happen"];

/* ─── QUESTIONNAIRE COMPONENTS ─────────────────────────────────── */
function QComp({id, qs, scores, setScores}) {
  const opts = ["Not at all","Several days","More than half","Nearly every day"];
  const sc = scores[id] || {};
  let total = 0; for (const k in sc) total += sc[k];
  const sev = id === "phq9"
    ? (total >= 19 ? ["Severe",C.red] : total >= 10 ? ["Moderate",C.amber] : total >= 5 ? ["Mild","#C4A000"] : ["Minimal",C.green])
    : (total >= 15 ? ["Severe",C.red] : total >= 11 ? ["Mod-Severe",C.amber] : total >= 6 ? ["Moderate","#C4A000"] : ["Mild",C.green]);
  return (
    <div>
      <div style={{background:sev[1]+"12",border:`2px solid ${sev[1]}30`,borderRadius:12,padding:14,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:C.mid}}>SCORE</div><div style={{fontSize:30,fontWeight:800,color:sev[1]}}>{total}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:700,color:sev[1]}}>{sev[0]}</div>{total>=10&&id==="phq9"&&<div style={{fontSize:11,color:C.red,marginTop:2,fontWeight:700}}>⚠ Notify GP</div>}</div>
      </div>
      <div style={{fontSize:12,color:C.mid,marginBottom:12}}>Over the last 2 weeks, how often bothered by:</div>
      {qs.map((q, qi) => (
        <div key={qi} style={{background:"#fff",border:`1px solid ${C.bdr}`,borderRadius:10,padding:10,marginBottom:6}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>{qi+1}. {q}</div>
          <div style={{display:"flex",gap:4}}>
            {[0,1,2,3].map(v => {
              const sel = sc[qi] === v;
              return <button key={v} onClick={() => setScores(p => ({...p, [id]: {...(p[id]||{}), [qi]: v}}))} style={{flex:1,padding:"5px 2px",borderRadius:6,border:`2px solid ${sel?C.blue:C.bdr}`,background:sel?"rgba(0,94,184,0.08)":"#fff",cursor:"pointer",fontSize:10,fontWeight:sel?700:400,color:sel?C.blue:C.dim,textAlign:"center"}}><div style={{fontSize:14,fontWeight:700}}>{v}</div>{opts[v]}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CITComp({scores, set}) {
  const qs = [
    {q:"What year is it?",opts:[["Correct",0],["Incorrect",4]]},
    {q:"What month is it?",opts:[["Correct",0],["Incorrect",3]]},
    {q:"About what time is it?",opts:[["Correct",0],["Incorrect",3]]},
    {q:"Count backwards 20 to 1",opts:[["Correct",0],["1 error",2],["2+ errors",4]]},
    {q:"Months in reverse",opts:[["Correct",0],["1 error",2],["2+ errors",4]]},
    {q:"Repeat address phrase",opts:[["All correct",0],["1 error",2],["2 errors",4],["3 errors",6],["4 errors",8],["All wrong",10]]},
  ];
  let total = 0; for (const k in scores) total += scores[k];
  const sev = total <= 7 ? ["Normal",C.green] : total <= 9 ? ["Mild Impairment",C.amber] : ["Significant - Refer",C.red];
  return (
    <div>
      <div style={{background:sev[1]+"12",border:`2px solid ${sev[1]}30`,borderRadius:12,padding:14,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:10,fontWeight:700,color:C.mid}}>6-CIT SCORE</div><div style={{fontSize:30,fontWeight:800,color:sev[1]}}>{total}/28</div></div>
        <div style={{fontSize:13,fontWeight:700,color:sev[1],maxWidth:160,textAlign:"right"}}>{sev[0]}</div>
      </div>
      <div style={{background:"#E3F2FD",borderRadius:8,padding:10,marginBottom:14,fontSize:12}}>💡 Give address phrase to remember: e.g. John, Smith, 42, High St, Bedford</div>
      {qs.map((q, i) => (
        <div key={i} style={{background:"#fff",border:`1px solid ${C.bdr}`,borderRadius:10,padding:10,marginBottom:6}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:6}}>{i+1}. {q.q}</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {q.opts.map(o => {
              const sel = scores[i] === o[1];
              return <button key={o[0]} onClick={() => set(p => ({...p, [i]: o[1]}))} style={{padding:"5px 10px",borderRadius:6,border:`2px solid ${sel?C.blue:C.bdr}`,background:sel?"rgba(0,94,184,0.08)":"#fff",cursor:"pointer",fontSize:11,fontWeight:sel?700:400,color:sel?C.blue:C.dim}}>{o[0]} ({o[1]})</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FRATComp({scores, set}) {
  const qs = ["History of fall in previous year?","On 4+ medications per day?","Diagnosis of stroke or Parkinsons?","Problems with balance?","Unable to rise from chair without arms?"];
  let total = 0; for (const k in scores) total += scores[k];
  const sev = total >= 3 ? ["Higher Falls Risk",C.red] : ["Lower Risk",C.green];
  return (
    <div>
      <div style={{background:sev[1]+"12",border:`2px solid ${sev[1]}30`,borderRadius:12,padding:14,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:10,fontWeight:700,color:C.mid}}>FRAT SCORE</div><div style={{fontSize:30,fontWeight:800,color:sev[1]}}>{total}/5</div></div>
        <div style={{fontSize:13,fontWeight:700,color:sev[1]}}>{sev[0]}</div>
      </div>
      {qs.map((q, i) => (
        <div key={i} style={{background:"#fff",border:`1px solid ${C.bdr}`,borderRadius:10,padding:10,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:13,flex:1,marginRight:10}}>{i+1}. {q}</div>
          <div style={{display:"flex",gap:4}}>
            {[["Yes",1],["No",0]].map(o => {
              const sel = scores[i] === o[1];
              const col = o[1] === 1 ? C.red : C.green;
              return <button key={o[0]} onClick={() => set(p => ({...p, [i]: o[1]}))} style={{padding:"5px 14px",borderRadius:6,border:`2px solid ${sel?col:C.bdr}`,background:sel?col+"0d":"#fff",cursor:"pointer",fontSize:12,fontWeight:sel?700:400,color:sel?col:C.dim}}>{o[0]}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ONSComp({scores, set}) {
  const qs = [{q:"How satisfied are you with your life?",k:"sat"},{q:"Do you feel things you do are worthwhile?",k:"worth"},{q:"How happy did you feel yesterday?",k:"happy"},{q:"How anxious did you feel yesterday?",k:"anx"}];
  return (
    <div>
      <div style={{background:"#E8F5E9",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.mid}}>ONS4 PERSONAL WELLBEING</div>
        <div style={{fontSize:12,color:C.mid,marginTop:2}}>0 = Not at all to 10 = Completely</div>
      </div>
      {qs.map(q => (
        <div key={q.k} style={{background:"#fff",border:`1px solid ${C.bdr}`,borderRadius:10,padding:10,marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>{q.q}</div>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
            {[0,1,2,3,4,5,6,7,8,9,10].map(v => {
              const sel = scores[q.k] === v;
              return <button key={v} onClick={() => set(p => ({...p, [q.k]: v}))} style={{width:28,height:28,borderRadius:6,border:`2px solid ${sel?C.blue:C.bdr}`,background:sel?C.blue:"#fff",color:sel?"#fff":C.dim,cursor:"pointer",fontSize:12,fontWeight:sel?700:400,padding:0}}>{v}</button>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function APComp({items, set}) {
  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#E3F2FD,#E8F5E9)",borderRadius:12,padding:14,marginBottom:14,fontSize:13,fontStyle:"italic",lineHeight:1.5}}>
        After talking with my GP and other professionals today, I understand and agree to the following...
      </div>
      {items.map((item, i) => (
        <div key={i} style={{background:"#fff",border:`1px solid ${item.d?C.green:C.bdr}`,borderRadius:10,padding:10,marginBottom:6,display:"flex",gap:8,alignItems:"flex-start",opacity:item.d?0.7:1}}>
          <button onClick={() => set(p => p.map((x,j) => j===i ? {...x, d:!x.d} : x))} style={{width:22,height:22,borderRadius:6,border:`2px solid ${item.d?C.green:C.bdr}`,background:item.d?C.green:"#fff",cursor:"pointer",color:"#fff",fontSize:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{item.d?"✓":""}</button>
          <div style={{flex:1}}>
            <input placeholder={`Action ${i+1}`} value={item.s} onChange={e => set(p => p.map((x,j) => j===i ? {...x, s:e.target.value} : x))} style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.bdr}`,borderRadius:6,fontSize:13,boxSizing:"border-box",fontFamily:"inherit",marginBottom:4,textDecoration:item.d?"line-through":"none"}} />
            <input placeholder="Person supporting" value={item.p} onChange={e => set(p => p.map((x,j) => j===i ? {...x, p:e.target.value} : x))} style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.bdr}`,borderRadius:6,fontSize:12,boxSizing:"border-box",fontFamily:"inherit",color:C.dim}} />
          </div>
          <button onClick={() => set(p => p.filter((_,j) => j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:C.dim,fontSize:14}}>✕</button>
        </div>
      ))}
      <button onClick={() => set(p => [...p, {s:"",p:"",d:false}])} style={{width:"100%",padding:10,borderRadius:10,border:`2px dashed ${C.bdr}`,background:"transparent",cursor:"pointer",fontSize:13,color:C.blue,fontWeight:600}}>+ Add Action</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
export default function PatientSupportPlan() {
  const navigate = useNavigate();
  const [sec, setSec] = useState(0);
  const [states, setStates] = useState({});
  const [data, setData] = useState({});
  const [qScores, setQScores] = useState({});
  const [citS, setCitS] = useState({});
  const [fratS, setFratS] = useState({});
  const [onsS, setOnsS] = useState({});
  const [actions, setActions] = useState([{s:"",p:"",d:false}]);
  const [rec, setRec] = useState(false);
  const [lines, setLines] = useState([]);
  const [filling, setFilling] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState("form");
  const tRef = useRef(null);

  const cur = SECS[sec];
  const doneN = Object.values(states).filter(v => v==="done"||v==="na").length;
  const pct = Math.round((doneN / SECS.length) * 100);

  useEffect(() => {
    if (tRef.current) tRef.current.scrollIntoView({behavior:"smooth"});
  }, [lines]);

  const hasDemo = !!DEMOS[cur.id];

  const runDemo = useCallback(() => {
    const d = DEMOS[cur.id];
    if (!d || busy) return;
    setBusy(true);
    setLines([]);
    function addLine(i) {
      if (i >= d.lines.length) { setTimeout(() => fillField(0), 400); return; }
      setLines(p => [...p, d.lines[i]]);
      setTimeout(() => addLine(i + 1), 700);
    }
    const keys = Object.keys(d.data);
    function fillField(i) {
      if (i >= keys.length) { setFilling(new Set()); setBusy(false); return; }
      const k = keys[i];
      setFilling(new Set([k]));
      setTimeout(() => {
        setData(p => ({...p, [k]: d.data[k]}));
        setFilling(new Set());
        setTimeout(() => fillField(i + 1), 200);
      }, 400);
    }
    addLine(0);
  }, [cur.id, busy]);

  const getTotal = (id) => { const s = qScores[id] || {}; let t = 0; for (const k in s) t += s[k]; return t; };
  const markDone = () => { setStates(p => ({...p, [cur.id]: "done"})); if (sec < SECS.length - 1) setSec(sec + 1); };
  const toggleNA = () => { setStates(p => ({...p, [cur.id]: p[cur.id] === "na" ? undefined : "na"})); };

  /* ─── SUMMARY VIEW ──────────────────────────────────────────────── */
  if (page === "summary") {
    return (
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",padding:20}}>
        <div style={{maxWidth:750,margin:"0 auto"}}>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            <button onClick={() => setPage("form")} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"10px 20px",cursor:"pointer",fontWeight:600,fontSize:13}}>← Back to Assessment</button>
          </div>
          <h2 style={{color:C.dark,marginBottom:4,fontFamily:"Georgia,'Times New Roman',serif"}}>Patient Support Plan Summary</h2>
          <p style={{color:C.mid,marginTop:0,fontSize:13}}>{new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</p>

          {data.name && (
            <div style={{background:`linear-gradient(135deg,${C.dark},${C.blue})`,borderRadius:12,padding:18,color:"#fff",marginBottom:16}}>
              <div style={{fontSize:20,fontWeight:700}}>{data.name}</div>
              <div style={{marginTop:6,fontSize:14,opacity:0.85}}>
                {data.preferredName && `Preferred: ${data.preferredName}  |  `}
                {data.dob && `DOB: ${data.dob}  |  `}
                {data.age && `Age: ${data.age}`}
                {data.surgery && `  |  ${data.surgery}`}
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
            {[
              ["PHQ-9", getTotal("phq9"), 27],
              ["GAD-7", getTotal("gad7"), 21],
              ["6-CIT", Object.values(citS).reduce((a,b) => a+b, 0), 28],
              ["FRAT", Object.values(fratS).reduce((a,b) => a+b, 0), 5],
            ].map(x => (
              <div key={x[0]} style={{background:"#fff",borderRadius:10,padding:12,textAlign:"center",border:`1px solid ${C.bdr}`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.dim}}>{x[0]}</div>
                <div style={{fontSize:24,fontWeight:800,color:C.blue}}>{x[1]}<span style={{fontSize:12,color:C.dim}}>/{x[2]}</span></div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
            <div style={{background:"#E8F5E9",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:C.green}}>{Object.values(states).filter(v => v==="done").length}</div><div style={{fontSize:11,color:C.mid}}>Completed</div></div>
            <div style={{background:"#FFF3E0",borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:C.amber}}>{Object.values(states).filter(v => v==="na").length}</div><div style={{fontSize:11,color:C.mid}}>N/A</div></div>
            <div style={{background:"#fff",borderRadius:10,padding:12,textAlign:"center",border:`1px solid ${C.bdr}`}}><div style={{fontSize:22,fontWeight:800,color:C.dim}}>{SECS.length - doneN}</div><div style={{fontSize:11,color:C.mid}}>Pending</div></div>
          </div>

          <div style={{background:"#fff",borderRadius:10,padding:16,border:`1px solid ${C.bdr}`}}>
            <div style={{fontWeight:700,marginBottom:10}}>Captured Data</div>
            {Object.keys(data).filter(k => data[k]).map(k => (
              <div key={k} style={{display:"flex",padding:"5px 0",borderBottom:`1px solid ${C.bdr}`,fontSize:13,gap:10}}>
                <span style={{fontWeight:600,color:C.mid,minWidth:130,flexShrink:0}}>{k}</span>
                <span style={{color:C.text,lineHeight:1.4}}>{data[k]}</span>
              </div>
            ))}
            {Object.keys(data).filter(k => data[k]).length === 0 && (
              <div style={{color:C.dim,fontSize:13,padding:20,textAlign:"center"}}>No data captured yet. Use the demo auto-fill or enter data manually.</div>
            )}
          </div>

          {actions.some(a => a.s) && (
            <div style={{background:"#fff",borderRadius:10,padding:16,border:`1px solid ${C.bdr}`,marginTop:12}}>
              <div style={{fontWeight:700,marginBottom:10}}>Action Plan</div>
              {actions.filter(a => a.s).map((a, i) => (
                <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.bdr}`,fontSize:13}}>
                  <span style={{color:a.d?C.green:C.dim}}>{a.d?"✅":"⬜"}</span>
                  <span style={{flex:1,textDecoration:a.d?"line-through":"none"}}>{a.s}</span>
                  {a.p && <span style={{color:C.mid,fontSize:12}}>({a.p})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── MAIN FORM VIEW ────────────────────────────────────────────── */
  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Segoe UI',system-ui,sans-serif",background:C.bg}}>
      {/* ── Yellow Notewell bar ──────────────────────────────────────── */}
      <div style={{background:"#F5C518",padding:"6px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={() => navigate("/agewell")} style={{background:"none",border:"none",cursor:"pointer",color:C.dark,fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:4}}>
          ← Notewell
        </button>
        <div style={{fontSize:11,fontWeight:700,color:C.dark,letterSpacing:1}}>AGEING WELL LIVE SERVICES</div>
      </div>

      {/* ── Blue header ─────────────────────────────────────────────── */}
      <div style={{background:`linear-gradient(135deg,${C.dark},${C.blue})`,flexShrink:0,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🩺</span>
          <div style={{color:"#fff"}}>
            <div style={{fontWeight:700,fontSize:14}}>Patient Support Plan</div>
            <div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",opacity:0.6}}>Guided Assessment</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={() => setRec(!rec)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:rec?C.red:"rgba(255,255,255,0.15)",color:"#fff"}}>
            {rec ? "● REC" : "Start Recording"}
          </button>
          <button onClick={() => setPage("summary")} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>
            View Summary
          </button>
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      <div style={{height:3,background:"rgba(0,48,135,0.15)",flexShrink:0}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.light},${C.aqua})`,transition:"width 0.5s"}} />
      </div>

      {/* ── Three-column layout ─────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Left sidebar */}
        <div style={{width:210,flexShrink:0,background:"#fff",borderRight:`1px solid ${C.bdr}`,overflowY:"auto",fontSize:12}}>
          <div style={{padding:"10px 12px 6px",fontSize:10,fontWeight:700,letterSpacing:1,color:C.dim,display:"flex",justifyContent:"space-between"}}>
            <span>SECTIONS</span><span style={{color:C.blue}}>{doneN}/{SECS.length}</span>
          </div>
          {SECS.map((item, i) => {
            const st = states[item.id];
            const act = i === sec;
            return (
              <div key={item.id} onClick={() => setSec(i)} style={{
                display:"flex",alignItems:"center",gap:6,padding:"7px 12px",cursor:"pointer",
                background: act ? "#E3F2FD" : st === "done" ? "#E8F5E9" : st === "na" ? "#FFF3E0" : "transparent",
                borderLeft: act ? `3px solid ${C.blue}` : "3px solid transparent",
              }}>
                <span style={{fontSize:13}}>{st === "done" ? "✅" : st === "na" ? "⊘" : item.ic}</span>
                <span style={{fontWeight:act?600:400,color:st==="na"?C.dim:C.text,textDecoration:st==="na"?"line-through":"none",lineHeight:1.3}}>{item.t}</span>
              </div>
            );
          })}
        </div>

        {/* Centre + Right */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Section header */}
          <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.bdr}`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:22}}>{cur.ic}</span>
              <div>
                <div style={{fontSize:16,fontWeight:700}}>{cur.t}</div>
                <div style={{fontSize:10,color:C.dim}}>Section {sec+1} of {SECS.length}{hasDemo ? " · Demo available" : ""}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={toggleNA} style={{background:states[cur.id]==="na"?C.amber:"transparent",color:states[cur.id]==="na"?"#fff":C.mid,border:`1px solid ${states[cur.id]==="na"?C.amber:C.bdr}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12}}>N/A</button>
              <button onClick={markDone} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>Complete & Next</button>
            </div>
          </div>

          {/* Content + Transcript */}
          <div style={{flex:1,display:"flex",overflow:"hidden"}}>
            {/* Main form */}
            <div style={{flex:1,overflowY:"auto",padding:20}}>
              {/* Demo auto-fill banner */}
              {hasDemo && states[cur.id] !== "na" && (
                <div onClick={busy ? undefined : runDemo} style={{
                  background: busy ? "#f0f0f0" : `linear-gradient(135deg,${C.green},#00b347)`,
                  borderRadius:12,padding:18,marginBottom:18,cursor:busy?"wait":"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:12,
                  boxShadow: busy ? "none" : "0 4px 16px rgba(0,150,57,0.25)",
                }}>
                  <span style={{fontSize:28}}>{busy ? "⏳" : "✨"}</span>
                  <div style={{color:busy?"#666":"#fff"}}>
                    <div style={{fontSize:16,fontWeight:700}}>{busy ? "Listening and auto-filling..." : "Demo Auto-Fill"}</div>
                    <div style={{fontSize:12,opacity:0.85,marginTop:2}}>{busy ? "Watch the transcript and fields update live" : "Click to simulate live transcription filling this section"}</div>
                  </div>
                </div>
              )}

              {/* Form content */}
              {states[cur.id] === "na" ? (
                <div style={{textAlign:"center",padding:40,color:C.dim}}>
                  <div style={{fontSize:36}}>⊘</div>
                  <div style={{marginTop:8}}>Not Applicable</div>
                  <button onClick={toggleNA} style={{marginTop:10,background:"transparent",border:`1px solid ${C.bdr}`,borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12,color:C.mid}}>Restore</button>
                </div>
              ) : cur.q === "phq9" ? (
                <QComp id="phq9" qs={PHQ9_QS} scores={qScores} setScores={setQScores} />
              ) : cur.q === "gad7" ? (
                <QComp id="gad7" qs={GAD7_QS} scores={qScores} setScores={setQScores} />
              ) : cur.q === "cit" ? (
                <CITComp scores={citS} set={setCitS} />
              ) : cur.q === "frat" ? (
                <FRATComp scores={fratS} set={setFratS} />
              ) : cur.q === "ons" ? (
                <ONSComp scores={onsS} set={setOnsS} />
              ) : cur.ap ? (
                <APComp items={actions} set={setActions} />
              ) : (
                <div style={{display:"grid",gridTemplateColumns:(cur.fields||[]).length > 3 ? "1fr 1fr" : "1fr",gap:12}}>
                  {(cur.fields||[]).map(f => {
                    const glow = filling.has(f.k);
                    const bdr = glow ? C.green : C.bdr;
                    const bg = glow ? "rgba(0,150,57,0.05)" : "#fff";
                    return (
                      <div key={f.k} style={{gridColumn: f.ta ? "1 / -1" : undefined}}>
                        <label style={{display:"block",fontSize:11,fontWeight:600,color:C.mid,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{f.l}</label>
                        {f.ta ? (
                          <textarea value={data[f.k]||""} onChange={e => setData(p => ({...p, [f.k]: e.target.value}))} rows={3} style={{width:"100%",padding:"8px 10px",border:`2px solid ${bdr}`,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",background:bg,boxSizing:"border-box",transition:"all 0.3s"}} />
                        ) : (
                          <input value={data[f.k]||""} onChange={e => setData(p => ({...p, [f.k]: e.target.value}))} style={{width:"100%",padding:"8px 10px",border:`2px solid ${bdr}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",background:bg,boxSizing:"border-box",transition:"all 0.3s"}} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right transcript panel */}
            <div style={{width:230,borderLeft:`1px solid ${C.bdr}`,background:"#FAFBFD",display:"flex",flexDirection:"column",flexShrink:0}}>
              <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.bdr}`,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                {rec && <span style={{width:7,height:7,borderRadius:"50%",background:C.red,display:"inline-block"}} />}
                Live Transcript
              </div>
              <div style={{flex:1,overflowY:"auto",padding:10}}>
                {lines.length === 0 ? (
                  <div style={{textAlign:"center",padding:24,color:C.dim,fontSize:12}}>
                    <div style={{fontSize:24,marginBottom:6}}>🎙️</div>
                    {hasDemo ? "Click the green Demo Auto-Fill button to see live transcription" : "No demo data for this section — use recording in production"}
                  </div>
                ) : lines.map((l, i) => (
                  <div key={i} style={{marginBottom:8}}>
                    <div style={{fontSize:10,fontWeight:700,color:l.s==="W"?C.blue:"#AE2573",marginBottom:2}}>{l.s==="W"?"WORKER":"PATIENT"}</div>
                    <div style={{fontSize:12,lineHeight:1.4,padding:"4px 8px",background:l.s==="W"?"rgba(0,94,184,0.05)":"rgba(174,37,115,0.05)",borderRadius:6}}>{l.t}</div>
                  </div>
                ))}
                <div ref={tRef} />
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div style={{padding:"8px 20px",borderTop:`1px solid ${C.bdr}`,background:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <button disabled={sec===0} onClick={() => setSec(Math.max(0,sec-1))} style={{background:"transparent",border:`1px solid ${C.bdr}`,borderRadius:8,padding:"6px 14px",cursor:sec===0?"not-allowed":"pointer",color:sec===0?C.dim:C.mid,fontSize:12}}>Previous</button>
            <span style={{fontSize:11,color:C.dim}}>{pct}% complete</span>
            <button disabled={sec===SECS.length-1} onClick={() => setSec(Math.min(SECS.length-1,sec+1))} style={{background:sec===SECS.length-1?C.dim:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:sec===SECS.length-1?"not-allowed":"pointer",fontSize:12}}>Next</button>
          </div>
        </div>
      </div>

      <style>{`input:focus,textarea:focus{border-color:${C.blue}!important;box-shadow:0 0 0 3px rgba(0,94,184,.1)!important}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}`}</style>
    </div>
  );
}
