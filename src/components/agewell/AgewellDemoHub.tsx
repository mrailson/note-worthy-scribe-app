// src/components/agewell/AgewellDemoHub.tsx
// Demo Hub zones rendered below the existing Ageing Well Live Services home cards.
// Self-contained: brings its own Fraunces font + scroll-reveal + modals.

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BookOpen,
  Layers,
  RefreshCcw,
  ChevronDown,
  FileDown,
  Mail,
  PlayCircle,
  Home,
  FileText,
  X,
} from "lucide-react";
import AgeingWellDemoModal from "@/components/AgeingWellDemoModal";
import CommunicationsModal from "@/components/CommunicationsModal";
import PatientSupportPlanModal from "@/components/demo/PatientSupportPlanModal";
import HomeVisitCaptureModal from "@/components/demo/HomeVisitCaptureModal";
import { DEMO_PATIENTS } from "@/data/demoPatients";

const VISIT_CAPTURED_KEY = "demo.dot.visit.captured";

/* ──────────────────────────────────────────────────────────────────
 * Palette (kept consistent with the rest of the AgeWell page)
 * ────────────────────────────────────────────────────────────────── */
const C = {
  navyDeep: "#0F2B46",
  navy: "#1B3A5C",
  navyMid: "#163A5E",
  navyText: "#1B3A5C",
  cream: "#FEFCF7",
  creamAlt: "#FAF7F2",
  border: "#E2E0D9",
  teal: "#2C7A7B",
  tealDark: "#1F5E5E",
  tealLight: "#E6F2F1",
  amber: "#F59E0B",
  amberDark: "#D97706",
  slate600: "#475569",
  slate700: "#334155",
};

/* ──────────────────────────────────────────────────────────────────
 * Scroll-reveal hook
 * ────────────────────────────────────────────────────────────────── */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

const revealStyle = (visible: boolean): React.CSSProperties => ({
  opacity: visible ? 1 : 0,
  transform: visible ? "translateY(0)" : "translateY(20px)",
  transition: "opacity 700ms ease, transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)",
});

/* ──────────────────────────────────────────────────────────────────
 * Fraunces loader (one-time)
 * ────────────────────────────────────────────────────────────────── */
function useFrauncesFont() {
  useEffect(() => {
    if (document.getElementById("fraunces-font-link")) return;
    const link = document.createElement("link");
    link.id = "fraunces-font-link";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap";
    document.head.appendChild(link);
  }, []);
}

const FONT_SERIF = `'Fraunces', 'Playfair Display', Georgia, 'Times New Roman', serif`;

/* ──────────────────────────────────────────────────────────────────
 * Programme knowledge modal (Zone 3, card 1)
 * ────────────────────────────────────────────────────────────────── */
const ProgrammeModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 43, 70, 0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.cream,
          borderRadius: 16,
          maxWidth: 720,
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            background: C.navyDeep,
            color: "white",
            padding: "20px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: C.amber,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              REFERENCE
            </div>
            <div style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 22 }}>
              Ageing Well — Northamptonshire
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              borderRadius: 8,
              padding: 8,
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 28, color: C.slate700, fontSize: 14, lineHeight: 1.7 }}>
          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 18,
              color: C.navyText,
              margin: "0 0 8px",
            }}
          >
            Programme overview
          </h3>
          <p style={{ margin: "0 0 18px" }}>
            Ageing Well is a Northamptonshire neighbourhood programme delivering proactive,
            multi-agency support to frail older adults — keeping them well at home, reducing
            avoidable admissions, and joining up health, social care and the voluntary sector
            around one person.
          </p>

          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 18,
              color: C.navyText,
              margin: "0 0 8px",
            }}
          >
            Partners
          </h3>
          <ul style={{ margin: "0 0 18px", paddingLeft: 20 }}>
            <li>Northamptonshire ICB (commissioner and convenor)</li>
            <li>Primary Care Networks across Nene and Northants</li>
            <li>Northamptonshire Healthcare NHS Foundation Trust (community)</li>
            <li>West Northamptonshire Council — Adult Social Care</li>
            <li>Voluntary Impact Northamptonshire — AgeWell support workers</li>
            <li>Falls service, community OT, district nursing, palliative care</li>
          </ul>

          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 18,
              color: C.navyText,
              margin: "0 0 8px",
            }}
          >
            iCAN context
          </h3>
          <p style={{ margin: "0 0 18px" }}>
            iCAN (Integrated Care Anticipatory Network) is the operating model — small
            neighbourhood teams holding a shared list of high-risk frail patients, meeting
            weekly, and acting through whichever partner is best placed.
          </p>

          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 18,
              color: C.navyText,
              margin: "0 0 8px",
            }}
          >
            Key contacts (demo placeholder)
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Programme Lead — Ageing Well Northants</li>
            <li>Clinical Lead — Frailty &amp; Community</li>
            <li>Digital Lead — ICB DDaT</li>
            <li>VCSE Lead — Voluntary Impact Northamptonshire</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
 * Section header helper
 * ────────────────────────────────────────────────────────────────── */
