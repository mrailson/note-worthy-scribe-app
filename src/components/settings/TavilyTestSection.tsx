import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink, Loader2, Search, Wrench } from "lucide-react";

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export const TavilyTestSection = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error("VITE_TAVILY_API_KEY is not set. Add it as a build secret or VITE_ environment variable.");
      }

      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: "NHS primary care news",
          max_results: 3,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Tavily API returned ${res.status}: ${text}`);
      }

      const data = await res.json();
      const items: SearchResult[] = (data.results || []).slice(0, 3).map((r: any) => ({
        title: r.title || "Untitled",
        url: r.url || "",
        content: r.content?.substring(0, 160) || "",
      }));

      setResults(items);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="hidden sm:block">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-2 font-semibold">
              <Wrench className="h-5 w-5" />
              Developer Tools
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Test the Tavily web search API connection used for real-time search features.
              </p>
              <Button onClick={runTest} disabled={loading} variant="outline" className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Searching…" : "Test Web Search"}
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-sm text-destructive/90 mt-1 break-all">{error}</p>
              </div>
            )}

            {results && results.length === 0 && (
              <p className="text-sm text-muted-foreground">No results returned.</p>
            )}

            {results && results.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  ✅ {results.length} result{results.length !== 1 ? "s" : ""} returned
                </p>
                {results.map((r, i) => (
                  <Card key={i} className="p-4 space-y-1">
                    <h4 className="text-sm font-semibold leading-tight">{r.title}</h4>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {r.url} <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-xs text-muted-foreground">{r.content}</p>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
