// src/components/CommunicationsModal.tsx
// Act 3 — Five letters from one conversation.
// Self-contained modal with grid of letter cards, sliding preview pane,
// and per-file DOCX downloads.

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Download,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Stethoscope,
  Users,
  Network,
  Clipboard,
  type LucideIcon,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const FONT_SERIF = `'Fraunces', 'Playfair Display', Georgia, 'Times New Roman', serif`;

/* ──────────────────────────────────────────────────────────────────
 * Letter registry
 * ────────────────────────────────────────────────────────────────── */
type AudienceColour = "amber" | "teal" | "purple" | "blue" | "green";

interface Letter {
  id: string;
  filename: string;
  label: string;
  title: string;
  description: string;
  audience: string;
  audienceColor: AudienceColour;
  pages: string;
  Icon: LucideIcon;
  iconBg: string;
}

const letters: Letter[] = [
  {
    id: "patient",
    filename: "1_Patient_Letter_Dot_Pearson.docx",
    label: "TO THE PATIENT",
    title: "Letter for Dot Pearson",
    description:
      "Warm, plain-English post-visit summary in accessible large type. Signposts what the AgeWell team is arranging, what Sandra is helping with, and how to get in touch between visits.",
    audience: "Patient",
    audienceColor: "amber",
    pages: "1 page · 12pt",
    Icon: Heart,
    iconBg: "#F59E0B",
  },
  {
    id: "gp",
    filename: "2_GP_Clinical_Summary_Dr_Patel.docx",
    label: "TO THE GP",
    title: "Clinical Summary for Dr Patel",
    description:
      "Structured clinical handover: objective findings (BP, Rockwood, TUG, PHQ-9, GAD-7), requested GP actions with priority, and the 2/4/6/12-week follow-up schedule.",
    audience: "Clinical",
    audienceColor: "teal",
    pages: "2 pages",
    Icon: Stethoscope,
    iconBg: "#2C7A7B",
  },
  {
    id: "family",
    filename: "3_Family_Letter_Sandra_Williams.docx",
    label: "TO THE FAMILY",
    title: "Letter for Sandra Williams",
    description:
      "Honest picture for the daughter / LPA. Three specific family-led actions (keysafe, Lifeline, hallway rug) and an opt-in referral to Northants Carers for her own support.",
    audience: "Family",
    audienceColor: "purple",
    pages: "2 pages",
    Icon: Users,
    iconBg: "#7C3AED",
  },
  {
    id: "referrals",
    filename: "4_Multi_Agency_Referral_Pack.docx",
    label: "TO OTHER AGENCIES",
    title: "Multi-agency Referral Pack",
    description:
      "Five referrals in one document: Adult Social Care OT, Age UK befriending, Northants Carers, Community Transport, Fire & Rescue Safe & Well visit.",
    audience: "Agencies",
    audienceColor: "blue",
    pages: "3 pages",
    Icon: Network,
    iconBg: "#1F4E78",
  },
  {
    id: "carer",
    filename: "5_Carer_Handover_Note.docx",
    label: "TO VISITING CARERS",
    title: "Carer Handover Note",
    description:
      "Fridge-ready brief for domiciliary or relief carers. Key people, risks, medication at a glance, and green/amber/red escalation matrix for when to call who.",
    audience: "Carers",
    audienceColor: "green",
    pages: "2 pages",
    Icon: Clipboard,
    iconBg: "#2F855A",
  },
];

const audienceChipClass = (c: AudienceColour) => {
  switch (c) {
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "teal":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "purple":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "blue":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "green":
      return "bg-green-50 text-green-700 border-green-200";
  }
};

/* ──────────────────────────────────────────────────────────────────
 * Download helper
 * ────────────────────────────────────────────────────────────────── */