const SectionHeader: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  small?: boolean;
}> = ({ eyebrow, title, subtitle, small }) => (
  <div style={{ marginBottom: 28, textAlign: "left" }}>
    {eyebrow && (
      <div
        style={{
          fontSize: 11,
          letterSpacing: 3,
          color: C.amberDark,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
    )}
    <h2
      style={{
        fontFamily: FONT_SERIF,
        fontStyle: "italic",
        fontSize: small ? 24 : 32,
        color: C.navyText,
        margin: 0,
        lineHeight: 1.15,
        fontWeight: small ? 500 : 600,
      }}
    >
      {title}
    </h2>
    {subtitle && (
      <p
        style={{
          fontSize: 14,
          color: C.slate600,
          marginTop: 8,
          marginBottom: 0,
          maxWidth: 720,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>
    )}
  </div>
);

/* ──────────────────────────────────────────────────────────────────
 * Main hub
 * ────────────────────────────────────────────────────────────────── */
const AgewellDemoHub: React.FC = () => {
  useFrauncesFont();
  const navigate = useNavigate();

  const [showDemo, setShowDemo] = useState(false);
  const [showComms, setShowComms] = useState(false);
  const [showProgramme, setShowProgramme] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showSupportPlan, setShowSupportPlan] = useState(false);
  const [showHomeVisit, setShowHomeVisit] = useState(false);
  const [visitCaptured, setVisitCaptured] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(VISIT_CAPTURED_KEY) === "true";
  });

  const openHomeVisit = () => setShowHomeVisit(true);
  const closeHomeVisit = () => {
    setShowHomeVisit(false);
    setVisitCaptured(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(VISIT_CAPTURED_KEY, "true");
    }
  };

  const z1 = useReveal<HTMLDivElement>();
  const z2 = useReveal<HTMLDivElement>();
  const z3 = useReveal<HTMLDivElement>();
  const z4 = useReveal<HTMLDivElement>();

  /* Responsive helper */
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 880 : true
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 880);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ─── ACTION HANDLERS ─── */
  const openMeeting = () =>
    navigate("/meetings?folder=Demonstrations");
  const openPlan = () => setShowSupportPlan(true);
  const openFeasibility = () =>
    window.open("/demo/gp-connect-feasibility.html", "_blank", "noopener,noreferrer");
  const openProductOverview = () => navigate("/documents");
  const resetDemo = () => {
    toast.success("Demo state reset");
    setTimeout(() => window.location.reload(), 400);
  };

  /* ─── ZONE 1: Featured patient strip ─── */
  const Zone1 = (
    <div
      ref={z1.ref}
      style={{
        ...revealStyle(z1.visible),
        background: `linear-gradient(135deg, ${C.navyDeep} 0%, ${C.navyMid} 100%)`,
        borderRadius: 16,
        padding: isDesktop ? "32px 40px" : "28px 24px",
        marginTop: 48,
        color: "white",
        display: "flex",
        flexDirection: isDesktop ? "row" : "column",
        gap: isDesktop ? 32 : 24,
        alignItems: "center",
        boxShadow: "0 8px 32px rgba(15, 43, 70, 0.2)",
      }}
    >
      {/* Left 60% */}
      <div style={{ flex: isDesktop ? "0 0 60%" : "1 1 100%" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: "#FBBF24",
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Featured Demo
        </div>
        <h2
          style={{
            fontFamily: FONT_SERIF,
            fontStyle: "italic",
            fontSize: isDesktop ? 56 : 44,
            color: "white",
            margin: 0,
            lineHeight: 1.05,
            fontWeight: 500,
          }}
        >
          Meet Dot
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.78)",
            lineHeight: 1.65,
            marginTop: 14,
            marginBottom: 18,
            maxWidth: 560,
          }}
        >
          Mrs Dorothy Pearson, 84. Widowed. Lives alone in Towcester. Two falls in a year.
          Rockwood 5. This is the patient who takes us through the entire Notewell journey
          — from home visit to GP inbox.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            "NHS 438 291 7654",
            "DOB 15/03/1942",
            "Towcester Medical Centre",
            "Demo patient · scripted data",
          ].map((p) => (
            <span
              key={p}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.92)",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Right 40% — avatar */}
      <div
        style={{
          flex: isDesktop ? "0 0 40%" : "1 1 100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)",
            color: "white",
            fontFamily: FONT_SERIF,
            fontSize: 52,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 0 0 6px rgba(20, 184, 166, 0.18), 0 0 0 14px rgba(20, 184, 166, 0.08), 0 12px 32px rgba(0,0,0,0.3)",
            letterSpacing: -2,
          }}
        >
          DP
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "rgba(255,255,255,0.85)",
            fontSize: 11,
            letterSpacing: 2,
            fontWeight: 600,
          }}
        >
          <span
            className="agewell-pulse-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22C55E",
              boxShadow: "0 0 0 0 rgba(34, 197, 94, 0.7)",
            }}
          />
          LIVE DEMO READY
        </div>
      </div>
    </div>
  );

  /* ─── ZONE 2: 5-Act flow ─── */
  const acts = [
    {
      n: 1,
      title: "Home visit captured",
      desc:
        "AgeWell worker records Dot's frailty review on the doorstep with Notewell mobile — offline-capable.",
      btn: "Watch visit",
      onClick: openHomeVisit,
      icon: <PlayCircle size={14} />,
      captured: visitCaptured,
      secondary: { label: "View raw transcript →", onClick: openMeeting },
    },
    {
      n: 2,
      title: "Patient Support Plan generated",
      desc:
        "Structured plan auto-populated from the transcript with PHQ-9, GAD-7, 6-CIT, FRAT, ONS4 scores and a 15-item action plan.",
      btn: "View plan (DOCX)",
      onClick: openPlan,
      icon: <FileText size={14} />,
    },
    {
      n: 3,
      title: "Communications generated",
      desc:
        "Five letters produced in one click — patient, family, GP, multi-agency referrals, carer handover note.",
      btn: "See communications",
      onClick: () => setShowComms(true),
      icon: <Mail size={14} />,
      isNew: true,
    },
    {
      n: 4,
      title: "Sent to GP via GP Connect",
      desc:
        "Structured FHIR tasks land in the GP's SystmOne or EMIS workflow manager — no re-keying, no fax, no post.",
      btn: "Launch GP Connect demo",
      onClick: () => setShowDemo(true),
      icon: <PlayCircle size={14} />,
      highlight: true,
    },
    {
      n: 5,
      title: "Feasibility defended",
      desc:
        "A 14-section technical feasibility paper ready for ICB IT leadership challenge on how we deliver this for real.",
      btn: "Open feasibility paper",
      onClick: openFeasibility,
      icon: <FileText size={14} />,
    },
  ];

  const Zone2 = (
    <div ref={z2.ref} style={{ ...revealStyle(z2.visible), marginTop: 64 }}>
      <SectionHeader
        eyebrow="The Demo Flow · 5 Acts"
        title="From home visit to GP inbox — in one click"
        subtitle="The complete Notewell workflow, choreographed as a single presentation narrative."
      />
      <div style={{ position: "relative" }}>
        {/* Dashed connector — desktop only */}
        {isDesktop && (
          <div
            style={{
              position: "absolute",
              top: 22,
              left: "10%",
              right: "10%",
              height: 0,
              borderTop: `2px dashed ${C.teal}`,
              opacity: 0.4,
              zIndex: 0,
            }}
          />
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "1fr",
            gap: isDesktop ? 16 : 28,
            position: "relative",
            zIndex: 1,
            paddingTop: 24,
          }}
        >
          {acts.map((a) => (
            <div
              key={a.n}
              style={{
                background: C.cream,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "32px 18px 18px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 8px rgba(15, 43, 70, 0.06)",
              }}
            >
              {/* Step number circle */}
              <div
                style={{
                  position: "absolute",
                  top: -22,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: C.teal,
                  color: "white",
                  fontFamily: FONT_SERIF,
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(44, 122, 123, 0.35)",
                }}
              >
                {a.n}
              </div>

              {/* LIVE DEMO badge for Act 4 */}
              {a.highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: C.amber,
                    color: "white",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}
                >
                  LIVE DEMO
                </div>
              )}

              {/* NEW badge for Act 3 */}
              {(a as { isNew?: boolean }).isNew && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: "#F59E0B",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    padding: "2px 6px",
                    borderRadius: 2,
                    textTransform: "uppercase",
                  }}
                >
                  NEW
                </div>
              )}

              <div
                style={{
                  fontWeight: 600,
                  color: C.navyText,
                  fontSize: 15,
                  marginBottom: 8,
                  marginTop: 4,
                }}
              >
                {a.title}
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  color: C.slate600,
                  lineHeight: 1.55,
                  margin: "0 0 16px",
                  flex: 1,
                }}
              >
                {a.desc}
              </p>
              <button
                onClick={a.onClick}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                  background: C.navyDeep,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#0A1F33")}
                onMouseLeave={(e) => (e.currentTarget.style.background = C.navyDeep)}
              >
                {a.icon}
                {a.btn}
              </button>
              {(a as { captured?: boolean }).captured && (
                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: C.teal,
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: C.tealLight,
                      color: C.tealDark,
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    ✓
                  </span>
                  Visit captured
                </div>
              )}
              {(a as { secondary?: { label: string; onClick: () => void } }).secondary && (
                <button
                  onClick={(a as { secondary: { onClick: () => void } }).secondary.onClick}
                  style={{
                    marginTop: 8,
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: C.slate600,
                    fontSize: 11.5,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textAlign: "left",
                    alignSelf: "flex-start",
                  }}
                >
                  {(a as { secondary: { label: string } }).secondary.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ─── ZONE 3: Reference cards ─── */
  const referenceCards = [
    {
      icon: <BookOpen size={16} />,
      title: "Ageing Well programme knowledge",
      desc: "Northamptonshire programme, partners, iCAN context, key people.",
      onClick: () => setShowProgramme(true),
    },
    {
      icon: <Layers size={16} />,
      title: "Notewell product overview",
      desc:
        "Full module inventory: Meeting Manager, Ask AI, Policy Generator, NRES Dashboard, AgeWell suite.",
      onClick: openProductOverview,
    },
    {
      icon: <RefreshCcw size={16} />,
      title: "Demo reset",
      desc: "Clear demo state and return to a fresh AgeWell Live Services view.",
      onClick: resetDemo,
    },
  ];

  const Zone3 = (
    <div ref={z3.ref} style={{ ...revealStyle(z3.visible), marginTop: 64 }}>
      <SectionHeader
        small
        title="Supporting reference material"
        subtitle="For deeper dives during Q&A"
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
          gap: 16,
        }}
      >
        {referenceCards.map((card) => (
          <button
            key={card.title}
            onClick={card.onClick}
            style={{
              textAlign: "left",
              background: C.cream,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 24,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transition: "transform 200ms ease, box-shadow 200ms ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(15, 43, 70, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: C.teal,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {card.icon}
            </div>
            <div
              style={{ fontWeight: 600, color: C.navyText, fontSize: 15, marginTop: 4 }}
            >
              {card.title}
            </div>
            <div style={{ fontSize: 13, color: C.slate600, lineHeight: 1.55 }}>
              {card.desc}
            </div>
            <div
              style={{
                marginTop: 8,
                color: C.tealDark,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Open →
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  /* ─── ZONE 4: Presenter notes ─── */
  const Zone4 = (
    <div ref={z4.ref} style={{ ...revealStyle(z4.visible), marginTop: 48 }}>
      <button
        onClick={() => setNotesOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: C.creamAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 20px",
          fontSize: 14,
          fontWeight: 600,
          color: C.navyText,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span>Presenter notes — click to expand</span>
        <ChevronDown
          size={18}
          style={{
            transition: "transform 220ms ease",
            transform: notesOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {notesOpen && (
        <div
          style={{
            marginTop: 12,
            background: C.cream,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: isDesktop ? "28px 32px" : "22px 20px",
            color: C.slate700,
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontSize: 20,
              color: C.navyText,
              margin: "0 0 10px",
              fontWeight: 600,
            }}
          >
            Running order
          </h3>
          <ol style={{ margin: "0 0 24px", paddingLeft: 22 }}>
            <li>Open on this Ageing Well hub page.</li>
            <li>Click "Open meeting" to show the Dot Pearson meeting.</li>
            <li>Back to hub. Click "View plan" to show the DOCX output.</li>
            <li>
              Back to hub. Click "See communications" — quickly flick through the 5 letters.
            </li>
            <li>
              Back to hub. Click "Launch GP Connect demo" — the headline moment. Walk through
              split-screen Notewell → SystmOne. Press key <strong>4</strong> for EMIS if any
              EMIS users in the room.
            </li>
            <li>If challenged on technical feasibility, open the paper.</li>
          </ol>

          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontSize: 20,
              color: C.navyText,
              margin: "0 0 10px",
              fontWeight: 600,
            }}
          >
            Key lines to use
          </h3>
          <ul style={{ margin: "0 0 24px", paddingLeft: 22 }}>
            <li>
              "This is one patient, one workflow, end-to-end — nothing staged between screens."
            </li>
            <li>
              "The GP Connect payload is the same whether SystmOne or EMIS receives it. It's
              not a SystmOne feature or an EMIS feature — it's an NHS feature."
            </li>
            <li>"The question isn't 'can this be done' — it's 'when do we start?'"</li>
          </ul>

          <h3
            style={{
              fontFamily: FONT_SERIF,
              fontStyle: "italic",
              fontSize: 20,
              color: C.navyText,
              margin: "0 0 10px",
              fontWeight: 600,
            }}
          >
            Audience-specific tweaks
          </h3>
          <ul style={{ margin: 0, paddingLeft: 22 }}>
            <li>For clinical audiences: emphasise Act 1 and Act 2.</li>
            <li>For IT/DDaT: emphasise Act 4 and Act 5.</li>
            <li>
              For finance/strategy: emphasise the feasibility paper's £6–10k external spend
              figure and 9-month roadmap.
            </li>
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: isDesktop ? "0 24px 80px" : "0 16px 64px",
      }}
    >
      <style>{`
        @keyframes agewellHubPulse {
          0%   { box-shadow: 0 0 0 0   rgba(34, 197, 94, 0.7); }
          70%  { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0   rgba(34, 197, 94, 0); }
        }
        .agewell-pulse-dot { animation: agewellHubPulse 2s infinite; }
      `}</style>

      {Zone1}
      {Zone2}
      {Zone3}
      {Zone4}

      {/* Modals */}
      <CommunicationsModal isOpen={showComms} onClose={() => setShowComms(false)} />
      <ProgrammeModal open={showProgramme} onClose={() => setShowProgramme(false)} />
      <AgeingWellDemoModal
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        meetingTitle="Towcester MC — Ageing Well Home Visit"
        patientName="Dorothy Pearson (Dot)"
      />
      <PatientSupportPlanModal
        open={showSupportPlan}
        onClose={() => setShowSupportPlan(false)}
        patient={DEMO_PATIENTS[0]}
      />
    </div>
  );
};

export default AgewellDemoHub;
