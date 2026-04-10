import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";

interface TranscriptionSegment {
  speaker: string;
  timestamp: string;
  text: string;
}

interface PatientSummaryPayload {
  sessionId: string;
  practiceName: string;
  sessionType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  languageUsed: string;
  transcription: TranscriptionSegment[];
  summary?: string;
  triageFlags?: string[];
  gpActions?: string[];
  complaintsRaised?: string[];
}

function parseBrowser(): string {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let version = "";

  if (/Edg\/(\d+[\.\d]*)/.test(ua)) {
    browser = "Edge";
    version = ua.match(/Edg\/(\d+[\.\d]*)/)?.[1] || "";
  } else if (/Chrome\/(\d+[\.\d]*)/.test(ua) && !/Chromium/.test(ua)) {
    browser = "Chrome";
    version = ua.match(/Chrome\/(\d+[\.\d]*)/)?.[1] || "";
  } else if (/Safari\/(\d+[\.\d]*)/.test(ua) && !/Chrome/.test(ua)) {
    browser = "Safari";
    version = ua.match(/Version\/(\d+[\.\d]*)/)?.[1] || "";
  } else if (/Firefox\/(\d+[\.\d]*)/.test(ua)) {
    browser = "Firefox";
    version = ua.match(/Firefox\/(\d+[\.\d]*)/)?.[1] || "";
  }

  return version ? `${browser} ${version}` : browser;
}

async function getPublicIP(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "Unknown";
  } catch {
    return "Unknown";
  }
}

export function usePatientSummaryEmail() {
  const sendPatientSummaryEmail = useCallback(async (payload: PatientSummaryPayload): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        console.warn("No user email available for patient summary");
        return false;
      }

      let userName = user.email.split("@")[0];
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();
        if (profile?.full_name) {
          userName = profile.full_name;
        }
      } catch {
        // fall back to email prefix
      }

      const [userBrowser, userIPAddress] = await Promise.all([
        Promise.resolve(parseBrowser()),
        getPublicIP(),
      ]);

      const { error } = await supabase.functions.invoke("send-patient-summary", {
        body: {
          ...payload,
          userEmail: user.email,
          userName,
          userBrowser,
          userIPAddress,
        },
      });

      if (error) {
        throw error;
      }

      showToast.success("Summary sent", {
        description: `Patient session summary emailed to ${user.email}`,
        section: "system",
      });
      return true;
    } catch (err) {
      console.error("Patient summary email failed:", err);
      showToast.error("Email failed", {
        description: "Session saved but email could not be sent. You can download the transcript manually.",
        section: "system",
      });
      return false;
    }
  }, []);

  return { sendPatientSummaryEmail };
}
