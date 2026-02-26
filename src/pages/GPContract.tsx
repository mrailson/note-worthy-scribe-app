import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GPContract = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    const iframe = document.getElementById('gp-contract-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/documents/gp-contract-2627.html';
    link.download = 'gp-contract-2626-27-infographic.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-lg font-semibold flex-1">GP Contract 2026/27 Update</h1>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Print</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>
      <iframe
        id="gp-contract-iframe"
        src="/documents/gp-contract-2627.html"
        className="flex-1 w-full border-0"
        title="GP Contract 2026/27 Infographic"
      />
    </div>
  );
};

export default GPContract;
