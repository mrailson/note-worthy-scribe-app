import React from "react";

const costData = [
  { service: "Browser Default (free)", perMin: 0.0, perHour: 0.0, tenHours: 0.0, fiftyHours: 0.0, hundredHours: 0.0 },
  { service: "AssemblyAI Streaming", perMin: 0.0018, perHour: 0.11, tenHours: 1.08, fiftyHours: 5.40, hundredHours: 10.80 },
  { service: "gpt-4o-mini-transcribe", perMin: 0.0022, perHour: 0.13, tenHours: 1.32, fiftyHours: 6.60, hundredHours: 13.20 },
  { service: "Deepgram Nova-3 Streaming", perMin: 0.0044, perHour: 0.26, tenHours: 2.64, fiftyHours: 13.20, hundredHours: 26.40 },
  { service: "gpt-4o-transcribe", perMin: 0.0045, perHour: 0.27, tenHours: 2.70, fiftyHours: 13.50, hundredHours: 27.00 },
  { service: "whisper-1", perMin: 0.0045, perHour: 0.27, tenHours: 2.70, fiftyHours: 13.50, hundredHours: 27.00 },
];

export default function TranscribeCostComparison() {
  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-primary mb-4">💷 Transcription Cost Comparison</h2>
      <p className="text-sm text-muted-foreground mb-2">
        Costs in GBP. Rounded at current exchange rate (£0.74/$1). 
        Shows per-hour and projected usage for exec-level clarity.
      </p>
      <div className="overflow-x-auto rounded-lg shadow border">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="px-3 py-2">Service / Model</th>
              <th className="px-3 py-2 text-right">£/hr</th>
              <th className="px-3 py-2 text-right">10h</th>
              <th className="px-3 py-2 text-right">50h</th>
              <th className="px-3 py-2 text-right">100h</th>
            </tr>
          </thead>
          <tbody>
            {costData.map((row, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 0 ? "bg-background" : "bg-muted/50"}
              >
                <td className="px-3 py-2 font-medium">{row.service}</td>
                <td className="px-3 py-2 text-right">£{row.perHour.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">£{row.tenHours.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">£{row.fiftyHours.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">£{row.hundredHours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        ✅ AssemblyAI Streaming is cheapest (£0.11/hr).  
        ✅ gpt-4o-mini is only slightly more (£0.13/hr) and integrates with OpenAI stack.  
        ⚖️ Whisper / gpt-4o-transcribe / Deepgram cost ~£0.26-0.27/hr.  
        🌐 Browser default = £0 but not enterprise-ready.
      </p>
    </div>
  );
}