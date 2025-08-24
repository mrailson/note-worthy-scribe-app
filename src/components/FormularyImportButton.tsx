import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2 } from "lucide-react";
import { importFormularySeedData, FORMULARY_SEED_DATA } from "@/utils/importFormularySeed";

export function FormularyImportButton() {
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await importFormularySeedData(FORMULARY_SEED_DATA);
      
      toast({
        title: "Import Successful",
        description: `Successfully imported ${result.imported_count} formulary items`,
      });
      
      console.log("Import result:", result);
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      onClick={handleImport}
      disabled={isImporting}
      className="flex items-center gap-2"
    >
      {isImporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Importing...
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" />
          Import ICB Formulary Seed Data ({FORMULARY_SEED_DATA.length} items)
        </>
      )}
    </Button>
  );
}