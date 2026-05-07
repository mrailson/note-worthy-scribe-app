// Master practice list for the AgeWell patient feedback form
// Grouped by area; canonical names used for matching.

export interface AgewellPractice {
  id: string;       // canonical slug
  name: string;     // display name (also stored as practice_canonical)
  area: string;
}

export const AGEWELL_AREAS: string[] = [
  "Wellingborough (current AgeWell catchment)",
  "Northampton",
  "Daventry & Rural West",
  "Brackley & Towcester (NRES)",
  "East Northants, Kettering & Corby",
];

export const AGEWELL_PRACTICES: AgewellPractice[] = [
  // Wellingborough
  { id: "redwell", name: "Redwell Medical Centre", area: AGEWELL_AREAS[0] },
  { id: "albany-house", name: "Albany House Medical Centre", area: AGEWELL_AREAS[0] },
  { id: "summerlee", name: "Summerlee Medical Centre", area: AGEWELL_AREAS[0] },
  { id: "irchester", name: "Irchester Health Centre", area: AGEWELL_AREAS[0] },
  { id: "abbey-medical", name: "Abbey Medical Practice", area: AGEWELL_AREAS[0] },
  { id: "queensway", name: "Queensway Surgery", area: AGEWELL_AREAS[0] },
  { id: "wollaston", name: "Wollaston Surgery", area: AGEWELL_AREAS[0] },

  // Northampton
  { id: "abington-mc", name: "Abington Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "abington-park", name: "Abington Park Surgery", area: AGEWELL_AREAS[1] },
  { id: "brook-northampton", name: "Brook Medical Centre, Northampton", area: AGEWELL_AREAS[1] },
  { id: "county", name: "County Surgery", area: AGEWELL_AREAS[1] },
  { id: "crescent", name: "The Crescent Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "danes-camp", name: "Danes Camp Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "eleanor-cross", name: "Eleanor Cross Healthcare", area: AGEWELL_AREAS[1] },
  { id: "favell-plus", name: "Favell Plus Surgery", area: AGEWELL_AREAS[1] },
  { id: "greenview", name: "Greenview Surgery", area: AGEWELL_AREAS[1] },
  { id: "king-edward", name: "King Edward Road Surgery", area: AGEWELL_AREAS[1] },
  { id: "kings-heath", name: "Kings Heath Practice", area: AGEWELL_AREAS[1] },
  { id: "kingsthorpe", name: "Kingsthorpe Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "langham-place", name: "Langham Place Surgery", area: AGEWELL_AREAS[1] },
  { id: "leicester-terrace", name: "Leicester Terrace Health Care Centre", area: AGEWELL_AREAS[1] },
  { id: "maple-access", name: "Maple Access Surgery", area: AGEWELL_AREAS[1] },
  { id: "mayfield", name: "Mayfield Surgery", area: AGEWELL_AREAS[1] },
  { id: "moulton", name: "Moulton Surgery", area: AGEWELL_AREAS[1] },
  { id: "mounts", name: "The Mounts Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "park-avenue", name: "Park Avenue Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "pines", name: "The Pines Surgery", area: AGEWELL_AREAS[1] },
  { id: "queensview", name: "Queensview Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "rillwood", name: "Rillwood Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "st-lukes", name: "St Lukes Primary Care Centre", area: AGEWELL_AREAS[1] },
  { id: "woodview", name: "Woodview Medical Centre", area: AGEWELL_AREAS[1] },
  { id: "wootton", name: "Wootton Medical Centre", area: AGEWELL_AREAS[1] },

  // Daventry & Rural West
  { id: "abbey-house-daventry", name: "Abbey House Surgery, Daventry", area: AGEWELL_AREAS[2] },
  { id: "crick", name: "Crick Medical Practice", area: AGEWELL_AREAS[2] },
  { id: "monksfield", name: "Monksfield Surgery, Daventry", area: AGEWELL_AREAS[2] },
  { id: "saxon-spires", name: "The Saxon Spires Medical Practice", area: AGEWELL_AREAS[2] },
  { id: "earls-barton", name: "Earls Barton Medical Centre", area: AGEWELL_AREAS[2] },

  // Brackley & Towcester (NRES)
  { id: "brackley", name: "Brackley Medical Centre", area: AGEWELL_AREAS[3] },
  { id: "brook-health", name: "Brook Health Centre", area: AGEWELL_AREAS[3] },
  { id: "bugbrooke", name: "Bugbrooke Medical Practice", area: AGEWELL_AREAS[3] },
  { id: "denton", name: "Denton Village Surgery", area: AGEWELL_AREAS[3] },
  { id: "springfield", name: "Springfield Surgery", area: AGEWELL_AREAS[3] },
  { id: "parks", name: "The Parks Medical Practice", area: AGEWELL_AREAS[3] },
  { id: "towcester", name: "Towcester Medical Centre", area: AGEWELL_AREAS[3] },

  // East Northants, Kettering & Corby
  { id: "rushden", name: "Rushden Medical Centre", area: AGEWELL_AREAS[4] },
  { id: "meadows-thrapston", name: "The Meadows Surgery, Thrapston", area: AGEWELL_AREAS[4] },
  { id: "burton-latimer", name: "Burton Latimer Health Centre", area: AGEWELL_AREAS[4] },
  { id: "rothwell", name: "Rothwell Medical Centre", area: AGEWELL_AREAS[4] },
  { id: "studfall", name: "Studfall Medical Centre, Corby", area: AGEWELL_AREAS[4] },
  { id: "lakeside-corby", name: "Lakeside Surgery, Corby", area: AGEWELL_AREAS[4] },
];
