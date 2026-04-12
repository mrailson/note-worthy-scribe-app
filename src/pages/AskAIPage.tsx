import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import NotewellChat from "@/components/AskAI/NotewellChat";

interface UserProfile {
  name: string;
  initials: string;
  role: string;
  jobTitle: string;
  practice: {
    name: string;
    shortName: string;
    odsCode: string;
    clinicalSystem: string;
    logoUrl: string | null;
    primaryColour: string;
  };
  neighbourhood: string;
  icb: string;
  pcn: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NU";

const buildFallbackUser = (authUser: { email?: string | null; user_metadata?: Record<string, any> }): UserProfile => {
  const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || "User";

  return {
    name,
    initials: getInitials(name),
    role: "NHS Staff",
    jobTitle: "",
    practice: {
      name: "NHS Primary Care",
      shortName: "NHS",
      odsCode: "",
      clinicalSystem: "",
      logoUrl: null,
      primaryColour: "#005EB8",
    },
    neighbourhood: "",
    icb: "",
    pcn: "",
  };
};

export default function AskAIPage() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (authLoading) return;

      if (!authUser) {
        if (isActive) {
          setUser(null);
          setProfileLoading(false);
        }
        return;
      }

      const fallbackUser = buildFallbackUser(authUser);
      setProfileLoading(true);

      // Load profile + practice_details (authoritative for user's practice)
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role, title")
        .eq("user_id", authUser.id)
        .maybeSingle();

      // Load practice from practice_details (user's own practice config)
      const { data: practiceDetail } = await supabase
        .from("practice_details")
        .select("practice_name, ods_code, clinical_system, logo_url, pcn_code")
        .eq("user_id", authUser.id)
        .eq("is_default", true)
        .maybeSingle();

      if (!isActive) return;

      if (error || !profile) {
        if (error) {
          console.error("Error loading Ask AI profile:", error);
        }
        setUser(fallbackUser);
        setProfileLoading(false);
        return;
      }

      const name = profile.full_name || fallbackUser.name;
      const practiceName = practiceDetail?.practice_name || fallbackUser.practice.name;
      const odsCode = practiceDetail?.ods_code || "";

      // Try to resolve neighbourhood and ICB from gp_practices via ODS code
      let neighbourhood = "";
      let icb = "";
      let pcn = "";
      if (odsCode) {
        const { data: gpMatch } = await supabase
          .from("gp_practices")
          .select("pcn_code, ics_name, neighbourhood_id, neighbourhoods(name)")
          .eq("practice_code", odsCode)
          .maybeSingle();

        if (gpMatch) {
          const gpData = gpMatch as any;
          pcn = gpData.pcn_code || practiceDetail?.pcn_code || "";
          icb = gpData.ics_name || "";
          neighbourhood = gpData.neighbourhoods?.name || "";
        }
      }

      if (!isActive) return;

      // Generate short name from practice name
      const shortName = practiceName.length > 20
        ? practiceName.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 4).toUpperCase()
        : practiceName;

      setUser({
        name,
        initials: getInitials(name),
        role: profile.role || fallbackUser.role,
        jobTitle: profile.title || fallbackUser.jobTitle,
        practice: {
          name: practiceName,
          shortName,
          odsCode,
          clinicalSystem: practiceDetail?.clinical_system || fallbackUser.practice.clinicalSystem,
          logoUrl: practiceDetail?.logo_url || fallbackUser.practice.logoUrl,
          primaryColour: fallbackUser.practice.primaryColour,
        },
        neighbourhood,
        icb,
        pcn,
      });
      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [authLoading, authUser]);

  const isLoading = authLoading || profileLoading;

  if (isLoading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🤖</div>
        <p style={{ color: "#425563", fontSize: "0.9rem" }}>Loading your profile…</p>
      </div>
    </div>
  );

  if (!authUser) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8" }}>
      <p style={{ color: "#425563" }}>Please sign in to use Notewell AI.</p>
    </div>
  );

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      overflow: "hidden",
      zIndex: 40,
      background: "#F0F4F8"
    }}>
      <NotewellChat user={user ?? buildFallbackUser(authUser)} onNavigateHome={() => navigate("/")} />
    </div>
  );
}
