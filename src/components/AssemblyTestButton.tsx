import React, { useRef, useState } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";
import { getAssemblyToken } from "@/lib/getAssemblyToken";

export default function AssemblyTestButton() {
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const [running, setRunning] = useState(false);
  const [partial, setPartial] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [lastError, setLastError] = useState<string>("");

  const start = async () => {
    if (running) return;
    
    try {
      setStatus("connecting");
      setLastError("");
      setFinals([]);
      setPartial("");

      const token = await getAssemblyToken(); // <- if this throws, you'll see it
      
      const client = new AssemblyRealtimeClient({
        onOpen: () => {
          setStatus("live");
          setRunning(true);
        },
        onPartial: (t) => setPartial(t),
        onFinal: (t) => {
          if (t?.trim()) setFinals((old) => [...old, t]);
          setPartial("");
        },
        onClose: (code, reason) => {
          setRunning(false);
          setStatus("idle");
          if (code !== 1000) setLastError(`Closed: ${code} ${reason || ""}`);
        },
        onError: (e) => {
          setRunning(false);
          setStatus("error");
          setLastError(e?.message || String(e));
        },
      });

      clientRef.current = client;
      await client.startWithToken(token); // use startWithToken method
    } catch (e: any) {
      setStatus("error");
      setLastError(e?.message || String(e));
    }
  };

  const stop = () => {
    clientRef.current?.stop();
    clientRef.current = null;
  };

  return (
    <div className="p-4 rounded-2xl shadow border bg-white space-y-3">
      <div className="flex items-center gap-2">
        {!running ? (
          <button onClick={start} className="px-4 py-2 rounded-xl bg-blue-600 text-white">
            ▶ Test Assembly STT
          </button>
        ) : (
          <button onClick={stop} className="px-4 py-2 rounded-xl bg-rose-600 text-white">
            ⏹ Stop
          </button>
        )}
        <span className="text-sm opacity-80">
          Status: {status}{lastError ? ` — ${lastError}` : ""}
        </span>
      </div>

      <div className="text-sm">
        <div className="font-semibold mb-1">Live (partial):</div>
        <div className="p-2 rounded bg-gray-50 min-h-[2.5rem]">{partial || <em>…</em>}</div>
      </div>

      <div className="text-sm">
        <div className="font-semibold mb-1">Final lines:</div>
        <div className="p-2 rounded bg-gray-50 min-h-[4rem] space-y-1">
          {finals.map((f, i) => (
            <div key={i}>• {f}</div>
          ))}
          {!finals.length && <em>…</em>}
        </div>
      </div>
    </div>
  );
}