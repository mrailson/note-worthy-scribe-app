import { useEffect, useState } from "react";
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

export default function AskAIPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*, gp_practices(name, short_name, ods_code, clinical_system, logo_url, primary_colour)")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        const practice = (profile as any).gp_practices;
        const name = profile.full_name || session.user.email || "User";
        setUser({
          name,
          initials: name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
          role: profile.role || "NHS Staff",
          jobTitle: profile.title || "",
          practice: {
            name: practice?.name || "NHS Primary Care",
            shortName: practice?.short_name || "NHS",
            odsCode: practice?.ods_code || "",
            clinicalSystem: practice?.clinical_system || "",
            logoUrl: practice?.logo_url || null,
            primaryColour: practice?.primary_colour || "#005EB8",
          },
          neighbourhood: "",
          icb: "",
        });
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🤖</div>
        <p style={{ color: "#425563", fontSize: "0.9rem" }}>Loading your profile…</p>
      </div>
    </div>
  );

  if (!user) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0F4F8" }}>
      <p style={{ color: "#425563" }}>Please sign in to use Notewell AI.</p>
    </div>
  );

  return (
    <div style={{ height: "calc(100vh - 48px)" }}>
      <NotewellChat user={user} />
    </div>
  );
}
