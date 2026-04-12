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

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role, title, gp_practices(name, short_name, ods_code, clinical_system, logo_url, primary_colour)")
        .eq("user_id", authUser.id)
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

      const profileData = profile as any;
      const practice = profileData.gp_practices;
      const name = profileData.full_name || fallbackUser.name;

      setUser({
        name,
        initials: getInitials(name),
        role: profileData.role || fallbackUser.role,
        jobTitle: profileData.title || fallbackUser.jobTitle,
        practice: {
          name: practice?.name || fallbackUser.practice.name,
          shortName: practice?.short_name || fallbackUser.practice.shortName,
          odsCode: practice?.ods_code || fallbackUser.practice.odsCode,
          clinicalSystem: practice?.clinical_system || fallbackUser.practice.clinicalSystem,
          logoUrl: practice?.logo_url || fallbackUser.practice.logoUrl,
          primaryColour: practice?.primary_colour || fallbackUser.practice.primaryColour,
        },
        neighbourhood: fallbackUser.neighbourhood,
        icb: fallbackUser.icb,
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
