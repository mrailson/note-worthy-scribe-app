import { supabase } from "@/integrations/supabase/client";

export async function getAssemblyToken() {
  const { data, error } = await supabase.functions.invoke("assemblyai-realtime-token", {
    method: "GET",
  });
  if (error) throw new Error(`Token invoke failed: ${error.message}`);
  if (!data?.token) throw new Error("No token in response");
  return data.token as string;
}