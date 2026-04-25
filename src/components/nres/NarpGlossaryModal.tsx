import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { glossaryEntries, METHODOLOGY_PATH } from "@/lib/narp-reference";

interface NarpGlossaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NarpGlossaryModal = ({ open, onOpenChange }: NarpGlossaryModalProps) => {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return glossaryEntries;
    return glossaryEntries.filter((entry) =>
      entry.term.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[calc(100vh-2rem)]">
        <DialogHeader>
          <DialogTitle>NARP glossary</DialogTitle>
          <DialogDescription>Quick-reference definitions for the Population Risk dashboard.</DialogDescription>
        </DialogHeader>
        <div className="px-8 sm:px-10 pt-4 pb-6 overflow-y-auto">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter glossary"
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((entry) => (
              <article key={entry.term} className="border-b pb-3">
                <h3 className="font-semibold text-sm text-foreground">{entry.term}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{entry.text}</p>
                <Link
                  to={`${METHODOLOGY_PATH}#${entry.anchor}`}
                  onClick={() => onOpenChange(false)}
                  className="mt-2 inline-flex text-xs font-medium text-primary underline underline-offset-2"
                >
                  Full detail
                </Link>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">No glossary entries match that filter.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