function downloadFile(filename: string) {
  const a = document.createElement("a");
  a.href = `/demo/communications/${filename}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ──────────────────────────────────────────────────────────────────
 * Preview content — faithful screen rendering of each letter
 * ────────────────────────────────────────────────────────────────── */
const LetterMast: React.FC<{ subtitle: string; tagline?: string }> = ({
  subtitle,
  tagline,
}) => (
  <div
    style={{
      background: "#0F2B46",
      color: "white",
      padding: "16px 20px",
      borderRadius: 8,
      marginBottom: 24,
    }}
  >
    <div
      style={{
        fontSize: 10,
        letterSpacing: 3,
        fontWeight: 700,
        color: "#F59E0B",
        marginBottom: 4,
      }}
    >
      NOTEWELL AI · AGEING WELL SERVICE
    </div>
    <div style={{ fontFamily: FONT_SERIF, fontSize: 18, fontWeight: 600 }}>
      {subtitle}
    </div>
    {tagline && (
      <div
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: "rgba(255,255,255,0.75)",
          marginTop: 4,
        }}
      >
        {tagline}
      </div>
    )}
  </div>
);

const InfoBox: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div
    style={{
      background: "#FAF7F2",
      border: "1px solid #E2E0D9",
      borderRadius: 8,
      padding: 16,
      margin: "16px 0",
    }}
  >
    {title && (
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontWeight: 600,
          color: "#0F2B46",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
    )}
    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{children}</div>
  </div>
);

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    style={{
      fontFamily: FONT_SERIF,
      fontSize: 18,
      color: "#0F2B46",
      margin: "24px 0 8px",
      fontWeight: 600,
    }}
  >
    {children}
  </h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: "0 0 12px", color: "#334155", lineHeight: 1.7 }}>{children}</p>
);

const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul
    style={{
      margin: "0 0 16px",
      paddingLeft: 20,
      color: "#334155",
      lineHeight: 1.8,
    }}
  >
    {children}
  </ul>
);

const PREVIEW_CONTENT: Record<string, React.ReactNode> = {
  patient: (
    <>
      <LetterMast
        subtitle="Letter to the Patient"
        tagline="Dorothy 'Dot' Pearson · Post-visit summary in plain English"
      />
      <P>
        <strong>Dr A Patel</strong> · Towcester Medical Centre
        <br />
        Visit date: 15 April 2026 · Ref: AW-2026-0472
      </P>
      <P>
        <strong>Mrs Dorothy Pearson</strong>
        <br />
        14 Primrose Lane, Towcester, NN12 6BH
      </P>
      <P>
        <strong>Dear Dot,</strong>
      </P>
      <P>
        Thank you for having me in your home last Wednesday. I really enjoyed our chat — and the
        stories about Eric and the garden roses.
      </P>
      <P>
        I'm writing to let you know what we agreed, so you have it all in one place. Sandra has
        a copy too.
      </P>

      <H>What we talked about</H>
      <P>
        You told me the most important things to you are staying in your home, seeing your
        grandchildren Archie and Poppy on Sundays, and being able to potter in the garden.
        Everything we arrange below is to help make those things easier and safer.
      </P>

      <H>What I'm arranging for you</H>
      <UL>
        <li>An Occupational Therapist will visit within 4 weeks to look at your shower, bed and stairs.</li>
        <li>The Community Transport team will be in touch about lifts to your GP and the Friday coffee morning.</li>
        <li>I'm putting in an Attendance Allowance form for you — around £73 a week.</li>
        <li>Age UK Northamptonshire will ring you about befriending and the Sunday lunch club.</li>
        <li>Northamptonshire Fire &amp; Rescue will pop in for a free home safety check.</li>
      </UL>

      <H>What Sandra is helping with</H>
      <UL>
        <li>Arranging a keysafe by the back door.</li>
        <li>Sorting out a Lifeline pendant alarm.</li>
        <li>Moving the loose rug in the hall — it's a trip hazard.</li>
      </UL>

      <H>When I'll see you next</H>
      <P>
        I'll phone in two weeks (Wednesday 29 April) and pop back in person in six weeks to go
        through everything properly again.
      </P>

      <InfoBox title="If you need us in between visits">
        Ageing Well team: 01604 555 0120 (Mon–Fri, 9am–5pm)
        <br />
        NHS 111: dial 111 from any phone (24 hours a day)
        <br />
        In an emergency: always dial 999
        <br />
        Towcester Medical Centre: 01327 350 209
      </InfoBox>

      <P>Take care of yourself Dot — and give my regards to Sandra and the little ones.</P>
      <P>
        With warm regards,
        <br />
        <strong>Sarah Mitchell</strong>
        <br />
        Ageing Well Support Worker
        <br />
        sarah.mitchell@nhs.net · 01604 555 0120
      </P>
    </>
  ),

  gp: (
    <>
      <LetterMast
        subtitle="Clinical Summary to GP"
        tagline="FAO Dr A Patel, Towcester Medical Centre · Home frailty review outcomes"
      />
      <P>
        Towcester Medical Centre
        <br />
        FAO: Dr Anisha Patel, GP
        <br />
        Date: 16 April 2026
      </P>

      <H>Patient details</H>
      <InfoBox>
        <strong>Patient:</strong> Dorothy (Dot) Margaret Pearson
        <br />
        <strong>DOB / Age:</strong> 15/03/1942 (age 84)
        <br />
        <strong>NHS number:</strong> 438 291 7654
        <br />
        <strong>Address:</strong> 14 Primrose Lane, Towcester, NN12 6BH
        <br />
        <strong>Visit date:</strong> 15 April 2026 — extended home-based frailty review
        <br />
        <strong>Attending:</strong> Sarah Mitchell (AgeWell SW); Dr A Patel (remote, phone)
        <br />
        <strong>Referral reason:</strong> GP referral — bereavement (18/12), neighbour concerns
      </InfoBox>

      <H>Clinical summary</H>
      <P>
        Widowed 18 months (husband Eric). Lives alone. Daughter Sandra (Milton Keynes) — LPA
        Health &amp; Finance in place. Reports fluctuating mood, disrupted sleep, weight loss
        of approx. 2kg over 6 months.
      </P>

      <H>Objective findings</H>
      <UL>
        <li>BP sitting 152/88, 148/84 — Stage 1 HTN</li>
        <li>BP standing 138/78, 134/76 — postural drop 14 mmHg</li>
        <li>Pulse 78 reg, RR 18, SpO₂ 96%, T 36.4°C</li>
        <li>Rockwood CFS 5 — Mildly Frail</li>
        <li>Timed Up &amp; Go: 22 seconds with frame — falls risk</li>
        <li>Falls (12/12): 2 (kitchen mat Sept; garden step Jan)</li>
        <li>PHQ-9: 12 — moderate depression</li>
        <li>GAD-7: 8 — mild anxiety</li>
        <li>6-CIT: 6 — no cognitive impairment</li>
        <li>ONS4 wellbeing: low — loneliness flag</li>
      </UL>

      <H>Actions requested from GP</H>
      <ol style={{ paddingLeft: 20, color: "#334155", lineHeight: 1.8 }}>
        <li>Medication review — paracetamol PRN not controlling bilateral OA knee pain.</li>
        <li>Postural hypotension workup — review antihypertensives, repeat L/S BP at 2/52.</li>
        <li>PHQ-9 12 in context of bereavement — consider Cruse referral, review at 4/52.</li>
        <li>Ventolin inhaler technique check at next Rx.</li>
        <li>Confirm flu / COVID / RSV vaccination status.</li>
      </ol>

      <H>Actions being progressed by AgeWell team</H>
      <UL>
        <li>OT assessment via Adult Social Care</li>
        <li>Community Transport registration</li>
        <li>Attendance Allowance application support</li>
        <li>Age UK social prescribing</li>
        <li>Fire &amp; Rescue Safe &amp; Well visit</li>
        <li>Keysafe + Lifeline pendant (family-led)</li>
        <li>Northants Carers referral for Sandra</li>
      </UL>

      <InfoBox title="Follow-up schedule">
        2 weeks — AgeWell telephone check-in (29 April, ElevenLabs agent)
        <br />
        4 weeks — Review of GP actions &amp; medication (13 May)
        <br />
        6 weeks — AgeWell home review visit (27 May)
        <br />
        12 weeks — MDT case review (8 July)
      </InfoBox>

      <P>
        Kind regards,
        <br />
        <strong>Sarah Mitchell</strong>
        <br />
        Ageing Well Support Worker — Northamptonshire East
      </P>
    </>
  ),

  family: (
    <>
      <LetterMast
        subtitle="Letter to Next of Kin"
        tagline="Mrs Sandra Williams, daughter & LPA · Visit summary and family-led actions"
      />
      <P>Visit date: 15 April 2026 · Ref: AW-2026-0472</P>
      <P>
        <strong>Mrs Sandra Williams</strong>
        <br />
        [Address held on record], Milton Keynes
      </P>
      <P>
        <strong>Dear Sandra,</strong>
      </P>
      <P>
        Thank you for speaking with me on the phone before my visit to your mum last Wednesday —
        it was really helpful to hear your perspective, and it helps to know you have LPA Health
        &amp; Finance in place.
      </P>

      <H>How Dot is doing — the honest picture</H>
      <UL>
        <li>Two falls in the last 12 months — kitchen and garden. Not hurt, but we want to prevent a third.</li>
        <li>Blood pressure drops on standing — GP reviewing.</li>
        <li>Quite down at times. Losing Eric is still raw. PHQ-9 suggests moderate low mood.</li>
        <li>Knees painful and limiting. GP reviewing pain relief.</li>
        <li>Hadn't had a proper hot meal for two days before I arrived.</li>
      </UL>

      <H>What the AgeWell team is putting in place</H>
      <UL>
        <li>OT — home assessment within 4 weeks</li>
        <li>Community Transport — lifts to GP and social activities</li>
        <li>Attendance Allowance — we'll complete the form (~£73/week)</li>
        <li>Age UK befriending + Sunday lunch club</li>
        <li>Fire &amp; Rescue Safe &amp; Well home visit</li>
        <li>GP medication and mood review</li>
      </UL>

      <H>Where we'd really value your help</H>
      <ol style={{ paddingLeft: 20, color: "#334155", lineHeight: 1.8 }}>
        <li>
          <strong>Keysafe</strong> — C500 or similar by the back door (~£50–60). Dot has agreed.
        </li>
        <li>
          <strong>Lifeline pendant</strong> — Careium or West Northants Council (~£5/week).
          Dot has agreed to try one.
        </li>
        <li>
          <strong>Hallway rug</strong> — loose runner she's already caught her foot on. Highest
          trip risk in the house.
        </li>
      </ol>

      <H>Support for you, Sandra</H>
      <P>
        Being an unpaid carer to a parent at a distance is hard work. With your permission I'd
        like to refer you to <strong>Northants Carers</strong>. They offer:
      </P>
      <UL>
        <li>Free statutory Carer's Assessment</li>
        <li>Counselling and carer support groups</li>
        <li>Help with Carer's Allowance / Carer's Credit paperwork</li>
        <li>Emergency card scheme</li>
      </UL>
      <P>Just reply 'yes please' and I'll make the referral.</P>

      <InfoBox title="Key contacts">
        Sarah Mitchell (AgeWell): sarah.mitchell@nhs.net · 01604 555 0120
        <br />
        Towcester Medical Centre: 01327 350 209
        <br />
        Northants Carers advice line: 01933 677 837
        <br />
        Adult Social Care (West Northants): 0300 126 7000
        <br />
        Out-of-hours / 111 / 999 — in an emergency always dial 999
      </InfoBox>

      <P>
        With warm regards,
        <br />
        <strong>Sarah Mitchell</strong>
        <br />
        Ageing Well Support Worker
      </P>
    </>
  ),

  referrals: (
    <>
      <LetterMast
        subtitle="Multi-agency Referral Pack"
        tagline="Adult Social Care · Age UK · Northants Carers · Community Transport · Fire & Rescue"
      />
      <P>
        This referral pack accompanies the AgeWell Patient Support Plan for Mrs Dorothy Pearson
        (DOB 15/03/1942, NHS 438 291 7654) following home assessment on 15 April 2026. Consent
        to share with each named agency was obtained at the visit.
      </P>

      <InfoBox>
        <strong>Patient:</strong> Dorothy (Dot) Margaret Pearson, age 84
        <br />
        <strong>Address:</strong> 14 Primrose Lane, Towcester, NN12 6BH
        <br />
        <strong>Phone:</strong> 01327 325 591 (landline)
        <br />
        <strong>Next of kin:</strong> Sandra Williams (daughter) — LPA H&amp;F — 07709 864 321
        <br />
        <strong>GP:</strong> Dr A Patel, Towcester Medical Centre
        <br />
        <strong>Rockwood CFS:</strong> 5 (Mildly Frail) · 2 falls in 12 months · widowed 18/12
      </InfoBox>

      <H>1. Adult Social Care — Occupational Therapy</H>
      <P>
        <em>Routine — within 4 weeks. Submitted via ASC portal.</em>
      </P>
      <P>
        TUG 22 seconds with frame. Bilateral OA knees limit stair use. Over-bath shower not
        safely accessible — strip-washing for 3 months. Requesting walk-in shower adaptation,
        bed raisers, dressing aids, toilet frame, second stair rail.
      </P>

      <H>2. Age UK Northamptonshire — Befriending</H>
      <P>
        <em>Routine — first phone contact within 2 weeks. 01604 611 200.</em>
      </P>
      <P>
        Widowed 18/12. Socially isolated. ONS4: low wellbeing across all four domains.
        Enthusiastic about St Lawrence's Friday coffee morning if transport available.
      </P>

      <H>3. Northants Carers — Support for Sandra Williams</H>
      <P>
        <em>Routine — first contact within 10 working days. 01933 677 837.</em>
      </P>
      <P>
        Daughter living in Milton Keynes. Weekly visits, daily calls, manages all finances (LPA
        H&amp;F). Sandra has consented. Requesting Carer's Assessment, emergency card scheme,
        carer support group.
      </P>

      <H>4. Community Transport (West Northants)</H>
      <P>
        <em>Routine — warm handover via 01327 811 414.</em>
      </P>
      <P>
        No car, no local drivers. Cancels non-essential GP appointments. Requesting registration,
        door-through-door assistance, weekly outing to Friday coffee morning.
      </P>

      <H>5. Northamptonshire Fire &amp; Rescue — Safe &amp; Well</H>
      <P>
        <em>Routine — safeandwell@northantsfire.gov.uk / 01604 797 390.</em>
      </P>
      <P>
        Lives alone. No working smoke alarm upstairs (battery removed). Old gas hob. Electric
        blanket present. Requesting smoke alarm fit, blanket check, cooking safety review.
      </P>

      <InfoBox title="Feedback loop">
        Each agency confirms acceptance within 5 working days. Outcome updates at 6 and 12
        weeks for inclusion in the MDT case review.
        <br />
        Coordinator: Sarah Mitchell · sarah.mitchell@nhs.net · 01604 555 0120
      </InfoBox>
    </>
  ),

  carer: (
    <>
      <LetterMast
        subtitle="Carer Handover Note"
        tagline="For visiting or relief domiciliary carers attending Mrs D Pearson"
      />
      <P>
        This handover is a concise 'all you need to know on day one' summary, drawn from the
        AgeWell Patient Support Plan.
      </P>

      <InfoBox title="Please call her 'Dot'">
        Full name: Dorothy Margaret Pearson · DOB 15/03/1942 · Age 84
        <br />
        Address: 14 Primrose Lane, Towcester, NN12 6BH
        <br />
        Phone (landline): 01327 325 591
        <br />
        Key safe: by the back door · Code: **** (check with coordinator)
      </InfoBox>

      <H>What matters most to Dot</H>
      <UL>
        <li>Staying in her own home — lived here since 1982 with late husband Eric.</li>
        <li>Sundays with grandchildren Archie (5) and Poppy (7).</li>
        <li>Her garden — Eric's roses, watched from the kitchen window.</li>
        <li>A proper cup of tea — from the caddy on the worktop, not the cupboard tea bags.</li>
      </UL>

      <H>Key people</H>
      <InfoBox>
        <strong>Daughter / LPA:</strong> Sandra Williams · 07709 864 321 · LPA H&amp;F
        <br />
        <strong>GP:</strong> Dr A Patel, Towcester Medical Centre · 01327 350 209
        <br />
        <strong>AgeWell worker:</strong> Sarah Mitchell · 01604 555 0120
        <br />
        <strong>Pharmacy:</strong> Boots, Towcester (home delivery Weds)
        <br />
        <strong>Neighbour:</strong> Mrs Ethel Gardiner, no. 16 — has a spare key
      </InfoBox>

      <H>Key risks &amp; things to watch</H>
      <UL>
        <li>
          <strong>Falls (2 in 12m):</strong> walking frame beside bed overnight; remove kitchen
          mat; watch the loose garden step.
        </li>
        <li>
          <strong>Postural BP drop:</strong> 30 seconds sitting on edge of bed before standing.
          Offer a drink first thing.
        </li>
        <li>
          <strong>Low mood / bereavement:</strong> she talks about Eric freely. If tearful or
          withdrawn for two consecutive visits, ring AgeWell.
        </li>
        <li>
          <strong>OA knee pain:</strong> paracetamol regular, topical NSAID under review. One
          step at a time on stairs.
        </li>
        <li>
          <strong>Skipping meals:</strong> she'll say 'I'm fine with toast' — gently prompt a
          hot meal. Check the fridge on arrival.
        </li>
        <li>
          <strong>Hearing:</strong> mild loss left side. Face her when speaking; don't shout.
        </li>
      </UL>

      <H>Medication (brief)</H>
      <UL>
        <li>Paracetamol 1g QDS PRN — regular for knees</li>
        <li>Salbutamol 100 mcg PRN — mild SOB on exertion</li>
        <li>Amlodipine 5 mg OD — under review (postural drop)</li>
        <li>Atorvastatin 20 mg ON</li>
        <li>No known drug allergies</li>
      </UL>

      <H>Escalation — when to call who</H>
      <InfoBox title="🟢 Green — log and continue">
        Minor grazes, missed meals, low mood on one visit, minor aches and pains.
      </InfoBox>
      <InfoBox title="🟡 Amber — call AgeWell same day (01604 555 0120)">
        Any fall (even without injury). Skipped meals &gt;24h. Signs of infection (confusion,
        temperature). Dizziness episodes. Low mood persisting 2+ visits.
      </InfoBox>
      <InfoBox title="🔴 Red — call 999 immediately">
        Chest pain. Severe breathlessness. Fall with injury or inability to get up. Stroke signs
        (FAST). Unresponsive or confused.
      </InfoBox>
    </>
  ),
};

/* ──────────────────────────────────────────────────────────────────
 * Main modal component
 * ────────────────────────────────────────────────────────────────── */
interface CommunicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommunicationsModal: React.FC<CommunicationsModalProps> = ({ isOpen, onClose }) => {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [listVisible, setListVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Load Fraunces font
  useEffect(() => {
    if (document.getElementById("fraunces-font-link")) return;
    const link = document.createElement("link");
    link.id = "fraunces-font-link";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap";
    document.head.appendChild(link);
  }, []);

  // Mount animation trigger
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
      setPreviewId(null);
    }
  }, [isOpen]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewId) setPreviewId(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, previewId, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Focus trap (basic)
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const downloadAll = () => {
    letters.forEach((l, i) => {
      setTimeout(() => downloadFile(l.filename), i * 200);
    });
  };

  const previewLetter = previewId ? letters.find((l) => l.id === previewId) : null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comms-modal-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-xl shadow-2xl w-full max-h-[88vh] overflow-hidden flex flex-col outline-none"
        style={{
          maxWidth: 1100,
          maxHeight: "88vh",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 300ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between flex-shrink-0"
          style={{ background: "#0F2B46", color: "white", padding: "24px 32px" }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="text-amber-400"
              style={{
                fontSize: 11,
                letterSpacing: 3,
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              COMMUNICATIONS · ACT 3
            </div>
            <h2
              id="comms-modal-title"
              style={{
                fontFamily: FONT_SERIF,
                fontStyle: "italic",
                fontSize: 28,
                fontWeight: 500,
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Five letters from one conversation
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                margin: "8px 0 0",
                maxWidth: 720,
              }}
            >
              Generated in a single click from Dot Pearson's Patient Support Plan. All tie back
              to the same visit, audit record, and action plan.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={downloadAll}
              className="hidden sm:inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "6px 12px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
              }
            >
              <Download size={14} />
              Download all (ZIP)
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-2 transition-colors"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
              }
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Card grid */}
          <div
            className="min-h-0 overflow-y-auto"
            style={{
              padding: 24,
              background: "#FAFAF8",
              width: previewLetter ? "45%" : "100%",
              transition: "width 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            <div
              className={`grid gap-4 ${
                previewLetter ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
              }`}
            >
              {letters.map((l, i) => {
                const Icon = l.Icon;
                return (
                  <div
                    key={l.id}
                    className="rounded-lg p-5 transition-all hover:shadow-md cursor-default"
                    style={{
                      background: "#FEFCF7",
                      border: "1px solid #E2E0D9",
                      opacity: mounted ? 1 : 0,
                      transform: mounted ? "translateY(0)" : "translateY(12px)",
                      transition: `opacity 400ms ease ${i * 50}ms, transform 400ms ease ${
                        i * 50
                      }ms, border-color 200ms, box-shadow 200ms`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#0F766E";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E2E0D9";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex items-center justify-center rounded-md flex-shrink-0"
                        style={{
                          width: 44,
                          height: 44,
                          background: l.iconBg,
                          color: "white",
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-teal-700 font-semibold uppercase"
                          style={{ fontSize: 11, letterSpacing: 1, marginBottom: 2 }}
                        >
                          {l.label}
                        </div>
                        <div
                          className="line-clamp-1"
                          style={{
                            fontFamily: FONT_SERIF,
                            fontSize: 17,
                            color: "#1E293B",
                            fontWeight: 500,
                            lineHeight: 1.3,
                          }}
                        >
                          {l.title}
                        </div>
                      </div>
                    </div>

                    <p
                      className="text-sm text-slate-600 mt-3 line-clamp-3"
                      style={{ lineHeight: 1.55 }}
                    >
                      {l.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <span
                        className="px-2 py-0.5 text-xs rounded font-mono bg-slate-100 text-slate-600"
                      >
                        DOCX
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-600">
                        {l.pages}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded border ${audienceChipClass(
                          l.audienceColor
                        )}`}
                      >
                        {l.audience}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => downloadFile(l.filename)}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-white transition-colors"
                        style={{ background: "#0F2B46" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#1B3A5C")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#0F2B46")
                        }
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <button
                        onClick={() => setPreviewId(l.id)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-white text-slate-700 transition-colors"
                        style={{ border: "1px solid #E2E8F0" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#F8FAFC")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                      >
                        <Eye size={14} />
                        Preview
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview panel */}
          {previewLetter && (
            <div
              className="min-h-0 overflow-y-auto"
              style={{
                width: "55%",
                background: "#FEFCF7",
                borderLeft: "1px solid #E2E8F0",
                padding: 32,
                animation: "commsSlideIn 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
                <button
                  onClick={() => setPreviewId(null)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to list
                </button>
                <div
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 14,
                    color: "#0F2B46",
                    fontWeight: 500,
                  }}
                >
                  {previewLetter.title}
                </div>
              </div>

              <div style={{ fontSize: 14 }}>{PREVIEW_CONTENT[previewLetter.id]}</div>

              <div className="mt-8 pt-6" style={{ borderTop: "1px solid #E2E8F0" }}>
                <button
                  onClick={() => downloadFile(previewLetter.filename)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-md text-sm font-medium text-white transition-colors"
                  style={{ background: "#0F2B46" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1B3A5C")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0F2B46")}
                >
                  <Download size={14} />
                  Download this letter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes commsSlideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default CommunicationsModal;
