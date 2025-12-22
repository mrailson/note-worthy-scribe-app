import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const documents = [
  { title: "PPT: Introduction", type: "presentation" },
  { title: "PPT: Planning Assump.", type: "presentation" },
  { title: "PPT: Model Matrix", type: "presentation" },
  { title: "PPT: Staffing WTE", type: "presentation" },
  { title: "PPT: Deep Dive", type: "presentation" },
  { title: "Estate Audit Summary", type: "document" },
  { title: "GP Connect Evidence Pack", type: "document" },
  { title: "Data Sharing Agreement", type: "legal" },
  { title: "Governance Framework ToR", type: "legal" },
  { title: "Innovation Budget Breakdown", type: "finance" },
  { title: "VCSE Partner Mapping", type: "document" },
  { title: "Seasonality Analysis", type: "analysis" },
];

const getTypeColor = (type: string) => {
  switch (type) {
    case "presentation": return "bg-blue-100 text-blue-700";
    case "document": return "bg-slate-100 text-slate-700";
    case "legal": return "bg-purple-100 text-purple-700";
    case "finance": return "bg-green-100 text-green-700";
    case "analysis": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

export const SDAEvidenceLibrary = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Evidence Library</h2>
        <p className="text-slate-600 mt-1">
          Supporting documentation and evidence for the SDA Programme
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {documents.map((doc, index) => (
          <Card key={index} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeColor(doc.type)}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm group-hover:text-[#005EB8] transition-colors">
                      {doc.title}
                    </p>
                    <p className="text-xs text-slate-500 capitalize mt-0.5">{doc.type}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Download className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <Card className="bg-blue-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#005EB8]">5</p>
            <p className="text-sm text-slate-600">Presentations</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-slate-700">4</p>
            <p className="text-sm text-slate-600">Documents</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-700">2</p>
            <p className="text-sm text-slate-600">Legal</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-0">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-700">1</p>
            <p className="text-sm text-slate-600">Finance</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
