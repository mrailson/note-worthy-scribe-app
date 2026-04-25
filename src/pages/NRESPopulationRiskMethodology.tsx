import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft } from "lucide-react";
import { NRESHeader } from "@/components/nres/NRESHeader";
import { NarpGlossaryModal } from "@/components/nres/NarpGlossaryModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { methodologySections } from "@/lib/narp-reference";

const NRESPopulationRiskMethodology = () => {
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const jumpTo = (id: string) => {
    window.location.hash = id;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground methodology-print-page">
      <div className="print:hidden">
        <NRESHeader activeTab="population-risk" />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[220px_minmax(0,760px)]">
        <aside className="print:hidden lg:sticky lg:top-4 lg:self-start">
          <Link to="/nres/population-risk" className="mb-4 inline-flex items-center text-sm font-medium text-primary underline underline-offset-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Population Risk
          </Link>
          <div className="lg:hidden mb-4">
            <Select onValueChange={jumpTo}>
              <SelectTrigger>
                <SelectValue placeholder="Jump to section" />
              </SelectTrigger>
              <SelectContent>
                {methodologySections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav aria-label="Methodology sections" className="hidden lg:block rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-4 w-4" /> Sections
            </div>
            <ol className="space-y-1 text-sm">
              {methodologySections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <main className="max-w-[760px] print:max-w-none">
          <header className="mb-8 border-b pb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">NRES Population Risk</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">About the Data</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Methodology, interpretation notes, and governance reference for NARP / ACG-based risk stratification.
            </p>
            <Button variant="outline" size="sm" className="mt-4 print:hidden" onClick={() => setGlossaryOpen(true)}>
              Glossary
            </Button>
          </header>

          <div className="space-y-10">
            {methodologySections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-6 break-inside-avoid">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{index + 1}. {section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-foreground/90">
                  {section.blocks.map((block, blockIndex) => {
                    if (block.type === "p") return <p key={blockIndex}>{block.text}</p>;
                    if (block.type === "list") {
                      return (
                        <ul key={blockIndex} className="space-y-2 pl-5">
                          {block.items.map((item) => <li key={item} className="list-disc">{item}</li>)}
                        </ul>
                      );
                    }
                    return (
                      <div key={blockIndex} className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <tbody>
                            {block.rows.map(([left, right]) => (
                              <tr key={`${left}-${right}`} className="border-b">
                                <td className="w-1/3 py-2 pr-4 font-semibold tabular-nums">{left}</td>
                                <td className="py-2 text-muted-foreground">{right}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
      <NarpGlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />
      <style>{`
        @media print {
          @page { margin: 18mm; }
          .methodology-print-page { background: white !important; color: black !important; }
          .methodology-print-page section { page-break-inside: avoid; margin-bottom: 18pt; }
          .methodology-print-page a { color: black !important; text-decoration: none !important; }
          .methodology-print-page h1, .methodology-print-page h2 { page-break-after: avoid; }
          .methodology-print-page table { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default NRESPopulationRiskMethodology;
