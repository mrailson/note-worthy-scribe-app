import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export async function getAssemblyToken() {
  const { data, error } = await supabase.functions.invoke("assemblyai-realtime-token", {
    method: "GET",
  });
  if (error) throw new Error(`Token invoke failed: ${error.message}`);
  if (!data?.token) throw new Error("No token in response");
  return data.token as string;
}