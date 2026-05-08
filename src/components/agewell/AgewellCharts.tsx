import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";

interface ChartRow {
  submitted_at: string;
  channel: "web" | "paper" | "telephony";
  practice_canonical: string | null;
  practice_label_freeform: string | null;
  overall_rating: number | null;
  would_recommend: string | null;
}

const RATING_COLOURS: Record<number, string> = {
  1: "#E76F51", 2: "#E76F51", 3: "#ED8B00", 4: "#2A9D8F", 5: "#2A9D8F",
};
const REC_COLOURS: Record<string, string> = { yes: "#2A9D8F", unsure: "#ED8B00", no: "#E76F51" };
const CHANNEL_COLOURS: Record<string, string> = { web: "#0EA5E9", telephony: "#8B5CF6", paper: "#64748B" };

function practiceLabel(r: ChartRow) {
  return r.practice_canonical || r.practice_label_freeform || "—";
}

function weekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function AgewellCharts({ rows }: { rows: ChartRow[] }) {
  const weekly = useMemo(() => {
    const cutoff = Date.now() - 12 * 7 * 24 * 60 * 60 * 1000;
    const buckets = new Map<string, number>();
    // seed last 12 week labels in order
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      buckets.set(weekKey(d), 0);
    }
    rows.forEach((r) => {
      const t = new Date(r.submitted_at).getTime();
      if (t < cutoff) return;
      const k = weekKey(new Date(r.submitted_at));
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + 1);
    });
    return Array.from(buckets.entries()).map(([week, count]) => ({ week: week.slice(5), count }));
  }, [rows]);

  const ratings = useMemo(() => {
    const counts = [1, 2, 3, 4, 5].map((n) => ({
      rating: String(n),
      count: rows.filter((r) => r.overall_rating === n).length,
      colour: RATING_COLOURS[n],
    }));
    return counts;
  }, [rows]);

  const recommendations = useMemo(() => {
    const items = ["yes", "unsure", "no"].map((k) => ({
      name: k === "yes" ? "Yes" : k === "unsure" ? "Unsure" : "No",
      value: rows.filter((r) => r.would_recommend === k).length,
      colour: REC_COLOURS[k],
    }));
    return items.filter((i) => i.value > 0);
  }, [rows]);

  const channels = useMemo(() => {
    const items = [
      { name: "Web", value: rows.filter((r) => r.channel === "web").length, colour: CHANNEL_COLOURS.web },
      { name: "Phone", value: rows.filter((r) => r.channel === "telephony").length, colour: CHANNEL_COLOURS.telephony },
      { name: "Paper", value: rows.filter((r) => r.channel === "paper").length, colour: CHANNEL_COLOURS.paper },
    ];
    return items.filter((i) => i.value > 0);
  }, [rows]);

  const practices = useMemo(() => {
    const map = new Map<string, { count: number; sum: number; n: number }>();
    rows.forEach((r) => {
      const p = practiceLabel(r);
      if (p === "—") return;
      const cur = map.get(p) || { count: 0, sum: 0, n: 0 };
      cur.count++;
      if (r.overall_rating != null) { cur.sum += r.overall_rating; cur.n++; }
      map.set(p, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, count: v.count, avg: v.n ? +(v.sum / v.n).toFixed(2) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [rows]);

  const hasData = rows.length > 0;
  if (!hasData) return null;

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Submissions — last 12 weeks</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Overall rating distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ratings}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {ratings.map((r, i) => <Cell key={i} fill={r.colour} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Would recommend</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={recommendations} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {recommendations.map((r, i) => <Cell key={i} fill={r.colour} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Channel mix</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={channels} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {channels.map((r, i) => <Cell key={i} fill={r.colour} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {practices.length > 0 && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Top practices — average rating</div>
          <ResponsiveContainer width="100%" height={Math.max(140, practices.length * 28)}>
            <BarChart data={practices} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
              <Tooltip formatter={(v: any, _n, p: any) => [`${v} / 5 (n=${p.payload.count})`, "Average"]} />
              <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                {practices.map((p, i) => (
                  <Cell key={i} fill={p.avg >= 4 ? "#2A9D8F" : p.avg >= 3 ? "#ED8B00" : "#E76F51"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
